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

export default function TerminalPage() {
  const { isConnected } = useAccount();
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Terminal</h1>

      {!isConnected && <p>Connect a wallet (see a call&apos;s ticket below) to FADE or FOLLOW.</p>}

      {loading && <p>Loading feed…</p>}
      {!loading && error && <p>Could not load feed ({error}).</p>}
      {!loading && !error && calls && calls.length === 0 && <p>No calls yet.</p>}

      {!loading && !error && calls && calls.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {calls.map((c) => (
            <li
              key={c.call_id}
              style={{ border: "1px solid #444", padding: 8, marginBottom: 8 }}
            >
              <div>
                <strong>@{c.handle}</strong> · {c.asset_symbol ?? "—"} ·{" "}
                {c.direction === "long" ? "long" : c.direction === "short" ? "short" : "—"} ·{" "}
                {(c.confidence * 100).toFixed(0)}% confidence · {fmtDate(c.posted_at)}
              </div>
              <p>{c.content}</p>
              <button
                disabled={!isConnected}
                title={!isConnected ? "Connect a wallet first" : undefined}
                onClick={() => setOpenCallId(openCallId === c.call_id ? null : c.call_id)}
              >
                FADE
              </button>{" "}
              <button
                disabled={!isConnected}
                title={!isConnected ? "Connect a wallet first" : undefined}
                onClick={() => setOpenCallId(openCallId === c.call_id ? null : c.call_id)}
              >
                FOLLOW
              </button>
              {openCallId === c.call_id && (
                <div style={{ marginTop: 8 }}>
                  <FadeTicket call={toDossierCall(c)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
