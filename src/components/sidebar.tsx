"use client";

import { useState } from "react";
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
  Menu,
  X,
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

function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClick}
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
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0f172a] flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
            F
          </div>
          <h1 className="font-bold text-white">FinAgent</h1>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-300 hover:text-white p-1"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute top-0 left-0 bottom-0 w-64 bg-[#0f172a] text-slate-200 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">
                  F
                </div>
                <div>
                  <h1 className="font-bold text-lg text-white">FinAgent</h1>
                  <p className="text-xs text-slate-400">Agente Financiero</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              <NavLinks onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="px-4 py-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">Fintoc - Modo en vivo</p>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0f172a] text-slate-200">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">
            F
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">FinAgent</h1>
            <p className="text-xs text-slate-400">Agente Financiero</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks />
        </nav>
        <div className="px-4 py-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">Fintoc - Modo en vivo</p>
        </div>
      </aside>
    </>
  );
}
