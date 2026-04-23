import { NextResponse } from "next/server";
import { getAccountsAndMovements } from "@/lib/fintoc";
import { prisma } from "@/lib/db";

/**
 * Transacciones de ejemplo para modo demo (cuando no hay link_token real)
 */
function getDemoTransactions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return [
    { id: "demo_1", date: new Date(year, month, 1), description: "Sueldo Abril", amount: 1850000, type: "credit" },
    { id: "demo_2", date: new Date(year, month, 3), description: "Arriendo departamento", amount: 550000, type: "debit" },
    { id: "demo_3", date: new Date(year, month, 4), description: "Cuenta de luz - Enel", amount: 42000, type: "debit" },
    { id: "demo_4", date: new Date(year, month, 5), description: "Supermercado Jumbo", amount: 87500, type: "debit" },
    { id: "demo_5", date: new Date(year, month, 6), description: "Spotify Premium", amount: 5490, type: "debit" },
    { id: "demo_6", date: new Date(year, month, 7), description: "Netflix", amount: 9990, type: "debit" },
    { id: "demo_7", date: new Date(year, month, 8), description: "Uber - viaje al trabajo", amount: 4200, type: "debit" },
    { id: "demo_8", date: new Date(year, month, 9), description: "Farmacia Cruz Verde", amount: 15800, type: "debit" },
    { id: "demo_9", date: new Date(year, month, 10), description: "Agua - Aguas Andinas", amount: 18500, type: "debit" },
    { id: "demo_10", date: new Date(year, month, 11), description: "Internet VTR", amount: 29990, type: "debit" },
    { id: "demo_11", date: new Date(year, month, 12), description: "Colegiatura hijo", amount: 320000, type: "debit" },
    { id: "demo_12", date: new Date(year, month, 13), description: "Almuerzo restaurante", amount: 12500, type: "debit" },
    { id: "demo_13", date: new Date(year, month, 14), description: "Bencina Copec", amount: 45000, type: "debit" },
    { id: "demo_14", date: new Date(year, month, 15), description: "Transferencia recibida - freelance", amount: 350000, type: "credit" },
    { id: "demo_15", date: new Date(year, month, 16), description: "Supermercado Lider", amount: 63200, type: "debit" },
    { id: "demo_16", date: new Date(year, month, 17), description: "Carrete - bar con amigos", amount: 28000, type: "debit" },
    { id: "demo_17", date: new Date(year, month, 18), description: "Gas - Metrogas", amount: 22000, type: "debit" },
    { id: "demo_18", date: new Date(year, month, 19), description: "Gimnasio SmartFit", amount: 19990, type: "debit" },
    { id: "demo_19", date: new Date(year, month, 20), description: "Pedidos Ya - delivery", amount: 15600, type: "debit" },
    { id: "demo_20", date: new Date(year, month, 21), description: "Ropa Falabella", amount: 54990, type: "debit" },
  ];
}

/**
 * POST /api/fintoc/sync
 * Sincroniza transacciones desde Fintoc a nuestra BD.
 * Si no hay link_token válido, carga transacciones demo.
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
    let isDemo = false;

    // Intentar sync real con Fintoc
    try {
      const accountsData = await getAccountsAndMovements(linkToken);
      accountCount = accountsData.length;

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
    } catch (fintocError) {
      // Si Fintoc falla (no hay link_token válido), cargar datos demo
      console.log("Fintoc sync failed, loading demo data:", fintocError);
      isDemo = true;
      accountCount = 1;

      const demoTransactions = getDemoTransactions();
      for (const tx of demoTransactions) {
        const txAmount = tx.type === "debit" ? -Math.abs(tx.amount) : Math.abs(tx.amount);
        await prisma.transaction.upsert({
          where: { fintocId: tx.id },
          update: {
            amount: txAmount,
            description: tx.description,
            date: tx.date,
            accountName: "Cuenta Demo",
          },
          create: {
            fintocId: tx.id,
            date: tx.date,
            description: tx.description,
            amount: txAmount,
            currency: "CLP",
            accountId: "demo_account",
            accountName: "Cuenta Demo",
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
      demo: isDemo,
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
