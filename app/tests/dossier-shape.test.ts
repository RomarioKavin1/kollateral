import { describe, it, expect } from "vitest";
import { getDb } from "../lib/db";
import { buildDossier } from "../lib/dossier";

describe("buildDossier", () => {
  it("assembles handle/stats/calls, scoring only the priced call", () => {
    process.env.DB_PATH = ":memory:";
    const db = getDb();

    db.prepare("INSERT INTO influencers (handle) VALUES ('dossiertest')").run();

    db.prepare(
      `INSERT INTO posts (influencer_id,x_post_id,content,content_hash,url,posted_at)
       VALUES (1,'p1','$FOO to the moon','h1','https://x.com/dossiertest/status/1',1000)`
    ).run();
    db.prepare(
      `INSERT INTO posts (influencer_id,x_post_id,content,content_hash,url,posted_at)
       VALUES (1,'p2','not really a call','h2','https://x.com/dossiertest/status/2',2000)`
    ).run();

    // Call 1: scoreable long call, entry/live + eth pair present, status open.
    db.prepare(
      `INSERT INTO calls (post_id,template,asset_symbol,direction,confidence,status)
       VALUES (1,'DIRECTIONAL','FOO','long',0.9,'open')`
    ).run();
    // Call 2: ambiguous — no marks at all.
    db.prepare(
      `INSERT INTO calls (post_id,template,asset_symbol,direction,confidence,status)
       VALUES (2,'AMBIGUOUS',NULL,NULL,0.5,'ambiguous')`
    ).run();

    db.prepare(
      `INSERT INTO marks (call_id,kind,price_usd,source,marked_at) VALUES (1,'entry',100,'graph',1000)`
    ).run();
    db.prepare(
      `INSERT INTO marks (call_id,kind,price_usd,source,marked_at) VALUES (1,'live',150,'graph',5000)`
    ).run();
    // ETH benchmark: kind 'd1'/'d7' disambiguated by source, not kind.
    db.prepare(
      `INSERT INTO marks (call_id,kind,price_usd,source,marked_at) VALUES (1,'d1',2000,'eth_entry',1000)`
    ).run();
    db.prepare(
      `INSERT INTO marks (call_id,kind,price_usd,source,marked_at) VALUES (1,'d7',2200,'eth_latest',5000)`
    ).run();

    const dossier = buildDossier("dossiertest");
    expect(dossier).not.toBeNull();

    // long: (150-100)/100 = 50% -> pnlUsd = round(1000*0.5) = 500
    expect(dossier!.stats.totalPnl).toBe(500);
    expect(dossier!.calls.length).toBe(2);

    const ambiguous = dossier!.calls.find((c) => c.status === "ambiguous");
    expect(ambiguous).toBeDefined();
    expect(ambiguous!.retPct).toBeNull();
    expect(ambiguous!.pnlUsd).toBeNull();

    const scored = dossier!.calls.find((c) => c.status === "open");
    expect(scored!.retPct).toBe(50);
    expect(scored!.pnlUsd).toBe(500);
  });

  it("returns null for an unknown handle", () => {
    process.env.DB_PATH = ":memory:";
    expect(buildDossier("nobody")).toBeNull();
  });
});
