"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { FadeTicket } from "@/components/FadeTicket";
import { DitherArt } from "@/components/DitherArt";
import { CallTweet } from "@/components/CallTweet";
import type { FeedCall } from "@/app/api/feed/route";
import type { InfluencerSummary } from "@/app/api/influencers/route";
import type { DossierCall } from "@/lib/dossier";

type Filter = "all" | "signals" | "conviction";

function MiniAvatar({ handle }: { handle: string }) {
  const [ok, setOk] = useState(true);
  const mg = handle.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??";
  return (
    <span className="mini-avatar pixel">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://unavatar.io/twitter/${handle}`} alt="" width={34} height={34} onError={() => setOk(false)} />
      ) : (
        mg
      )}
    </span>
  );
}

// FadeTicket expects a full DossierCall; the feed row doesn't carry
// entry/return/pnl (those only exist once a call is scored in the
// dossier), so those fields are filled with null here.
function toDossierCall(f: FeedCall): DossierCall {
  return {
    id: f.call_id,
    content: f.content,
    url: f.url,
    posted_at: f.posted_at,
    template: f.template,
    asset_symbol: f.asset_symbol,
    direction: f.direction,
    expiry_at: f.expiry_at,
    confidence: f.confidence,
    entry: null,
    latest: f.latest_price,
    retPct: null,
    pnlUsd: null,
    ethPnlUsd: null,
    status: f.status,
    deleted_at: f.deleted_at,
    chat_id: null,
  };
}

const POLL_MS = 10_000;

