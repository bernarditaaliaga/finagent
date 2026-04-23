import { NextResponse } from "next/server";
import { getAccountsAndMovements, getAccountBalances } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * POST /api/fintoc/sync
 * Sincroniza transacciones y balances desde Fintoc a nuestra BD.
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
    let totalImported = 0;
    let accountCount = 0;

    // Sync balances
    try {
      const balances = await getAccountBalances(linkToken);
      for (const acc of balances) {
        await prisma.bankAccount.upsert({
          where: { fintocId: acc.id },
          update: {
            available: acc.available,
            current: acc.current,
            creditLimit: acc.limit ?? 0,
            name: acc.name,
          },
          create: {
            fintocId: acc.id,
            name: acc.name,
            type: acc.type,
            number: acc.number,
            available: acc.available,
            current: acc.current,
            creditLimit: acc.limit ?? 0,
            currency: acc.currency,
          },
        });
      }
    } catch (e) {
      console.error("Error syncing balances:", e);
    }

    // Sync transactions
    const accountsData = await getAccountsAndMovements(linkToken);
    accountCount = accountsData.length;

    for (const { account, movements } of accountsData) {
      for (const mov of movements) {
        const movId = (mov.id as string) ?? `manual_${Date.now()}_${totalImported}`;
        const description = (mov.description as string) ?? "Sin descripción";
        const amount = mov.amount as number;
        const postDate = (mov.post_date as string) || (mov.postDate as string) || new Date().toISOString();
        const currency = (mov.currency as string) ?? "CLP";

        await prisma.transaction.upsert({
          where: { fintocId: movId },
          update: {
            amount,
            description,
            date: new Date(postDate),
            accountName: (account.name as string) ?? null,
          },
          create: {
            fintocId: movId,
            date: new Date(postDate),
            description,
            amount,
            currency,
            accountId: account.id as string,
            accountName: (account.name as string) ?? null,
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
      accounts: accountCount,
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
