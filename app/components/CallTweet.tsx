"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { FeedCall } from "@/app/api/feed/route";

function timeAgo(unixSec: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - unixSec));
  const d = Math.floor(s / 86400);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(s / 3600);
  if (h >= 1) return `${h}h`;
  return `${Math.floor(s / 60)}m`;
}
function monogram(h: string) {
  return h.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??";
}
function trunc(v: string | null | undefined, n = 8) {
  if (!v) return null;
  return v.length <= n * 2 + 1 ? v : `${v.slice(0, n)}…${v.slice(-6)}`;
}

// The AI classification template, spelled out for humans.
const TEMPLATE_LABEL: Record<string, string> = {
  DIRECTIONAL: "directional call",
  TARGET_CALL: "price target",
  GEM_SHILL: "gem shill",
  AMBIGUOUS: "no clear signal",
};

interface Receipt {
  tee_signature: string | null;
  content_hash: string | null;
}

export function CallTweet({
  call,
  connected,
  fadeOpen,
  onFade,
  onFollow,
  children,
}: {
  call: FeedCall;
  connected: boolean;
  fadeOpen: boolean;
  onFade: () => void;
  onFollow: () => void;
  children?: ReactNode;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [proofOpen, setProofOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const name = call.display_name || call.handle;
  const dir = call.direction;
  const ai = call.ai;
  const settled = call.status === "settled";

  // Lazily pull the full receipt (signature + content hash) the first time the
  // proof drawer opens, so the panel shows the actual TEE artifact, not a claim.
  useEffect(() => {
    if (!proofOpen || receipt) return;
    let cancelled = false;
    fetch(`/api/receipt/${call.call_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setReceipt({ tee_signature: d.tee_signature, content_hash: d.content_hash }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [proofOpen, receipt, call.call_id]);

  return (
    <article className="tweet">
      <Link href={`/k/${call.handle}`} className="tw-avatar" aria-label={`${call.handle} dossier`}>
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={call.avatar_url} alt="" onError={() => setImgOk(false)} width={46} height={46} />
        ) : (
          <span className="pixel">{monogram(call.handle)}</span>
        )}
      </Link>

      <div style={{ minWidth: 0, flex: 1 }}>
        {/* identity row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Link href={`/k/${call.handle}`} className="tw-name">
            {name}
          </Link>
          <span className="label" style={{ letterSpacing: "0.04em" }}>@{call.handle}</span>
          <span className="label">· {timeAgo(call.posted_at)}</span>
          {call.deleted_at && <span className="label" style={{ color: "var(--loss)" }}>· deleted</span>}
          <a
            href={call.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tw-src label"
            style={{ marginLeft: "auto" }}
            title="Open the original tweet"
          >
            original ↗
          </a>
        </div>

        {/* the tweet */}
        <p style={{ marginTop: 8, color: "var(--ink)", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {call.content}
        </p>

        {/* AI inference chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <span className="chip" title="What the model classified this post as">
            {TEMPLATE_LABEL[call.template] ?? call.template.toLowerCase()}
          </span>
          {call.asset_symbol && (
            <span className="asset-tag">
              ${call.asset_symbol}
              {dir && <span style={{ color: "var(--faint)", marginLeft: 6 }}>{dir === "long" ? "▲ long" : "▼ short"}</span>}
            </span>
          )}
          <span className="chip tnum">{Math.round(call.confidence * 100)}% confidence</span>
          {settled && call.latest_price != null && (
            <span className="chip tnum">settled @ ${call.latest_price.toLocaleString()}</span>
          )}
        </div>

        {/* 0G TEE proof badge */}
        {ai && (
          <button className={`proof-badge ${proofOpen ? "proof-open" : ""}`} onClick={() => setProofOpen((v) => !v)}>
            <span className="proof-dot" />
            {ai.hasSignature ? "TEE-signed inference" : "0G inference"}
            <span style={{ color: "var(--faint)" }}>· {ai.model ?? "0g-compute"}</span>
            {ai.verified ? <span style={{ color: "var(--gain)" }}>· verified ✓</span> : null}
            <span style={{ color: "var(--faint)" }}>{proofOpen ? "▾" : "▸"}</span>
          </button>
        )}

        {proofOpen && ai && (
          <div className="proof-panel">
            <div className="label" style={{ marginBottom: 10 }}>// 0G compute · verifiable inference</div>
            <ProofRow k="model" v={ai.model} />
            <ProofRow k="classified" v={`${ai.aiTemplate ?? call.template}${ai.aiConfidence != null ? ` (${Math.round(ai.aiConfidence * 100)}%)` : ""}`} />
            <ProofRow k="provider" v={trunc(ai.provider, 10)} mono />
            <ProofRow k="chat id" v={trunc(ai.chatId, 12)} mono />
            <ProofRow k="request id" v={trunc(ai.requestId, 10)} mono />
            <ProofRow k="tee signature" v={receipt ? (trunc(receipt.tee_signature, 12) ?? "none on this provider") : "…"} mono />
            <ProofRow k="content hash" v={receipt ? trunc(receipt.content_hash, 12) : "…"} mono />
            {ai.costA0gi && <ProofRow k="cost" v={`${(Number(ai.costA0gi) / 1e18).toFixed(6)} A0GI`} mono />}
            <div className="label" style={{ marginTop: 10, color: ai.verified ? "var(--gain)" : "var(--muted)" }}>
              {ai.verified
                ? "signature recovers to the provider's on-chain TEE signer"
                : "TeeTLS provider: attested at the transport layer, no per-response signature"}
            </div>
          </div>
        )}

        {/* actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <button
            className={`act ${fadeOpen ? "act-fade-on" : ""}`}
            disabled={!connected}
            title={!connected ? "Connect a wallet first" : "Trade against this call"}
            onClick={onFade}
          >
            Fade
          </button>
          <button
            className="act"
            disabled={!connected}
            title={!connected ? "Connect a wallet first" : "Trade with this call"}
            onClick={onFollow}
          >
            Follow
          </button>
          {!connected && <span className="label" style={{ color: "var(--faint)" }}>connect a wallet to trade</span>}
        </div>

        {children}
      </div>
    </article>
  );
}

function ProofRow({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
      <span className="label">{k}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : undefined, fontSize: 12, color: "var(--ink)", textAlign: "right", overflowWrap: "anywhere" }}>
        {v ?? "—"}
      </span>
    </div>
  );
}
