"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { FadeTicket } from "@/components/FadeTicket";
import type { DossierCall } from "@/lib/dossier";

interface FeedCall {
  call_id: number;
  handle: string;
  content: string;
  url: string;
  template: string;
  asset_symbol: string | null;
  direction: "long" | "short" | null;
  expiry_at: number | null;
  confidence: number;
  status: string;
  posted_at: number;
  deleted_at: number | null;
  latest_price: number | null;
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

function fmtDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

const POLL_MS = 10_000;

const actionBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  padding: "7px 16px",
  background: "transparent",
  cursor: "pointer",
  transition: "color .2s, border-color .2s, background .2s, opacity .2s",
};

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

  return (
    <main className="mx-auto max-w-6xl px-6" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
      <div className="label" style={{ marginBottom: 10 }}>// live feed · polling every 10s</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 20 }}>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)" }}>Terminal</h1>
        {!connected && (
          <span className="label" style={{ color: "var(--muted)" }}>
            connect a wallet on a call&apos;s ticket to FADE or FOLLOW
          </span>
        )}
      </div>

      {loading && <div className="label flick" style={{ padding: "48px 0" }}>reading the feed…</div>}
      {!loading && error && (
        <div className="label" style={{ padding: "48px 0", color: "var(--loss)" }}>could not load feed ({error})</div>
      )}
      {!loading && !error && calls && calls.length === 0 && (
        <div className="label" style={{ padding: "48px 0", color: "var(--muted)" }}>no calls yet.</div>
      )}

      {!loading && !error && calls && calls.length > 0 && (
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14 }}>
          {calls.map((c, i) => {
            const isOpen = openCallId === c.call_id;
            const dirLabel = c.direction === "long" ? "LONG" : c.direction === "short" ? "SHORT" : "—";
            const dirColor = c.direction === "long" ? "var(--gain)" : c.direction === "short" ? "var(--loss)" : "var(--faint)";
            return (
              <div
                key={c.call_id}
                className="panel rise"
                style={{ padding: "20px 22px", animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600 }}>
                      @{c.handle}
                    </span>
                    <span className="label tnum">{fmtDate(c.posted_at)}</span>
                  </div>
                  <div className="label tnum" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span>{c.asset_symbol ?? "—"}</span>
                    <span style={{ color: dirColor }}>{dirLabel}</span>
                    <span>{(c.confidence * 100).toFixed(0)}% CONF</span>
                  </div>
                </div>

                <p style={{ marginTop: 14, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.7, maxWidth: "70ch" }}>
                  {c.content}
                </p>

                <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                  <button
                    disabled={!connected}
                    title={!connected ? "Connect a wallet first" : undefined}
                    onClick={() => setOpenCallId(isOpen ? null : c.call_id)}
                    style={{
                      ...actionBtn,
                      color: "var(--loss)",
                      borderColor: isOpen ? "var(--loss)" : "var(--line-strong)",
                      opacity: !connected ? 0.4 : 1,
                      cursor: !connected ? "not-allowed" : "pointer",
                    }}
                  >
                    Fade
                  </button>
                  <button
                    disabled={!connected}
                    title={!connected ? "Connect a wallet first" : undefined}
                    onClick={() => setOpenCallId(isOpen ? null : c.call_id)}
                    style={{
                      ...actionBtn,
                      color: "var(--gain)",
                      borderColor: isOpen ? "var(--gain)" : "var(--line-strong)",
                      opacity: !connected ? 0.4 : 1,
                      cursor: !connected ? "not-allowed" : "pointer",
                    }}
                  >
                    Follow
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
                    <FadeTicket call={toDossierCall(c)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
