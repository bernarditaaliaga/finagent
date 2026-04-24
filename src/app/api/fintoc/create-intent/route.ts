import { NextResponse } from "next/server";
import { createLinkIntent } from "@/lib/fintoc";

/**
 * POST /api/fintoc/create-intent
 *
 * Crea un link_intent en Fintoc y retorna el widget_token
 * para abrir el widget con el flujo de exchange.
 */
export async function POST() {
  try {
    const intent = await createLinkIntent();
    return NextResponse.json({
      widgetToken: intent.widget_token,
      linkIntentId: intent.id,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error creando link_intent:", errorMsg);
    return NextResponse.json(
      { error: `Error creando intent: ${errorMsg}` },
      { status: 500 }
    );
  }
}
