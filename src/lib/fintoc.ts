/**
 * Fintoc API Client - usa fetch directo para máxima compatibilidad
 */

const FINTOC_BASE_URL = "https://api.fintoc.com/v1";

function getHeaders() {
  const secretKey = process.env.FINTOC_SECRET_KEY;
  if (!secretKey || secretKey.includes("tu_key_aqui")) {
    throw new Error("FINTOC_SECRET_KEY no configurada");
  }
  return {
    Authorization: secretKey,
    "Content-Type": "application/json",
  };
}

// Obtiene todos los links (conexiones bancarias)
export async function getLinks() {
  const res = await fetch(`${FINTOC_BASE_URL}/links`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error obteniendo links");
  return res.json();
}

// Obtiene cuentas y movimientos de un link
export async function getAccountsAndMovements(linkToken: string) {
  const headers = getHeaders();

  const accRes = await fetch(
    `${FINTOC_BASE_URL}/accounts?link_token=${linkToken}`,
    { headers }
  );
  if (!accRes.ok) {
    const err = await accRes.json();
    throw new Error(`Error cuentas: ${JSON.stringify(err)}`);
  }

  const accounts = await accRes.json();
  const result = [];

  for (const account of accounts) {
    const movRes = await fetch(
      `${FINTOC_BASE_URL}/accounts/${account.id}/movements?link_token=${linkToken}&per_page=50`,
      { headers }
    );

    let movements: Array<Record<string, unknown>> = [];
    if (movRes.ok) {
      movements = await movRes.json();
    }

    result.push({ account, movements });
  }

  return result;
}
