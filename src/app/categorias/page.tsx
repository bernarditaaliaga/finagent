import { prisma } from "@/lib/db";
import { CategoriasClient } from "@/components/categorias-client";

export const dynamic = "force-dynamic";

// Patrones de ruido bancario que no son gastos reales
const NOISE_PATTERNS = [
  "linea de cred", "linea de credito",
  "transferencia desde linea", "amortizacion a linea",
  "pago linea de cred",
];

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

  const [categories, uncategorizedRaw, rulesData, selectedCatTxns, fixedExpenses, fixedIncomes, creditCards] = await Promise.all([
    prisma.category.findMany({
      include: {
        transactions: {
          where: { date: { gte: startOfMonth, lt: endOfMonth }, amount: { lt: 0 }, isIgnored: false },
          select: { amount: true },
        },
        _count: { select: { transactions: { where: { amount: { lt: 0 }, isIgnored: false } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { categoryId: null, amount: { lt: 0 }, isIgnored: false },
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
            isIgnored: false,
          },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    prisma.fixedExpense.findMany({ where: { isActive: true, type: "expense" } }),
    prisma.fixedExpense.findMany({ where: { isActive: true, type: "income" } }),
    prisma.creditCard.findMany({ where: { isTitular: true } }),
  ]);

  // Filtrar ruido bancario de sin categoría
  const uncategorized = uncategorizedRaw.filter((t) => {
    const desc = t.description.toLowerCase();
    return !NOISE_PATTERNS.some((p) => desc.includes(p));
  });

  // Gastos fijos: total mensual vs pagado este mes
  const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidFixedThisMonth = fixedExpenses
    .filter((e) => e.lastPaidAt && e.lastPaidAt >= startOfMonth && e.lastPaidAt < endOfMonth)
    .reduce((sum, e) => sum + e.amount, 0);
  const totalFixedIncome = fixedIncomes.reduce((sum, e) => sum + e.amount, 0);

  // Excluir "Gastos Fijos" de la grilla (tiene su propia página)
  const categoryData = categories
    .filter((cat) => cat.name !== "Gastos Fijos")
    .map((cat) => {
      const txSpent = cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budgetLimit: cat.budgetLimit,
        priority: cat.priority,
        frequency: cat.frequency,
        totalTransactions: cat._count.transactions,
        spentThisMonth: txSpent,
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

  // Tarjeta de crédito: facturado y pagado
  const ccFacturado = creditCards.reduce((sum, c) => sum + c.facturadoMes, 0);
  const ccPagado = creditCards.reduce((sum, c) => sum + c.pagadoMes, 0);

  // Resumen financiero
  const summary = {
    totalIncome: totalFixedIncome,
    totalFixed: totalFixedExpenses,
    paidFixed: paidFixedThisMonth,
    ccFacturado,
    ccPagado,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
        <p className="text-slate-500">Gastos variables por categoria</p>
      </div>

      <CategoriasClient
        categories={categoryData}
        uncategorized={uncategorizedData}
        rules={rules}
        selectedCategoryId={selectedCatId}
        selectedCategoryTransactions={selectedCategoryTransactions}
        summary={summary}
      />
    </div>
  );
}
