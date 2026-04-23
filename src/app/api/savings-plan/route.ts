import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

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
 * Body: { savingsTarget: number, month?: number, year?: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date();
    const month = body.month ?? now.getMonth() + 1;
    const year = body.year ?? now.getFullYear();
    const savingsTarget = body.savingsTarget;

    if (!savingsTarget || savingsTarget <= 0) {
      return NextResponse.json(
        { error: "Debes indicar cuánto quieres ahorrar" },
        { status: 400 }
      );
    }

    // Obtener datos financieros
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    const [categories, fixedExpenses, transactions] = await Promise.all([
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
        select: { amount: true, description: true },
      }),
    ]);

    // Calcular ingresos fijos (estimados)
    // Detectar ingresos recurrentes: positivos que no son crédito ni traspasos internos
    const realIncome = transactions
      .filter((t) => {
        const d = t.description.toLowerCase();
        return t.amount > 0 && !d.includes("linea de credito") && !d.includes("linea de cred");
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Preparar datos de categorías con gasto histórico
    const categoryInfo = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      priority: cat.priority ?? "sin etiqueta",
      budgetLimit: cat.budgetLimit,
      currentSpent: cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
    }));

    const availableForSpending = realIncome - totalFixedExpenses - savingsTarget;

    // Llamar a Claude para generar el plan
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes("tu_key_aqui")) {
      // Sin Claude API → generar plan básico automático
      return generateBasicPlan({
        month, year, savingsTarget, realIncome, totalFixedExpenses,
        availableForSpending, categoryInfo,
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `Eres un asesor financiero personal. Analiza estos datos y genera un plan de ahorro mensual.

DATOS FINANCIEROS:
- Ingresos del mes: ${realIncome.toLocaleString("es-CL")} CLP
- Gastos fijos mensuales: ${totalFixedExpenses.toLocaleString("es-CL")} CLP
- Meta de ahorro: ${savingsTarget.toLocaleString("es-CL")} CLP
- Disponible para gastos variables: ${availableForSpending.toLocaleString("es-CL")} CLP

CATEGORÍAS DE GASTO (con gasto actual del mes y prioridad):
${categoryInfo.map((c) => `- ${c.name} (${c.priority}): gastado ${c.currentSpent.toLocaleString("es-CL")} CLP${c.budgetLimit ? `, límite actual: ${c.budgetLimit.toLocaleString("es-CL")} CLP` : ""}`).join("\n")}

PRIORIDADES:
- "esencial": no se puede reducir (ej: cuentas, arriendo)
- "necesario": difícil de reducir pero posible
- "prescindible": se puede reducir significativamente
- "innecesario": se puede eliminar o reducir al mínimo
- "sin etiqueta": categoría sin clasificar

INSTRUCCIONES:
1. Evalúa si la meta de ahorro es realista con los ingresos y gastos fijos
2. Si NO es posible, explica por qué y sugiere una meta más realista
3. Si ES posible, asigna un presupuesto máximo a cada categoría, recortando primero las innecesarias, luego prescindibles
4. Los gastos esenciales no se recortan
5. Los necesarios se recortan solo si es imprescindible

Responde EXACTAMENTE en este formato JSON:
{
  "feasible": true/false,
  "message": "Explicación para el usuario en español, máximo 2-3 frases",
  "suggestedTarget": null o número (si no es feasible, sugiere una meta más realista),
  "budgets": [
    { "categoryId": "id", "categoryName": "nombre", "budgetAmount": número }
  ]
}

Solo responde el JSON, sin texto adicional.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const planData = JSON.parse(text);

    return NextResponse.json({
      feasible: planData.feasible,
      message: planData.message,
      suggestedTarget: planData.suggestedTarget,
      budgets: planData.budgets,
      income: realIncome,
      fixedExpenses: totalFixedExpenses,
      savingsTarget,
      availableForSpending,
    });
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

    // Upsert del plan
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

    // Eliminar budgets anteriores y crear nuevos
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

    // Actualizar budgetLimit en cada categoría para que se refleje en el dashboard
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
  month, year, savingsTarget, realIncome, totalFixedExpenses,
  availableForSpending, categoryInfo,
}: {
  month: number; year: number; savingsTarget: number; realIncome: number;
  totalFixedExpenses: number; availableForSpending: number;
  categoryInfo: { id: string; name: string; priority: string; budgetLimit: number | null; currentSpent: number }[];
}) {
  if (availableForSpending < 0) {
    return NextResponse.json({
      feasible: false,
      message: `Con ingresos de $${realIncome.toLocaleString("es-CL")} y gastos fijos de $${totalFixedExpenses.toLocaleString("es-CL")}, no alcanza para ahorrar $${savingsTarget.toLocaleString("es-CL")}. El máximo que podrías ahorrar es $${Math.max(0, realIncome - totalFixedExpenses).toLocaleString("es-CL")}.`,
      suggestedTarget: Math.max(0, Math.floor((realIncome - totalFixedExpenses) * 0.5)),
      budgets: [],
      income: realIncome,
      fixedExpenses: totalFixedExpenses,
      savingsTarget,
      availableForSpending,
    });
  }

  // Distribuir el presupuesto disponible
  const totalCurrentSpent = categoryInfo.reduce((sum, c) => sum + c.currentSpent, 0);
  const reductionNeeded = totalCurrentSpent > availableForSpending
    ? totalCurrentSpent - availableForSpending
    : 0;

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
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      budgetAmount: Math.round(budget),
    };
  });

  const feasible = remainingCut <= 0;

  return NextResponse.json({
    feasible,
    message: feasible
      ? `Tu plan es viable. Con $${availableForSpending.toLocaleString("es-CL")} disponibles para gastos variables, puedes ahorrar $${savingsTarget.toLocaleString("es-CL")} al mes ajustando tus gastos prescindibles e innecesarios.`
      : `Es difícil ahorrar $${savingsTarget.toLocaleString("es-CL")} con tus gastos actuales. Aún recortando gastos innecesarios, faltarían $${Math.round(remainingCut).toLocaleString("es-CL")}.`,
    suggestedTarget: feasible ? null : Math.floor(savingsTarget - remainingCut),
    budgets,
    income: realIncome,
    fixedExpenses: totalFixedExpenses,
    savingsTarget,
    availableForSpending,
  });
}
