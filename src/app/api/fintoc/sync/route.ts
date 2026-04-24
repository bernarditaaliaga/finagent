import { NextResponse } from "next/server";
import { getAccountsAndMovements, getAccountBalances, getCreditCards } from "@/lib/fintoc";
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

    // Sync credit cards
    try {
      const creditCards = await getCreditCards(linkToken);
      for (const card of creditCards) {
        // Solo guardar tarjetas donde es titular
        if (!card.isTitular) continue;
        await prisma.creditCard.upsert({
          where: { fintocId: card.id },
          update: {
            cupoTotal: card.cupoTotal,
            deudaActual: card.deudaActual,
            name: card.name,
            lastFourDigits: card.lastFourDigits,
            isTitular: card.isTitular,
          },
          create: {
            fintocId: card.id,
            name: card.name,
            lastFourDigits: card.lastFourDigits,
            cupoTotal: card.cupoTotal,
            deudaActual: card.deudaActual,
            isTitular: card.isTitular,
          },
        });
      }
    } catch (e) {
      console.error("Error syncing credit cards:", e);
    }

    // Sync transactions
    const accountsData = await getAccountsAndMovements(linkToken);
    accountCount = accountsData.length;

    for (const { account, movements } of accountsData) {
      const accNumber = account.number as string | undefined;
      const accName = (account.name as string) ?? "Cuenta";
      const last4 = accNumber ? accNumber.slice(-4) : "";
      const fullAccountName = last4 ? `${accName} ••${last4}` : accName;

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
            accountName: fullAccountName,
          },
          create: {
            fintocId: movId,
            date: new Date(postDate),
            description,
            amount,
            currency,
            accountId: account.id as string,
            accountName: fullAccountName,
          },
        });
        totalImported++;
      }
    }

    await prisma.bankLink.update({
      where: { id: bankLink.id },
      data: { lastSync: new Date() },
    });

    // Auto-detectar pagos de gastos/ingresos fijos
    await detectFixedExpensePayments();

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

/**
 * Detecta automáticamente pagos de gastos/ingresos fijos
 * buscando transacciones del mes actual que coincidan con matchKeyword
 */
async function detectFixedExpensePayments() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: {
        isActive: true,
        matchKeyword: { not: null },
      },
    });

    if (fixedExpenses.length === 0) return;

    const monthTransactions = await prisma.transaction.findMany({
      where: { date: { gte: startOfMonth, lt: endOfMonth } },
      select: { description: true, amount: true, date: true },
    });

    for (const expense of fixedExpenses) {
      if (!expense.matchKeyword) continue;

      const keyword = expense.matchKeyword.toLowerCase();
      const isIncome = expense.type === "income";

      // Buscar transacción que contenga el keyword
      const match = monthTransactions.find((t) => {
        const descMatch = t.description.toLowerCase().includes(keyword);
        // Para gastos: monto negativo. Para ingresos: monto positivo
        const signMatch = isIncome ? t.amount > 0 : t.amount < 0;
        return descMatch && signMatch;
      });

      if (match) {
        // Encontró el pago → actualizar lastPaidAt
        const alreadyPaid = expense.lastPaidAt &&
          expense.lastPaidAt >= startOfMonth && expense.lastPaidAt < endOfMonth;

        if (!alreadyPaid) {
          await prisma.fixedExpense.update({
            where: { id: expense.id },
            data: { lastPaidAt: match.date },
          });
        }
      }
    }
  } catch (e) {
    console.error("Error detectando pagos fijos:", e);
  }
}
