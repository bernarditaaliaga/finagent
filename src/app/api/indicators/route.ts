import { NextResponse } from "next/server";
import { getIndicators } from "@/lib/indicators";

/**
 * GET /api/indicators
 * Retorna UF, Dólar, Euro, UTM, IPC del día
 */
export async function GET() {
  try {
    const indicators = await getIndicators();
    return NextResponse.json(indicators);
  } catch (error) {
    console.error("Error obteniendo indicadores:", error);
    return NextResponse.json(
      { error: "Error al obtener indicadores financieros" },
      { status: 500 }
    );
  }
}
