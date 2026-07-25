import { getDb } from "../lib/db";
import { classifyPost } from "../lib/zg";
import { priceAt } from "../lib/graph";
import { DEFAULT_EXPIRY } from "../lib/signal-schema";
import { TOKENS } from "../lib/tokens"; // symbol->address map seeded for the demo set

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

async function main(handle: string) {
  const db = getDb();
  const posts = db
    .prepare(
      `SELECT p.* FROM posts p JOIN influencers i ON i.id=p.influencer_id
       WHERE i.handle=? AND p.id NOT IN (SELECT post_id FROM calls)`
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw sqlite rows, shape matches lib/schema.sql posts table
    .all(handle) as any[];

  for (const p of posts) {
    const c = await classifyPost(p.content, p.posted_at);
    await sleep(2500); // throttle 0G classification calls

    if (!c.signal) continue;
    const s = c.signal;
    const isSignal = s.template !== "NOT_A_SIGNAL" && s.confidence >= 0.85 && s.asset_symbol;
    const template = isSignal ? s.template : "AMBIGUOUS";
    const addr = s.asset_symbol ? TOKENS[s.asset_symbol.toUpperCase()] ?? null : null;
    const expiry = p.posted_at + (s.expiry_days ?? DEFAULT_EXPIRY[s.template] ?? 30) * 86400;

    const r = db
      .prepare(
        `INSERT INTO calls (post_id,template,asset_symbol,asset_address,direction,expiry_at,confidence,status)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(
        p.id,
        template,
        s.asset_symbol,
        addr,
        s.direction ?? "long",
        expiry,
        s.confidence,
        isSignal ? (addr ? "open" : "unpriceable") : "ambiguous"
      );

    db.prepare(
      `INSERT INTO artifacts (call_id,request_json,response_json,chat_id,tee_signature)
       VALUES (?,?,?,?,?)`
    ).run(r.lastInsertRowid, p.content, JSON.stringify(c.raw ?? {}), c.chatId, c.teeSignature);

    if (isSignal && addr) {
      try {
        const entry = await priceAt(addr, p.posted_at);
        const latest = await priceAt(addr, Math.floor(Date.now() / 1000) - 3600);
        const ethE = await priceAt(WETH, p.posted_at);
        const ethL = await priceAt(WETH, Math.floor(Date.now() / 1000) - 3600);

        const mk = db.prepare(
          "INSERT OR IGNORE INTO marks (call_id,kind,price_usd,source,marked_at) VALUES (?,?,?,?,?)"
        );
        if (entry) mk.run(r.lastInsertRowid, "entry", entry.price, entry.source, p.posted_at);
        if (latest) mk.run(r.lastInsertRowid, "live", latest.price, latest.source, (Date.now() / 1000) | 0);
        // ETH benchmark stored under d1/d7 kinds, disambiguated by source — Task 7 reads by source
        if (ethE && ethL) {
          mk.run(r.lastInsertRowid, "d1", ethE.price, "eth_entry", p.posted_at);
          mk.run(r.lastInsertRowid, "d7", ethL.price, "eth_latest", (Date.now() / 1000) | 0);
        }
        if (!entry) db.prepare("UPDATE calls SET status='unpriceable' WHERE id=?").run(r.lastInsertRowid);
      } catch (err) {
        console.log(`pricing failed for call ${r.lastInsertRowid}: ${(err as Error).message}`);
        db.prepare("UPDATE calls SET status='unpriceable' WHERE id=?").run(r.lastInsertRowid);
        continue;
      }
    }

    console.log(`${p.x_post_id}: ${template} ${s.asset_symbol ?? ""} conf=${s.confidence}`);
  }
}

main(process.argv[2] ?? "CryptoKaleo").catch((err) => {
  console.error(err);
  process.exit(1);
});
