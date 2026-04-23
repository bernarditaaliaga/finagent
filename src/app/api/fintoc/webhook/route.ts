import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/webhook
 *
 * Fintoc envía eventos aquí cuando se crea un link exitosamente.
 * El evento contiene el link_token que necesitamos para acceder a cuentas y movimientos.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("=== FINTOC WEBHOOK ===");
    console.log(JSON.stringify(body, null, 2));

    // Fintoc envía el evento con el link y su link_token
    const link = body.data || body.link || body;
    const linkToken = link.link_token || link.linkToken;
    const linkId = link.id;
    const institution = link.institution?.name ?? "Banco de Chile";
    const holderName = link.holder_name ?? link.holderName ?? null;

    if (linkToken && linkId) {
      await prisma.bankLink.upsert({
        where: { fintocLinkId: linkId },
        update: { lastSync: new Date() },
        create: {
          fintocLinkId: linkToken, // guardamos el link_token como ID
          bankName: institution,
          holderName: holderName,
          lastSync: new Date(),
        },
      });
      console.log(`Link guardado: ${linkId} con token: ${linkToken}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ received: true }); // siempre responder 200
  }
}
