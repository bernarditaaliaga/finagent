import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/split
 * Crear un grupo de split con miembros
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const group = await prisma.splitGroup.create({
      data: {
        name: body.name,
        members: {
          create: body.members.map((name: string) => ({ name })),
        },
      },
      include: { members: true },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Error creando grupo:", error);
    return NextResponse.json(
      { error: "Error al crear grupo" },
      { status: 500 }
    );
  }
}
