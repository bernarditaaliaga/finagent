import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/format";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

// Detecta movimientos de línea de crédito (no son ingreso/gasto real, son deuda)
// EXCEPTO: "Traspaso a: Línea de cred..." = pago real de deuda
function isCreditLineMovement(description: string): boolean {
  const d = description.toLowerCase();
  if (d.includes("traspaso a:") && d.includes("linea de cred")) return false;
  return d.includes("linea de credito") || d.includes("linea de cred");
}

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
  const currentAccountId = (params.accountId as string) || null;
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfMonth = new Date(currentYear, currentMonth, 1);

  let saldoInicial = 0;
  let saldoActual = 0;
  let totalIngresos = 0;
  let totalGastos = 0;
  let creditCards: { id: string; name: string; lastFourDigits: string | null; cupoTotal: number; deudaActual: number; facturadoMes: number; pagadoMes: number; billingCloseDay: number }[] = [];
  let estimacionProximoMes = 0;
  let categoryData: { id: string; name: string; icon: string | null; color: string | null; budgetLimit: number | null; priority: string | null; spent: number }[] = [];
  let serializedTransactions: { id: string; date: string; description: string; amount: number; categoryName: string | null; categoryColor: string | null; accountName: string | null; isCreditLine: boolean }[] = [];
  let accounts: { id: string; name: string }[] = [];

  try {
    const baseWhere = {
      date: { gte: startOfMonth, lt: endOfMonth },
      isIgnored: false,
      ...(currentAccountId ? { accountId: currentAccountId } : {}),
    };

    const [transactions, categories, distinctAccounts, bankAccounts, creditCardsData] =
      await Promise.all([
        prisma.transaction.findMany({
          where: baseWhere,
          include: { category: true },
          orderBy: { date: "desc" },
        }),
        prisma.category.findMany({
          include: {
            transactions: {
              where: baseWhere,
              select: { amount: true },
            },
          },
        }),
        prisma.transaction.findMany({
          where: { accountId: { not: null } },
          distinct: ["accountId"],
          select: { accountId: true, accountName: true },
        }),
        prisma.bankAccount.findMany(),
        prisma.creditCard.findMany({ where: { isTitular: true } }),
      ]);

    // === SALDO ACTUAL ===
    // Si hay filtro de cuenta, mostrar solo esa; si no, sumar todas
    if (currentAccountId) {
      const acc = bankAccounts.find(
        (a) => a.fintocId === currentAccountId || a.id === currentAccountId
      );
      saldoActual = acc ? acc.available : 0;
    } else {
      // Sumar solo cuentas que no sean línea de crédito
      saldoActual = bankAccounts
        .filter((a) => a.type !== "line_of_credit")
        .reduce((sum, a) => sum + a.available, 0);
    }

    // === SALDO INICIAL DEL MES ===
    // saldo_inicial = saldo_actual - sum(todos los movimientos del mes)
    const sumMovimientosMes = transactions.reduce((sum, t) => sum + t.amount, 0);
    saldoInicial = saldoActual - sumMovimientosMes;

    // === INGRESOS REALES (excluyendo línea de crédito) ===
    totalIngresos = transactions
      .filter((t) => t.amount > 0 && !isCreditLineMovement(t.description))
      .reduce((sum, t) => sum + t.amount, 0);

    // === GASTOS REALES (excluyendo pagos de línea de crédito) ===
    totalGastos = transactions
      .filter((t) => t.amount < 0 && !isCreditLineMovement(t.description))
      .reduce((sum, t) => sum + t.amount, 0);

    // === TARJETAS DE CRÉDITO ===
    creditCards = creditCardsData.map((card) => ({
      id: card.id,
      name: card.name,
      lastFourDigits: card.lastFourDigits,
      cupoTotal: card.cupoTotal,
      deudaActual: card.deudaActual,
      facturadoMes: card.facturadoMes,
      pagadoMes: card.pagadoMes,
      billingCloseDay: card.billingCloseDay,
    }));

    // Detectar pago de TC en transacciones bancarias ("Cargo por pago tc", "pago tc")
    const tcPayments = transactions.filter((t) => {
      const d = t.description.toLowerCase();
      return d.includes("pago tc") || d.includes("pago tarjeta");
    });
    const totalPagadoTC = tcPayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    // Actualizar pagadoMes si encontramos pagos en las transacciones
    if (creditCards.length > 0 && totalPagadoTC > 0) {
      creditCards[0].pagadoMes = totalPagadoTC;
    }

    // === ESTIMACIÓN PRÓXIMO MES ===
    // El cierre es el día 26. Gastos desde el 27 del mes anterior hasta el 26 del mes actual
    // se facturan en el próximo mes.
    // Para estimar lo que se facturará el próximo mes: gastos desde el 27 del mes actual
    const closeDay = creditCards[0]?.billingCloseDay ?? 26;
    const startBillingPeriod = new Date(currentYear, currentMonth - 1, closeDay + 1);
    // Buscar transacciones de TC en el periodo actual de facturación
    // "Cargo por pago tc" nos dice cuánto fue el facturado este mes
    const facturadoFromTxns = tcPayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    if (creditCards.length > 0 && facturadoFromTxns > 0 && creditCards[0].facturadoMes === 0) {
      creditCards[0].facturadoMes = facturadoFromTxns;
    }

    // Para estimar próximo mes, buscar gastos con "Pago:" (compras con TC)
    // que ocurrieron después del cierre (día 27+)
    const gastosPostCierre = transactions.filter((t) => {
      const txDate = new Date(t.date);
      return t.amount < 0 && txDate >= startBillingPeriod && !isCreditLineMovement(t.description);
    });
    // Esto es una estimación rough - los gastos con "Pago:" podrían ser TC o débito
    // Por ahora mostramos el total de gastos post-cierre como referencia
    estimacionProximoMes = gastosPostCierre.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // === CATEGORÍAS (solo gastos reales) ===
    categoryData = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      budgetLimit: cat.budgetLimit,
      priority: cat.priority,
      spent: cat.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
    }));

    // === TRANSACCIONES SERIALIZADAS ===
    serializedTransactions = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount,
      categoryName: t.category?.name ?? null,
      categoryColor: t.category?.color ?? null,
      accountName: t.accountName ?? null,
      isCreditLine: isCreditLineMovement(t.description),
    }));

    accounts = distinctAccounts
      .filter((a) => a.accountId !== null)
      .map((a) => ({
        id: a.accountId as string,
        name: a.accountName ?? (a.accountId as string),
      }));
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }

  return (
    <div className="space-y-6">
      {/* Resumen financiero del mes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Saldo Inicial</p>
          <p className="text-2xl font-bold text-slate-800">
            {formatCLP(saldoInicial)}
          </p>
          <p className="text-xs text-slate-400 mt-1">1 del mes</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Ingresos</p>
          <p className="text-2xl font-bold text-emerald-600">
            +{formatCLP(totalIngresos)}
          </p>
          <p className="text-xs text-slate-400 mt-1">sin linea de crédito</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Gastos</p>
          <p className="text-2xl font-bold text-red-500">
            {formatCLP(totalGastos)}
          </p>
          <p className="text-xs text-slate-400 mt-1">sin linea de crédito</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Saldo Actual</p>
          <p className={`text-2xl font-bold ${saldoActual >= 0 ? "text-blue-600" : "text-red-500"}`}>
            {formatCLP(saldoActual)}
          </p>
          <p className="text-xs text-slate-400 mt-1">disponible hoy</p>
        </div>
      </div>

      {/* Tarjetas de Crédito */}
      {creditCards.map((card) => (
        <div key={card.id} className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 shadow-sm text-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-300">
              TARJETA DE CRÉDITO{card.lastFourDigits ? ` •••• ${card.lastFourDigits}` : ""}
            </p>
            <p className="text-xs text-slate-400">{card.name}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400">Deuda Total</p>
              <p className={`text-xl font-bold ${card.deudaActual > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                {formatCLP(card.deudaActual)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Facturado este mes</p>
              <p className="text-xl font-bold text-red-400">
                {formatCLP(card.facturadoMes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Pagado este mes</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCLP(card.pagadoMes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Cupo Disponible</p>
              <p className="text-xl font-bold text-blue-400">
                {formatCLP(card.cupoTotal - card.deudaActual)}
              </p>
            </div>
          </div>
          {/* Barra de uso */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Uso: {Math.round((card.deudaActual / card.cupoTotal) * 100)}%</span>
              <span>Cupo: {formatCLP(card.cupoTotal)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  card.deudaActual / card.cupoTotal > 0.8 ? "bg-red-500" :
                  card.deudaActual / card.cupoTotal > 0.5 ? "bg-orange-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, (card.deudaActual / card.cupoTotal) * 100)}%` }}
              />
            </div>
          </div>
          {/* Estimación próximo mes */}
          {estimacionProximoMes > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Estimación próxima facturación (gastos desde día {card.billingCloseDay + 1})
                </p>
                <p className="text-sm font-bold text-yellow-400">
                  ~{formatCLP(estimacionProximoMes)}
                </p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Progreso del mes */}
      {saldoInicial > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-500">CONSUMO DEL MES</p>
            <p className="text-sm text-slate-500">
              {formatCLP(Math.abs(totalGastos))} de {formatCLP(saldoInicial + totalIngresos)}
            </p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                Math.abs(totalGastos) > saldoInicial + totalIngresos
                  ? "bg-red-500"
                  : Math.abs(totalGastos) > (saldoInicial + totalIngresos) * 0.8
                  ? "bg-orange-400"
                  : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(100, (Math.abs(totalGastos) / (saldoInicial + totalIngresos)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Categorías como chips */}
      {categoryData.filter((c) => c.spent > 0).length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">GASTOS POR CATEGORÍA</h2>
          <div className="flex flex-wrap gap-3">
            {categoryData
              .filter((cat) => cat.spent > 0)
              .sort((a, b) => b.spent - a.spent)
              .map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorias?cat=${cat.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border hover:shadow-md transition-shadow"
                  style={{ borderColor: cat.color ?? "#e2e8f0" }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color ?? "#6B7280" }}
                  />
                  <span className="text-sm font-medium">{cat.name}</span>
                  {cat.priority && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      cat.priority === "esencial" ? "bg-red-100 text-red-700" :
                      cat.priority === "necesario" ? "bg-orange-100 text-orange-700" :
                      cat.priority === "prescindible" ? "bg-yellow-100 text-yellow-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {cat.priority.charAt(0).toUpperCase() + cat.priority.slice(1)}
                    </span>
                  )}
                  <span className="text-sm text-slate-500">{formatCLP(cat.spent)}</span>
                  {cat.budgetLimit && (
                    <span className={`text-xs ${cat.spent > cat.budgetLimit ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                      / {formatCLP(cat.budgetLimit)}
                    </span>
                  )}
                </Link>
              ))}
          </div>
        </div>
      )}

      <DashboardClient
        transactions={serializedTransactions}
        currentMonth={currentMonth}
        currentYear={currentYear}
        accounts={accounts}
        currentAccountId={currentAccountId}
      />
    </div>
  );
}
