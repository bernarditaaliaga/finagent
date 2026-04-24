import { prisma } from "@/lib/db";
import { AhorroClient } from "@/components/ahorro-client";

export const dynamic = "force-dynamic";

export default async function AhorroPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [goals, activePlan, categories] = await Promise.all([
    prisma.savingsGoal.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.savingsPlan.findFirst({
      where: { isActive: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        budgets: {
          include: { category: true },
        },
      },
    }),
    prisma.category.findMany({
      include: {
        transactions: {
          where: { date: { gte: startOfMonth, lt: endOfMonth }, isIgnored: false },
          select: { amount: true },
        },
      },
    }),
  ]);

  const serializedGoals = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    deadline: g.deadline?.toISOString() ?? null,
  }));

  const serializedPlan = activePlan
    ? {
        id: activePlan.id,
        month: activePlan.month,
        year: activePlan.year,
        savingsTarget: activePlan.savingsTarget,
        totalIncome: activePlan.totalIncome,
        totalFixed: activePlan.totalFixed,
        reasoning: activePlan.reasoning ?? null,
        isActive: activePlan.isActive,
        budgets: activePlan.budgets.map((b) => ({
          categoryId: b.categoryId,
          categoryName: b.category.name,
          categoryColor: b.category.color,
          budgetAmount: b.budgetAmount,
          currentSpent: categories
            .find((c) => c.id === b.categoryId)
            ?.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) ?? 0,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ahorro</h1>
        <p className="text-slate-500">Plan de ahorro mensual y metas a largo plazo</p>
      </div>
      <AhorroClient
        goals={serializedGoals}
        activePlan={serializedPlan}
        currentMonth={now.getMonth() + 1}
        currentYear={now.getFullYear()}
      />
    </div>
  );
}
