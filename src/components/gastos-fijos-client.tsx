"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Plus, CalendarClock, AlertCircle } from "lucide-react";

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
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

  const today = new Date().getDate();
  const totalMonthly = expenses
    .filter((e) => e.isActive)
    .reduce((sum, e) => sum + e.amount, 0);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/fixed-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        amount: parseFloat(formData.get("amount") as string),
        dayOfMonth: parseInt(formData.get("dayOfMonth") as string),
        categoryId: formData.get("categoryId") || null,
      }),
    });

    if (res.ok) {
      window.location.reload();
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <p className="text-sm text-slate-500">Total Gastos Fijos Mensuales</p>
        <p className="text-2xl font-bold text-slate-900">{formatCLP(totalMonthly)}</p>
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Agregar Gasto Fijo
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Ej: Cuenta de luz"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-slate-500 mb-1">Monto</label>
            <input
              name="amount"
              type="number"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="45000"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-500 mb-1">Dia del mes</label>
            <input
              name="dayOfMonth"
              type="number"
              min="1"
              max="28"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="4"
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
        </form>
      )}

      {/* Lista de gastos fijos */}
      <div className="space-y-3">
        {expenses.map((exp) => {
          const isPending = exp.isActive && today >= exp.dayOfMonth && !exp.lastPaidAt;
          return (
            <div
              key={exp.id}
              className={`bg-white rounded-xl p-5 shadow-sm border flex items-center justify-between ${
                isPending ? "border-amber-300" : "border-slate-100"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-slate-500" />
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
                  </div>
                  <p className="text-xs text-slate-400">
                    Dia {exp.dayOfMonth} de cada mes
                    {exp.categoryName && ` · ${exp.categoryName}`}
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900">{formatCLP(exp.amount)}</p>
            </div>
          );
        })}

        {expenses.length === 0 && (
          <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-100 text-center text-slate-400">
            No hay gastos fijos registrados
          </div>
        )}
      </div>
    </div>
  );
}
