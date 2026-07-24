import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
let db: Database.Database | null = null;
export function getDb() {
  if (!db) {
    db = new Database(process.env.DB_PATH ?? "./kollateral.db");
    db.pragma("journal_mode = WAL");
    db.exec(readFileSync(path.join(process.cwd(), "lib/schema.sql"), "utf8"));
  }
  return db;
}
