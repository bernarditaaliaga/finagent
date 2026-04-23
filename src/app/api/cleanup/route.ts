import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/cleanup
 * Deletes all test/demo transactions and old bank links.
 * Keeps only data from real bank sync.
 */
export async function POST() {
  try {
    // Delete all existing transactions
    const deleted = await prisma.transaction.deleteMany({});

    // Delete old bank links (we'll re-create from the live one)
    await prisma.bankLink.deleteMany({});

    // Re-create the live bank link
    await prisma.bankLink.create({
      data: {
        fintocLinkId: process.env.FINTOC_LIVE_LINK_TOKEN || "link_nyJGj7i6gKgJkdEN_token_PKmFHxc1_i-fxiyFNysaVxgE",
        bankName: "Banco de Chile",
        holderName: "Bernardita Maria Aliaga Perez",
        lastSync: null,
      },
    });

    return NextResponse.json({
      success: true,
      deletedTransactions: deleted.count,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
