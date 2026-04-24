import { NextResponse } from "next/server";
import { exchangeLinkToken } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/connect
 *
 * Recibe linkIntentId + exchangeToken del widget onSuccess,
 * llama al endpoint de exchange para obtener el link_token real,
 * y lo guarda en la BD.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const linkIntentId = body.linkIntentId as string | undefined;
    const exchangeToken = body.exchangeToken as string | undefined;

    if (!linkIntentId || !exchangeToken) {
      return NextResponse.json(
        { error: "Faltan linkIntentId o exchangeToken del widget" },
        { status: 400 }
      );
    }

    console.log("=== CONNECT: exchanging token for linkIntent", linkIntentId);

    // Exchange para obtener el link_token real (formato: link_XXX_token_YYY)
    const exchangeResult = await exchangeLinkToken(linkIntentId, exchangeToken);
    const linkToken = exchangeResult.link_token;
    const bankName = exchangeResult.institution?.name ?? "Banco de Chile";
    const holderName = exchangeResult.holder_name ?? null;

    console.log("=== CONNECT: got link_token", linkToken?.slice(0, 20) + "...");

    if (!linkToken) {
      return NextResponse.json(
        { error: "No se recibió link_token del exchange" },
        { status: 500 }
      );
    }

    // Guardar en BD — fintocLinkId almacena el link_token para usar en API calls
    await prisma.bankLink.deleteMany({});
    await prisma.bankLink.create({
      data: {
        fintocLinkId: linkToken,
        bankName,
        holderName,
        lastSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      linkId: exchangeResult.id,
      bank: bankName,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error conectando banco:", errorMsg);
    return NextResponse.json(
      { error: `Error al conectar: ${errorMsg}` },
      { status: 500 }
    );
  }
}
