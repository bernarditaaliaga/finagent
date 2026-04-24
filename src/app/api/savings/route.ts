import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/savings
 * Lista todas las metas de ahorro
 */
export async function GET() {
  const goals = await prisma.savingsGoal.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(goals);
}

/**
 * POST /api/savings
 * Crear meta de ahorro
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const goal = await prisma.savingsGoal.create({
      data: {
        name: body.name,
        targetAmount: body.targetAmount,
        currentAmount: body.currentAmount ?? 0,
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Error creando meta:", error);
    return NextResponse.json(
      { error: "Error al crear meta de ahorro" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/savings?id=xxx
 * Eliminar meta de ahorro
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    await prisma.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando meta:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
