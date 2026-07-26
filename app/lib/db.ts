import Database from "better-sqlite3";
import { readFileSync, existsSync, copyFileSync } from "fs";
import path from "path";

// Resolve the SQLite file to open.
//
// Local dev: use DB_PATH or the historical ./kollateral.db (unchanged).
//
// Vercel: serverless functions have a READ-ONLY filesystem except /tmp, and
// instances are ephemeral. The committed seed fixture (seed/demo.db) is bundled
// read-only into the function via outputFileTracingIncludes, so we copy it once
// per instance into /tmp/kollateral.db (writable) and open that. If DB_PATH is
// already a /tmp path we trust it as-is.
function resolveDbPath(): string {
  const envPath = process.env.DB_PATH;

  if (process.env.VERCEL && !(envPath && envPath.startsWith("/tmp"))) {
    const runtimePath = "/tmp/kollateral.db";
    if (!existsSync(runtimePath)) {
      const seedPath = envPath ?? path.join(process.cwd(), "seed/demo.db");
      copyFileSync(seedPath, runtimePath);
    }
    return runtimePath;
  }

  return envPath ?? "./kollateral.db";
}

let db: Database.Database | null = null;
export function getDb() {
  if (!db) {
    db = new Database(resolveDbPath());
    db.pragma("journal_mode = WAL");
    db.exec(readFileSync(path.join(process.cwd(), "lib/schema.sql"), "utf8"));
    // Task 9 (Said-vs-Did): small side table for the human/legal attribution
    // note behind a linked wallet. Kept out of schema.sql per the hackathon
    // rule against touching existing table definitions mid-event; created
    // here (idempotent) so every getDb() caller — app and scripts/sync-wallet.ts
    // alike — can rely on it existing, even before any wallet has been set.
    db.exec(
      "CREATE TABLE IF NOT EXISTS wallet_attributions (influencer_id INTEGER PRIMARY KEY, note TEXT)"
    );
    // 0-yap mode cache: the 0G-distilled pure signal per call, so the
    // distillation runs once and is reused (idempotent side table).
    db.exec(
      "CREATE TABLE IF NOT EXISTS yap_signals (call_id INTEGER PRIMARY KEY REFERENCES calls(id), bias TEXT, thesis TEXT, levels_json TEXT, tee_verified INTEGER, created_at INTEGER)"
    );
    // Extra copy_trades columns for an honest portfolio: which chain it ran on
    // (for the explorer link), the REAL amounts swapped (input token in/out,
    // not the nominal allocation cap), and the failure reason. Added
    // idempotently — SQLite throws if a column already exists (harmless).
    for (const col of [
      "network TEXT DEFAULT 'testnet'",
      "in_amount REAL",
      "in_symbol TEXT",
      "out_amount REAL",
      "out_symbol TEXT",
      "reason TEXT",
    ]) {
      try {
        db.exec(`ALTER TABLE copy_trades ADD COLUMN ${col}`);
      } catch {
        /* column already present */
      }
    }
    // Global "quick trade amount" (USDC) per user — the default size each
    // one-click copy/fade deploys, overridable per creator via allocations.
    try {
      db.exec("ALTER TABLE users ADD COLUMN quick_trade_usd REAL DEFAULT 1");
    } catch {
      /* column already present */
    }
  }
  return db;
}
