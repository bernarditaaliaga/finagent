import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/transactions
 * Lista transacciones con filtros opcionales
 * Query params: ?categoryId=xxx&month=2026-04&limit=50
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const categoryId = searchParams.get("categoryId");
  const month = searchParams.get("month"); // formato: "2026-04"
  const limit = parseInt(searchParams.get("limit") ?? "100");

  const where: Record<string, unknown> = {};

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (month) {
    const [year, m] = month.split("-").map(Number);
    where.date = {
      gte: new Date(year, m - 1, 1),
      lt: new Date(year, m, 1),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
    take: limit,
  });

  return NextResponse.json(transactions);
}

/**
 * POST /api/transactions
 * Crear transacción manual
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(body.date),
        description: body.description,
        amount: body.amount,
        currency: body.currency ?? "CLP",
        categoryId: body.categoryId ?? null,
      },
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creando transacción:", error);
    return NextResponse.json(
      { error: "Error al crear transacción" },
      { status: 500 }
    );
  }
}
