"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Plus, CalendarClock, AlertCircle, Trash2, DollarSign, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  amountUsd: number | null;
  currency: string;
  dayOfMonth: number | null;
  type: string;
  isActive: boolean;
  lastPaidAt: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

export function GastosFijosClient({
  expenses: initialExpenses,
  categories,
}: {
  expenses: FixedExpense[];
  categories: { id: string; name: string }[];
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [currency, setCurrency] = useState<"CLP" | "USD">("CLP");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [deleting, setDeleting] = useState<string | null>(null);

  const today = new Date().getDate();

  const gastos = expenses.filter((e) => e.type !== "income" && e.isActive);
  const ingresos = expenses.filter((e) => e.type === "income" && e.isActive);

  const totalGastos = gastos.reduce((sum, e) => sum + e.amount, 0);
  const totalIngresos = ingresos.reduce((sum, e) => sum + e.amount, 0);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dayValue = formData.get("dayOfMonth") as string;

    const payload: Record<string, unknown> = {
      name: formData.get("name"),
      currency,
      type,
      categoryId: formData.get("categoryId") || null,
      dayOfMonth: dayValue ? parseInt(dayValue) : null,
    };

    if (currency === "USD") {
      payload.amountUsd = parseFloat(formData.get("amount") as string);
    } else {
      payload.amount = parseFloat(formData.get("amount") as string);
    }

    const res = await fetch("/api/fixed-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      window.location.reload();
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/fixed-expenses?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
    setDeleting(null);
  }

  function renderCard(exp: FixedExpense) {
    const isIncome = exp.type === "income";
    const isPending = exp.isActive && exp.dayOfMonth && today >= exp.dayOfMonth && !exp.lastPaidAt;
    return (
      <div
        key={exp.id}
        className={`bg-white rounded-xl p-5 shadow-sm border flex items-center justify-between ${
          isPending ? "border-amber-300" : "border-slate-100"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isIncome ? "bg-emerald-100" : "bg-slate-100"
          }`}>
            {isIncome ? (
              <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <CalendarClock className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{exp.name}</h3>
              {isPending && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  Pendiente
                </span>
              )}
              {exp.currency === "USD" && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  USD
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {exp.dayOfMonth ? `Dia ${exp.dayOfMonth} de cada mes` : "Sin dia definido"}
              {exp.categoryName && ` · ${exp.categoryName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-lg font-bold ${isIncome ? "text-emerald-600" : "text-slate-900"}`}>
              {isIncome ? "+" : ""}{formatCLP(exp.amount)}
            </p>
            {exp.amountUsd && (
              <p className="text-xs text-slate-400">US${exp.amountUsd.toFixed(2)}</p>
            )}
          </div>
          <button
            onClick={() => handleDelete(exp.id)}
            disabled={deleting === exp.id}
            className="text-slate-300 hover:text-red-500 transition-colors p-1"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Total Gastos Fijos</p>
          <p className="text-2xl font-bold text-slate-900">{formatCLP(totalGastos)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Total Ingresos Fijos</p>
          <p className="text-2xl font-bold text-emerald-600">+{formatCLP(totalIngresos)}</p>
        </div>
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Agregar
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4"
        >
          {/* Tipo: Gasto o Ingreso */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                type === "expense" ? "bg-red-100 text-red-700 border-2 border-red-300" : "bg-slate-50 text-slate-500 border border-slate-200"
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Gasto Fijo
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                type === "income" ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300" : "bg-slate-50 text-slate-500 border border-slate-200"
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Ingreso Fijo
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input
                name="name"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder={type === "income" ? "Ej: Sueldo" : "Ej: Cuenta de luz"}
              />
            </div>

            {/* Moneda */}
            <div className="w-24">
              <label className="block text-xs text-slate-500 mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "CLP" | "USD")}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div className="w-36">
              <label className="block text-xs text-slate-500 mb-1">
                Monto ({currency})
              </label>
              <input
                name="amount"
                type="number"
                step={currency === "USD" ? "0.01" : "1"}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder={currency === "USD" ? "111.34" : "45000"}
              />
            </div>

            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">Dia del mes</label>
              <input
                name="dayOfMonth"
                type="number"
                min="1"
                max="31"
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Opcional"
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
              Crear
            </button>
          </div>

          {currency === "USD" && (
            <p className="text-xs text-blue-500">
              El monto se convertira a CLP automaticamente usando el valor del dolar del dia.
            </p>
          )}
        </form>
      )}

      {/* Ingresos Fijos */}
      {ingresos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
            Ingresos Fijos
          </h2>
          {ingresos.map(renderCard)}
        </div>
      )}

      {/* Gastos Fijos */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <ArrowUpCircle className="w-5 h-5 text-red-500" />
          Gastos Fijos
        </h2>
        {gastos.map(renderCard)}

        {gastos.length === 0 && ingresos.length === 0 && (
          <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-100 text-center text-slate-400">
            No hay gastos ni ingresos fijos registrados
          </div>
        )}
      </div>
    </div>
  );
}
