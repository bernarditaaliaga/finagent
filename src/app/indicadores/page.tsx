import { prisma } from "@/lib/db";
import { getIndicators } from "@/lib/indicators";
import { IndicadoresClient } from "@/components/indicadores-client";

export const dynamic = "force-dynamic";

export default async function IndicadoresPage() {
  let indicators: Record<string, { nombre: string; valor: number; unidad_medida: string; fecha: string }> = {};
  let error = "";

  try {
    indicators = await getIndicators();
  } catch {
    error = "No se pudieron cargar los indicadores";
  }

  // Obtener gastos de los últimos 6 meses para el gráfico de tendencia
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: sixMonthsAgo },
      amount: { lt: 0 },
    },
    select: { amount: true, date: true, description: true },
  });

  // Agrupar por mes
  const monthlyData: { month: string; gastos: number; key: string }[] = [];
  const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const key = `${y}-${m}`;
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);

    const total = transactions
      .filter((t) => {
        const td = new Date(t.date);
        const desc = t.description.toLowerCase();
        return td >= monthStart && td < monthEnd
          && !desc.includes("linea de credito") && !desc.includes("linea de cred");
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    monthlyData.push({
      month: `${MONTH_NAMES[m]} ${y.toString().slice(2)}`,
      gastos: total,
      key,
    });
  }

  // Ingresos por mes
  const incomeTransactions = await prisma.transaction.findMany({
    where: {
      date: { gte: sixMonthsAgo },
      amount: { gt: 0 },
    },
    select: { amount: true, date: true, description: true },
  });

  const chartData = monthlyData.map((md) => {
    const [yStr, mStr] = md.key.split("-");
    const y = parseInt(yStr);
    const m = parseInt(mStr);
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);

    const ingresos = incomeTransactions
      .filter((t) => {
        const td = new Date(t.date);
        const desc = t.description.toLowerCase();
        return td >= monthStart && td < monthEnd
          && !desc.includes("linea de credito") && !desc.includes("linea de cred");
      })
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      month: md.month,
      gastos: md.gastos,
      ingresos,
    };
  });

  const format = (val: number, unit: string) => {
    if (unit === "Pesos") return `$${val.toLocaleString("es-CL")}`;
    if (unit === "Porcentaje") return `${val}%`;
    return val.toLocaleString("es-CL");
  };

  const serializedIndicators = Object.values(indicators).map((ind) => ({
    nombre: ind.nombre,
    valor: ind.valor,
    unidad_medida: ind.unidad_medida,
    formatted: format(ind.valor, ind.unidad_medida),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Indicadores Financieros</h1>
        <p className="text-slate-500">Valores del dia y tendencia de gastos</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serializedIndicators.map((ind) => (
            <div
              key={ind.nombre}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100"
            >
              <p className="text-sm text-slate-500">{ind.nombre}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{ind.formatted}</p>
              <p className="text-xs text-slate-400 mt-1">{ind.unidad_medida}</p>
            </div>
          ))}
        </div>
      )}

      <IndicadoresClient chartData={chartData} />
    </div>
  );
}
