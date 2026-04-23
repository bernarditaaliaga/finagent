import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/categorize/rules
 * Lista todas las reglas de categorización con nombre de categoría
 */
export async function GET() {
  const rules = await prisma.categoryRule.findMany({
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const result = rules.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    categoryId: r.categoryId,
    issender: r.issender,
    categoryName: r.category.name,
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/categorize/rules
 * Crear nueva regla de categorización
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { keyword, categoryId, issender } = body;

    if (!keyword || !categoryId) {
      return NextResponse.json(
        { error: "keyword y categoryId son requeridos" },
        { status: 400 }
      );
    }

    const rule = await prisma.categoryRule.create({
      data: {
        keyword: keyword.trim(),
        categoryId,
        issender: issender ?? false,
      },
      include: { category: { select: { name: true } } },
    });

    return NextResponse.json({
      id: rule.id,
      keyword: rule.keyword,
      categoryId: rule.categoryId,
      issender: rule.issender,
      categoryName: rule.category.name,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creando regla:", error);
    return NextResponse.json(
      { error: "Error al crear regla" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categorize/rules?id=xxx
 * Eliminar una regla de categorización
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id es requerido" },
        { status: 400 }
      );
    }

    await prisma.categoryRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando regla:", error);
    return NextResponse.json(
      { error: "Error al eliminar regla" },
      { status: 500 }
    );
  }
}
