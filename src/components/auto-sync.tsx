"use client";

import { useEffect } from "react";

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const STORAGE_KEY = "finagent_last_sync";

export function AutoSync() {
  useEffect(() => {
    async function maybeSync() {
      const lastSync = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();

      if (lastSync && now - parseInt(lastSync) < SYNC_INTERVAL_MS) {
        return; // aún no pasan 10 min
      }

      try {
        const res = await fetch("/api/fintoc/sync", { method: "POST" });
        if (res.ok) {
          localStorage.setItem(STORAGE_KEY, now.toString());
          const data = await res.json();
          if (data.imported > 0) {
            // Si importó transacciones nuevas, recargar para mostrarlas
            window.location.reload();
          }
        }
      } catch {
        // silencioso — no interrumpir al usuario
      }
    }

    maybeSync();
  }, []);

  return null;
}
