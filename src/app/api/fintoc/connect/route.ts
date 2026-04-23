import { NextResponse } from "next/server";
import { getLinks } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/connect
 *
 * Recibe datos del widget onSuccess + busca en la API de Fintoc
 * para guardar el link bancario en la DB.
 */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // no body is ok
    }

    const widgetData = body.widgetData as Record<string, unknown> | undefined;
    console.log("=== CONNECT: widgetData ===", JSON.stringify(widgetData));

    // Buscar links en Fintoc API
    const links = await getLinks();
    console.log("=== CONNECT: links from API ===", JSON.stringify(
      links.map((l: Record<string, unknown>) => ({
        id: l.id,
        link_token: l.link_token,
        status: l.status,
      }))
    ));

    if (links.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron links en Fintoc" },
        { status: 400 }
      );
    }

    // Tomar el link más reciente
    const link = links[0] as Record<string, unknown>;
    const linkId = link.id as string;
    const institution = link.institution as Record<string, string> | undefined;
    const holderName = (link.holder_name || link.holderName || null) as string | null;

    // El link_token puede venir de: API, widget callback, o usamos el linkId como fallback
    const linkToken = (link.link_token as string)
      || (widgetData?.link_token as string)
      || (widgetData?.linkToken as string)
      || linkId;

    // Guardar en BD
    await prisma.bankLink.upsert({
      where: { fintocLinkId: linkId },
      update: {
        lastSync: new Date(),
      },
      create: {
        fintocLinkId: linkId,
        bankName: institution?.name ?? "Banco de Chile",
        holderName: holderName,
        lastSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      linkId: linkId,
      linkToken: linkToken,
      bank: institution?.name,
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
