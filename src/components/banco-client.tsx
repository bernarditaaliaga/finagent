"use client";

import { useState, useEffect } from "react";
import { Landmark, CheckCircle, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/format";

interface BankLink {
  id: string;
  bankName: string;
  holderName: string | null;
  lastSync: string | null;
}

declare global {
  interface Window {
    Fintoc?: {
      create: (config: Record<string, unknown>) => { open: () => void };
    };
  }
}

export function BancoClient({
  bankLink,
  fintocPublicKey,
}: {
  bankLink: BankLink | null;
  fintocPublicKey: string;
}) {
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Cargar el script de Fintoc UNA sola vez al montar el componente
  useEffect(() => {
    if (window.Fintoc) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.fintoc.com/v1/";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setMessage("Error cargando el widget de Fintoc");
    document.head.appendChild(script);
  }, []);

  async function handleConnect() {
    if (!window.Fintoc) {
      setMessage("El widget de Fintoc aún no carga. Espera un momento.");
      return;
    }

    setConnecting(true);
    setMessage("");

    try {
      // Paso 1: Pedir un widget_token al backend
      // Abrir el widget — el usuario se loguea en su banco
      const widget = window.Fintoc.create({
        holderType: "individual",
        product: "movements",
        publicKey: fintocPublicKey,
        country: "cl",
        webhookUrl: "https://finagent-eight.vercel.app/api/fintoc/webhook",
        onSuccess: async (linkInfo: Record<string, unknown>) => {
          // El widget entrega info del link creado en el callback
          console.log("Fintoc onSuccess:", JSON.stringify(linkInfo));
          try {
            const res = await fetch("/api/fintoc/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ widgetData: linkInfo }),
            });
            const data = await res.json();
            if (data.success) {
              setMessage("Banco conectado exitosamente");
              window.location.reload();
            } else {
              setMessage(data.error ?? "Error al conectar");
            }
          } catch {
            setMessage("Error de conexion");
          }
          setConnecting(false);
        },
        onExit: () => {
          setConnecting(false);
        },
      });
      widget.open();
    } catch {
      setMessage("Error iniciando conexión con Fintoc");
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/fintoc/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage(`${data.imported} transacciones importadas de ${data.accounts} cuenta(s)`);
      } else {
        setMessage(data.error ?? "Error al sincronizar");
      }
    } catch {
      setMessage("Error de conexion");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      {bankLink ? (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {bankLink.bankName}
              </h2>
              {bankLink.holderName && (
                <p className="text-sm text-slate-500">{bankLink.holderName}</p>
              )}
              {bankLink.lastSync && (
                <p className="text-xs text-slate-400">
                  Ultima sincronizacion: {formatDate(bankLink.lastSync)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Transacciones"}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Landmark className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Conecta tu Banco
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Usa Fintoc para conectar tu cuenta del Banco de Chile de forma segura.
            Tus credenciales nunca pasan por nuestra app.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || !scriptLoaded}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {!scriptLoaded
              ? "Cargando Fintoc..."
              : connecting
              ? "Abriendo widget..."
              : "Conectar Banco de Chile"}
          </button>
        </div>
      )}

      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      {/* Credenciales de prueba */}
      <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
        <h3 className="font-semibold text-amber-800 mb-2">Credenciales de Prueba</h3>
        <p className="text-sm text-amber-700 mb-2">
          Estas en modo prueba. Usa estas credenciales ficticias:
        </p>
        <div className="bg-white rounded-lg p-3 text-sm font-mono">
          <p><span className="text-slate-500">RUT:</span> 41614850-3</p>
          <p><span className="text-slate-500">Clave:</span> jonsnow</p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h3 className="font-semibold text-slate-700 mb-3">Como funciona</h3>
        <ol className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            Haces clic en &quot;Conectar Banco de Chile&quot;
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">2.</span>
            Se abre una ventana segura de Fintoc donde pones tus credenciales del banco
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">3.</span>
            Fintoc se conecta al banco y nos entrega acceso de solo lectura a tus movimientos
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">4.</span>
            Importamos tus transacciones automaticamente a tu dashboard
          </li>
        </ol>
      </div>
    </div>
  );
}
