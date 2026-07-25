const BASE = "https://api.pinax.network/v1";

// Built lazily inside a function (not a module-level const) so importing this
// module never depends on PINAX_JWT being set — keeps `pickCandleClose` (and
// this module generally) safely importable in tests with no env vars.
function headers() {
  return { Authorization: `Bearer ${process.env.PINAX_JWT}` };
}

export type WalletSwap = {
  tx_hash: string;
  token_address: string;
  side: "buy" | "sell";
  usd_value: number;
  occurred_at: number;
};

export async function paginate(
  url: string,
  cap = 20
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are loosely-shaped Pinax API JSON
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are loosely-shaped Pinax API JSON
  let out: any[] = [], page = 1;
  while (page <= cap) {
    const r = await fetch(`${url}&page=${page}`, { headers: headers() });
    if (!r.ok) break;
    const j = await r.json();
    const rows = j.data ?? [];
    out = out.concat(rows);
    if (rows.length < 10) break; // free tier: 10/page
    page++;
  }
  return out;
}

// Assumes candles are sorted ascending by datetime (the `else break` exits on
// the first candle past tsSec, which is only correct under that ordering).
export function pickCandleClose(candles: { datetime: string; close: number }[], tsSec: number) {
  let best: number | null = null;
  for (const c of candles) {
    const ct = Math.floor(new Date(c.datetime).getTime() / 1000);
    if (ct <= tsSec) best = c.close; else break;
  }
  return best;
}

export async function resolvePool(token: string): Promise<string | null> {
  const rows = await paginate(`${BASE}/evm/pools?network=mainnet&token=${token}&sort_by=tvl&order=desc`, 1);
  return rows[0]?.pool ?? null;
}

export async function priceAt(token: string, tsSec: number): Promise<{ price: number; source: string } | null> {
  const pool = await resolvePool(token);
  if (!pool) return null;
  const start = new Date((tsSec - 6 * 3600) * 1000).toISOString();
  const end = new Date((tsSec + 3600) * 1000).toISOString();
  const candles = await paginate(
    `${BASE}/evm/pools/ohlc?network=mainnet&pool=${pool}&interval=1h&start_time=${start}&end_time=${end}`
  );
  // paginate concatenates pages in fetch order, not guaranteed chronological
  // across pages; sort defensively before pickCandleClose relies on ordering.
  candles.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const price = pickCandleClose(candles, tsSec);
  // subgraph fallback wired in Task 11 when OHLC returns null
  return price != null ? { price, source: "pinax_ohlc" } : null;
}

export async function swapsForWallet(wallet: string, startSec: number, endSec: number): Promise<WalletSwap[]> {
  const rows = await paginate(
    `${BASE}/evm/swaps?network=mainnet&transaction_from=${wallet}` +
      `&start_time=${new Date(startSec * 1000).toISOString()}&end_time=${new Date(endSec * 1000).toISOString()}`
  );
  return rows.map((r) => ({
    tx_hash: r.transaction_id,
    token_address: r.input_contract,
    side: "sell" as const,
    usd_value: r.input_value_usd ?? r.input_value,
    occurred_at: Math.floor(new Date(r.datetime).getTime() / 1000),
  }));
}
