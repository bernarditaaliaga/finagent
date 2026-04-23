import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/format";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const currentMonth = params.month
    ? parseInt(params.month as string)
    : now.getMonth() + 1;
  const currentYear = params.year
    ? parseInt(params.year as string)
    : now.getFullYear();
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfMonth = new Date(currentYear, currentMonth, 1);

  let income = 0;
  let expense = 0;
  let balance = 0;
  let categoryData: { id: string; name: string; icon: string | null; color: string | null; budgetLimit: number | null; spent: number }[] = [];
  let serializedTransactions: { id: string; date: string; description: string; amount: number; categoryName: string | null; categoryColor: string | null }[] = [];

  try {
    const [transactions, categories, totalIncome, totalExpense] =
      await Promise.all([
        prisma.transaction.findMany({
          where: { date: { gte: startOfMonth, lt: endOfMonth } },
          include: { category: true },
          orderBy: { date: "desc" },
        }),
        prisma.category.findMany({
          include: {
            transactions: {
              where: { date: { gte: startOfMonth, lt: endOfMonth } },
              select: { amount: true },
            },
          },
        }),
        prisma.transaction.aggregate({
          where: {
            date: { gte: startOfMonth, lt: endOfMonth },
            amount: { gt: 0 },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            date: { gte: startOfMonth, lt: endOfMonth },
            amount: { lt: 0 },
          },
          _sum: { amount: true },
        }),
      ]);

    income = totalIncome._sum.amount ?? 0;
    expense = totalExpense._sum.amount ?? 0;
    balance = income + expense;

    categoryData = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      budgetLimit: cat.budgetLimit,
      spent: cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
    }));

    serializedTransactions = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount,
      categoryName: t.category?.name ?? null,
      categoryColor: t.category?.color ?? null,
    }));
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }

  return (
    <div className="space-y-6">
      {/* Resumen: Ingresos / Gastos / Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Ingresos</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCLP(income)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Gastos</p>
          <p className="text-2xl font-bold text-red-500">{formatCLP(Math.abs(expense))}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Balance</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCLP(balance)}
          </p>
        </div>
      </div>

      {/* Categorías como chips */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">GASTOS POR CATEGORIA</h2>
          <div className="flex flex-wrap gap-3">
            {categoryData.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 px-4 py-2 rounded-full border"
                style={{ borderColor: cat.color ?? "#e2e8f0" }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cat.color ?? "#6B7280" }}
                />
                <span className="text-sm font-medium">{cat.name}</span>
                <span className="text-sm text-slate-500">{formatCLP(cat.spent)}</span>
                {cat.budgetLimit && (
                  <span className={`text-xs ${cat.spent > cat.budgetLimit ? "text-red-500" : "text-slate-400"}`}>
                    / {formatCLP(cat.budgetLimit)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DashboardClient
        transactions={serializedTransactions}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />
    </div>
  );
}
