import { prisma } from "@/lib/db";
import { getIndicators } from "@/lib/indicators";
import { IndicadoresClient } from "@/components/indicadores-client";

export const dynamic = "force-dynamic";

export default async function IndicadoresPage() {
  let indicators: Record<string, { nombre: string; valor: number; unidad_medida: string; fecha: string }> = {};
  let error = "";

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Fetch indicators and transactions in parallel
  const [indicatorsResult, allTxns] = await Promise.all([
    getIndicators().catch(() => {
      error = "No se pudieron cargar los indicadores";
      return {} as typeof indicators;
    }),
    prisma.transaction.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { amount: true, date: true, description: true },
    }),
  ]);

  indicators = indicatorsResult;

  // Build chart data in a single pass
  const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  // Initialize monthly buckets
  const monthBuckets = new Map<string, { gastos: number; ingresos: number; label: string }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthBuckets.set(key, {
      gastos: 0,
      ingresos: 0,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
    });
  }

  // Single pass over transactions
  for (const t of allTxns) {
    const desc = t.description.toLowerCase();
    if (desc.includes("linea de credito") || desc.includes("linea de cred")) continue;

    const td = new Date(t.date);
    const key = `${td.getFullYear()}-${td.getMonth()}`;
    const bucket = monthBuckets.get(key);
    if (!bucket) continue;

    if (t.amount < 0) {
      bucket.gastos += Math.abs(t.amount);
    } else {
      bucket.ingresos += t.amount;
    }
  }

  // Build ordered chart data
  const chartData: { month: string; gastos: number; ingresos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = monthBuckets.get(key)!;
    chartData.push({ month: bucket.label, gastos: bucket.gastos, ingresos: bucket.ingresos });
  }

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
