import { prisma } from "@/lib/db";
import { GastosFijosClient } from "@/components/gastos-fijos-client";

export const dynamic = "force-dynamic";

export default async function GastosFijosPage() {
  const expenses = await prisma.fixedExpense.findMany({
    include: { category: true },
    orderBy: { dayOfMonth: "asc" },
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  const serialized = expenses.map((e) => ({
    id: e.id,
    name: e.name,
    amount: e.amount,
    dayOfMonth: e.dayOfMonth,
    isActive: e.isActive,
    lastPaidAt: e.lastPaidAt?.toISOString() ?? null,
    categoryName: e.category?.name ?? null,
    categoryColor: e.category?.color ?? null,
  }));

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gastos Fijos</h1>
        <p className="text-slate-500">Pagos recurrentes programados cada mes</p>
      </div>
      <GastosFijosClient expenses={serialized} categories={categoryOptions} />
    </div>
  );
}
