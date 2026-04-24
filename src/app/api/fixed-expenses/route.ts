import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/fixed-expenses
 * Lista todos los gastos/ingresos fijos
 */
export async function GET() {
  const expenses = await prisma.fixedExpense.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(expenses);
}

/**
 * POST /api/fixed-expenses
 * Crear gasto/ingreso fijo con soporte USD
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, amount, amountUsd, currency, dayOfMonth, categoryId, type, matchKeyword } = body;

    let finalAmount = amount;

    // Si es USD, convertir a CLP usando mindicador.cl
    if (currency === "USD" && amountUsd) {
      try {
        const res = await fetch("https://mindicador.cl/api/dolar");
        const data = await res.json();
        const dolarValue = data.serie[0].valor;
        finalAmount = Math.round(amountUsd * dolarValue);
      } catch {
        return NextResponse.json(
          { error: "No se pudo obtener el valor del dólar" },
          { status: 500 }
        );
      }
    }

    const expense = await prisma.fixedExpense.create({
      data: {
        name,
        amount: finalAmount,
        amountUsd: currency === "USD" ? amountUsd : null,
        currency: currency || "CLP",
        dayOfMonth: dayOfMonth || null,
        categoryId: categoryId || null,
        type: type || "expense",
        matchKeyword: matchKeyword || null,
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

/**
 * PATCH /api/fixed-expenses
 * Actualizar gasto fijo (amount USD se reconvierte)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Si actualiza USD, reconvertir
    if (updates.currency === "USD" && updates.amountUsd) {
      try {
        const res = await fetch("https://mindicador.cl/api/dolar");
        const data = await res.json();
        const dolarValue = data.serie[0].valor;
        updates.amount = Math.round(updates.amountUsd * dolarValue);
      } catch {
        return NextResponse.json(
          { error: "No se pudo obtener el valor del dólar" },
          { status: 500 }
        );
      }
    }

    const expense = await prisma.fixedExpense.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error actualizando gasto fijo:", error);
    return NextResponse.json(
      { error: "Error al actualizar" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fixed-expenses
 * Eliminar gasto fijo
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.fixedExpense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando gasto fijo:", error);
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
}
