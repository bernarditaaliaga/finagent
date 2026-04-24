import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/categories
 * Lista todas las categorías con el total gastado en el mes actual
 */
export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const categories = await prisma.category.findMany({
    include: {
      transactions: {
        where: {
          date: { gte: startOfMonth, lt: endOfMonth },
        },
        select: { amount: true },
      },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });

  // Calcular total gastado por categoría este mes
  const result = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    budgetLimit: cat.budgetLimit,
    priority: cat.priority,
    frequency: cat.frequency,
    totalTransactions: cat._count.transactions,
    spentThisMonth: cat.transactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    ),
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/categories
 * Crear nueva categoría
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const category = await prisma.category.create({
      data: {
        name: body.name,
        icon: body.icon ?? null,
        color: body.color ?? "#6B7280",
        budgetLimit: body.budgetLimit ?? null,
        priority: body.priority ?? null,
        frequency: body.frequency ?? "recurrente",
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creando categoría:", error);
    return NextResponse.json(
      { error: "Error al crear categoría" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/categories
 * Actualizar categoría (ej: cambiar prioridad)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.budgetLimit !== undefined && { budgetLimit: data.budgetLimit }),
        ...(data.frequency !== undefined && { frequency: data.frequency }),
      },
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Error actualizando categoría:", error);
    return NextResponse.json(
      { error: "Error al actualizar categoría" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories?id=xxx
 * Eliminar categoría. Las transacciones quedan sin categoría.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Desasociar transacciones (quedan sin categoría)
    await prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    // Eliminar reglas asociadas
    await prisma.categoryRule.deleteMany({ where: { categoryId: id } });

    // Eliminar budgets asociados
    await prisma.categoryBudget.deleteMany({ where: { categoryId: id } });

    // Eliminar la categoría
    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    return NextResponse.json(
      { error: "Error al eliminar categoría" },
      { status: 500 }
    );
  }
}
