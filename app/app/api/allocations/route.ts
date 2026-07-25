import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyUser } from "@/lib/privy";

// GET → the signed-in user's per-creator allocations.
export async function GET(req: Request) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, i.handle, a.mode, a.cap_type AS capType, a.cap_value AS capValue, a.active
       FROM allocations a JOIN influencers i ON i.id = a.influencer_id
       WHERE a.user_id = ? ORDER BY a.created_at DESC`
    )
    .all(user.userId);
  return NextResponse.json({ allocations: rows });
}

interface AllocBody {
  handle?: string;
  mode?: "copy" | "fade";
  capType?: "fixed_usd" | "percent";
  capValue?: number;
}

// POST → create/update the allocation for one creator (upsert on user+creator).
export async function POST(req: Request) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json()) as AllocBody;
  if (!b.handle || (b.mode !== "copy" && b.mode !== "fade")) {
    return NextResponse.json({ error: "handle and mode(copy|fade) required" }, { status: 400 });
  }
  if (b.capType !== "fixed_usd" && b.capType !== "percent") {
    return NextResponse.json({ error: "capType must be fixed_usd|percent" }, { status: 400 });
  }
  if (typeof b.capValue !== "number" || b.capValue <= 0) {
    return NextResponse.json({ error: "capValue must be a positive number" }, { status: 400 });
  }
  const db = getDb();
  const inf = db.prepare("SELECT id FROM influencers WHERE handle=?").get(b.handle) as
    | { id: number }
    | undefined;
  if (!inf) return NextResponse.json({ error: "unknown creator" }, { status: 404 });

  db.prepare(
    `INSERT INTO allocations (user_id, influencer_id, mode, cap_type, cap_value, active, created_at)
     VALUES (?,?,?,?,?,1,?)
     ON CONFLICT(user_id, influencer_id)
     DO UPDATE SET mode=excluded.mode, cap_type=excluded.cap_type, cap_value=excluded.cap_value, active=1`
  ).run(user.userId, inf.id, b.mode, b.capType, b.capValue, Math.floor(Date.now() / 1000));

  return NextResponse.json({ ok: true });
}
