"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { VerdictBlock } from "@/components/VerdictBlock";
import { CallLedger } from "@/components/CallLedger";
import { CallDetail } from "@/components/CallDetail";
import { SaidVsDid } from "@/components/SaidVsDid";
import { EquityCurveChart } from "@/components/DitheredChart";
import { DitherArt } from "@/components/DitherArt";
import type { Dossier, DossierCall } from "@/lib/dossier";

type Tab = "calls" | "said-vs-did";

const TABS: { key: Tab; label: string }[] = [
  { key: "calls", label: "Calls" },
  { key: "said-vs-did", label: "Said vs. Did" },
];

export default function DossierPage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle;

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DossierCall | null>(null);
  const [tab, setTab] = useState<Tab>("calls");

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    fetch(`/api/dossier/${handle}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Dossier>;
      })
      .then((d) => {
        if (!cancelled) setDossier(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const curve = useMemo(() => {
    if (!dossier) return [];
    const sorted = [...dossier.calls].sort((a, b) => a.posted_at - b.posted_at);
    let cumCall = 0;
    let cumEth = 0;
    return sorted
      .filter((c) => c.pnlUsd != null)
      .map((c) => {
        cumCall += c.pnlUsd ?? 0;
        cumEth += c.ethPnlUsd ?? 0;
        return {
          date: new Date(c.posted_at * 1000).toLocaleDateString(),
          call: cumCall,
          eth: cumEth,
        };
      });
  }, [dossier]);

  function handleSelect(call: DossierCall) {
    setSelected(call);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
        <div className="label flick">reading the ledger for @{handle}…</div>
      </div>
    );
  }
  if (error || !dossier) {
    return (
      <div className="max-w-4xl mx-auto" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
        <div className="label" style={{ color: "var(--muted)" }}>no dossier on file for @{handle}.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
      {/* ---- case file header ---- */}
      <header style={{ borderBottom: "1px solid var(--line)", paddingBottom: 24, marginBottom: 8 }}>
        <div className="label">// dossier</div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 6vw, 56px)",
            margin: "10px 0 0",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "var(--faint)" }}>@</span>
          {dossier.handle}
        </h1>
      </header>

      {/* thesis band — dither accent tying the dossier to the product line */}
      <div
        style={{
          position: "relative",
          height: 88,
          background: "var(--dark)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          marginBottom: 32,
        }}
      >
        <DitherArt shape="signal" invert gap={4} className="h-full w-full" />
        <div
          className="label"
          style={{
            position: "absolute",
            top: "50%",
            left: 16,
            transform: "translateY(-50%)",
            color: "var(--dark-ink)",
            opacity: 0.8,
          }}
        >
          separating signal from the noise
        </div>
      </div>

      <VerdictBlock stats={dossier.stats} />

      {dossier.integrity.deletedTotal > 0 && (
        <p
          className="tnum"
          style={{
            fontSize: 13,
            color: "var(--loss)",
            border: "1px solid color-mix(in oklch, var(--loss) 45%, var(--line))",
            background: "color-mix(in oklch, var(--loss) 8%, var(--surface))",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            marginBottom: 32,
          }}
        >
          Deleted {dossier.integrity.deletedTotal} call
          {dossier.integrity.deletedTotal === 1 ? "" : "s"} · avg{" "}
          {dossier.integrity.deletedAvgRetPct >= 0 ? "+" : ""}
          {dossier.integrity.deletedAvgRetPct}% · $
          {Math.abs(dossier.integrity.deletedHiddenLoss).toLocaleString()} hidden
        </p>
      )}

      {dossier.insights.scoredCalls > 0 && (
        <div
          className="panel"
          style={{
            marginBottom: 40,
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 1,
            background: "var(--line)",
            overflow: "hidden",
          }}
        >
          <div style={{ background: "var(--surface)", padding: "16px 18px" }}>
            <div className="label">Wallet contradicts</div>
            <div className="tnum" style={{ color: "var(--ink)", fontSize: 18, marginTop: 6 }}>
              {dossier.insights.contradictionRate}% of calls
            </div>
          </div>
          <div style={{ background: "var(--surface)", padding: "16px 18px" }}>
            <div className="label">Direction</div>
            <div className="tnum" style={{ color: "var(--ink)", fontSize: 18, marginTop: 6 }}>
              {dossier.insights.longPct}% long
            </div>
          </div>
          <div style={{ background: "var(--surface)", padding: "16px 18px" }}>
            <div className="label">Cadence</div>
            <div className="tnum" style={{ color: "var(--ink)", fontSize: 18, marginTop: 6 }}>
              {dossier.insights.callsPerWeek}/wk
            </div>
          </div>
          <div style={{ background: "var(--surface)", padding: "16px 18px" }}>
            <div className="label">Calls scored</div>
            <div className="tnum" style={{ color: "var(--ink)", fontSize: 18, marginTop: 6 }}>
              {dossier.insights.scoredCalls}/{dossier.insights.totalCalls}
            </div>
          </div>
          {dossier.insights.bestCall && (
            <div style={{ background: "var(--surface)", padding: "16px 18px", gridColumn: "1 / -1" }}>
              <div className="label">Best / worst call</div>
              <div className="tnum" style={{ fontSize: 14, marginTop: 6 }}>
                <span style={{ color: "var(--gain)" }}>
                  {dossier.insights.bestCall.asset} +{dossier.insights.bestCall.retPct}%
                </span>{" "}
                <span style={{ color: "var(--faint)" }}>/</span>{" "}
                <span style={{ color: "var(--loss)" }}>
                  {dossier.insights.worstCall!.asset} {dossier.insights.worstCall!.retPct}%
                </span>
              </div>
            </div>
          )}
          {dossier.insights.byToken.length > 0 && (
            <div style={{ background: "var(--surface)", padding: "16px 18px", gridColumn: "1 / -1" }}>
              <div className="label">Per-token (avg %)</div>
              <div className="tnum" style={{ fontSize: 14, marginTop: 6, color: "var(--muted)" }}>
                {dossier.insights.byToken
                  .slice(0, 4)
                  .map((t) => `${t.asset} ${t.avgRetPct >= 0 ? "+" : ""}${t.avgRetPct}% (${t.winRate}%W)`)
                  .join(" · ")}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="label"
            style={{
              padding: "10px 14px",
              marginBottom: -1,
              cursor: "pointer",
              background: "transparent",
              border: 0,
              borderBottom: `2px solid ${tab === t.key ? "var(--ink)" : "transparent"}`,
              color: tab === t.key ? "var(--ink)" : "var(--faint)",
              transition: "color 0.18s var(--ease-out-quart)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "calls" && (
        <>
          {curve.length > 0 && (
            <div className="mb-10">
              <EquityCurveChart data={curve} positive={dossier.stats.totalPnl >= 0} />
            </div>
          )}

          <CallLedger calls={dossier.calls} onSelect={handleSelect} />

          {selected && <CallDetail call={selected} onClose={() => setSelected(null)} />}
        </>
      )}

      {tab === "said-vs-did" && <SaidVsDid data={dossier.saidVsDid} />}
    </div>
  );
}
