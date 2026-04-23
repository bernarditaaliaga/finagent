import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/format";
import { CategoriasClient } from "@/components/categorias-client";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const categories = await prisma.category.findMany({
    include: {
      transactions: {
        where: { date: { gte: startOfMonth, lt: endOfMonth } },
        select: { amount: true },
      },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });

  const uncategorized = await prisma.transaction.findMany({
    where: { categoryId: null },
    orderBy: { date: "desc" },
    take: 20,
  });

  const categoryData = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    budgetLimit: cat.budgetLimit,
    totalTransactions: cat._count.transactions,
    spentThisMonth: cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
  }));

  const uncategorizedData = uncategorized.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
        <p className="text-slate-500">Organiza tus gastos en categorias personalizadas</p>
      </div>

      <CategoriasClient categories={categoryData} uncategorized={uncategorizedData} />
    </div>
  );
}