export default function TerminalPage() {
  const { isConnected } = useAccount();
  // Guard wallet state until after mount so the first client render matches the
  // server (isConnected is always false on the server, avoiding a hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const connected = mounted && isConnected;
  const [calls, setCalls] = useState<FeedCall[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCallId, setOpenCallId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("signals");
  const [query, setQuery] = useState("");
  const [creators, setCreators] = useState<InfluencerSummary[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/feed")
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json() as Promise<{ calls: FeedCall[] }>;
        })
        .then((data) => {
          if (!cancelled) {
            setCalls(data.calls);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // creators for the "who to fade or follow" rail
  useEffect(() => {
    let cancelled = false;
    fetch("/api/influencers")
      .then((r) => (r.ok ? (r.json() as Promise<InfluencerSummary[]>) : []))
      .then((d) => !cancelled && setCreators(d))
      .catch(() => !cancelled && setCreators([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    let all = calls ?? [];
    if (filter === "signals") all = all.filter((c) => c.template !== "AMBIGUOUS");
    else if (filter === "conviction") all = all.filter((c) => c.confidence >= 0.7);
    const q = query.trim().toLowerCase();
    if (q) {
      all = all.filter(
        (c) =>
          c.handle.toLowerCase().includes(q) ||
          (c.display_name?.toLowerCase().includes(q) ?? false) ||
          (c.asset_symbol?.toLowerCase().includes(q) ?? false) ||
          c.content.toLowerCase().includes(q),
      );
    }
    return all;
  }, [calls, filter, query]);

  // trending tickers, aggregated from the live feed
  const trending = useMemo(() => {
    const map = new Map<string, { count: number; long: number; short: number }>();
    for (const c of calls ?? []) {
      if (!c.asset_symbol) continue;
      const e = map.get(c.asset_symbol) ?? { count: 0, long: 0, short: 0 };
      e.count++;
      if (c.direction === "long") e.long++;
      else if (c.direction === "short") e.short++;
      map.set(c.asset_symbol, e);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  }, [calls]);

  const stats = useMemo(() => {
    const all = calls ?? [];
    const signed = all.filter((c) => c.ai?.hasSignature).length;
    const signals = all.filter((c) => c.template !== "AMBIGUOUS").length;
    return { total: all.length, signed, signals };
  }, [calls]);

  return (
    <main className="mx-auto px-6" style={{ maxWidth: 1240, padding: "clamp(40px, 8vw, 96px) 24px 100px" }}>
      <div className="term-grid">
        {/* ---- LEFT RAIL ---- */}
        <aside className="term-left">
          <div className="term-sticky">
            <div className="label" style={{ marginBottom: 8 }}>// live feed</div>
            <h1 style={{ fontSize: 30, lineHeight: 1, marginBottom: 14 }}>Terminal</h1>
            <div className="label" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", marginBottom: 20 }}>
              <span className="flick" style={{ color: "var(--signal)", fontSize: 14, lineHeight: 1 }}>●</span>
              live · polls every 10s
            </div>

            <div className="label" style={{ marginBottom: 8 }}>search</div>
            <div className="term-search" style={{ marginBottom: 20 }}>
              <span aria-hidden style={{ color: "var(--faint)" }}>⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="handle, $ticker, text"
                aria-label="Search the feed"
              />
              {query && (
                <button aria-label="clear search" onClick={() => setQuery("")} style={{ background: "none", border: 0, color: "var(--faint)", cursor: "pointer", fontSize: 12 }}>✕</button>
              )}
            </div>

            <div className="label" style={{ marginBottom: 8 }}>filter</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              {([
                ["all", `All calls`],
                ["signals", `Signals only`],
                ["conviction", `High conviction`],
              ] as [Filter, string][]).map(([key, lbl]) => (
                <button key={key} className={`filter-pill ${filter === key ? "filter-on" : ""}`} onClick={() => setFilter(key)}>
                  {lbl}
                </button>
              ))}
            </div>

            <div className="side-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ position: "relative", height: 84, background: "var(--dark)" }}>
                <DitherArt shape="arrows" invert gap={4} className="h-full w-full" />
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div className="label" style={{ color: "var(--muted)" }}>signal integrity</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }} className="tnum">
                  <span className="label">indexed</span><span>{stats.total}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12 }} className="tnum">
                  <span className="label">tee-signed</span><span style={{ color: "var(--gain)" }}>{stats.signed}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12 }} className="tnum">
                  <span className="label">real signals</span><span>{stats.signals}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ---- CENTER FEED ---- */}
        <div className="term-center">
          <div className="term-feed-head">
            <span className="tnum">{shown.length} {filter === "all" ? "calls" : filter === "signals" ? "signals" : "high-conviction calls"}</span>
            {!connected && <span className="label" style={{ color: "var(--muted)" }}>connect a wallet to fade or follow</span>}
          </div>

          {loading && <div className="label flick" style={{ padding: "48px 0" }}>reading the feed…</div>}
          {!loading && error && (
            <div className="label" style={{ padding: "48px 0", color: "var(--loss)" }}>could not load feed ({error})</div>
          )}
          {!loading && !error && shown.length === 0 && (
            <div className="label" style={{ padding: "48px 0", color: "var(--muted)" }}>nothing matches this filter.</div>
          )}

          {!loading && !error && shown.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {shown.map((c, i) => {
                const isOpen = openCallId === c.call_id;
                return (
                  <div key={c.call_id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <CallTweet
                      call={c}
                      connected={connected}
                      fadeOpen={isOpen}
                      onFade={() => setOpenCallId(isOpen ? null : c.call_id)}
                      onFollow={() => setOpenCallId(isOpen ? null : c.call_id)}
                    >
                      {isOpen && (
                        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                          <FadeTicket call={toDossierCall(c)} />
                        </div>
                      )}
                    </CallTweet>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- RIGHT SIDEBAR ---- */}
        <aside className="term-right">
          <div className="term-sticky">
            {/* who to fade or follow */}
            <div className="side-card">
              <div className="label" style={{ marginBottom: 12 }}>who to fade or follow</div>
              {(creators ?? []).slice(0, 5).map((c) => {
                const neg = c.headlinePct < 0;
                return (
                  <Link key={c.handle} href={`/k/${c.handle}`} className="wtf-row">
                    <MiniAvatar handle={c.handle} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.display_name || c.handle}
                      </span>
                      <span className="label">@{c.handle}</span>
                    </span>
                    <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: neg ? "var(--loss)" : "var(--gain)" }}>
                      {neg ? "" : "+"}{c.headlinePct}%
                    </span>
                  </Link>
                );
              })}
              {creators && creators.length === 0 && <div className="label" style={{ color: "var(--muted)" }}>no creators yet.</div>}
              {!creators && <div className="label flick">loading…</div>}
            </div>

            {/* trending tickers */}
            <div className="side-card" style={{ marginTop: 14 }}>
              <div className="label" style={{ marginBottom: 12 }}>trending tickers</div>
              {trending.length === 0 && <div className="label" style={{ color: "var(--muted)" }}>no tickers yet.</div>}
              {trending.map(([sym, e], i) => {
                const bias = e.long === e.short ? "mixed" : e.long > e.short ? "long" : "short";
                const biasColor = bias === "long" ? "var(--gain)" : bias === "short" ? "var(--loss)" : "var(--faint)";
                return (
                  <div key={sym} className="trend-row">
                    <span className="label" style={{ width: 18, color: "var(--faint)" }}>{i + 1}</span>
                    <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)" }}>${sym}</span>
                    <span className="label" style={{ color: biasColor }}>{bias}</span>
                    <span className="label tnum" style={{ width: 42, textAlign: "right" }}>{e.count} call{e.count === 1 ? "" : "s"}</span>
                  </div>
                );
              })}
            </div>

            <div className="label" style={{ marginTop: 16, color: "var(--faint)", lineHeight: 1.6 }}>
              every call is scored against real DEX prices and cross-checked against the caller&apos;s own wallet.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
