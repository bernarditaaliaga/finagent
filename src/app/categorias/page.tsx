import { prisma } from "@/lib/db";
import { CategoriasClient } from "@/components/categorias-client";

export const dynamic = "force-dynamic";

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const selectedCatId = (params.cat as string) || null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Asegurar que exista la categoría "Gastos Fijos" por default
  await prisma.category.upsert({
    where: { name: "Gastos Fijos" },
    update: {},
    create: { name: "Gastos Fijos", color: "#6B7280", priority: "esencial", frequency: "recurrente" },
  });

  // Parallel queries
  const [categories, uncategorized, rulesData, selectedCatTxns, fixedExpenses] = await Promise.all([
    prisma.category.findMany({
      include: {
        transactions: {
          where: { date: { gte: startOfMonth, lt: endOfMonth } },
          select: { amount: true },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { categoryId: null },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.categoryRule.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    selectedCatId
      ? prisma.transaction.findMany({
          where: {
            categoryId: selectedCatId,
            date: { gte: startOfMonth, lt: endOfMonth },
          },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    prisma.fixedExpense.findMany({ where: { isActive: true, type: "expense" } }),
  ]);

  // Gastos fijos: total mensual (budgetLimit) vs pagado este mes (spentThisMonth)
  const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidFixedThisMonth = fixedExpenses
    .filter((e) => e.lastPaidAt && e.lastPaidAt >= startOfMonth && e.lastPaidAt < endOfMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  const categoryData = categories.map((cat) => {
    const txSpent = cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const isGastosFijos = cat.name === "Gastos Fijos";
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      budgetLimit: isGastosFijos ? totalFixedExpenses : cat.budgetLimit,
      priority: cat.priority,
      frequency: cat.frequency,
      totalTransactions: cat._count.transactions,
      spentThisMonth: isGastosFijos ? paidFixedThisMonth : txSpent,
    };
  });

  const uncategorizedData = uncategorized.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
    accountName: t.accountName ?? null,
  }));

  const rules = rulesData.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    categoryId: r.categoryId,
    issender: r.issender,
    categoryName: r.category.name,
  }));

  const selectedCategoryTransactions = selectedCatTxns.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
    accountName: t.accountName ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
        <p className="text-slate-500">Organiza tus gastos en categorias personalizadas</p>
      </div>

      <CategoriasClient
        categories={categoryData}
        uncategorized={uncategorizedData}
        rules={rules}
        selectedCategoryId={selectedCatId}
        selectedCategoryTransactions={selectedCategoryTransactions}
      />
    </div>
  );
}
