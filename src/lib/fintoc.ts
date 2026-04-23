/**
 * Fintoc API Client
 *
 * Flujo simplificado para desarrollo:
 * 1. Frontend abre el widget → usuario se loguea
 * 2. Widget crea el link automáticamente en Fintoc
 * 3. Backend lista los links con GET /v1/links (incluye link_token)
 * 4. Usa el link_token para obtener cuentas y movimientos
 */

import { Fintoc } from "fintoc";

function getClient() {
  const secretKey = process.env.FINTOC_SECRET_KEY;
  if (!secretKey || secretKey.includes("tu_key_aqui")) {
    throw new Error("FINTOC_SECRET_KEY no configurada. Agrega tu key en .env");
  }
  return new Fintoc(secretKey);
}

// Obtiene todos los links (conexiones bancarias)
export async function getLinks() {
  const client = getClient();
  const links: Array<Record<string, unknown>> = [];
  for await (const link of client.links.list()) {
    links.push(link as unknown as Record<string, unknown>);
  }
  return links;
}

// Obtiene cuentas y movimientos de un link usando el SDK
export async function getAccountsAndMovements(linkToken: string) {
  const FINTOC_BASE_URL = "https://api.fintoc.com/v1";
  const secretKey = process.env.FINTOC_SECRET_KEY!;

  // Obtener cuentas
  const accRes = await fetch(
    `${FINTOC_BASE_URL}/accounts?link_token=${linkToken}`,
    { headers: { Authorization: secretKey } }
  );

  if (!accRes.ok) {
    const err = await accRes.json();
    throw new Error(`Error cuentas: ${JSON.stringify(err)}`);
  }

  const accounts = await accRes.json();
  const result = [];

  for (const account of accounts) {
    // Obtener movimientos de cada cuenta
    const movRes = await fetch(
      `${FINTOC_BASE_URL}/accounts/${account.id}/movements?link_token=${linkToken}&per_page=50`,
      { headers: { Authorization: secretKey } }
    );

    let movements: Array<Record<string, unknown>> = [];
    if (movRes.ok) {
      movements = await movRes.json();
    }

    result.push({ account, movements });
  }

  return result;
}
