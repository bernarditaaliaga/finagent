"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Plus, Users } from "lucide-react";

interface SplitGroup {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  expenses: {
    id: string;
    description: string;
    amount: number;
    paidByName: string;
    shares: { memberName: string; amount: number }[];
  }[];
}

export function SplitClient({ groups }: { groups: SplitGroup[] }) {
  const [showForm, setShowForm] = useState(false);

  async function handleCreateGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const membersStr = formData.get("members") as string;
    const memberNames = membersStr.split(",").map((n) => n.trim()).filter(Boolean);

    const res = await fetch("/api/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members: memberNames }),
    });

    if (res.ok) {
      window.location.reload();
    }
  }

  // Calcula balances: quién debe a quién
  function calculateBalances(group: SplitGroup) {
    const balances: Record<string, number> = {};
    group.members.forEach((m) => (balances[m.name] = 0));

    for (const expense of group.expenses) {
      // El que pagó suma lo que pagó
      balances[expense.paidByName] = (balances[expense.paidByName] ?? 0) + expense.amount;
      // Cada share resta lo que le corresponde
      for (const share of expense.shares) {
        balances[share.memberName] = (balances[share.memberName] ?? 0) - share.amount;
      }
    }

    return balances;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Nuevo Grupo
      </button>

      {showForm && (
        <form
          onSubmit={handleCreateGroup}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Nombre del grupo
            </label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Ej: Asado viernes, Vacaciones..."
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Miembros (separados por coma)
            </label>
            <input
              name="members"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Ej: Juan, Pedro, Maria, Yo"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            Crear Grupo
          </button>
        </form>
      )}

      {/* Lista de grupos */}
      {groups.map((group) => {
        const balances = calculateBalances(group);
        const totalSpent = group.expenses.reduce((sum, e) => sum + e.amount, 0);

        return (
          <div
            key={group.id}
            className="bg-white rounded-xl shadow-sm border border-slate-100"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{group.name}</h3>
                  <p className="text-xs text-slate-400">
                    {group.members.map((m) => m.name).join(", ")}
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900">
                {formatCLP(totalSpent)}
              </p>
            </div>

            {/* Balances */}
            <div className="px-5 py-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500">BALANCES</p>
              {Object.entries(balances).map(([name, balance]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span className="text-slate-700">{name}</span>
                  <span
                    className={`font-medium ${
                      balance > 0
                        ? "text-emerald-600"
                        : balance < 0
                        ? "text-red-500"
                        : "text-slate-400"
                    }`}
                  >
                    {balance > 0 ? "Le deben " : balance < 0 ? "Debe " : ""}
                    {formatCLP(Math.abs(balance))}
                  </span>
                </div>
              ))}
            </div>

            {/* Gastos del grupo */}
            {group.expenses.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-50">
                <p className="text-xs font-semibold text-slate-500 mb-2">GASTOS</p>
                {group.expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex justify-between py-1 text-sm"
                  >
                    <span className="text-slate-600">
                      {exp.description}{" "}
                      <span className="text-slate-400">
                        (pago {exp.paidByName})
                      </span>
                    </span>
                    <span className="font-medium">{formatCLP(exp.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-100 text-center text-slate-400">
          No hay grupos creados. Crea uno para empezar a dividir gastos.
        </div>
      )}
    </div>
  );
}
