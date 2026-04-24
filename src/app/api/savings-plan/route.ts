import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * GET /api/savings-plan
 * Obtiene el plan activo del mes actual
 */
export async function GET() {
  const now = new Date();
  const plan = await prisma.savingsPlan.findUnique({
    where: { month_year: { month: now.getMonth() + 1, year: now.getFullYear() } },
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
 * Analiza gastos fijos pendientes, cuotas TC, y gastos por categoría con prioridades
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const savingsTarget = body.savingsTarget;

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

    // Fetch historical data (last 3 months) for average category spending
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
      // Historical: last 3 months of transactions for averages
      prisma.transaction.findMany({
        where: { date: { gte: threeMonthsAgo, lt: startOfMonth } },
        select: { amount: true, categoryId: true, date: true },
      }),
    ]);

    // === INGRESOS FIJOS (from fixedExpenses, not from transactions) ===
    const fixedIncomes = fixedExpenses.filter((e) => e.type === "income");
    const fixedCosts = fixedExpenses.filter((e) => e.type !== "income");
    const totalFixedIncome = fixedIncomes.reduce((sum, e) => sum + e.amount, 0);
    const totalFixedExpenses = fixedCosts.reduce((sum, e) => sum + e.amount, 0);

    // === THIS MONTH: pending fixed expenses/incomes ===
    const startISO = startOfMonth.toISOString();
    const endISO = endOfMonth.toISOString();

    const pendingFixedExpenses = fixedCosts.filter((e) => {
      const paid = e.lastPaidAt &&
        e.lastPaidAt.toISOString() >= startISO &&
        e.lastPaidAt.toISOString() < endISO;
      return !paid;
    });
    const paidFixedExpenses = fixedCosts.filter((e) => {
      const paid = e.lastPaidAt &&
        e.lastPaidAt.toISOString() >= startISO &&
        e.lastPaidAt.toISOString() < endISO;
      return paid;
    });
    const pendingFixedIncome = fixedIncomes.filter((e) => {
      const paid = e.lastPaidAt &&
        e.lastPaidAt.toISOString() >= startISO &&
        e.lastPaidAt.toISOString() < endISO;
      return !paid;
    });

    const totalPendingExpenses = pendingFixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaidExpenses = paidFixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPendingIncome = pendingFixedIncome.reduce((sum, e) => sum + e.amount, 0);

    // Ingresos reales recibidos este mes (excluyendo línea de crédito)
    const realIncomeThisMonth = thisMonthTxns
      .filter((t) => {
        const d = t.description.toLowerCase();
        return t.amount > 0 && !d.includes("linea de credito") && !d.includes("linea de cred");
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Gastos variables ya realizados este mes (excluyendo línea de crédito)
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

    // CC expenses detail for this and next month
    const ccDetailThisMonth = ccExpenses
      .filter((exp) => {
        const start = exp.billingStartYear * 12 + exp.billingStartMonth;
        const end = start + exp.installments - 1;
        const target = currentYear * 12 + currentMonth;
        return target >= start && target <= end;
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
        const target = nextYear * 12 + nextMonth;
        return target >= start && target <= end;
      })
      .map((exp) => ({
        description: exp.description,
        cuota: exp.installmentAmount,
        category: exp.category?.name ?? "Sin categoría",
      }));

    // Saldo actual
    const saldoActual = bankAccounts
      .filter((a) => a.type !== "line_of_credit")
      .reduce((sum, a) => sum + a.available, 0);

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;

    // === CATEGORY ANALYSIS ===
    // Current month spending by category
    const categoryInfo = categories.map((cat) => {
      const currentSpent = cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Historical average (last 3 months)
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

    // Common data for both Claude and basic plan
    const planContext = {
      savingsTarget,
      realIncomeThisMonth,
      totalFixedIncome,
      totalFixedExpenses,
      totalPendingExpenses,
      totalPaidExpenses,
      totalPendingIncome,
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
      fixedIncomes: fixedIncomes.map((e) => ({ name: e.name, amount: e.amount })),
      pendingFixedExpenses: pendingFixedExpenses.map((e) => ({ name: e.name, amount: e.amount, dayOfMonth: e.dayOfMonth })),
      paidFixedExpenses: paidFixedExpenses.map((e) => ({ name: e.name, amount: e.amount })),
    };

    // === CALL CLAUDE ===
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes("tu_key_aqui")) {
      return generateBasicPlan(planContext);
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `Eres un asesor financiero personal chileno experto. Analiza la situación financiera detallada y genera un plan de ahorro.

HOY: ${currentDay} de ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
Quedan ${daysRemaining} días del mes.

═══ ANÁLISIS MES ACTUAL (${MONTH_NAMES[currentMonth - 1]}) ═══

INGRESOS:
- Ingresos ya recibidos este mes: $${realIncomeThisMonth.toLocaleString("es-CL")}
- Ingresos fijos pendientes por recibir: $${totalPendingIncome.toLocaleString("es-CL")}${pendingFixedIncome.length > 0 ? `\n  (${pendingFixedIncome.map((e) => e.name).join(", ")})` : ""}

GASTOS FIJOS:
- Ya pagados este mes: $${totalPaidExpenses.toLocaleString("es-CL")}${paidFixedExpenses.length > 0 ? `\n  (${paidFixedExpenses.map((e) => `${e.name}: $${e.amount.toLocaleString("es-CL")}`).join(", ")})` : ""}
- Pendientes por pagar: $${totalPendingExpenses.toLocaleString("es-CL")}${pendingFixedExpenses.length > 0 ? `\n  (${pendingFixedExpenses.map((e) => `${e.name}${e.dayOfMonth ? ` día ${e.dayOfMonth}` : ""}: $${e.amount.toLocaleString("es-CL")}`).join(", ")})` : ""}

TARJETA DE CRÉDITO:
- Cuotas a pagar este mes: $${ccCuotasThisMonth.toLocaleString("es-CL")}${ccDetailThisMonth.length > 0 ? `\n  (${ccDetailThisMonth.map((c) => `${c.description}: $${c.cuota.toLocaleString("es-CL")}`).join(", ")})` : ""}
- Cuotas próximo mes: $${ccCuotasNextMonth.toLocaleString("es-CL")}${ccDetailNextMonth.length > 0 ? `\n  (${ccDetailNextMonth.map((c) => `${c.description}: $${c.cuota.toLocaleString("es-CL")}`).join(", ")})` : ""}

GASTOS VARIABLES YA REALIZADOS: $${spentSoFar.toLocaleString("es-CL")}
SALDO DISPONIBLE HOY: $${saldoActual.toLocaleString("es-CL")}

═══ GASTOS POR CATEGORÍA ═══
${categoryInfo.map((c) => `- ${c.name} [${c.priority}]: este mes $${c.currentSpent.toLocaleString("es-CL")}, promedio mensual $${c.avgMonthly.toLocaleString("es-CL")}`).join("\n")}

═══ ANÁLISIS PRÓXIMO MES (${MONTH_NAMES[nextMonth - 1]}) ═══
Para el próximo mes, NO contar el saldo actual (sería gastar ahorro anterior).
Usar solo:
- Ingresos fijos totales: $${totalFixedIncome.toLocaleString("es-CL")}
  (${fixedIncomes.map((e) => `${e.name}: $${e.amount.toLocaleString("es-CL")}`).join(", ")})
- Gastos fijos totales: $${totalFixedExpenses.toLocaleString("es-CL")}
- Cuotas TC próximo mes: $${ccCuotasNextMonth.toLocaleString("es-CL")}
- Disponible para gastos variables y ahorro: $${(totalFixedIncome - totalFixedExpenses - ccCuotasNextMonth).toLocaleString("es-CL")}

═══ PRIORIDADES DE CATEGORÍA ═══
- "esencial": NO se puede reducir (ej: arriendo, salud)
- "necesario": difícil pero posible reducir un poco
- "prescindible": se puede reducir significativamente
- "innecesario": se puede eliminar o reducir drásticamente

META DE AHORRO: $${savingsTarget.toLocaleString("es-CL")} mensuales

═══ INSTRUCCIONES ═══
1. MES ACTUAL: Calcula cuánto queda realmente disponible (ingresos recibidos + pendientes - gastos fijos pendientes - cuotas TC - lo ya gastado). ¿Alcanza para ahorrar ${savingsTarget.toLocaleString("es-CL")}?

2. PRÓXIMO MES: Usando SOLO ingresos fijos (NO el saldo actual), calcula: ingresos fijos - gastos fijos - cuotas TC = disponible. Luego resta la meta de ahorro. ¿Cuánto queda para gastos variables?

3. PRESUPUESTO POR CATEGORÍA: Analiza cuánto gasta en promedio en cada categoría. Según la prioridad, sugiere cuánto MÁXIMO debería gastar para alcanzar la meta. Recorta primero los innecesarios, luego prescindibles, luego necesarios. Los esenciales no se tocan.

4. RECOMENDACIONES: Para cada categoría prescindible/innecesaria, explica cuánto podría ahorrarse y por qué.

Responde EXACTAMENTE en JSON:
{
  "thisMonthFeasible": true/false,
  "thisMonthMessage": "Análisis detallado del mes actual (2-3 frases con números)",
  "nextMonthFeasible": true/false,
  "nextMonthMessage": "Análisis detallado del próximo mes (2-3 frases con números)",
  "neverFeasible": true/false,
  "suggestedTarget": null o número más realista,
  "startMonth": ${currentMonth} o ${nextMonth},
  "startYear": ${currentMonth === 12 ? nextYear : currentYear},
  "budgets": [
    { "categoryId": "id", "categoryName": "nombre", "budgetAmount": número, "recommendation": "por qué este monto" }
  ]
}

Solo JSON, sin texto adicional.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const planData = JSON.parse(text);

      return NextResponse.json({
        ...planData,
        income: realIncomeThisMonth,
        totalFixedIncome,
        fixedExpenses: totalFixedExpenses,
        pendingExpenses: totalPendingExpenses,
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
    const { month, year, savingsTarget, income, fixedExpenses, budgets } = body;

    const plan = await prisma.savingsPlan.upsert({
      where: { month_year: { month, year } },
      update: {
        savingsTarget,
        totalIncome: income,
        totalFixed: fixedExpenses,
        isActive: true,
      },
      create: {
        month,
        year,
        savingsTarget,
        totalIncome: income,
        totalFixed: fixedExpenses,
        isActive: true,
      },
    });

    await prisma.categoryBudget.deleteMany({ where: { planId: plan.id } });

    for (const b of budgets) {
      await prisma.categoryBudget.create({
        data: {
          planId: plan.id,
          categoryId: b.categoryId,
          budgetAmount: b.budgetAmount,
        },
      });
    }

    // Actualizar budgetLimit en cada categoría
    for (const b of budgets) {
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

// Plan básico sin Claude API
function generateBasicPlan(ctx: {
  savingsTarget: number;
  realIncomeThisMonth: number;
  totalFixedIncome: number;
  totalFixedExpenses: number;
  totalPendingExpenses: number;
  totalPaidExpenses: number;
  totalPendingIncome: number;
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
  fixedIncomes: { name: string; amount: number }[];
  pendingFixedExpenses: { name: string; amount: number; dayOfMonth: number | null }[];
  paidFixedExpenses: { name: string; amount: number }[];
}) {
  const {
    savingsTarget, realIncomeThisMonth, totalFixedIncome, totalFixedExpenses,
    totalPendingExpenses, totalPendingIncome,
    ccCuotasThisMonth, ccCuotasNextMonth,
    spentSoFar, saldoActual, currentDay, daysRemaining,
    currentMonth, currentYear, nextMonth, nextYear, categoryInfo,
  } = ctx;

  // === MES ACTUAL ===
  // Lo que queda realmente: saldo + ingresos pendientes - gastos fijos pendientes - cuotas TC
  const availableThisMonth = saldoActual + totalPendingIncome - totalPendingExpenses - ccCuotasThisMonth;
  const thisMonthFeasible = availableThisMonth >= savingsTarget && currentDay <= 25;

  // === PRÓXIMO MES (solo con ingresos fijos, NO saldo actual) ===
  const nextMonthDisponible = totalFixedIncome - totalFixedExpenses - ccCuotasNextMonth;
  const nextMonthFeasible = nextMonthDisponible > savingsTarget;
  const neverFeasible = nextMonthDisponible <= 0 || savingsTarget > nextMonthDisponible;

  // === PRESUPUESTOS POR CATEGORÍA ===
  // Para next month: lo que queda para gastos variables
  const availableForVariable = nextMonthDisponible - savingsTarget;

  // Sort categories: cut innecesarios first, then prescindibles, etc.
  const priorityOrder = ["innecesario", "prescindible", "sin etiqueta", "necesario", "esencial"];
  const sorted = [...categoryInfo].sort((a, b) => {
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });

  const totalAvgSpending = sorted.reduce((sum, c) => sum + c.avgMonthly, 0);
  const reductionNeeded = Math.max(0, totalAvgSpending - availableForVariable);

  let remainingCut = reductionNeeded;
  const budgetMap = new Map<string, { budgetAmount: number; recommendation: string }>();

  for (const cat of sorted) {
    const baseAmount = cat.avgMonthly || cat.currentSpent || (cat.budgetLimit ?? 0);
    let budget = baseAmount;
    let recommendation = "";

    if (cat.priority === "esencial") {
      recommendation = "Gasto esencial, no se recorta";
    } else if (remainingCut > 0 && budget > 0) {
      const cutPercent = cat.priority === "innecesario" ? 0.8
        : cat.priority === "prescindible" ? 0.5
        : cat.priority === "necesario" ? 0.2
        : 0.3;
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

  // === MESSAGES ===
  let thisMonthMessage: string;
  let nextMonthMessage: string;

  if (neverFeasible) {
    thisMonthMessage = `Con ingresos fijos de $${totalFixedIncome.toLocaleString("es-CL")}, gastos fijos de $${totalFixedExpenses.toLocaleString("es-CL")} y cuotas TC de $${ccCuotasThisMonth.toLocaleString("es-CL")}, no alcanza para ahorrar $${savingsTarget.toLocaleString("es-CL")}.`;
    nextMonthMessage = `Ingresos fijos ($${totalFixedIncome.toLocaleString("es-CL")}) - gastos fijos ($${totalFixedExpenses.toLocaleString("es-CL")}) - cuotas TC ($${ccCuotasNextMonth.toLocaleString("es-CL")}) = $${nextMonthDisponible.toLocaleString("es-CL")} disponible, insuficiente para ahorrar $${savingsTarget.toLocaleString("es-CL")}.`;
  } else if (!thisMonthFeasible) {
    thisMonthMessage = `Ya estamos a día ${currentDay} con $${spentSoFar.toLocaleString("es-CL")} gastados. Te quedan $${Math.round(availableThisMonth).toLocaleString("es-CL")} disponibles (saldo + ingresos pendientes - gastos fijos pendientes - TC), insuficiente para la meta.`;
    nextMonthMessage = `Ingresos fijos ($${totalFixedIncome.toLocaleString("es-CL")}) - gastos fijos ($${totalFixedExpenses.toLocaleString("es-CL")}) - cuotas TC ($${ccCuotasNextMonth.toLocaleString("es-CL")}) = $${nextMonthDisponible.toLocaleString("es-CL")}. Ahorrando $${savingsTarget.toLocaleString("es-CL")}, quedan $${Math.round(availableForVariable).toLocaleString("es-CL")} para gastos variables.`;
  } else {
    thisMonthMessage = `Quedan ${daysRemaining} días. Disponible: $${Math.round(availableThisMonth).toLocaleString("es-CL")} (saldo + ingresos pendientes - gastos pendientes - TC). Si controlas gastos, puedes ahorrar $${savingsTarget.toLocaleString("es-CL")}.`;
    nextMonthMessage = `Viable como plan recurrente. Ingresos fijos - gastos fijos - TC = $${nextMonthDisponible.toLocaleString("es-CL")} disponible cada mes.`;
  }

  return NextResponse.json({
    thisMonthFeasible,
    thisMonthMessage,
    nextMonthFeasible,
    nextMonthMessage,
    neverFeasible,
    suggestedTarget: neverFeasible ? Math.max(0, Math.floor(nextMonthDisponible * 0.5)) : null,
    startMonth: thisMonthFeasible ? currentMonth : nextMonth,
    startYear: thisMonthFeasible ? currentYear : (currentMonth === 12 ? nextYear : currentYear),
    budgets,
    income: realIncomeThisMonth,
    totalFixedIncome,
    fixedExpenses: totalFixedExpenses,
    pendingExpenses: totalPendingExpenses,
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
