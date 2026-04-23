/**
 * Indicadores financieros chilenos en tiempo real
 * Fuente: mindicador.cl (API gratuita del Banco Central)
 *
 * Obtiene: UF, Dólar, Euro, UTM, IPC, Tasa de interés
 */

export interface Indicator {
  codigo: string;
  nombre: string;
  unidad_medida: string;
  valor: number;
  fecha: string;
}

// Obtiene todos los indicadores del día
export async function getIndicators(): Promise<Record<string, Indicator>> {
  const res = await fetch("https://mindicador.cl/api", {
    next: { revalidate: 3600 }, // cachea por 1 hora
  });
  if (!res.ok) throw new Error("Error obteniendo indicadores");
  const data = await res.json();

  // Extraemos los que nos interesan
  const relevant = ["uf", "dolar", "euro", "utm", "ipc"];
  const result: Record<string, Indicator> = {};

  for (const key of relevant) {
    if (data[key]) {
      result[key] = {
        codigo: key,
        nombre: data[key].nombre,
        unidad_medida: data[key].unidad_medida,
        valor: data[key].valor,
        fecha: data[key].fecha,
      };
    }
  }

  return result;
}

// Obtiene el historial de un indicador específico (para gráficos)
export async function getIndicatorHistory(
  indicator: string,
  year?: number
): Promise<{ fecha: string; valor: number }[]> {
  const url = year
    ? `https://mindicador.cl/api/${indicator}/${year}`
    : `https://mindicador.cl/api/${indicator}`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Error obteniendo historial de ${indicator}`);
  const data = await res.json();

  return data.serie.map((item: { fecha: string; valor: number }) => ({
    fecha: item.fecha,
    valor: item.valor,
  }));
}
