import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/update-token
 * Updates the link_token for the most recent bank link.
 */
export async function POST(request: Request) {
  try {
    const { linkToken } = await request.json();
    if (!linkToken) {
      return NextResponse.json({ error: "linkToken required" }, { status: 400 });
    }

    const bankLink = await prisma.bankLink.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!bankLink) {
      // Create a new one
      await prisma.bankLink.create({
        data: {
          fintocLinkId: linkToken,
          bankName: "Banco de Chile",
          lastSync: new Date(),
        },
      });
    } else {
      await prisma.bankLink.update({
        where: { id: bankLink.id },
        data: { fintocLinkId: linkToken },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
