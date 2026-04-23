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
