import { NextResponse } from "next/server";
import { getLinks } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/connect
 *
 * Después de que el usuario se loguea en el widget,
 * buscamos los links existentes en Fintoc y guardamos el más reciente.
 */
export async function POST() {
  try {
    const links = await getLinks();
    console.log("Links encontrados:", links.length);
    console.log("Links:", JSON.stringify(links.map((l: Record<string, unknown>) => ({
      id: l.id,
      link_token: l.link_token || l.linkToken,
      status: l.status,
    }))));

    if (links.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron links en Fintoc" },
        { status: 400 }
      );
    }

    // Tomar el link más reciente
    const link = links[0] as Record<string, unknown>;
    const linkToken = (link.link_token || link.linkToken || link.id) as string;
    const institution = link.institution as Record<string, string> | undefined;

    // Guardar en BD
    await prisma.bankLink.upsert({
      where: { fintocLinkId: linkToken },
      update: { lastSync: new Date() },
      create: {
        fintocLinkId: linkToken,
        bankName: institution?.name ?? "Banco de Chile",
        holderName: (link.holder_name || link.holderName || null) as string | null,
        lastSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      linkId: link.id,
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
