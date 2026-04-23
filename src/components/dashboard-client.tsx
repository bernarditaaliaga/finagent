"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCLP, formatDate } from "@/lib/format";
import { RefreshCw, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryName: string | null;
  categoryColor: string | null;
}

export function DashboardClient({
  transactions,
  currentMonth,
  currentYear,
}: {
  transactions: Transaction[];
  currentMonth: number;
  currentYear: number;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const now = new Date();
  const isCurrentMonth =
    currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear();

  function goToPreviousMonth() {
    let m = currentMonth - 1;
    let y = currentYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    router.push(`/?month=${m}&year=${y}`);
  }

  function goToNextMonth() {
    if (isCurrentMonth) return;
    let m = currentMonth + 1;
    let y = currentYear;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    router.push(`/?month=${m}&year=${y}`);
  }

  // Sincronizar con Fintoc
  async function handleSync() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/fintoc/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`${data.imported} transacciones sincronizadas`);
        // Recargar la página para ver los nuevos datos
        window.location.reload();
      } else {
        setSyncMessage(data.error ?? "Error al sincronizar");
      }
    } catch {
      setSyncMessage("Error de conexion");
    } finally {
      setSyncing(false);
    }
  }

  // Agregar transacción manual
  async function handleAddTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: formData.get("description"),
        amount: parseFloat(formData.get("amount") as string),
        date: formData.get("date") || new Date().toISOString(),
      }),
    });

    if (res.ok) {
      setShowAddForm(false);
      window.location.reload();
    }
  }

  return (
    <div className="space-y-4">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </h1>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Barra de acciones */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Banco"}
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Agregar Manual
        </button>
        {syncMessage && (
          <span className="text-sm text-slate-500">{syncMessage}</span>
        )}
      </div>

      {/* Formulario agregar transacción */}
      {showAddForm && (
        <form
          onSubmit={handleAddTransaction}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">
              Descripcion
            </label>
            <input
              name="description"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Ej: Supermercado Líder"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-slate-500 mb-1">
              Monto (negativo = gasto)
            </label>
            <input
              name="amount"
              type="number"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="-25000"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs text-slate-500 mb-1">Fecha</label>
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            Guardar
          </button>
        </form>
      )}

      {/* Lista de transacciones */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            Transacciones del Mes
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-lg mb-2">No hay transacciones aun</p>
            <p className="text-sm">
              Conecta tu banco o agrega transacciones manualmente
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  {t.categoryColor && (
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: t.categoryColor }}
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {t.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(t.date)}
                      {t.categoryName && ` · ${t.categoryName}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    t.amount >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {formatCLP(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
