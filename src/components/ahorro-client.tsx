"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Plus, PiggyBank, Target, Sparkles, Check, AlertTriangle, X } from "lucide-react";

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
}

interface BudgetItem {
  categoryId: string;
  categoryName: string;
  categoryColor?: string | null;
  budgetAmount: number;
  currentSpent: number;
}

interface ActivePlan {
  id: string;
  month: number;
  year: number;
  savingsTarget: number;
  totalIncome: number;
  totalFixed: number;
  budgets: BudgetItem[];
}

interface PlanResult {
  thisMonthFeasible: boolean;
  thisMonthMessage: string;
  nextMonthFeasible: boolean;
  nextMonthMessage: string;
  neverFeasible: boolean;
  suggestedTarget: number | null;
  startMonth: number;
  startYear: number;
  budgets: { categoryId: string; categoryName: string; budgetAmount: number }[];
  income: number;
  fixedExpenses: number;
  spentSoFar: number;
  saldoActual: number;
  savingsTarget: number;
  currentDay: number;
  daysRemaining: number;
  currentMonth: number;
  currentYear: number;
  nextMonth: number;
  nextYear: number;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function AhorroClient({
  goals: initialGoals,
  activePlan,
  currentMonth,
  currentYear,
}: {
  goals: SavingsGoal[];
  activePlan: ActivePlan | null;
  currentMonth: number;
  currentYear: number;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planSaved, setPlanSaved] = useState(false);

  async function handleCreateGoal(e: React.FormEvent<HTMLFormElement>) {
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
      setShowGoalForm(false);
    }
  }

  async function generatePlan(savingsTarget: number) {
    setPlanLoading(true);
    setPlanResult(null);
    setPlanSaved(false);
    try {
      const res = await fetch("/api/savings-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savingsTarget }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setPlanResult(data);
      }
    } catch {
      alert("Error generando plan");
    } finally {
      setPlanLoading(false);
    }
  }

