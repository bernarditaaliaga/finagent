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

    // Obtener día de cierre de la tarjeta (default 26)
    let closeDay = 26;
    if (creditCardId) {
      const card = await prisma.creditCard.findUnique({ where: { id: creditCardId } });
      if (card) closeDay = card.billingCloseDay;
    }

    const purchase = new Date(purchaseDate);
    const { billingStartMonth, billingStartYear } = calcBillingStart(purchase, closeDay);

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
 * PATCH /api/credit-cards/expenses
 * Editar una compra TC
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, description, totalAmount, installments, purchaseDate, categoryId } = body;

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (description !== undefined) updates.description = description;
    if (categoryId !== undefined) updates.categoryId = categoryId || null;

    if (totalAmount !== undefined || installments !== undefined) {
      // Si cambia monto o cuotas, recalcular
      const existing = await prisma.creditCardExpense.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

      const newTotal = totalAmount ?? existing.totalAmount;
      const newInstallments = installments ?? existing.installments;
      updates.totalAmount = newTotal;
      updates.installments = newInstallments;
      updates.installmentAmount = Math.round(newTotal / newInstallments);
    }

    if (purchaseDate !== undefined) {
      const purchase = new Date(purchaseDate);
      updates.purchaseDate = purchase;

      // Obtener día de cierre de la tarjeta
      const existing2 = await prisma.creditCardExpense.findUnique({
        where: { id },
        include: { creditCard: true },
      });
      const closeDay = existing2?.creditCard?.billingCloseDay ?? 26;
      const billing = calcBillingStart(purchase, closeDay);
      updates.billingStartMonth = billing.billingStartMonth;
      updates.billingStartYear = billing.billingStartYear;
    }

    const expense = await prisma.creditCardExpense.update({
      where: { id },
      data: updates,
      include: { category: true },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error editando compra TC:", error);
    return NextResponse.json({ error: "Error al editar" }, { status: 500 });
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
 * Calcula el mes de inicio de facturación según la fecha de compra y el día de cierre.
 * Si la compra es antes o en el día de cierre → se factura el mes siguiente.
 * Si es después del cierre → se factura en 2 meses.
 */
function calcBillingStart(purchase: Date, closeDay: number) {
  const purchaseDay = purchase.getDate();
  const purchaseMonth = purchase.getMonth() + 1;
  const purchaseYear = purchase.getFullYear();

  if (purchaseDay <= closeDay) {
    // Compra antes o en el cierre → factura mes siguiente
    const billingStartMonth = purchaseMonth === 12 ? 1 : purchaseMonth + 1;
    const billingStartYear = purchaseMonth === 12 ? purchaseYear + 1 : purchaseYear;
    return { billingStartMonth, billingStartYear };
  } else {
    // Compra después del cierre → factura en 2 meses
    const nextMonth = purchaseMonth === 12 ? 1 : purchaseMonth + 1;
    const nextYear = purchaseMonth === 12 ? purchaseYear + 1 : purchaseYear;
    const billingStartMonth = nextMonth === 12 ? 1 : nextMonth + 1;
    const billingStartYear = nextMonth === 12 ? nextYear + 1 : nextYear;
    return { billingStartMonth, billingStartYear };
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
