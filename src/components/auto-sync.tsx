"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const STORAGE_KEY = "finagent_last_sync";

export function AutoSync() {
  const router = useRouter();

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
            // Refrescar datos del servidor sin recargar la página completa
            router.refresh();
          }
        }
      } catch {
        // silencioso — no interrumpir al usuario
      }
    }

    maybeSync();
  }, [router]);

  return null;
}
