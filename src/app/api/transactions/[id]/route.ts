import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/transactions/[id]
 * Actualiza una transacción (ej: asignarle categoría)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.amount !== undefined && { amount: body.amount }),
      },
      include: { category: true },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error actualizando transacción:", error);
    return NextResponse.json(
      { error: "Error al actualizar transacción" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando transacción:", error);
    return NextResponse.json(
      { error: "Error al eliminar transacción" },
      { status: 500 }
    );
  }
}
