import { createHash } from "crypto";
import { readFileSync } from "fs";
import { getDb } from "../lib/db";
export function importArchive(handle: string, jsonPath: string) {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO influencers (handle) VALUES (?)").run(handle);
  const inf = db.prepare("SELECT id FROM influencers WHERE handle=?").get(handle) as {id:number};
  const rows = JSON.parse(readFileSync(jsonPath, "utf8"));
  let inserted = 0, skipped = 0, malformed = 0;
  const ins = db.prepare(`INSERT OR IGNORE INTO posts
    (influencer_id,x_post_id,content,content_hash,url,posted_at,raw_json)
    VALUES (?,?,?,?,?,?,?)`);
  const importRows = db.transaction((rows: any[]) => {
    for (const r of rows) {
      if (typeof r?.text !== "string" || typeof r?.id !== "string") {
        malformed++;
        continue;
      }
      const createdMs = new Date(r.created_at).getTime();
      if (Number.isNaN(createdMs)) {
        malformed++;
        continue;
      }
      const hash = createHash("sha256").update(r.text).digest("hex");
      const ts = Math.floor(createdMs / 1000);
      const res = ins.run(inf.id, r.id, r.text, hash, r.url, ts, JSON.stringify(r));
      res.changes ? inserted++ : skipped++;
    }
  });
  importRows(rows);
  return { inserted, skipped, malformed };
}
