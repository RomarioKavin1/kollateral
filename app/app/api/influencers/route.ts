import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildDossier } from "@/lib/dossier";

// Trending list for the home page: every influencer in the DB with a
// headline P&L % and a scored-call count. Reuses buildDossier per handle
// (same scoring logic as the dossier page) rather than duplicating the
// P&L math in raw SQL — fine at hackathon/demo scale.
export interface InfluencerSummary {
  handle: string;
  display_name: string | null;
  headlinePct: number;
  callCount: number;
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT handle, display_name FROM influencers ORDER BY handle")
    .all() as { handle: string; display_name: string | null }[];

  const result: InfluencerSummary[] = rows.map(({ handle, display_name }) => {
    const dossier = buildDossier(handle);
    const settled = dossier?.stats.settled ?? 0;
    const totalPnl = dossier?.stats.totalPnl ?? 0;
    const callCount = dossier?.calls.filter((c) => c.retPct != null).length ?? 0;
    // Same formula as VerdictBlock: $1,000-per-call return vs actual.
    const headlinePct =
      Math.round((10000 * totalPnl) / (1000 * Math.max(settled, 1))) / 100;
    return { handle, display_name, headlinePct, callCount };
  });

  // "Trending" = most scored calls first, best headline % as tiebreak.
  result.sort((a, b) => b.callCount - a.callCount || b.headlinePct - a.headlinePct);

  return NextResponse.json(result);
}
