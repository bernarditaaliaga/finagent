"use client";

import { useState } from "react";
import { formatCLP, formatDate } from "@/lib/format";
import { Plus, Tag, Sparkles, Trash2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  budgetLimit: number | null;
  totalTransactions: number;
  spentThisMonth: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
}

interface Rule {
  id: string;
  keyword: string;
  categoryId: string;
  issender: boolean;
  categoryName: string;
}

const COLORS = [
  { name: "Azul", value: "#3b82f6" },
  { name: "Rojo", value: "#ef4444" },
  { name: "Verde", value: "#10b981" },
  { name: "Amarillo", value: "#f59e0b" },
  { name: "Morado", value: "#8b5cf6" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Celeste", value: "#06b6d4" },
  { name: "Lima", value: "#84cc16" },
  { name: "Naranjo", value: "#f97316" },
  { name: "Indigo", value: "#6366f1" },
];

export function CategoriasClient({
  categories: initialCategories,
  uncategorized,
  rules: initialRules = [],
}: {
  categories: Category[];
  uncategorized: Transaction[];
  rules?: Rule[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [showForm, setShowForm] = useState(false);
  const [rules, setRules] = useState(initialRules);
  const [autoCatLoading, setAutoCatLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        color: formData.get("color"),
        budgetLimit: formData.get("budgetLimit")
          ? parseFloat(formData.get("budgetLimit") as string)
          : null,
      }),
    });

    if (res.ok) {
      const newCat = await res.json();
      setCategories([
        ...categories,
        { ...newCat, totalTransactions: 0, spentThisMonth: 0 },
      ]);
      setShowForm(false);
      form.reset();
    }
  }

  async function assignCategory(transactionId: string, categoryId: string) {
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    window.location.reload();
  }

  async function handleAutoCategorize() {
    setAutoCatLoading(true);
    try {
      const res = await fetch("/api/categorize", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Se categorizaron ${data.categorized} de ${data.total} transacciones sin categoria.`);
        window.location.reload();
      } else {
        alert("Error al auto-categorizar.");
      }
    } catch {
      alert("Error al auto-categorizar.");
    } finally {
      setAutoCatLoading(false);
    }
  }

  async function handleCreateRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const keyword = formData.get("keyword") as string;
    const categoryId = formData.get("categoryId") as string;
    const issender = formData.get("issender") === "on";

    const res = await fetch("/api/categorize/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, categoryId, issender }),
    });

    if (res.ok) {
      const newRule = await res.json();
      setRules([...rules, newRule]);
      form.reset();
    }
  }

  async function handleDeleteRule(ruleId: string) {
    const res = await fetch(`/api/categorize/rules?id=${ruleId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRules(rules.filter((r) => r.id !== ruleId));
    }
  }

  return (
    <div className="space-y-6">
      {/* Botones de acción */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoria
        </button>
        <button
          onClick={handleAutoCategorize}
          disabled={autoCatLoading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {autoCatLoading ? "Categorizando..." : "Auto-categorizar"}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Ej: Cuentas Casa, Carrete, Colegiatura..."
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-slate-500 mb-1">Color</label>
            <select name="color" className="w-full px-3 py-2 border rounded-lg text-sm">
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="block text-xs text-slate-500 mb-1">
              Limite mensual (opcional)
            </label>
            <input
              name="budgetLimit"
              type="number"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="150000"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            Crear
          </button>
        </form>
      )}

      {/* Grid de categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-xl p-5 shadow-sm border-l-4"
            style={{ borderLeftColor: cat.color ?? "#6B7280" }}
          >
            <h3 className="font-semibold text-slate-900">{cat.name}</h3>
            <p className="text-2xl font-bold mt-2" style={{ color: cat.color ?? "#6B7280" }}>
              {formatCLP(cat.spentThisMonth)}
            </p>
            {cat.budgetLimit && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{Math.round((cat.spentThisMonth / cat.budgetLimit) * 100)}%</span>
                  <span>de {formatCLP(cat.budgetLimit)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min((cat.spentThisMonth / cat.budgetLimit) * 100, 100)}%`,
                      backgroundColor:
                        cat.spentThisMonth > cat.budgetLimit ? "#ef4444" : (cat.color ?? "#6B7280"),
                    }}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {cat.totalTransactions} transacciones
            </p>
          </div>
        ))}
      </div>

      {/* Transacciones sin categoría */}
      {uncategorized.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Sin Categoria ({uncategorized.length})
            </h2>
            <p className="text-xs text-slate-400">
              Asigna una categoria a estas transacciones
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {uncategorized.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      t.amount >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {formatCLP(t.amount)}
                  </span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) assignCategory(t.id, e.target.value);
                    }}
                    className="text-xs border rounded px-2 py-1"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Asignar...
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reglas de Asignación */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Reglas de Asignacion</h2>
          <p className="text-xs text-slate-400">
            Define reglas para categorizar transacciones automaticamente
          </p>
        </div>

        {/* Formulario nueva regla */}
        <form
          onSubmit={handleCreateRule}
          className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">
              Cuando la descripcion contenga
            </label>
            <input
              name="keyword"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Ej: uber, copec, netflix..."
            />
          </div>
          <div className="w-48">
            <label className="block text-xs text-slate-500 mb-1">Asignar a</label>
            <select
              name="categoryId"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input name="issender" type="checkbox" id="issender" className="rounded" />
            <label htmlFor="issender" className="text-xs text-slate-500">
              Es remitente
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            Agregar
          </button>
        </form>

        {/* Lista de reglas */}
        {rules.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                <div className="text-sm">
                  <span className="text-slate-500">
                    {rule.issender ? "Remitente" : "Descripcion"} contiene{" "}
                  </span>
                  <span className="font-medium text-slate-900">&quot;{rule.keyword}&quot;</span>
                  <span className="text-slate-500"> → </span>
                  <span className="font-medium text-slate-900">{rule.categoryName}</span>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-4 text-sm text-slate-400">
            No hay reglas definidas aun.
          </div>
        )}
      </div>
    </div>
  );
}
