import { NextResponse } from "next/server";
import { getAccountsAndMovements } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/sync
 * Sincroniza transacciones desde Fintoc a nuestra BD.
 */
export async function POST() {
  try {
    const bankLink = await prisma.bankLink.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!bankLink) {
      return NextResponse.json(
        { error: "No hay banco conectado. Conecta tu banco primero." },
        { status: 400 }
      );
    }

    const linkToken = bankLink.fintocLinkId;
    console.log("Syncing with link token:", linkToken);

    const accountsData = await getAccountsAndMovements(linkToken);

    let totalImported = 0;

    for (const { account, movements } of accountsData) {
      for (const mov of movements) {
        const movId = (mov.id as string) ?? `manual_${Date.now()}_${totalImported}`;
        const description = (mov.description as string) ?? "Sin descripción";
        const amount = mov.amount as number;
        const postDate = (mov.post_date as string) || (mov.postDate as string) || new Date().toISOString();
        const movType = mov.type as string;
        const currency = (mov.currency as string) ?? "CLP";

        await prisma.transaction.upsert({
          where: { fintocId: movId },
          update: {
            amount: movType === "debit" ? -Math.abs(amount) : Math.abs(amount),
            description,
            date: new Date(postDate),
          },
          create: {
            fintocId: movId,
            date: new Date(postDate),
            description,
            amount: movType === "debit" ? -Math.abs(amount) : Math.abs(amount),
            currency,
            accountId: account.id as string,
          },
        });
        totalImported++;
      }
    }

    await prisma.bankLink.update({
      where: { id: bankLink.id },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      imported: totalImported,
      accounts: accountsData.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error sincronizando:", errorMsg);
    return NextResponse.json(
      { error: `Error al sincronizar: ${errorMsg}` },
      { status: 500 }
    );
  }
}
