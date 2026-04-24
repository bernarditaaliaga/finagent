import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * GET /api/savings-plan
 * Obtiene el plan activo más reciente
 */
export async function GET() {
  const plan = await prisma.savingsPlan.findFirst({
    where: { isActive: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      budgets: {
        include: { category: true },
      },
    },
  });
  return NextResponse.json(plan);
}

/**
 * POST /api/savings-plan
 * Genera un plan de ahorro inteligente usando Claude API
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const savingsTarget = body.savingsTarget;
    const userInstructions = (body.userInstructions as string) || "";
    const chatHistory = (body.chatHistory as { role: string; content: string }[]) || [];

    if (!savingsTarget || savingsTarget <= 0) {
      return NextResponse.json(
        { error: "Debes indicar cuánto quieres ahorrar" },
        { status: 400 }
      );
    }

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 1);

    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    // Historial últimos 3 meses para promedios
    const threeMonthsAgo = new Date(currentYear, currentMonth - 4, 1);

    const [
      categories,
      fixedExpenses,
      thisMonthTxns,
      bankAccounts,
      ccExpenses,
      historicalTxns,
    ] = await Promise.all([
      prisma.category.findMany({
        include: {
          transactions: {
            where: { date: { gte: startOfMonth, lt: endOfMonth } },
            select: { amount: true },
          },
        },
      }),
      prisma.fixedExpense.findMany({ where: { isActive: true } }),
      prisma.transaction.findMany({
        where: { date: { gte: startOfMonth, lt: endOfMonth } },
        select: { amount: true, description: true, date: true, categoryId: true },
      }),
      prisma.bankAccount.findMany(),
      prisma.creditCardExpense.findMany({
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: threeMonthsAgo, lt: startOfMonth } },
        select: { amount: true, categoryId: true, date: true },
      }),
    ]);

    // === INGRESOS Y GASTOS FIJOS ===
    const fixedIncomes = fixedExpenses.filter((e) => e.type === "income");
    const fixedCosts = fixedExpenses.filter((e) => e.type !== "income");
    const totalFixedIncome = fixedIncomes.reduce((sum, e) => sum + e.amount, 0);
    const totalFixedExpenses = fixedCosts.reduce((sum, e) => sum + e.amount, 0);

    // === PENDIENTES vs PAGADOS (usando lastPaidAt) ===
    const startISO = startOfMonth.toISOString();
    const endISO = endOfMonth.toISOString();

    const isPaidThisMonth = (e: { lastPaidAt: Date | null }) =>
      e.lastPaidAt &&
      e.lastPaidAt.toISOString() >= startISO &&
      e.lastPaidAt.toISOString() < endISO;

    const pendingFixedExpenses = fixedCosts.filter((e) => !isPaidThisMonth(e));
    const paidFixedExpenses = fixedCosts.filter((e) => isPaidThisMonth(e));
    const pendingFixedIncome = fixedIncomes.filter((e) => !isPaidThisMonth(e));
    const paidFixedIncome = fixedIncomes.filter((e) => isPaidThisMonth(e));

    const totalPendingExpenses = pendingFixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaidExpenses = paidFixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPendingIncome = pendingFixedIncome.reduce((sum, e) => sum + e.amount, 0);
    const totalPaidIncome = paidFixedIncome.reduce((sum, e) => sum + e.amount, 0);

    // Gastos variables ya realizados
    const spentSoFar = thisMonthTxns
      .filter((t) => {
        const d = t.description.toLowerCase();
        return t.amount < 0 && !d.includes("linea de credito") && !d.includes("linea de cred");
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // === CUOTAS TC ===
    const ccCuotasThisMonth = ccExpenses
      .filter((exp) => {
        const start = exp.billingStartYear * 12 + exp.billingStartMonth;
        const end = start + exp.installments - 1;
        const target = currentYear * 12 + currentMonth;
        return target >= start && target <= end;
      })
      .reduce((sum, exp) => sum + exp.installmentAmount, 0);

    const ccCuotasNextMonth = ccExpenses
      .filter((exp) => {
        const start = exp.billingStartYear * 12 + exp.billingStartMonth;
        const end = start + exp.installments - 1;
        const target = nextYear * 12 + nextMonth;
        return target >= start && target <= end;
      })
      .reduce((sum, exp) => sum + exp.installmentAmount, 0);

    const ccDetailThisMonth = ccExpenses
      .filter((exp) => {
        const start = exp.billingStartYear * 12 + exp.billingStartMonth;
        const end = start + exp.installments - 1;
        return currentYear * 12 + currentMonth >= start && currentYear * 12 + currentMonth <= end;
      })
      .map((exp) => ({
        description: exp.description,
        cuota: exp.installmentAmount,
        category: exp.category?.name ?? "Sin categoría",
      }));

    const ccDetailNextMonth = ccExpenses
      .filter((exp) => {
        const start = exp.billingStartYear * 12 + exp.billingStartMonth;
        const end = start + exp.installments - 1;
        return nextYear * 12 + nextMonth >= start && nextYear * 12 + nextMonth <= end;
      })
      .map((exp) => ({
        description: exp.description,
        cuota: exp.installmentAmount,
        category: exp.category?.name ?? "Sin categoría",
      }));

    // Saldo actual (excluyendo línea de crédito)
    const saldoActual = bankAccounts
      .filter((a) => a.type !== "line_of_credit")
      .reduce((sum, a) => sum + a.available, 0);

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;

    // === ANÁLISIS POR CATEGORÍA (excluir categorías de gastos fijos, ya contados arriba) ===
    const fixedCategoryIds = new Set(
      fixedExpenses.map((e) => e.categoryId).filter(Boolean) as string[]
    );

    const categoryInfo = categories.filter((cat) => !fixedCategoryIds.has(cat.id) && cat.frequency !== "ocasional").map((cat) => {
      const currentSpent = cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const historicalForCat = historicalTxns.filter((t) => t.categoryId === cat.id);
      const monthsWithData = new Set(
        historicalForCat.map((t) => `${t.date.getFullYear()}-${t.date.getMonth()}`)
      ).size;
      const historicalTotal = historicalForCat.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const avgMonthly = monthsWithData > 0 ? Math.round(historicalTotal / monthsWithData) : 0;

      return {
        id: cat.id,
        name: cat.name,
        priority: cat.priority ?? "sin etiqueta",
        budgetLimit: cat.budgetLimit,
        currentSpent,
        avgMonthly,
      };
    });

    const planContext = {
      savingsTarget,
      totalFixedIncome,
      totalFixedExpenses,
      totalPendingExpenses,
      totalPaidExpenses,
      totalPendingIncome,
      totalPaidIncome,
      ccCuotasThisMonth,
      ccCuotasNextMonth,
      ccDetailThisMonth,
      ccDetailNextMonth,
      spentSoFar,
      saldoActual,
      currentDay,
      daysRemaining,
      currentMonth,
      currentYear,
      nextMonth,
      nextYear,
      categoryInfo,
      fixedIncomes: fixedIncomes.map((e) => ({ name: e.name, amount: e.amount, paid: !!isPaidThisMonth(e) })),
      fixedCosts: fixedCosts.map((e) => ({ name: e.name, amount: e.amount, paid: !!isPaidThisMonth(e), dayOfMonth: e.dayOfMonth })),
      pendingFixedExpenses: pendingFixedExpenses.map((e) => ({ name: e.name, amount: e.amount, dayOfMonth: e.dayOfMonth })),
      paidFixedExpenses: paidFixedExpenses.map((e) => ({ name: e.name, amount: e.amount })),
    };

    // === CALL CLAUDE ===
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes("tu_key_aqui")) {
      return generateBasicPlan(planContext);
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `Eres un asesor financiero personal chileno experto. Analiza la situación financiera y genera un plan de ahorro realista.

HOY: ${currentDay} de ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
Quedan ${daysRemaining} días del mes.

═══ SITUACIÓN FINANCIERA ACTUAL ═══

SALDO EN CUENTA HOY: $${saldoActual.toLocaleString("es-CL")}
(Este saldo YA refleja ingresos recibidos y gastos pagados)

INGRESOS FIJOS MENSUALES:
${fixedIncomes.map((e) => `- ${e.name}: $${e.amount.toLocaleString("es-CL")} [${isPaidThisMonth(e) ? "YA RECIBIDO este mes" : "PENDIENTE de recibir"}]`).join("\n")}
Total: $${totalFixedIncome.toLocaleString("es-CL")} | Recibido: $${totalPaidIncome.toLocaleString("es-CL")} | Pendiente: $${totalPendingIncome.toLocaleString("es-CL")}

GASTOS FIJOS MENSUALES:
${fixedCosts.map((e) => `- ${e.name}${e.dayOfMonth ? ` (día ${e.dayOfMonth})` : ""}: $${e.amount.toLocaleString("es-CL")} [${isPaidThisMonth(e) ? "YA PAGADO" : "PENDIENTE"}]`).join("\n")}
Total: $${totalFixedExpenses.toLocaleString("es-CL")} | Pagado: $${totalPaidExpenses.toLocaleString("es-CL")} | Pendiente: $${totalPendingExpenses.toLocaleString("es-CL")}

TARJETA DE CRÉDITO:
- Cuotas este mes: $${ccCuotasThisMonth.toLocaleString("es-CL")}${ccDetailThisMonth.length > 0 ? `\n  (${ccDetailThisMonth.map((c) => `${c.description}: $${c.cuota.toLocaleString("es-CL")}`).join(", ")})` : ""}
- Cuotas próximo mes: $${ccCuotasNextMonth.toLocaleString("es-CL")}${ccDetailNextMonth.length > 0 ? `\n  (${ccDetailNextMonth.map((c) => `${c.description}: $${c.cuota.toLocaleString("es-CL")}`).join(", ")})` : ""}

GASTOS VARIABLES YA REALIZADOS ESTE MES: $${spentSoFar.toLocaleString("es-CL")}

═══ GASTOS VARIABLES POR CATEGORÍA (promedio mensual y prioridad) ═══
(NOTA: estas categorías son SOLO gastos variables. Los gastos fijos ya están contados arriba y NO aparecen aquí. No los cuentes dos veces.)
${categoryInfo.filter((c) => c.avgMonthly > 0 || c.currentSpent > 0).map((c) => `- ${c.name} [${c.priority}]: promedio mensual $${c.avgMonthly.toLocaleString("es-CL")}, este mes $${c.currentSpent.toLocaleString("es-CL")}`).join("\n")}

═══ PRIORIDADES (qué tan reducible es cada categoría) ═══
IMPORTANTE: Los recortes deben ser REALISTAS. Usa el promedio mensual como referencia.
Contexto: estamos en Chile, la bencina es cara (~$1.200/litro), la comida es cara, etc.
No sugieras montos irreales — si alguien gasta $100.000 en bencina, no puede gastar $35.000.

- "esencial": casi intocable, máximo 5% de reducción
- "necesario": reducción conservadora, máximo 10-15% del promedio
- "prescindible": reducción moderada, máximo 15-25% del promedio
- "innecesario": se puede recortar fuerte, 30-50% del promedio
- Los gastos fijos NO son negociables, van aparte
- El límite sugerido NUNCA debe ser menor al 60% del promedio histórico

META DE AHORRO DEL USUARIO: $${savingsTarget.toLocaleString("es-CL")} mensuales

═══ INSTRUCCIONES ═══

1. ANÁLISIS MES ACTUAL (${MONTH_NAMES[currentMonth - 1]}):
   Calcula: saldo actual ($${saldoActual.toLocaleString("es-CL")})
   + ingresos pendientes por recibir ($${totalPendingIncome.toLocaleString("es-CL")})
   - gastos fijos pendientes ($${totalPendingExpenses.toLocaleString("es-CL")})
   - cuotas TC pendientes ($${ccCuotasThisMonth.toLocaleString("es-CL")})
   = disponible real
   NOTA: los ingresos/gastos YA pagados están reflejados en el saldo, NO los sumes/restes de nuevo.

   Luego mira cuánto queda para gastos variables + ahorro. ¿Es realista ahorrar la meta este mes considerando los promedios de gasto variable?

2. ANÁLISIS PRÓXIMO MES (${MONTH_NAMES[nextMonth - 1]}):
   Calcula: ingresos fijos totales ($${totalFixedIncome.toLocaleString("es-CL")})
   - gastos fijos totales ($${totalFixedExpenses.toLocaleString("es-CL")})
   - cuotas TC ($${ccCuotasNextMonth.toLocaleString("es-CL")})
   = disponible para gastos variables + ahorro

   ¿Es viable ahorrar la meta si se ajustan los gastos por categoría según su prioridad?

3. PRESUPUESTOS SUGERIDOS: Para cada categoría con gasto, sugiere un límite mensual realista basado en:
   - Su promedio histórico
   - Su prioridad (esencial casi no se toca, innecesario se recorta fuerte)
   - Lo que se necesita recortar para alcanzar la meta

Responde EXACTAMENTE en JSON:
{
  "reasoning": "Análisis detallado en español (3-5 párrafos). Explica tu razonamiento paso a paso con números. Incluye: 1) cómo calculaste el disponible real para este mes, 2) si es viable o no y por qué, 3) análisis del próximo mes, 4) qué categorías se pueden recortar y cuánto, 5) tu recomendación final.",
  "thisMonthFeasible": true/false,
  "nextMonthFeasible": true/false,
  "neverFeasible": true/false,
  "suggestedTarget": null o número más realista si neverFeasible,
  "startMonth": ${currentMonth} o ${nextMonth},
  "startYear": ${currentMonth === 12 ? nextYear : currentYear},
  "startReason": "Frase corta explicando por qué se eligió este mes de inicio",
  "budgets": [
    { "categoryId": "id", "categoryName": "nombre", "budgetAmount": número, "recommendation": "por qué este monto" }
  ]
}

Solo JSON válido, sin texto adicional fuera del JSON.${userInstructions ? `\n\n═══ INDICACIONES ADICIONALES DEL USUARIO ═══\n${userInstructions}` : ""}`;

    try {
      // Construir mensajes: prompt base + historial de chat
      const messages: { role: "user" | "assistant"; content: string }[] = [
        { role: "user", content: prompt },
      ];

      // Si hay historial de conversación previo, agregarlo
      for (const msg of chatHistory) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        messages,
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      // Intentar parsear JSON, con fallback para bloques markdown
      let planData;
      try {
        planData = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error("No se pudo parsear la respuesta de la IA");
        }
      }

      return NextResponse.json({
        ...planData,
        totalFixedIncome,
        fixedExpenses: totalFixedExpenses,
        pendingExpenses: totalPendingExpenses,
        paidExpenses: totalPaidExpenses,
        pendingIncome: totalPendingIncome,
        paidIncome: totalPaidIncome,
        ccCuotasThisMonth,
        ccCuotasNextMonth,
        spentSoFar,
        saldoActual,
        savingsTarget,
        currentDay,
        daysRemaining,
        currentMonth,
        currentYear,
        nextMonth,
        nextYear,
      });
    } catch (aiError) {
      console.error("Claude API error, usando plan básico:", aiError);
      return generateBasicPlan(planContext);
    }
  } catch (error) {
    console.error("Error generando plan:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/savings-plan
 * Acepta y guarda el plan
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { month, year, savingsTarget, totalFixedIncome, fixedExpenses, budgets, reasoning } = body;

    const plan = await prisma.savingsPlan.upsert({
      where: { month_year: { month, year } },
      update: {
        savingsTarget,
        totalIncome: totalFixedIncome ?? 0,
        totalFixed: fixedExpenses ?? 0,
        reasoning: reasoning ?? null,
        isActive: true,
      },
      create: {
        month,
        year,
        savingsTarget,
        totalIncome: totalFixedIncome ?? 0,
        totalFixed: fixedExpenses ?? 0,
        reasoning: reasoning ?? null,
        isActive: true,
      },
    });

    // Reemplazar budgets
    await prisma.categoryBudget.deleteMany({ where: { planId: plan.id } });

    for (const b of budgets) {
      if (!b.categoryId) continue;
      await prisma.categoryBudget.create({
        data: {
          planId: plan.id,
          categoryId: b.categoryId,
          budgetAmount: b.budgetAmount,
        },
      });
    }

    // Aplicar budgetLimit en cada categoría
    for (const b of budgets) {
      if (!b.categoryId) continue;
      await prisma.category.update({
        where: { id: b.categoryId },
        data: { budgetLimit: b.budgetAmount },
      });
    }

    return NextResponse.json({ success: true, planId: plan.id });
  } catch (error) {
    console.error("Error guardando plan:", error);
    return NextResponse.json({ error: "Error al guardar plan" }, { status: 500 });
  }
}

/**
 * PATCH /api/savings-plan
 * Activar/desactivar plan
 */
