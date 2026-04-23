import { getIndicators } from "@/lib/indicators";

export default async function IndicadoresPage() {
  let indicators: Record<string, { nombre: string; valor: number; unidad_medida: string; fecha: string }> = {};
  let error = "";

  try {
    indicators = await getIndicators();
  } catch {
    error = "No se pudieron cargar los indicadores";
  }

  const format = (val: number, unit: string) => {
    if (unit === "Pesos") return `$${val.toLocaleString("es-CL")}`;
    if (unit === "Porcentaje") return `${val}%`;
    return val.toLocaleString("es-CL");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Indicadores Financieros</h1>
        <p className="text-slate-500">Valores del dia - fuente: Banco Central de Chile</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(indicators).map((ind) => (
            <div
              key={ind.nombre}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100"
            >
              <p className="text-sm text-slate-500">{ind.nombre}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {format(ind.valor, ind.unidad_medida)}
              </p>
              <p className="text-xs text-slate-400 mt-1">{ind.unidad_medida}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
