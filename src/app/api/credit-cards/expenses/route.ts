import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/credit-cards/expenses
 * Lista todas las compras TC, opcionalmente filtradas por mes de facturación
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const expenses = await prisma.creditCardExpense.findMany({
    include: { category: true, creditCard: true },
    orderBy: { purchaseDate: "desc" },
  });

  // Si piden un mes específico, filtrar las que tienen cuota ese mes
  if (month && year) {
    const m = parseInt(month);
    const y = parseInt(year);
    const filtered = expenses.filter((exp) => {
      return isActiveInMonth(exp.billingStartMonth, exp.billingStartYear, exp.installments, m, y);
    });
    return NextResponse.json(filtered);
  }

  return NextResponse.json(expenses);
}

/**
 * POST /api/credit-cards/expenses
 * Registrar una compra con TC
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, totalAmount, installments, purchaseDate, categoryId, creditCardId } = body;

    const numInstallments = installments || 1;
    const installmentAmount = Math.round(totalAmount / numInstallments);

    // Calcular mes de inicio de facturación según ciclo de cierre (28 del mes)
    const purchase = new Date(purchaseDate);
    const purchaseDay = purchase.getDate();
    const purchaseMonth = purchase.getMonth() + 1;
    const purchaseYear = purchase.getFullYear();

    // Si la compra es antes del cierre (28), se factura el mes siguiente
    // Si es después del 28, se factura en 2 meses
    let billingStartMonth: number;
    let billingStartYear: number;

    if (purchaseDay <= 28) {
      // Compra antes del cierre → se factura el mes siguiente
      billingStartMonth = purchaseMonth === 12 ? 1 : purchaseMonth + 1;
      billingStartYear = purchaseMonth === 12 ? purchaseYear + 1 : purchaseYear;
    } else {
      // Compra después del cierre → se factura en 2 meses
      const nextMonth = purchaseMonth === 12 ? 1 : purchaseMonth + 1;
      const nextYear = purchaseMonth === 12 ? purchaseYear + 1 : purchaseYear;
      billingStartMonth = nextMonth === 12 ? 1 : nextMonth + 1;
      billingStartYear = nextMonth === 12 ? nextYear + 1 : nextYear;
    }

    const expense = await prisma.creditCardExpense.create({
      data: {
        description,
        totalAmount,
        installments: numInstallments,
        installmentAmount,
        purchaseDate: purchase,
        billingStartMonth,
        billingStartYear,
        categoryId: categoryId || null,
        creditCardId: creditCardId || null,
      },
      include: { category: true },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Error registrando compra TC:", error);
    return NextResponse.json({ error: "Error al registrar compra" }, { status: 500 });
  }
}

/**
 * DELETE /api/credit-cards/expenses?id=xxx
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await prisma.creditCardExpense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando compra TC:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

/**
 * Verifica si una compra tiene cuota activa en un mes dado
 */
function isActiveInMonth(
  startMonth: number, startYear: number,
  installments: number,
  targetMonth: number, targetYear: number
): boolean {
  const startTotal = startYear * 12 + startMonth;
  const endTotal = startTotal + installments - 1;
  const targetTotal = targetYear * 12 + targetMonth;
  return targetTotal >= startTotal && targetTotal <= endTotal;
}
