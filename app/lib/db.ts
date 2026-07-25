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
  }
  return db;
}
