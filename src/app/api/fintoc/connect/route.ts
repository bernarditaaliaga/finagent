import { NextResponse } from "next/server";
import { exchangeLinkToken, getLinkById } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/connect
 *
 * Estrategia dual:
 *   A) Si hay exchangeToken → exchange para obtener link_token
 *   B) Si no hay exchangeToken pero hay linkId → GET /links/{linkId} como fallback
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const linkIntentId = body.linkIntentId as string | undefined;
    const exchangeToken = body.exchangeToken as string | undefined;
    const linkId = body.linkId as string | undefined;

    console.log("=== CONNECT: received", { linkIntentId, exchangeToken: !!exchangeToken, linkId });

    if (!linkIntentId) {
      return NextResponse.json(
        { error: "Falta linkIntentId" },
        { status: 400 }
      );
    }

    let linkToken: string | undefined;
    let bankName = "Banco de Chile";
    let holderName: string | null = null;
    let resultId: string | undefined;

    // Camino A: exchange token disponible (flujo ideal)
    if (exchangeToken) {
      console.log("=== CONNECT: Camino A — exchange token for linkIntent", linkIntentId);
      const exchangeResult = await exchangeLinkToken(linkIntentId, exchangeToken);
      linkToken = exchangeResult.link_token;
      bankName = exchangeResult.institution?.name ?? bankName;
      holderName = exchangeResult.holder_name ?? null;
      resultId = exchangeResult.id;
      console.log("=== CONNECT: exchange OK, link_token", linkToken?.slice(0, 20) + "...");
    }
    // Camino B: sin exchangeToken, usar linkId para GET el link directamente
    else if (linkId) {
      console.log("=== CONNECT: Camino B — GET link by id", linkId);
      const linkData = await getLinkById(linkId);
      linkToken = linkData.link_token;
      bankName = linkData.institution?.name ?? bankName;
      holderName = linkData.holder_name ?? null;
      resultId = linkData.id;
      console.log("=== CONNECT: GET link OK, link_token", linkToken?.slice(0, 20) + "...");
    } else {
      return NextResponse.json(
        { error: "Se necesita exchangeToken o linkId del widget" },
        { status: 400 }
      );
    }

    if (!linkToken) {
      return NextResponse.json(
        { error: "No se recibió link_token" },
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
      linkId: resultId,
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
