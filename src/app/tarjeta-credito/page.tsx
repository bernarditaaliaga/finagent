import { prisma } from "@/lib/db";
import { TarjetaCreditoClient } from "@/components/tarjeta-credito-client";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function TarjetaCreditoPage() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [cards, expenses, categories] = await Promise.all([
    prisma.creditCard.findMany({ where: { isTitular: true } }),
    prisma.creditCardExpense.findMany({
      include: { category: true, creditCard: true },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Calcular cuotas activas este mes y próximo
  function getInstallmentForMonth(
    startMonth: number, startYear: number,
    installments: number,
    targetMonth: number, targetYear: number
  ): number | null {
    const startTotal = startYear * 12 + startMonth;
    const targetTotal = targetYear * 12 + targetMonth;
    const cuotaNum = targetTotal - startTotal + 1;
    if (cuotaNum >= 1 && cuotaNum <= installments) return cuotaNum;
    return null;
  }

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  // Compras con cuotas activas este mes
  const thisMonthExpenses = expenses
    .map((exp) => {
      const cuota = getInstallmentForMonth(
        exp.billingStartMonth, exp.billingStartYear,
        exp.installments, currentMonth, currentYear
      );
      if (cuota === null) return null;
      return {
        id: exp.id,
        description: exp.description,
        installmentAmount: exp.installmentAmount,
        cuotaActual: cuota,
        totalCuotas: exp.installments,
        categoryName: exp.category?.name ?? null,
        categoryColor: exp.category?.color ?? null,
      };
    })
    .filter(Boolean);

  // Compras con cuotas activas próximo mes
  const nextMonthExpenses = expenses
    .map((exp) => {
      const cuota = getInstallmentForMonth(
        exp.billingStartMonth, exp.billingStartYear,
        exp.installments, nextMonth, nextYear
      );
      if (cuota === null) return null;
      return {
        id: exp.id,
        description: exp.description,
        installmentAmount: exp.installmentAmount,
        cuotaActual: cuota,
        totalCuotas: exp.installments,
        categoryName: exp.category?.name ?? null,
        categoryColor: exp.category?.color ?? null,
      };
    })
    .filter(Boolean);

  const facturadoEsteMes = thisMonthExpenses.reduce((sum, e) => sum + (e?.installmentAmount ?? 0), 0);
  const facturadoProxMes = nextMonthExpenses.reduce((sum, e) => sum + (e?.installmentAmount ?? 0), 0);

  // Serializar todas las compras
  const serializedExpenses = expenses.map((exp) => {
    const cuotaActual = getInstallmentForMonth(
      exp.billingStartMonth, exp.billingStartYear,
      exp.installments, currentMonth, currentYear
    );
    return {
      id: exp.id,
      description: exp.description,
      totalAmount: exp.totalAmount,
      installments: exp.installments,
      installmentAmount: exp.installmentAmount,
      purchaseDate: exp.purchaseDate.toISOString(),
      billingStartMonth: exp.billingStartMonth,
      billingStartYear: exp.billingStartYear,
      categoryId: exp.categoryId,
      categoryName: exp.category?.name ?? null,
      categoryColor: exp.category?.color ?? null,
      creditCardId: exp.creditCardId,
      cuotaActual,
      isActive: cuotaActual !== null,
    };
  });

  const card = cards[0] ?? null;
  const serializedCard = card ? {
    id: card.id,
    name: card.name,
    lastFourDigits: card.lastFourDigits,
    cupoTotal: card.cupoTotal,
    deudaActual: card.deudaActual,
    billingCloseDay: card.billingCloseDay,
  } : null;

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tarjeta de Credito</h1>
        <p className="text-slate-500">Compras en cuotas y proximos cobros</p>
      </div>
      <TarjetaCreditoClient
        card={serializedCard}
        expenses={serializedExpenses}
        thisMonthExpenses={thisMonthExpenses as NonNullable<typeof thisMonthExpenses[0]>[]}
        nextMonthExpenses={nextMonthExpenses as NonNullable<typeof nextMonthExpenses[0]>[]}
        facturadoEsteMes={facturadoEsteMes}
        facturadoProxMes={facturadoProxMes}
        categories={categoryOptions}
        currentMonth={currentMonth}
        currentYear={currentYear}
        currentMonthName={MONTH_NAMES[currentMonth - 1]}
        nextMonthName={MONTH_NAMES[nextMonth - 1]}
      />
    </div>
  );
}
