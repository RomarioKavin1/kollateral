import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyUser } from "@/lib/privy";

// GET → the signed-in user's copy/fade trade history + a summary.
export async function GET(req: Request) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const trades = db
    .prepare(
      `SELECT creator_handle, mode, token_symbol, token_address, side,
              amount_usd, entry_price_usd, tx_hash, status, yield_usd, created_at
       FROM copy_trades WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(user.userId) as { amount_usd: number; yield_usd: number }[];

  const totalPnlUsd = trades.reduce((s, t) => s + (t.yield_usd ?? 0), 0);
  return NextResponse.json({
    summary: { totalTrades: trades.length, totalPnlUsd: Math.round(totalPnlUsd * 100) / 100 },
    trades,
  });
}
