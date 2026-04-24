import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_RULES: Record<string, string[]> = {
  Transporte: [
    "copec", "shell", "aramco", "petrobras", "uber", "didi", "cabify",
    "bencina", "combustible", "estacionamiento", "tag", "peaje", "metro",
  ],
  Supermercado: [
    "jumbo", "lider", "santa isabel", "unimarc", "tottus", "supermercado",
  ],
  Comida: [
    "rappi", "pedidosya", "uber eats", "cornershop", "restaurante",
    "mcdonalds", "starbucks", "burger", "pizza", "sushi",
  ],
  Hogar: [
    "enel", "aguas andinas", "metrogas", "engie", "luz", "agua", "gas",
    "internet", "vtr", "movistar", "claro", "wom", "entel",
  ],
  Entretenimiento: [
    "spotify", "netflix", "disney", "hbo", "amazon prime", "youtube",
    "steam", "playstation", "cine",
  ],
  Salud: [
    "farmacia", "cruz verde", "salcobrand", "ahumada", "isapre", "colmena",
    "fonasa", "clinica", "hospital", "doctor", "dentista",
  ],
  Educacion: [
    "colegiatura", "universidad", "colegio", "matricula", "udemy", "coursera",
  ],
  Ropa: [
    "falabella", "ripley", "paris", "zara", "h&m", "nike", "adidas",
  ],
  Sueldo: [
    "sueldo", "remuneracion", "honorario", "salario",
  ],
};

const COLOR_MAP: Record<string, string> = {
  Transporte: "#3b82f6",
  Supermercado: "#10b981",
  Comida: "#f59e0b",
  Hogar: "#8b5cf6",
  Entretenimiento: "#ec4899",
  Salud: "#ef4444",
  Educacion: "#06b6d4",
  Ropa: "#84cc16",
  Sueldo: "#f97316",
};

/**
 * POST /api/categorize
 * Auto-categoriza transacciones sin categoria usando:
 * 1. matchKeyword de gastos/ingresos fijos → categoría "Gastos Fijos"
 * 2. Reglas del usuario (CategoryRule)
 * 3. Reglas por defecto
 */
export async function POST() {
  try {
    // 1. Get all uncategorized transactions
    const uncategorized = await prisma.transaction.findMany({
      where: { categoryId: null },
    });

    const total = uncategorized.length;
    if (total === 0) {
      return NextResponse.json({ success: true, categorized: 0, total: 0 });
    }

    // 2. Get all existing categories
    const existingCategories = await prisma.category.findMany();
    const categoryByName = new Map(
      existingCategories.map((c) => [c.name.toLowerCase(), c])
    );

    // 3. Get "Gastos Fijos" category if it exists (no auto-create)
    const gastosFijosCategory = categoryByName.get("gastos fijos") ?? null;

    // 4. Get fixed expenses with matchKeyword for auto-detection
    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: {
        isActive: true,
        matchKeyword: { not: null },
      },
    });

    // 5. Get user-defined rules from CategoryRule
    const userRules = await prisma.categoryRule.findMany({
      include: { category: true },
    });

    let categorized = 0;

    for (const tx of uncategorized) {
      const descLower = tx.description.toLowerCase();
      let matchedCategoryId: string | null = null;

      // Check fixed expense matchKeywords first → assign to its category or "Gastos Fijos"
      for (const fe of fixedExpenses) {
        if (!fe.matchKeyword) continue;
        const keyword = fe.matchKeyword.toLowerCase();
        if (descLower.includes(keyword)) {
          matchedCategoryId = gastosFijosCategory?.id ?? null;
          break;
        }
      }

      // Check user-defined rules (higher priority than defaults)
      if (!matchedCategoryId) {
        for (const rule of userRules) {
          if (descLower.includes(rule.keyword.toLowerCase())) {
            matchedCategoryId = rule.categoryId;
            break;
          }
        }
      }

      // If no user rule matched, check default rules (only for existing categories)
      if (!matchedCategoryId) {
        for (const [categoryName, keywords] of Object.entries(DEFAULT_RULES)) {
          const matched = keywords.some((kw) => descLower.includes(kw));
          if (matched) {
            const category = categoryByName.get(categoryName.toLowerCase());
            if (category) {
              matchedCategoryId = category.id;
            }
            break;
          }
        }
      }

      if (matchedCategoryId) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId: matchedCategoryId },
        });
        categorized++;
      }
    }

    return NextResponse.json({ success: true, categorized, total });
  } catch (error) {
    console.error("Error auto-categorizando:", error);
    return NextResponse.json(
      { error: "Error al auto-categorizar" },
      { status: 500 }
    );
  }
}
