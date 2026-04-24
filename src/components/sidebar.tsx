"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Tags,
  CalendarClock,
  PiggyBank,
  Users,
  Landmark,
  CreditCard,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Categorias", href: "/categorias", icon: Tags },
  { name: "Gastos Fijos", href: "/gastos-fijos", icon: CalendarClock },
  { name: "Tarjeta Credito", href: "/tarjeta-credito", icon: CreditCard },
  { name: "Ahorro", href: "/ahorro", icon: PiggyBank },
  { name: "Dividir Gastos", href: "/split", icon: Users },
  { name: "Banco", href: "/banco", icon: Landmark },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0f172a] text-slate-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">
          F
        </div>
        <div>
          <h1 className="font-bold text-lg text-white">FinAgent</h1>
          <p className="text-xs text-slate-400">Agente Financiero</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">Fintoc - Modo en vivo</p>
      </div>
    </aside>
  );
}