  async function acceptPlan(month: number, year: number) {
    if (!planResult) return;
    const res = await fetch("/api/savings-plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        year,
        savingsTarget: planResult.savingsTarget,
        income: planResult.income,
        fixedExpenses: planResult.fixedExpenses,
        budgets: planResult.budgets,
      }),
    });
    if (res.ok) {
      setPlanSaved(true);
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  function handlePlanSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const target = parseFloat(formData.get("savingsTarget") as string);
    if (target > 0) generatePlan(target);
  }

  return (
    <div className="space-y-6">
      {/* Plan de Ahorro Activo */}
      {activePlan && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">
                Plan de Ahorro — {MONTH_NAMES[activePlan.month - 1]} {activePlan.year}
              </h2>
              <p className="text-sm text-purple-200">
                Meta: {formatCLP(activePlan.savingsTarget)} al mes
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-purple-200">Ingresos</p>
              <p className="text-lg font-bold">{formatCLP(activePlan.totalIncome)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-purple-200">Gastos Fijos</p>
              <p className="text-lg font-bold">{formatCLP(activePlan.totalFixed)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-purple-200">Ahorro</p>
              <p className="text-lg font-bold">{formatCLP(activePlan.savingsTarget)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePlan.budgets.map((b) => {
              const percent = b.budgetAmount > 0 ? (b.currentSpent / b.budgetAmount) * 100 : 0;
              const overBudget = b.currentSpent > b.budgetAmount;
              return (
                <div key={b.categoryId} className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{b.categoryName}</span>
                    <span className={`text-xs font-bold ${overBudget ? "text-red-300" : "text-emerald-300"}`}>
                      {formatCLP(b.currentSpent)} / {formatCLP(b.budgetAmount)}
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        overBudget ? "bg-red-400" : percent > 80 ? "bg-yellow-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-purple-200 mt-1 text-right">
                    {Math.round(percent)}% usado
                    {overBudget && ` — excedido por ${formatCLP(b.currentSpent - b.budgetAmount)}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => { setShowPlanForm(!showPlanForm); setPlanResult(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          <Sparkles className="w-4 h-4" />
          {activePlan ? "Nuevo Plan" : "Crear Plan de Ahorro"}
        </button>
        <button
          onClick={() => setShowGoalForm(!showGoalForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Meta de Ahorro
        </button>
      </div>

      {/* Formulario Plan de Ahorro */}
      {showPlanForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-semibold text-slate-900">¿Cuánto quieres ahorrar al mes?</h3>
          <p className="text-sm text-slate-500">
            El agente analizará tu situación actual y te dirá si es viable este mes o cuándo empezar.
          </p>
          <form onSubmit={handlePlanSubmit} className="flex gap-3 items-end">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">Meta mensual ($)</label>
              <input
                name="savingsTarget"
                type="number"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="100000"
              />
            </div>
            <button
              type="submit"
              disabled={planLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {planLoading ? "Analizando..." : "Analizar con IA"}
            </button>
          </form>

          {/* Resultado del plan */}
          {planResult && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {/* Estado actual del mes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Ingresos del mes</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCLP(planResult.income)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Gastos fijos</p>
                  <p className="text-lg font-bold text-slate-700">{formatCLP(planResult.fixedExpenses)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Ya gastado</p>
                  <p className="text-lg font-bold text-red-500">{formatCLP(planResult.spentSoFar)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Saldo actual</p>
                  <p className="text-lg font-bold text-blue-600">{formatCLP(planResult.saldoActual)}</p>
                </div>
              </div>

              {/* No es viable nunca */}
              {planResult.neverFeasible && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                  <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Objetivo no realista</p>
                    <p className="text-sm text-slate-600 mt-1">{planResult.thisMonthMessage}</p>
                    {planResult.suggestedTarget && (
                      <button
                        onClick={() => generatePlan(planResult.suggestedTarget!)}
                        className="text-sm text-purple-600 font-medium mt-2 hover:underline"
                      >
                        Probar con {formatCLP(planResult.suggestedTarget)} →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Este mes */}
              {!planResult.neverFeasible && (
                <div className={`flex items-start gap-3 p-4 rounded-lg ${
                  planResult.thisMonthFeasible
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-orange-50 border border-orange-200"
                }`}>
                  {planResult.thisMonthFeasible ? (
                    <Check className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      planResult.thisMonthFeasible ? "text-emerald-800" : "text-orange-800"
                    }`}>
                      {MONTH_NAMES[planResult.currentMonth - 1]}: {planResult.thisMonthFeasible ? "Viable" : "No recomendado"}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{planResult.thisMonthMessage}</p>
                  </div>
                </div>
              )}

              {/* Próximo mes */}
              {!planResult.neverFeasible && !planResult.thisMonthFeasible && planResult.nextMonthFeasible && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <Check className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      {MONTH_NAMES[planResult.nextMonth - 1]}: Viable
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{planResult.nextMonthMessage}</p>
                  </div>
                </div>
              )}

              {/* Presupuestos por categoría */}
              {planResult.budgets.length > 0 && !planResult.neverFeasible && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Presupuesto por categoría</h4>
                  <div className="space-y-2">
                    {planResult.budgets.map((b) => (
                      <div key={b.categoryId} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-900">{b.categoryName}</span>
                        <span className="text-sm font-bold text-slate-700">
                          máx. {formatCLP(b.budgetAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones aceptar */}
              {!planResult.neverFeasible && !planSaved && (
                <div className="flex gap-3">
                  {planResult.thisMonthFeasible && (
                    <button
                      onClick={() => acceptPlan(planResult.currentMonth, planResult.currentYear)}
                      className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                    >
                      Activar desde {MONTH_NAMES[planResult.currentMonth - 1]}
                    </button>
                  )}
                  {planResult.nextMonthFeasible && (
                    <button
                      onClick={() => acceptPlan(planResult.nextMonth, planResult.nextYear)}
                      className={`flex-1 py-3 rounded-lg font-medium ${
                        planResult.thisMonthFeasible
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-purple-600 text-white hover:bg-purple-700"
                      }`}
                    >
                      Activar desde {MONTH_NAMES[planResult.nextMonth - 1]}
                    </button>
                  )}
                </div>
              )}

              {planSaved && (
                <div className="py-3 text-center text-emerald-600 font-medium bg-emerald-50 rounded-lg">
                  ¡Plan guardado!
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulario Meta de Ahorro */}
      {showGoalForm && (
        <form
          onSubmit={handleCreateGoal}
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

      {/* Metas de Ahorro */}
      {goals.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-900">Metas de Ahorro</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const progress = goal.targetAmount > 0
                ? (goal.currentAmount / goal.targetAmount) * 100
                : 0;
              return (
                <div key={goal.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
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
                    <span className="text-slate-500">{formatCLP(goal.currentAmount)}</span>
                    <span className="font-medium text-slate-900">{formatCLP(goal.targetAmount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-purple-500 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-right">{Math.round(progress)}% completado</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
