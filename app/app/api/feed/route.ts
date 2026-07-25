import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Terminal feed: N most recent calls across all influencers, newest first.
// Polled client-side (e.g. every 5s) to give a live-feeling ticker without
// websockets. Thin SQL — one query, latest `live` mark per call via a
// correlated subquery (marks has no "most recent" flag, so pick the row
// with the greatest marked_at for kind='live').
const LIMIT = 30;

interface FeedRow {
  handle: string;
  content: string;
  url: string;
  asset_symbol: string | null;
  direction: "long" | "short" | null;
  confidence: number;
  posted_at: number;
  latest_price: number | null;
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT i.handle as handle, p.content as content, p.url as url,
              c.asset_symbol as asset_symbol, c.direction as direction,
              c.confidence as confidence, p.posted_at as posted_at,
              (SELECT m.price_usd FROM marks m
                WHERE m.call_id = c.id AND m.kind = 'live'
                ORDER BY m.marked_at DESC LIMIT 1) as latest_price
       FROM calls c
       JOIN posts p ON p.id = c.post_id
       JOIN influencers i ON i.id = p.influencer_id
       ORDER BY p.posted_at DESC
       LIMIT ?`
    )
    .all(LIMIT) as FeedRow[];

  return NextResponse.json({ calls: rows });
}
