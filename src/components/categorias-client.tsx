"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCLP, formatDate } from "@/lib/format";
import { Plus, Tag, Sparkles, Trash2, ArrowLeft, Pencil, X, Check, UserPlus } from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  budgetLimit: number | null;
  priority: string | null;
  totalTransactions: number;
  spentThisMonth: number;
}

const PRIORITIES = [
  { value: "esencial", label: "Esencial", color: "bg-red-100 text-red-700", desc: "No se puede reducir" },
  { value: "necesario", label: "Necesario", color: "bg-orange-100 text-orange-700", desc: "Difícil de reducir" },
  { value: "prescindible", label: "Prescindible", color: "bg-yellow-100 text-yellow-700", desc: "Se puede reducir" },
  { value: "innecesario", label: "Innecesario", color: "bg-slate-100 text-slate-600", desc: "Se puede eliminar" },
];

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountName?: string | null;
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
  selectedCategoryId = null,
  selectedCategoryTransactions = [],
}: {
  categories: Category[];
  uncategorized: Transaction[];
  rules?: Rule[];
  selectedCategoryId?: string | null;
  selectedCategoryTransactions?: Transaction[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [showForm, setShowForm] = useState(false);
  const [rules, setRules] = useState(initialRules);
  const [autoCatLoading, setAutoCatLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [addingSenderId, setAddingSenderId] = useState<string | null>(null);
  const [newSenderKeyword, setNewSenderKeyword] = useState("");

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null;

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
        priority: formData.get("priority") || null,
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

  async function removeCategory(transactionId: string) {
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: null }),
    });
    window.location.reload();
  }

  async function updatePriority(categoryId: string, priority: string | null) {
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: categoryId, priority }),
    });
    if (res.ok) {
      setCategories(categories.map((c) =>
        c.id === categoryId ? { ...c, priority } : c
      ));
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color ?? "#6B7280");
    setEditBudget(cat.budgetLimit?.toString() ?? "");
  }

  async function saveEdit(catId: string) {
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: catId,
        name: editName,
        color: editColor,
        budgetLimit: editBudget ? parseFloat(editBudget) : null,
      }),
    });
    if (res.ok) {
      setCategories(categories.map((c) =>
        c.id === catId
          ? { ...c, name: editName, color: editColor, budgetLimit: editBudget ? parseFloat(editBudget) : null }
          : c
      ));
      setEditingId(null);
    }
  }

  async function deleteCategory(catId: string) {
    if (!confirm("¿Eliminar esta categoría? Las transacciones quedarán sin categoría.")) return;
    const res = await fetch(`/api/categories?id=${catId}`, { method: "DELETE" });
    if (res.ok) {
      setCategories(categories.filter((c) => c.id !== catId));
      if (selectedCategoryId === catId) {
        router.push("/categorias");
      }
    }
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

  async function addSenderToCategory(categoryId: string) {
    if (!newSenderKeyword.trim()) return;
    const res = await fetch("/api/categorize/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: newSenderKeyword.trim(),
        categoryId,
        issender: true,
      }),
    });
    if (res.ok) {
      const newRule = await res.json();
      setRules([...rules, newRule]);
      setNewSenderKeyword("");
      setAddingSenderId(null);
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

  // === VISTA DE CATEGORÍA SELECCIONADA ===
  if (selectedCategory) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/categorias")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a categorías
        </button>

        <div
          className="bg-white rounded-xl p-5 shadow-sm border-l-4"
          style={{ borderLeftColor: selectedCategory.color ?? "#6B7280" }}
        >
          <h2 className="text-xl font-bold text-slate-900">{selectedCategory.name}</h2>
          <p className="text-2xl font-bold mt-1" style={{ color: selectedCategory.color ?? "#6B7280" }}>
            {formatCLP(selectedCategory.spentThisMonth)}
          </p>
          {selectedCategory.budgetLimit && (
            <p className="text-sm text-slate-500 mt-1">
              de {formatCLP(selectedCategory.budgetLimit)} presupuestado
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">
              Transacciones ({selectedCategoryTransactions.length})
            </h3>
            <p className="text-xs text-slate-400">Cambia la categoría de cualquier transacción</p>
          </div>
          {selectedCategoryTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No hay transacciones este mes en esta categoría
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {selectedCategoryTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                    {t.accountName && (
                      <p className="text-[11px] text-slate-300">{t.accountName}</p>
                    )}
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
                        const val = e.target.value;
                        if (val === "__remove__") {
                          removeCategory(t.id);
                        } else if (val) {
                          assignCategory(t.id, val);
                        }
                      }}
                      className="text-xs border rounded px-2 py-1"
                      defaultValue={selectedCategory.id}
                    >
                      <option value="__remove__">Sin categoría</option>
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
          )}
        </div>
      </div>
    );
  }

  // === VISTA PRINCIPAL DE CATEGORÍAS ===
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
          <div className="w-40">
            <label className="block text-xs text-slate-500 mb-1">Prioridad</label>
            <select name="priority" className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Sin etiqueta</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Grid de categorías - clickeables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-xl p-5 shadow-sm border-l-4 hover:shadow-md transition-shadow"
            style={{ borderLeftColor: cat.color ?? "#6B7280" }}
          >
            {editingId === cat.id ? (
              /* Modo edición */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Color</label>
                  <select
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {COLORS.map((c) => (
                      <option key={c.value} value={c.value}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Limite mensual</label>
                  <input
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Sin limite"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(cat.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4" />
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* Modo vista */
              <>
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => router.push(`/categorias?cat=${cat.id}`)}
                    className="text-left flex-1"
                  >
                    <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                  </button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const p = PRIORITIES.find((pr) => pr.value === cat.priority);
                      return p ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.color}`}>
                          {p.label}
                        </span>
                      ) : null;
                    })()}
                    <button
                      onClick={() => startEdit(cat)}
                      className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/categorias?cat=${cat.id}`)}
                  className="text-left w-full"
                >
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
                </button>
                <select
                  value={cat.priority ?? ""}
                  onChange={(e) => updatePriority(cat.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 text-xs border rounded px-2 py-1 w-full text-slate-500"
                >
                  <option value="">Sin etiqueta</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} — {p.desc}
                    </option>
                  ))}
                </select>

                {/* Reglas asociadas a esta categoría */}
                {(() => {
                  const catRules = rules.filter((r) => r.categoryId === cat.id);
                  return catRules.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {catRules.map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
                          <span className="text-xs text-slate-600">
                            {r.issender ? "📤" : "📝"} {r.keyword}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRule(r.id); }}
                            className="text-slate-300 hover:text-red-500 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Agregar destinatario inline */}
                {addingSenderId === cat.id ? (
                  <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={newSenderKeyword}
                      onChange={(e) => setNewSenderKeyword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addSenderToCategory(cat.id); }}
                      className="flex-1 px-2 py-1 border rounded text-xs"
                      placeholder="Ej: merpago* whoosh"
                      autoFocus
                    />
                    <button
                      onClick={() => addSenderToCategory(cat.id)}
                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => { setAddingSenderId(null); setNewSenderKeyword(""); }}
                      className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingSenderId(cat.id); setNewSenderKeyword(""); }}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus className="w-3 h-3" />
                    Asociar destinatario
                  </button>
                )}
              </>
            )}
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
