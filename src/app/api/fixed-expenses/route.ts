import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/fixed-expenses
 * Lista todos los gastos fijos
 */
export async function GET() {
  const expenses = await prisma.fixedExpense.findMany({
    include: { category: true },
    orderBy: { dayOfMonth: "asc" },
  });
  return NextResponse.json(expenses);
}

/**
 * POST /api/fixed-expenses
 * Crear gasto fijo (ej: "Luz", día 4 de cada mes, $45.000)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const expense = await prisma.fixedExpense.create({
      data: {
        name: body.name,
        amount: body.amount,
        dayOfMonth: body.dayOfMonth,
        categoryId: body.categoryId ?? null,
        isActive: true,
      },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Error creando gasto fijo:", error);
    return NextResponse.json(
      { error: "Error al crear gasto fijo" },
      { status: 500 }
    );
  }
}
