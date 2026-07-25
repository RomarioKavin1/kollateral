"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { isRealTweetUrl, resolveTweetUrl } from "@/lib/xlink";
import { zgAddressUrl } from "@/lib/zgexplorer";
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
function timeUntil(unixSec: number): string {
  const s = unixSec - Math.floor(Date.now() / 1000);
  if (s <= 0) return "0m";
  const d = Math.floor(s / 86400);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(s / 3600);
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(s / 60))}m`;
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
  const [deleted, setDeleted] = useState<boolean>(call.deleted_at != null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPending, setReportPending] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const name = call.display_name || call.handle;
  const dir = call.direction;
  const ai = call.ai;
  const settled = call.status === "settled";
  const now = Math.floor(Date.now() / 1000);
  const isSignal = call.template !== "AMBIGUOUS";

  async function submitReport() {
    setReportPending(true);
    setReportMsg(null);
    try {
      const r = await fetch("/api/report-deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: call.call_id }),
      });
      const d = (await r.json()) as { deleted?: boolean; verified?: boolean; error?: string };
      if (d.deleted) {
        setDeleted(true);
        setReportOpen(false);
      } else if (d.deleted === false) {
        setReportMsg("The tweet still resolves on X. Report rejected, nothing hidden.");
      } else {
        setReportMsg("Could not verify against X right now. Try again shortly.");
      }
    } catch {
      setReportMsg("Could not verify against X right now. Try again shortly.");
    } finally {
      setReportPending(false);
    }
  }

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
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12 }}>
            {!deleted && (
              <button className="tw-report" onClick={() => { setReportOpen((v) => !v); setReportMsg(null); }} title="Report this call's tweet as deleted">
                ⚑ report deleted
              </button>
            )}
            <a
              href={resolveTweetUrl(call.url, call.handle)}
              target="_blank"
              rel="noopener noreferrer"
              className="tw-src label"
              title={isRealTweetUrl(call.url) ? "Open the original tweet" : "Documented call, open the creator's X profile"}
            >
              {isRealTweetUrl(call.url) ? "original ↗" : "on x ↗"}
            </a>
          </span>
        </div>

        {/* deleted banner — red, prominent */}
        {deleted && (
          <div className="deleted-banner">
            <span className="db-mark">⚑ THIS POST WAS DELETED</span>
            <span className="label">the caller took it down{call.deleted_at ? `, ${timeAgo(call.deleted_at)} ago` : ""}, we kept the receipt</span>
          </div>
        )}

        {/* report-deletion confirm */}
        {reportOpen && !deleted && (
          <div className="report-confirm">
            <div className="label" style={{ marginBottom: 6 }}>// report a deletion</div>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
              You&apos;re about to report this call&apos;s tweet as deleted. We verify it against X before flagging, false reports are rejected and nothing is hidden.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <button className="rc-btn" onClick={() => { setReportOpen(false); setReportMsg(null); }}>Cancel</button>
              <button className="rc-btn rc-confirm" disabled={reportPending} onClick={submitReport}>
                {reportPending ? "checking X…" : "Report deletion"}
              </button>
              {reportMsg && <span className="label" style={{ color: "var(--loss)" }}>{reportMsg}</span>}
            </div>
          </div>
        )}

        {/* the tweet */}
        <p style={{ marginTop: deleted ? 12 : 8, color: "var(--ink)", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", opacity: deleted ? 0.72 : 1 }}>
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
          {/* time remaining until the call resolves */}
          {isSignal && !deleted && !settled && call.expiry_at != null && (
            call.expiry_at > now ? (
              <span className="chip chip-time tnum" title={`Resolves ${new Date(call.expiry_at * 1000).toLocaleString()}`}>
                ⏳ resolves in {timeUntil(call.expiry_at)}
              </span>
            ) : (
              <span className="chip chip-time tnum">⏳ past deadline, awaiting price</span>
            )
          )}
          {isSignal && !deleted && !settled && call.expiry_at == null && (
            <span className="chip tnum" style={{ color: "var(--faint)" }}>open, no deadline</span>
          )}
        </div>

        {/* 0G TEE proof status bar */}
        {ai && (
          <button
            className={`proof-bar ${ai.verified ? "proof-bar-verified" : ""} ${proofOpen ? "open" : ""}`}
            onClick={() => setProofOpen((v) => !v)}
            aria-expanded={proofOpen}
          >
            <span className="proof-bar-left">
              <span className="proof-dot" />
              <span className="proof-title">{ai.verified ? "TEE-verified" : "0G inference"}</span>
              {ai.verified && <span className="proof-check">✓</span>}
              <span className="proof-model">{ai.model ?? "0g-compute"}</span>
            </span>
            <span className="proof-toggle">
              {proofOpen ? "hide proof" : "show full proof"}
              <span className="proof-chev">{proofOpen ? "▾" : "▸"}</span>
            </span>
          </button>
        )}

        {proofOpen && ai && (
          <div className="proof-panel">
            <div className="label" style={{ marginBottom: 10 }}>// 0G compute · verifiable inference</div>
            <ProofRow k="model" v={ai.model} />
            <ProofRow k="classified" v={`${ai.aiTemplate ?? call.template}${ai.aiConfidence != null ? ` (${Math.round(ai.aiConfidence * 100)}%)` : ""}`} />
            <ProofRow k="provider" v={trunc(ai.provider, 10)} mono href={ai.provider ? zgAddressUrl(ai.provider) : undefined} />
            <ProofRow k="chat id" v={trunc(ai.chatId, 12)} mono />
            <ProofRow k="request id" v={trunc(ai.requestId, 10)} mono />
            {ai.hasSignature && <ProofRow k="tee signature" v={receipt ? trunc(receipt.tee_signature, 12) : "…"} mono />}
            <ProofRow k="content hash" v={receipt ? trunc(receipt.content_hash, 12) : "…"} mono />
            {ai.costA0gi && <ProofRow k="cost" v={`${(Number(ai.costA0gi) / 1e18).toFixed(6)} A0GI`} mono />}
            <div className="label" style={{ marginTop: 10, color: ai.verified ? "var(--gain)" : "var(--muted)" }}>
              {ai.verified
                ? "on-chain TEE signature verified by the 0G router (verify_tee)"
                : "transport-layer (TeeTLS) attestation via the 0G router, no per-response signature exposed"}
            </div>
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <VerifyButton callId={call.call_id} />
              {ai.provider && (
                <a
                  href={zgAddressUrl(ai.provider)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink)" }}
                >
                  <span className="proof-dot" /> look up this provider on the 0G explorer ↗
                </a>
              )}
              {/* trustless: anyone can reproduce the check against 0G directly */}
              <div className="label" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
                verify independently: POST it to 0G&apos;s router (
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>router-api.0g.ai/v1/chat/completions</span>
                ) with <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>verify_tee:true</span> + header{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>X-0G-Provider-Trust-Mode: private</span>; the response&apos;s{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>x_0g_trace.tee_verified</span> is 0G&apos;s answer, not ours.
              </div>
            </div>
          </div>
        )}

        {/* actions: follow = vote with, fade = vote against */}
        <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
          <div className={`votes ${fadeOpen ? "votes-open" : ""}`}>
            <button
              className="vote up"
              disabled={!connected}
              title={!connected ? "Connect a wallet first" : "Trade with this call"}
              onClick={onFollow}
            >
              <span className="arrow">▲</span> follow
            </button>
            <button
              className="vote down"
              disabled={!connected}
              title={!connected ? "Connect a wallet first" : "Trade against this call"}
              onClick={onFade}
            >
              <span className="arrow">▼</span> fade
            </button>
          </div>
          {!connected && <span className="label" style={{ color: "var(--faint)" }}>connect a wallet to trade</span>}
        </div>

        {children}
      </div>
    </article>
  );
}

type Attestation = {
  address: string;
  modelId: string | null;
  verifiability: string | null;
  teeType: string | null;
  teeVerifier: string | null;
  teeAttested: boolean;
  trustMode: string | null;
  providerName: string | null;
};
type VerifyResult = {
  status: "verified" | "unavailable" | "failed";
  verified: boolean;
  provider?: string | null;
  requestId?: string | null;
  attestation?: Attestation | null;
  detail: string;
};

// Runs 0G's own verification (broker.processResponse) live, via /api/verify.
function VerifyButton({ callId }: { callId: number }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [res, setRes] = useState<VerifyResult | null>(null);

  async function run() {
    setState("loading");
    setRes(null);
    try {
      const r = await fetch(`/api/verify/${callId}`);
      setRes((await r.json()) as VerifyResult);
    } catch {
      setRes({ status: "unavailable", verified: false, provider: null, detail: "verification request failed" });
    }
    setState("done");
  }

  const color =
    res?.status === "verified" ? "var(--gain)" : res?.status === "failed" ? "var(--loss)" : "var(--muted)";
  const mark = res?.status === "verified" ? "✓ verified" : res?.status === "failed" ? "✗ failed" : "⚠ unavailable";

  return (
    <div>
      <button className={`proof-badge ${state === "loading" ? "" : ""}`} onClick={run} disabled={state === "loading"}>
        <span className="proof-dot" />
        {state === "loading" ? "verifying against 0G…" : "verify this inference now"}
      </button>
      {state === "done" && res && (
        <div style={{ marginTop: 8 }}>
          <div className="label" style={{ color, lineHeight: 1.5 }}>{mark} · {res.detail}</div>
          {/* independent, 0G-sourced evidence — not our claim */}
          {(res.attestation || res.requestId || res.provider) && (
            <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", background: "var(--surface)" }}>
              <div className="label" style={{ marginBottom: 8 }}>// evidence, from 0G&apos;s own registry</div>
              {res.attestation?.teeType && <EvRow k="TEE hardware" v={res.attestation.teeType} />}
              {res.attestation?.teeVerifier && <EvRow k="attestation" v={res.attestation.teeVerifier} />}
              {res.attestation?.verifiability && <EvRow k="verifiability" v={res.attestation.verifiability} />}
              {res.attestation && <EvRow k="tee attested" v={res.attestation.teeAttested ? "yes ✓" : "no"} good={res.attestation.teeAttested} />}
              {res.requestId && <EvRow k="request id" v={res.requestId} />}
              {res.provider && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                  <span className="label">provider</span>
                  <a href={zgAddressUrl(res.provider)} target="_blank" rel="noopener noreferrer" className="link" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {res.provider.slice(0, 12)}… on-chain ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvRow({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
      <span className="label">{k}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: good ? "var(--gain)" : "var(--ink)", overflowWrap: "anywhere", textAlign: "right" }}>{v}</span>
    </div>
  );
}

function ProofRow({ k, v, mono, href }: { k: string; v: ReactNode; mono?: boolean; href?: string }) {
  const valueStyle: React.CSSProperties = {
    fontFamily: mono ? "var(--font-mono)" : undefined,
    fontSize: 12,
    color: "var(--ink)",
    textAlign: "right",
    overflowWrap: "anywhere",
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
      <span className="label">{k}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="link" style={{ ...valueStyle, textDecoration: "underline", textUnderlineOffset: 2 }}>
          {v ?? "—"} ↗
        </a>
      ) : (
        <span style={valueStyle}>{v ?? "—"}</span>
      )}
    </div>
  );
}
