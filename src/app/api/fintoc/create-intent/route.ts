import { NextResponse } from "next/server";
import { createLinkIntent } from "@/lib/fintoc";

/**
 * POST /api/fintoc/create-intent
 * Crea un Link Intent en Fintoc y devuelve el widget_token
 * para que el frontend abra el widget.
 */
export async function POST() {
  try {
    const intent = await createLinkIntent();
    console.log("Link Intent created:", JSON.stringify(intent));
    return NextResponse.json({
      widgetToken: intent.widget_token,
      intentId: intent.id,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error creando link intent:", errorMsg);
    return NextResponse.json(
      { error: `Error creando link intent: ${errorMsg}` },
      { status: 500 }
    );
  }
}
