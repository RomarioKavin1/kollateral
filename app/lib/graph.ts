// Public data-layer API for the app, backed entirely by The Graph's Uniswap v3
// subgraph (see lib/subgraph.ts). Signatures are unchanged from the earlier
// Pinax-backed version so the pipeline, dossier, and wallet sync are untouched.
import { subgraphPriceAt, subgraphSwapsForWallet } from "./subgraph";

export type WalletSwap = {
  tx_hash: string;
  token_address: string;
  side: "buy" | "sell";
  usd_value: number;
  occurred_at: number;
};

// USD price of an EVM token at a past timestamp, from the subgraph (USD-native).
export async function priceAt(token: string, tsSec: number): Promise<{ price: number; source: string } | null> {
  const price = await subgraphPriceAt(token, tsSec);
  return price != null && price > 0 ? { price, source: "uniswap_v3_subgraph" } : null;
}

// A wallet's token sells in a window (each swap labelled a "sell" of the token
// it sold), for cross-referencing against LONG calls in Said-vs-Did.
export async function swapsForWallet(wallet: string, startSec: number, endSec: number): Promise<WalletSwap[]> {
  const sells = await subgraphSwapsForWallet(wallet, startSec, endSec);
  return sells.map((s) => ({
    tx_hash: s.tx_hash,
    token_address: s.token_address,
    side: "sell" as const,
    usd_value: s.usd_value,
    occurred_at: s.occurred_at,
  }));
}
