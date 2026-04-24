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

// Intercambia el exchangeToken del widget por el link_token real (one-time)
export async function exchangeLinkToken(
  linkIntentId: string,
  exchangeToken: string
): Promise<{ link_token: string; id: string; institution: { name: string } | null; holder_name: string | null }> {
  const res = await fetch(`${FINTOC_BASE_URL}/link_intents/${linkIntentId}/exchange`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ exchange_token: exchangeToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Exchange failed (${res.status}): ${JSON.stringify(err)}`);
  }
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

// Obtiene tarjetas de crédito del link
export async function getCreditCards(linkToken: string) {
  const headers = getHeaders();
  try {
    const res = await fetch(
      `${FINTOC_BASE_URL}/credit_cards?link_token=${linkToken}`,
      { headers }
    );
    if (!res.ok) return [];
    const cards = await res.json();
    return cards.map((c: Record<string, unknown>) => {
      const balance = c.balance as Record<string, number> | null;
      const holder = c.holder as Record<string, string> | null;
      return {
        id: c.id as string,
        name: c.name as string,
        lastFourDigits: (c.number as string)?.slice(-4) ?? null,
        cupoTotal: balance?.limit ?? 0,
        deudaActual: balance?.current ?? 0,
        available: balance?.available ?? 0,
        isTitular: holder?.type === "TITULAR",
        currency: (c.currency as string) ?? "CLP",
      };
    });
  } catch {
    return [];
  }
}

// Obtiene balances de todas las cuentas
export async function getAccountBalances(linkToken: string) {
  const headers = getHeaders();
  const accRes = await fetch(
    `${FINTOC_BASE_URL}/accounts?link_token=${linkToken}`,
    { headers }
  );
  if (!accRes.ok) return [];
  const accounts = await accRes.json();
  return accounts.map((a: Record<string, unknown>) => {
    const balance = a.balance as Record<string, number>;
    return {
      id: a.id as string,
      name: a.name as string,
      type: a.type as string,
      number: a.number as string,
      available: balance.available,
      current: balance.current,
      limit: balance.limit,
      currency: (a.currency as string) ?? "CLP",
    };
  });
}
