import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
let db: Database.Database | null = null;
export function getDb() {
  if (!db) {
    db = new Database(process.env.DB_PATH ?? "./kollateral.db");
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
