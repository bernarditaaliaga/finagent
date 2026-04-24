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

    // Fetch all data from Fintoc in parallel
    type BalanceItem = { id: string; name: string; type: string; number: string; available: number; current: number; limit: number; currency: string };
    type CardItem = { id: string; name: string; lastFourDigits: string | null; cupoTotal: number; deudaActual: number; available: number; isTitular: boolean; currency: string };

    const [balances, creditCards, accountsData] = await Promise.all([
      getAccountBalances(linkToken).catch((e) => {
        console.error("Error fetching balances:", e);
        return [] as BalanceItem[];
      }) as Promise<BalanceItem[]>,
      getCreditCards(linkToken).catch((e) => {
        console.error("Error fetching credit cards:", e);
        return [] as CardItem[];
      }) as Promise<CardItem[]>,
      getAccountsAndMovements(linkToken),
    ]);

    // Sync balances — batch with Promise.all
    if (balances.length > 0) {
      await Promise.all(
        balances.map((acc) =>
          prisma.bankAccount.upsert({
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
          })
        )
      );
    }

    // Sync credit cards — batch with Promise.all
    const titularCards = creditCards.filter((c) => c.isTitular);
    if (titularCards.length > 0) {
      await Promise.all(
        titularCards.map((card) =>
          prisma.creditCard.upsert({
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
          })
        )
      );
    }

    // Sync transactions — batch in chunks of 20 for concurrency
    accountCount = accountsData.length;
    const allUpserts: Promise<unknown>[] = [];

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

        // Auto-ignorar movimientos internos que no son gasto/ingreso real
        // PERO: pagar la línea de crédito SÍ es un gasto real (devuelves deuda)
        const descLower = description.toLowerCase();
        const isPayingCreditLine =
          descLower.includes("traspaso a:") && descLower.includes("linea de cred");
        const shouldIgnore = !isPayingCreditLine && (
          descLower.includes("linea de cred") ||
          descLower.includes("linea de credito") ||
          descLower.includes("transferencia desde linea") ||
          descLower.includes("amortizacion a linea") ||
          descLower.startsWith("traspaso a:") ||
          descLower.startsWith("traspaso de:")
        );

        allUpserts.push(
          prisma.transaction.upsert({
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
              isIgnored: shouldIgnore,
            },
          })
        );
        totalImported++;
      }
    }

    // Execute in batches of 20 to avoid overwhelming the DB
    const BATCH_SIZE = 20;
    for (let i = 0; i < allUpserts.length; i += BATCH_SIZE) {
      await Promise.all(allUpserts.slice(i, i + BATCH_SIZE));
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

    const [fixedExpenses, monthTransactions] = await Promise.all([
      prisma.fixedExpense.findMany({
        where: {
          isActive: true,
          matchKeyword: { not: null },
        },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: startOfMonth, lt: endOfMonth }, isIgnored: false },
        select: { description: true, amount: true, date: true },
      }),
    ]);

    if (fixedExpenses.length === 0) return;

    const updates: Promise<unknown>[] = [];

    for (const expense of fixedExpenses) {
      if (!expense.matchKeyword) continue;

      const keyword = expense.matchKeyword.toLowerCase();
      const isIncome = expense.type === "income";

      const match = monthTransactions.find((t) => {
        const descMatch = t.description.toLowerCase().includes(keyword);
        const signMatch = isIncome ? t.amount > 0 : t.amount < 0;
        return descMatch && signMatch;
      });

      if (match) {
        const alreadyPaid = expense.lastPaidAt &&
          expense.lastPaidAt >= startOfMonth && expense.lastPaidAt < endOfMonth;

        if (!alreadyPaid) {
          updates.push(
            prisma.fixedExpense.update({
              where: { id: expense.id },
              data: { lastPaidAt: match.date },
            })
          );
        }
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (e) {
    console.error("Error detectando pagos fijos:", e);
  }
}
