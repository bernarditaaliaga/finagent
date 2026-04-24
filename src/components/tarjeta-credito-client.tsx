"use client";

import { useState } from "react";
import { formatCLP, formatDate } from "@/lib/format";
import { Plus, CreditCard, Trash2, CalendarClock, ShoppingBag, Pencil, Check, X } from "lucide-react";

interface CardInfo {
  id: string;
  name: string;
  lastFourDigits: string | null;
  cupoTotal: number;
  deudaActual: number;
  billingCloseDay: number;
}

interface MonthExpense {
  id: string;
  description: string;
  installmentAmount: number;
  cuotaActual: number;
  totalCuotas: number;
  categoryName: string | null;
  categoryColor: string | null;
}

interface Expense {
  id: string;
  description: string;
  totalAmount: number;
  installments: number;
  installmentAmount: number;
  purchaseDate: string;
  billingStartMonth: number;
  billingStartYear: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  creditCardId: string | null;
  cuotaActual: number | null;
  isActive: boolean;
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 10, 12, 18, 24, 36, 48];

export function TarjetaCreditoClient({
  card,
  expenses: initialExpenses,
  thisMonthExpenses,
  nextMonthExpenses,
  facturadoEsteMes,
  facturadoProxMes,
  categories,
  currentMonthName,
  nextMonthName,
}: {
  card: CardInfo | null;
  expenses: Expense[];
  thisMonthExpenses: MonthExpense[];
  nextMonthExpenses: MonthExpense[];
  facturadoEsteMes: number;
  facturadoProxMes: number;
  categories: { id: string; name: string }[];
  currentMonth: number;
  currentYear: number;
  currentMonthName: string;
  nextMonthName: string;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    description: "", totalAmount: "", installments: "1",
    purchaseDate: "", categoryId: "",
  });

  const activeExpenses = expenses.filter((e) => e.isActive);
  const completedExpenses = expenses.filter((e) => !e.isActive && e.installments > 1);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/credit-cards/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: formData.get("description"),
        totalAmount: parseFloat(formData.get("totalAmount") as string),
        installments: parseInt(formData.get("installments") as string),
        purchaseDate: formData.get("purchaseDate"),
        categoryId: formData.get("categoryId") || null,
        creditCardId: card?.id ?? null,
      }),
    });

    if (res.ok) {
      window.location.reload();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta compra?")) return;
    const res = await fetch(`/api/credit-cards/expenses?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setEditData({
      description: exp.description,
      totalAmount: exp.totalAmount.toString(),
      installments: exp.installments.toString(),
      purchaseDate: exp.purchaseDate.slice(0, 10),
      categoryId: exp.categoryId ?? "",
    });
  }

  async function saveEdit(id: string) {
    const res = await fetch("/api/credit-cards/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        description: editData.description,
        totalAmount: parseFloat(editData.totalAmount),
        installments: parseInt(editData.installments),
        purchaseDate: editData.purchaseDate,
        categoryId: editData.categoryId || null,
      }),
    });

    if (res.ok) {
      window.location.reload();
    }
  }

  function renderEditForm(expId: string) {
    return (
      <div key={expId} className="px-5 py-4 bg-blue-50 border border-blue-200 rounded-lg mx-2 my-1 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-500 mb-1">Descripcion</label>
            <input
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-500 mb-1">Monto total</label>
            <input
              value={editData.totalAmount}
              onChange={(e) => setEditData({ ...editData, totalAmount: e.target.value })}
              type="number"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs text-slate-500 mb-1">Cuotas</label>
            <select
              value={editData.installments}
              onChange={(e) => setEditData({ ...editData, installments: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              {INSTALLMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n === 1 ? "Sin cuotas" : `${n} cuotas`}</option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs text-slate-500 mb-1">Fecha</label>
            <input
              value={editData.purchaseDate}
              onChange={(e) => setEditData({ ...editData, purchaseDate: e.target.value })}
              type="date"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-slate-500 mb-1">Categoria</label>
            <select
              value={editData.categoryId}
              onChange={(e) => setEditData({ ...editData, categoryId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Sin categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => saveEdit(expId)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            <Check className="w-4 h-4" />
            Guardar
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  function renderExpenseRow(exp: Expense) {
    if (editingId === exp.id) return renderEditForm(exp.id);

    const progress = exp.cuotaActual
      ? (exp.cuotaActual / exp.installments) * 100
      : 0;

    return (
      <div key={exp.id} className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-slate-900">{exp.description}</p>
            <p className="text-xs text-slate-400">
              {formatDate(exp.purchaseDate)} · {formatCLP(exp.totalAmount)} en {exp.installments} cuotas
              {exp.categoryName && ` · ${exp.categoryName}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold text-slate-700 mr-1">
              {formatCLP(exp.installmentAmount)}/mes
            </span>
            <button
              onClick={() => startEdit(exp)}
              className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(exp.id)}
              className="text-slate-300 hover:text-red-500 p-1 transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {exp.installments > 1 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-purple-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 w-16 text-right">
              {exp.cuotaActual}/{exp.installments}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen de tarjeta */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold">
              {card?.name ?? "Visa"} {card?.lastFourDigits ? `••${card.lastFourDigits}` : ""}
            </h2>
            <p className="text-sm text-slate-400">
              Cierre de facturacion: dia {card?.billingCloseDay ?? 28}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-slate-400">Deuda Total</p>
            <p className="text-xl font-bold">{formatCLP(card?.deudaActual ?? 0)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-slate-400">Cupo Total</p>
            <p className="text-xl font-bold">{formatCLP(card?.cupoTotal ?? 0)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-slate-400">Cobro {currentMonthName}</p>
            <p className="text-xl font-bold text-amber-400">{formatCLP(facturadoEsteMes)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-slate-400">Cobro {nextMonthName}</p>
            <p className="text-xl font-bold text-orange-400">{formatCLP(facturadoProxMes)}</p>
          </div>
        </div>
      </div>

      {/* Agregar compra */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Registrar Compra TC
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4"
        >
          <h3 className="font-semibold text-slate-900">Nueva compra con tarjeta</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">Descripcion</label>
              <input
                name="description"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Ej: Falabella, Spotify..."
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-slate-500 mb-1">Monto total</label>
              <input
                name="totalAmount"
                type="number"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="299990"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">Cuotas</label>
              <select name="installments" className="w-full px-3 py-2 border rounded-lg text-sm">
                {INSTALLMENT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Sin cuotas" : `${n} cuotas`}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs text-slate-500 mb-1">Fecha compra</label>
              <input
                name="purchaseDate"
                type="date"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="w-40">
              <label className="block text-xs text-slate-500 mb-1">Categoria</label>
              <select name="categoryId" className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Sin categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
            >
              Registrar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Cobros este mes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-900">
            Cobros de {currentMonthName}
          </h2>
          <span className="ml-auto text-sm font-bold text-amber-600">
            {formatCLP(facturadoEsteMes)}
          </span>
        </div>
        {thisMonthExpenses.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {thisMonthExpenses.map((exp) => {
              const fullExp = expenses.find((e) => e.id === exp.id);
              if (editingId === exp.id && fullExp) return renderEditForm(exp.id);
              return (
                <div key={exp.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {exp.categoryColor && (
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: exp.categoryColor }} />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{exp.description}</p>
                      <p className="text-xs text-slate-400">
                        Cuota {exp.cuotaActual} de {exp.totalCuotas}
                        {exp.categoryName && ` · ${exp.categoryName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-bold text-slate-900 mr-1">{formatCLP(exp.installmentAmount)}</p>
                    {fullExp && (
                      <button
                        onClick={() => startEdit(fullExp)}
                        className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-6 text-center text-sm text-slate-400">
            No hay cobros este mes
          </div>
        )}
      </div>

      {/* Próximos cobros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-orange-500" />
          <h2 className="font-semibold text-slate-900">
            Proximos cobros — {nextMonthName}
          </h2>
          <span className="ml-auto text-sm font-bold text-orange-600">
            {formatCLP(facturadoProxMes)}
          </span>
        </div>
        {nextMonthExpenses.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {nextMonthExpenses.map((exp) => {
              const fullExp = expenses.find((e) => e.id === exp.id);
              if (editingId === exp.id && fullExp) return renderEditForm(exp.id);
              return (
                <div key={exp.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {exp.categoryColor && (
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: exp.categoryColor }} />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{exp.description}</p>
                      <p className="text-xs text-slate-400">
                        Cuota {exp.cuotaActual} de {exp.totalCuotas}
                        {exp.categoryName && ` · ${exp.categoryName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-bold text-slate-900 mr-1">{formatCLP(exp.installmentAmount)}</p>
                    {fullExp && (
                      <button
                        onClick={() => startEdit(fullExp)}
                        className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-6 text-center text-sm text-slate-400">
            No hay cobros proyectados
          </div>
        )}
      </div>

      {/* Compras activas */}
      {activeExpenses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-500" />
            <h2 className="font-semibold text-slate-900">Compras Activas en Cuotas</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {activeExpenses.filter((e) => e.installments > 1).map((exp) => renderExpenseRow(exp))}
          </div>
        </div>
      )}

      {/* Compras completadas */}
      {completedExpenses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-500 text-sm">Compras Completadas</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {completedExpenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between px-5 py-3 opacity-60">
                <div>
                  <p className="text-sm font-medium text-slate-700">{exp.description}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(exp.purchaseDate)} · {exp.installments} cuotas pagadas
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-500 mr-1">{formatCLP(exp.totalAmount)}</span>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="text-slate-300 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 && (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-100 text-center text-slate-400">
          No hay compras registradas. Usa el boton de arriba para registrar tus compras con tarjeta.
        </div>
      )}
    </div>
  );
}
