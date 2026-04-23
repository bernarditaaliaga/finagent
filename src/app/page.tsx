import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/format";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

// Detecta movimientos de línea de crédito (no son ingreso/gasto real, son deuda)
function isCreditLineMovement(description: string): boolean {
  const d = description.toLowerCase();
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
  let deudaCredito = 0;
  let facturadoMes = 0;
  let pagadoMes = 0;
  let creditLimit = 0;
  let categoryData: { id: string; name: string; icon: string | null; color: string | null; budgetLimit: number | null; priority: string | null; spent: number }[] = [];
  let serializedTransactions: { id: string; date: string; description: string; amount: number; categoryName: string | null; categoryColor: string | null; isCreditLine: boolean }[] = [];
  let accounts: { id: string; name: string }[] = [];

  try {
    const baseWhere = {
      date: { gte: startOfMonth, lt: endOfMonth },
      ...(currentAccountId ? { accountId: currentAccountId } : {}),
    };

    const [transactions, categories, distinctAccounts, bankAccounts] =
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

    // === LÍNEA DE CRÉDITO / TARJETA ===
    const creditMovements = transactions.filter((t) =>
      isCreditLineMovement(t.description)
    );
    // Facturado: préstamos tomados de la línea (positivos = dinero recibido del crédito)
    facturadoMes = creditMovements
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    // Pagado: pagos hechos a la línea (negativos = dinero devuelto al crédito)
    pagadoMes = creditMovements
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    deudaCredito = Math.max(0, facturadoMes - pagadoMes);

    // Obtener límite de crédito de la cuenta corriente
    const ccAccount = bankAccounts.find((a) => a.creditLimit > 0);
    if (ccAccount) {
      creditLimit = ccAccount.creditLimit;
      // Deuda real = límite - disponible (más preciso que solo movimientos del mes)
      const deudaReal = ccAccount.creditLimit - ccAccount.available;
      if (deudaReal > 0) {
        deudaCredito = deudaReal;
      }
    }

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

      {/* Tarjeta de Crédito / Línea de Crédito */}
      {(deudaCredito > 0 || facturadoMes > 0 || pagadoMes > 0 || creditLimit > 0) && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 shadow-sm text-white">
          <p className="text-sm font-medium text-slate-300 mb-3">LÍNEA DE CRÉDITO</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400">Deuda Total</p>
              <p className={`text-xl font-bold ${deudaCredito > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                {formatCLP(deudaCredito)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Facturado este mes</p>
              <p className="text-xl font-bold text-red-400">
                {formatCLP(facturadoMes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Pagado este mes</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCLP(pagadoMes)}
              </p>
            </div>
            {creditLimit > 0 && (
              <div>
                <p className="text-xs text-slate-400">Disponible</p>
                <p className="text-xl font-bold text-blue-400">
                  {formatCLP(creditLimit - deudaCredito)}
                </p>
              </div>
            )}
          </div>
          {creditLimit > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Uso: {Math.round((deudaCredito / creditLimit) * 100)}%</span>
                <span>Límite: {formatCLP(creditLimit)}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    deudaCredito / creditLimit > 0.8 ? "bg-red-500" :
                    deudaCredito / creditLimit > 0.5 ? "bg-orange-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, (deudaCredito / creditLimit) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
