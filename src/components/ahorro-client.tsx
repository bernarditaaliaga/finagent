"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Plus, PiggyBank } from "lucide-react";

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
}

export function AhorroClient({ goals: initialGoals }: { goals: SavingsGoal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        targetAmount: parseFloat(formData.get("targetAmount") as string),
        deadline: formData.get("deadline") || null,
      }),
    });

    if (res.ok) {
      const newGoal = await res.json();
      setGoals([{ ...newGoal, deadline: newGoal.deadline ?? null }, ...goals]);
      setShowForm(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Nueva Meta
      </button>

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
              placeholder="Ej: Vacaciones, Fondo emergencia..."
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-slate-500 mb-1">Meta ($)</label>
            <input
              name="targetAmount"
              type="number"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="500000"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs text-slate-500 mb-1">Fecha limite</label>
            <input
              name="deadline"
              type="date"
              className="w-full px-3 py-2 border rounded-lg text-sm"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => {
          const progress = goal.targetAmount > 0
            ? (goal.currentAmount / goal.targetAmount) * 100
            : 0;

          return (
            <div
              key={goal.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{goal.name}</h3>
                  {goal.deadline && (
                    <p className="text-xs text-slate-400">
                      Meta: {new Date(goal.deadline).toLocaleDateString("es-CL")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">
                  {formatCLP(goal.currentAmount)}
                </span>
                <span className="font-medium text-slate-900">
                  {formatCLP(goal.targetAmount)}
                </span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-purple-500 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              <p className="text-xs text-slate-400 mt-2 text-right">
                {Math.round(progress)}% completado
              </p>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="col-span-2 bg-white rounded-xl p-10 shadow-sm border border-slate-100 text-center text-slate-400">
            No hay metas de ahorro creadas
          </div>
        )}
      </div>
    </div>
  );
}
