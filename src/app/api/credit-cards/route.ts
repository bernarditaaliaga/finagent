import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const cards = await prisma.creditCard.findMany({
    where: { isTitular: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const card = await prisma.creditCard.create({
      data: {
        name: body.name,
        lastFourDigits: body.lastFourDigits ?? null,
        cupoTotal: body.cupoTotal,
        deudaActual: body.deudaActual ?? 0,
        facturadoMes: body.facturadoMes ?? 0,
        pagadoMes: body.pagadoMes ?? 0,
        billingCloseDay: body.billingCloseDay ?? 26,
        isTitular: true,
      },
    });
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Error creando tarjeta:", error);
    return NextResponse.json({ error: "Error al crear tarjeta" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const card = await prisma.creditCard.update({
      where: { id },
      data,
    });
    return NextResponse.json(card);
  } catch (error) {
    console.error("Error actualizando tarjeta:", error);
    return NextResponse.json({ error: "Error al actualizar tarjeta" }, { status: 500 });
  }
}