export async function PATCH(request: Request) {
  try {
    const { planId, isActive } = await request.json();

    await prisma.savingsPlan.update({
      where: { id: planId },
      data: { isActive },
    });

    const budgets = await prisma.categoryBudget.findMany({ where: { planId } });

    if (isActive) {
      // Reactivar: aplicar budgetLimits
      for (const b of budgets) {
        await prisma.category.update({
          where: { id: b.categoryId },
          data: { budgetLimit: b.budgetAmount },
        });
      }
    } else {
      // Desactivar: limpiar budgetLimits
      for (const b of budgets) {
        await prisma.category.update({
          where: { id: b.categoryId },
          data: { budgetLimit: null },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error toggling plan:", error);
    return NextResponse.json({ error: "Error al cambiar estado del plan" }, { status: 500 });
  }
}

/**
 * DELETE /api/savings-plan
 * Eliminar plan y limpiar budgetLimits
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");
    if (!planId) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Limpiar budgetLimits antes de borrar
    const budgets = await prisma.categoryBudget.findMany({ where: { planId } });
    for (const b of budgets) {
      await prisma.category.update({
        where: { id: b.categoryId },
        data: { budgetLimit: null },
      });
    }

    // Cascade delete borra CategoryBudgets
    await prisma.savingsPlan.delete({ where: { id: planId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando plan:", error);
    return NextResponse.json({ error: "Error al eliminar plan" }, { status: 500 });
  }
}

// ===== PLAN BÁSICO SIN CLAUDE =====
function generateBasicPlan(ctx: {
  savingsTarget: number;
  totalFixedIncome: number;
  totalFixedExpenses: number;
  totalPendingExpenses: number;
  totalPaidExpenses: number;
  totalPendingIncome: number;
  totalPaidIncome: number;
  ccCuotasThisMonth: number;
  ccCuotasNextMonth: number;
  ccDetailThisMonth: { description: string; cuota: number; category: string }[];
  ccDetailNextMonth: { description: string; cuota: number; category: string }[];
  spentSoFar: number;
  saldoActual: number;
  currentDay: number;
  daysRemaining: number;
  currentMonth: number;
  currentYear: number;
  nextMonth: number;
  nextYear: number;
  categoryInfo: { id: string; name: string; priority: string; budgetLimit: number | null; currentSpent: number; avgMonthly: number }[];
  fixedIncomes: { name: string; amount: number; paid: boolean }[];
  fixedCosts: { name: string; amount: number; paid: boolean; dayOfMonth: number | null }[];
  pendingFixedExpenses: { name: string; amount: number; dayOfMonth: number | null }[];
  paidFixedExpenses: { name: string; amount: number }[];
}) {
  const {
    savingsTarget, totalFixedIncome, totalFixedExpenses,
    totalPendingExpenses, totalPendingIncome,
    ccCuotasThisMonth, ccCuotasNextMonth,
    spentSoFar, saldoActual, currentDay, daysRemaining,
    currentMonth, currentYear, nextMonth, nextYear, categoryInfo,
  } = ctx;

  // === MES ACTUAL ===
  // Disponible = saldo + ingresos pendientes - gastos fijos pendientes - cuotas TC
  const availableThisMonth = saldoActual + totalPendingIncome - totalPendingExpenses - ccCuotasThisMonth;
  const thisMonthFeasible = availableThisMonth >= savingsTarget * 1.2 && currentDay <= 25;

  // === PRÓXIMO MES ===
  const nextMonthDisponible = totalFixedIncome - totalFixedExpenses - ccCuotasNextMonth;
  const totalAvgVariable = categoryInfo.reduce((sum, c) => sum + c.avgMonthly, 0);
  const nextMonthAfterVariable = nextMonthDisponible - totalAvgVariable;
  const nextMonthFeasible = nextMonthDisponible > savingsTarget;
  const neverFeasible = nextMonthDisponible <= 0 || savingsTarget > nextMonthDisponible * 0.8;

  // === PRESUPUESTOS ===
  const availableForVariable = (thisMonthFeasible ? availableThisMonth : nextMonthDisponible) - savingsTarget;
  const priorityOrder = ["innecesario", "prescindible", "sin etiqueta", "necesario", "esencial"];
  const sorted = [...categoryInfo].sort((a, b) =>
    priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
  );

  const totalAvgSpending = sorted.reduce((sum, c) => sum + c.avgMonthly, 0);
  const reductionNeeded = Math.max(0, totalAvgSpending - Math.max(0, availableForVariable));

  let remainingCut = reductionNeeded;
  const budgetMap = new Map<string, { budgetAmount: number; recommendation: string }>();

  for (const cat of sorted) {
    const baseAmount = cat.avgMonthly || cat.currentSpent || (cat.budgetLimit ?? 0);
    let budget = baseAmount;
    let recommendation = "";

    if (cat.priority === "esencial") {
      recommendation = "Gasto esencial, no se recorta";
    } else if (remainingCut > 0 && budget > 0) {
      const cutPercent = cat.priority === "innecesario" ? 0.4
        : cat.priority === "prescindible" ? 0.2
        : cat.priority === "necesario" ? 0.12
        : cat.priority === "esencial" ? 0.05
        : 0.15;
      const cut = Math.min(budget * cutPercent, remainingCut);
      budget -= cut;
      remainingCut -= cut;

      if (cut > 0) {
        const label = cat.priority === "innecesario" ? "eliminable"
          : cat.priority === "prescindible" ? "reducible"
          : "ajustable";
        recommendation = `Gasto ${label}: recortado $${Math.round(cut).toLocaleString("es-CL")} (de $${baseAmount.toLocaleString("es-CL")} a $${Math.round(budget).toLocaleString("es-CL")})`;
      } else {
        recommendation = "Sin recorte necesario";
      }
    } else {
      recommendation = "Sin recorte necesario";
    }

    budgetMap.set(cat.id, { budgetAmount: Math.round(budget), recommendation });
  }

  const budgets = categoryInfo.map((cat) => {
    const b = budgetMap.get(cat.id) ?? { budgetAmount: cat.avgMonthly, recommendation: "" };
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      budgetAmount: b.budgetAmount,
      recommendation: b.recommendation,
    };
  });

  // === REASONING ===
  let reasoning: string;
  const startMonth = thisMonthFeasible ? currentMonth : nextMonth;
  const startYear = thisMonthFeasible ? currentYear : (currentMonth === 12 ? nextYear : currentYear);
  let startReason: string;

  if (neverFeasible) {
    reasoning = `Con ingresos fijos de $${totalFixedIncome.toLocaleString("es-CL")} y gastos fijos de $${totalFixedExpenses.toLocaleString("es-CL")} más cuotas TC, el margen disponible ($${nextMonthDisponible.toLocaleString("es-CL")}) no permite ahorrar $${savingsTarget.toLocaleString("es-CL")} al mes. Se sugiere una meta más conservadora.`;
    startReason = "No es viable con los ingresos y gastos actuales";
  } else if (!thisMonthFeasible) {
    reasoning = `Para ${MONTH_NAMES[currentMonth - 1]}: el saldo actual es $${saldoActual.toLocaleString("es-CL")}. Restando gastos fijos pendientes ($${totalPendingExpenses.toLocaleString("es-CL")}) y cuotas TC ($${ccCuotasThisMonth.toLocaleString("es-CL")}), quedan $${Math.round(availableThisMonth).toLocaleString("es-CL")} disponibles, lo que no alcanza o es muy justo para ahorrar $${savingsTarget.toLocaleString("es-CL")} y cubrir gastos variables.\n\nPara ${MONTH_NAMES[nextMonth - 1]}: con ingresos fijos ($${totalFixedIncome.toLocaleString("es-CL")}) menos gastos fijos ($${totalFixedExpenses.toLocaleString("es-CL")}) menos TC ($${ccCuotasNextMonth.toLocaleString("es-CL")}), quedan $${nextMonthDisponible.toLocaleString("es-CL")}. Ahorrando $${savingsTarget.toLocaleString("es-CL")}, quedan $${Math.round(availableForVariable).toLocaleString("es-CL")} para gastos variables. Se ajustaron las categorías según su prioridad.`;
    startReason = `El saldo actual no permite empezar en ${MONTH_NAMES[currentMonth - 1]}`;
  } else {
    reasoning = `Para ${MONTH_NAMES[currentMonth - 1]}: el saldo actual ($${saldoActual.toLocaleString("es-CL")}) más ingresos pendientes ($${totalPendingIncome.toLocaleString("es-CL")}) menos gastos pendientes ($${totalPendingExpenses.toLocaleString("es-CL")}) y cuotas TC ($${ccCuotasThisMonth.toLocaleString("es-CL")}) da $${Math.round(availableThisMonth).toLocaleString("es-CL")} disponibles. Es viable ahorrar $${savingsTarget.toLocaleString("es-CL")} ajustando los gastos variables según su prioridad.`;
    startReason = "El saldo actual permite comenzar este mes";
  }

  return NextResponse.json({
    reasoning,
    thisMonthFeasible,
    nextMonthFeasible,
    neverFeasible,
    suggestedTarget: neverFeasible ? Math.max(0, Math.floor(nextMonthDisponible * 0.5)) : null,
    startMonth,
    startYear,
    startReason,
    budgets,
    totalFixedIncome,
    fixedExpenses: totalFixedExpenses,
    pendingExpenses: totalPendingExpenses,
    paidExpenses: ctx.totalPaidExpenses,
    pendingIncome: totalPendingIncome,
    paidIncome: ctx.totalPaidIncome,
    ccCuotasThisMonth,
    ccCuotasNextMonth,
    spentSoFar,
    saldoActual,
    savingsTarget,
    currentDay,
    daysRemaining,
    currentMonth,
    currentYear,
    nextMonth,
    nextYear,
  });
}
