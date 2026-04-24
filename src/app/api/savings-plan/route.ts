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
 * Genera un plan de ahorro usando Claude API
 * Body: { savingsTarget: number }
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

    // Datos del mes actual
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 1);

    // Datos del mes siguiente (para plan alternativo)
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const [categories, fixedExpenses, thisMonthTxns, bankAccounts] = await Promise.all([
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
        select: { amount: true, description: true, date: true },
      }),
      prisma.bankAccount.findMany(),
    ]);

    // Ingresos reales del mes (excluyendo línea de crédito)
    const realIncome = thisMonthTxns
      .filter((t) => {
        const d = t.description.toLowerCase();
        return t.amount > 0 && !d.includes("linea de credito") && !d.includes("linea de cred");
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Gastos ya realizados este mes
    const spentSoFar = thisMonthTxns
      .filter((t) => {
        const d = t.description.toLowerCase();
        return t.amount < 0 && !d.includes("linea de credito") && !d.includes("linea de cred");
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Saldo actual disponible
    const saldoActual = bankAccounts
      .filter((a) => a.type !== "line_of_credit")
      .reduce((sum, a) => sum + a.available, 0);

    // Días restantes del mes
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;

    // Info de categorías
    const categoryInfo = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      priority: cat.priority ?? "sin etiqueta",
      budgetLimit: cat.budgetLimit,
      currentSpent: cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
    }));

    // Llamar a Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes("tu_key_aqui")) {
      return generateBasicPlan({
        savingsTarget, realIncome, totalFixedExpenses,
        spentSoFar, saldoActual, currentDay, daysRemaining,
        currentMonth, currentYear, nextMonth, nextYear, categoryInfo,
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `Eres un asesor financiero personal chileno. Analiza la situación financiera y genera un plan de ahorro MENSUAL RECURRENTE.

HOY: ${currentDay} de ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
Quedan ${daysRemaining} días del mes.

SITUACIÓN ACTUAL DEL MES:
- Ingresos recibidos este mes: $${realIncome.toLocaleString("es-CL")}
- Gastos fijos mensuales: $${totalFixedExpenses.toLocaleString("es-CL")}
- Ya gastado este mes (variable): $${spentSoFar.toLocaleString("es-CL")}
- Saldo disponible hoy en cuentas: $${saldoActual.toLocaleString("es-CL")}

META DE AHORRO MENSUAL: $${savingsTarget.toLocaleString("es-CL")} cada mes

GASTOS POR CATEGORÍA (este mes):
${categoryInfo.map((c) => `- ${c.name} (${c.priority}): $${c.currentSpent.toLocaleString("es-CL")} gastado`).join("\n")}

PRIORIDADES:
- "esencial": no se puede reducir
- "necesario": difícil de reducir
- "prescindible": se puede reducir
- "innecesario": se puede eliminar

ANALIZA Y RESPONDE:

1. ¿Es viable ahorrar $${savingsTarget.toLocaleString("es-CL")} ESTE mes considerando que ya estamos a día ${currentDay} y ya se gastaron $${spentSoFar.toLocaleString("es-CL")}?

2. ¿Es viable como plan mensual recurrente (empezando desde el 1 del mes siguiente)?

3. Si no es viable para ningún mes (los ingresos fijos menos gastos fijos no alcanzan), dilo claramente.

4. Asigna presupuesto máximo por categoría, recortando innecesarios primero.

Responde EXACTAMENTE en JSON:
{
  "thisMonthFeasible": true/false,
  "thisMonthMessage": "Análisis del mes actual en 1-2 frases",
  "nextMonthFeasible": true/false,
  "nextMonthMessage": "Análisis para meses futuros en 1-2 frases",
  "neverFeasible": true/false,
  "suggestedTarget": null o número (meta más realista si no es viable),
  "startMonth": número (mes recomendado para empezar: ${currentMonth} o ${nextMonth}),
  "startYear": ${currentMonth === 12 ? nextYear : currentYear},
  "budgets": [
    { "categoryId": "id", "categoryName": "nombre", "budgetAmount": número }
  ]
}

Solo JSON, sin texto adicional.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const planData = JSON.parse(text);

      return NextResponse.json({
        ...planData,
        income: realIncome,
        fixedExpenses: totalFixedExpenses,
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
      // Fallback al plan básico si Claude falla
      return generateBasicPlan({
        savingsTarget, realIncome, totalFixedExpenses,
        spentSoFar, saldoActual, currentDay, daysRemaining,
        currentMonth, currentYear, nextMonth, nextYear, categoryInfo,
      });
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
function generateBasicPlan({
  savingsTarget, realIncome, totalFixedExpenses,
  spentSoFar, saldoActual, currentDay, daysRemaining,
  currentMonth, currentYear, nextMonth, nextYear, categoryInfo,
}: {
  savingsTarget: number; realIncome: number; totalFixedExpenses: number;
  spentSoFar: number; saldoActual: number; currentDay: number; daysRemaining: number;
  currentMonth: number; currentYear: number; nextMonth: number; nextYear: number;
  categoryInfo: { id: string; name: string; priority: string; budgetLimit: number | null; currentSpent: number }[];
}) {
  const maxMonthly = realIncome - totalFixedExpenses;
  const remainingThisMonth = saldoActual - savingsTarget;

  // ¿Es viable como plan mensual?
  const neverFeasible = maxMonthly <= 0 || savingsTarget > maxMonthly;

  // ¿Es viable este mes?
  const thisMonthFeasible = !neverFeasible && remainingThisMonth > 0 && currentDay <= 25;

  // ¿Es viable el próximo mes?
  const nextMonthFeasible = !neverFeasible;

  // Presupuestos
  const availableForSpending = realIncome - totalFixedExpenses - savingsTarget;
  const totalCurrentSpent = categoryInfo.reduce((sum, c) => sum + c.currentSpent, 0);
  const reductionNeeded = Math.max(0, totalCurrentSpent - availableForSpending);

  let remainingCut = reductionNeeded;
  const priorityOrder = ["innecesario", "prescindible", "necesario", "sin etiqueta"];

  const budgets = categoryInfo.map((cat) => {
    let budget = cat.currentSpent || (cat.budgetLimit ?? 0);
    if (cat.priority === "esencial") {
      // No recortar
    } else if (remainingCut > 0) {
      const idx = priorityOrder.indexOf(cat.priority);
      const cutPercent = idx === 0 ? 0.8 : idx === 1 ? 0.5 : idx === 2 ? 0.2 : 0.3;
      const cut = Math.min(budget * cutPercent, remainingCut);
      budget -= cut;
      remainingCut -= cut;
    }
    return { categoryId: cat.id, categoryName: cat.name, budgetAmount: Math.round(budget) };
  });

  let thisMonthMessage: string;
  let nextMonthMessage: string;

  if (neverFeasible) {
    thisMonthMessage = `Con ingresos de $${realIncome.toLocaleString("es-CL")} y gastos fijos de $${totalFixedExpenses.toLocaleString("es-CL")}, no es posible ahorrar $${savingsTarget.toLocaleString("es-CL")} en ningún mes.`;
    nextMonthMessage = thisMonthMessage;
  } else if (!thisMonthFeasible) {
    thisMonthMessage = `Ya estamos a día ${currentDay} y llevas $${spentSoFar.toLocaleString("es-CL")} gastados. No es realista empezar este mes.`;
    nextMonthMessage = `A partir de ${MONTH_NAMES[nextMonth - 1]}, con disciplina puedes ahorrar $${savingsTarget.toLocaleString("es-CL")} al mes.`;
  } else {
    thisMonthMessage = `Quedan ${daysRemaining} días y tienes $${saldoActual.toLocaleString("es-CL")} disponibles. Es viable ahorrar $${savingsTarget.toLocaleString("es-CL")} si controlas los gastos.`;
    nextMonthMessage = `Como plan mensual recurrente, es viable.`;
  }

  return NextResponse.json({
    thisMonthFeasible,
    thisMonthMessage,
    nextMonthFeasible,
    nextMonthMessage,
    neverFeasible,
    suggestedTarget: neverFeasible ? Math.max(0, Math.floor(maxMonthly * 0.5)) : null,
    startMonth: thisMonthFeasible ? currentMonth : nextMonth,
    startYear: thisMonthFeasible ? currentYear : (currentMonth === 12 ? nextYear : currentYear),
    budgets,
    income: realIncome,
    fixedExpenses: totalFixedExpenses,
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
