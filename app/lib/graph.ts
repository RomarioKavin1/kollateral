import { subgraphPriceAt } from "./subgraph";

const BASE = "https://api.pinax.network/v1";

// Built lazily inside a function (not a module-level const) so importing this
// module never depends on PINAX_JWT being set — keeps `pickCandleClose` (and
// this module generally) safely importable in tests with no env vars.
function headers() {
  return { Authorization: `Bearer ${process.env.PINAX_JWT}` };
}

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// Mainnet stablecoins whose price we treat as ~$1 (quote → USD directly).
const STABLES: Record<string, true> = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": true, // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7": true, // USDT
  "0x6b175474e89094c44da98b954eedeac495271d0f": true, // DAI
};
// Quote tokens we know how to convert to USD (stables + WETH). Pools whose
// other side is one of these are preferred when resolving a token's pool.
function isConvertibleQuote(addr: string) {
  const a = addr.toLowerCase();
  return a === WETH || STABLES[a] === true;
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

// ---- pool resolution -------------------------------------------------------
// Pinax's /evm/pools filters by `input_token` / `output_token` (NOT `token`,
// which is silently ignored and returns the global top pool). A token can sit
// on either side of a pool, so we query both and merge. We prefer pools whose
// OTHER side is a convertible quote (stable or WETH) so we can derive USD, and
// rank by transaction count as a liquidity proxy.
type PoolInfo = {
  pool: string;
  tokenSymbol: string;
  otherAddress: string;
  otherSymbol: string;
};
const poolCache = new Map<string, PoolInfo | null>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely-shaped Pinax pool rows
function toPoolInfo(row: any, token: string): PoolInfo | null {
  const t = token.toLowerCase();
  const inp = row.input_token, out = row.output_token;
  if (!inp || !out) return null;
  const tokenIsInput = inp.address?.toLowerCase() === t;
  const tokenIsOutput = out.address?.toLowerCase() === t;
  if (!tokenIsInput && !tokenIsOutput) return null;
  const self = tokenIsInput ? inp : out;
  const other = tokenIsInput ? out : inp;
  return {
    pool: row.pool,
    tokenSymbol: String(self.symbol ?? "").toUpperCase(),
    otherAddress: String(other.address ?? "").toLowerCase(),
    otherSymbol: String(other.symbol ?? "").toUpperCase(),
  };
}

async function bestPool(token: string): Promise<PoolInfo | null> {
  const key = token.toLowerCase();
  const cached = poolCache.get(key);
  if (cached !== undefined) return cached;
  const [asInput, asOutput] = await Promise.all([
    paginate(`${BASE}/evm/pools?network=mainnet&input_token=${token}&order=desc`, 1),
    paginate(`${BASE}/evm/pools?network=mainnet&output_token=${token}&order=desc`, 1),
  ]);
  const infos = [...asInput, ...asOutput]
    .map((r) => ({ row: r, info: toPoolInfo(r, token) }))
    .filter((x): x is { row: { transactions?: number }; info: PoolInfo } => x.info !== null);
  // Prefer convertible-quote pools; within each group, most transactions first.
  infos.sort((a, b) => {
    const ca = isConvertibleQuote(a.info.otherAddress) ? 1 : 0;
    const cb = isConvertibleQuote(b.info.otherAddress) ? 1 : 0;
    if (ca !== cb) return cb - ca;
    return (Number(b.row.transactions) || 0) - (Number(a.row.transactions) || 0);
  });
  const best = infos[0]?.info ?? null;
  poolCache.set(key, best);
  return best;
}

// Back-compat export (returns just the pool address, previous signature).
export async function resolvePool(token: string): Promise<string | null> {
  return (await bestPool(token))?.pool ?? null;
}

// ---- OHLC + USD conversion -------------------------------------------------
// Empirically, Pinax OHLC `close` prices the LESS-reference token of a pool in
// terms of the MORE-reference one (reference rank: stablecoin > WETH > others).
// Verified against real pools: PEPE/WETH close = PEPE-in-WETH (3.4e-9), and
// USDC/WETH close = WETH-in-USDC (~2150). Because `bestPool` always resolves a
// pool whose OTHER side is a more-reference convertible quote (stable or WETH),
// `close` is already the requested token priced in that other token — no
// inversion needed.
async function tokenPriceInOther(pi: PoolInfo, tsSec: number): Promise<number | null> {
  const start = new Date((tsSec - 6 * 3600) * 1000).toISOString();
  const end = new Date((tsSec + 3600) * 1000).toISOString();
  const candles = await paginate(
    `${BASE}/evm/pools/ohlc?network=mainnet&pool=${pi.pool}&interval=1h&start_time=${start}&end_time=${end}`
  );
  candles.sort(
    (a: { datetime: string }, b: { datetime: string }) =>
      new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );
  const close = pickCandleClose(candles, tsSec);
  return close != null && close > 0 ? close : null;
}

// WETH→USD at tsSec, via a WETH/stable pool. Cached per hour bucket to keep the
// pipeline's call volume down (every token that pairs with WETH needs this).
const wethUsdCache = new Map<number, number | null>();
async function wethUsdAt(tsSec: number): Promise<number | null> {
  const bucket = Math.floor(tsSec / 3600);
  const cached = wethUsdCache.get(bucket);
  if (cached !== undefined) return cached;
  // Resolve a WETH pool whose other side is a stablecoin.
  const wethPool = await bestPool(WETH);
  let usd: number | null = null;
  if (wethPool && STABLES[wethPool.otherAddress]) {
    usd = await tokenPriceInOther(wethPool, tsSec); // WETH priced in a ~$1 stable
  }
  wethUsdCache.set(bucket, usd);
  return usd;
}

export async function priceAt(token: string, tsSec: number): Promise<{ price: number; source: string } | null> {
  const t = token.toLowerCase();
  // Stablecoins: treat as $1 (avoids a needless pool lookup and self-reference).
  if (STABLES[t]) return { price: 1, source: "stable" };
  // WETH: its USD price is the benchmark conversion rate itself.
  if (t === WETH) {
    const usd = await wethUsdAt(tsSec);
    if (usd != null && usd > 0) return { price: usd, source: "pinax_ohlc" };
    return await subgraphFallback(token, tsSec);
  }

  const pi = await bestPool(token);
  if (pi && isConvertibleQuote(pi.otherAddress)) {
    const inOther = await tokenPriceInOther(pi, tsSec);
    if (inOther != null && inOther > 0) {
      if (STABLES[pi.otherAddress]) return { price: inOther, source: "pinax_ohlc" };
      // other side is WETH → multiply by WETH's USD price
      const wethUsd = await wethUsdAt(tsSec);
      if (wethUsd != null && wethUsd > 0) return { price: inOther * wethUsd, source: "pinax_ohlc" };
    }
  }
  return await subgraphFallback(token, tsSec);
}

// Task 11 fallback: Uniswap v3 subgraph time-travel, only when Pinax can't
// price the token and GRAPH_STUDIO_KEY is configured. Inert (no network) when
// the key is unset, so it's harmless in tests / local runs without it.
async function subgraphFallback(token: string, tsSec: number): Promise<{ price: number; source: string } | null> {
  if (process.env.GRAPH_STUDIO_KEY) {
    const p = await subgraphPriceAt(token, tsSec);
    if (p != null && p > 0) return { price: p, source: "uniswap_v3_subgraph" };
  }
  return null;
}

// ---- wallet swaps (Said-vs-Did) --------------------------------------------
// Pinax /evm/swaps rows carry input_token/output_token objects and decimal-
// adjusted amounts in input_value/output_value (these are TOKEN amounts, NOT
// USD). We label each swap a "sell" of its input token (in any swap you are
// selling the input), so a call to LONG token X is contradicted by a swap whose
// input token is X. usd_value is the proceeds (output side) converted to USD.
export async function swapsForWallet(wallet: string, startSec: number, endSec: number): Promise<WalletSwap[]> {
  const rows = await paginate(
    `${BASE}/evm/swaps?network=mainnet&transaction_from=${wallet}` +
      `&start_time=${new Date(startSec * 1000).toISOString()}&end_time=${new Date(endSec * 1000).toISOString()}`
  );
  const out: WalletSwap[] = [];
  for (const r of rows) {
    const inAddr = r.input_token?.address;
    if (!inAddr) continue;
    const occurred_at = Math.floor(new Date(r.datetime).getTime() / 1000);
    const outAddr = String(r.output_token?.address ?? "").toLowerCase();
    const outValue = Number(r.output_value) || 0;
    let usd_value = 0;
    if (STABLES[outAddr]) usd_value = outValue;
    else if (outAddr === WETH) {
      const wethUsd = await wethUsdAt(occurred_at);
      usd_value = wethUsd ? outValue * wethUsd : 0;
    }
    out.push({
      tx_hash: r.transaction_id,
      token_address: String(inAddr).toLowerCase(),
      side: "sell",
      usd_value,
      occurred_at,
    });
  }
  return out;
}
