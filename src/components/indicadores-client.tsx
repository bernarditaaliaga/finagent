"use client";

import { formatCLP } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface ChartDataPoint {
  month: string;
  gastos: number;
  ingresos: number;
}

export function IndicadoresClient({ chartData }: { chartData: ChartDataPoint[] }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Tendencia Mensual</h2>
      <p className="text-sm text-slate-500 mb-4">Ingresos y gastos de los ultimos 6 meses</p>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCLP(value as number),
                name === "ingresos" ? "Ingresos" : "Gastos",
              ]}
              labelStyle={{ fontWeight: "bold", color: "#1e293b" }}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            />
            <Legend
              formatter={(value: string) => (value === "ingresos" ? "Ingresos" : "Gastos")}
            />
            <Line
              type="monotone"
              dataKey="ingresos"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#10b981" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="gastos"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#ef4444" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
