"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { FadeTicket } from "@/components/FadeTicket";
import { DitherArt } from "@/components/DitherArt";
import { CallTweet } from "@/components/CallTweet";
import type { FeedCall } from "@/app/api/feed/route";
import type { DossierCall } from "@/lib/dossier";

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
    <main className="mx-auto max-w-2xl px-6" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
      <div className="label" style={{ marginBottom: 10 }}>// live feed · polling every 10s</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 20 }}>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)" }}>Terminal</h1>
        {!connected && (
          <span className="label" style={{ color: "var(--muted)" }}>
            connect a wallet on a call&apos;s ticket to FADE or FOLLOW
          </span>
        )}
      </div>

      {/* live wire: a dithered signal band that reads as the feed streaming in */}
      <div style={{ position: "relative", marginTop: 22, height: 72, background: "var(--dark)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <DitherArt shape="arrows" invert gap={4} className="h-full w-full" />
        <div className="label" style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)", color: "var(--dark-ink)", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="flick" style={{ color: "var(--signal)", fontSize: 16, lineHeight: 1 }}>●</span>
          live wire · {calls?.length ?? 0} calls indexed
        </div>
      </div>

      {loading && <div className="label flick" style={{ padding: "48px 0" }}>reading the feed…</div>}
      {!loading && error && (
        <div className="label" style={{ padding: "48px 0", color: "var(--loss)" }}>could not load feed ({error})</div>
      )}
      {!loading && !error && calls && calls.length === 0 && (
        <div className="label" style={{ padding: "48px 0", color: "var(--muted)" }}>no calls yet.</div>
      )}

      {!loading && !error && calls && calls.length > 0 && (
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
          {calls.map((c, i) => {
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
    </main>
  );
}
