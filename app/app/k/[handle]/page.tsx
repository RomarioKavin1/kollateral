"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VerdictBlock } from "@/components/VerdictBlock";
import { CallLedger } from "@/components/CallLedger";
import { CallDetail } from "@/components/CallDetail";
import { SaidVsDid } from "@/components/SaidVsDid";
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
    return <div className="p-10 text-neutral-500">Loading {handle}…</div>;
  }
  if (error || !dossier) {
    return <div className="p-10 text-neutral-500">No dossier for {handle}.</div>;
  }

  const callColor = dossier.stats.totalPnl < 0 ? "#ef4444" : "#22c55e";

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-200">{dossier.handle}</h1>
      <VerdictBlock stats={dossier.stats} />

      {dossier.integrity.deletedTotal > 0 && (
        <p className="text-sm text-red-400 mb-6">
          Deleted {dossier.integrity.deletedTotal} call
          {dossier.integrity.deletedTotal === 1 ? "" : "s"} · avg{" "}
          {dossier.integrity.deletedAvgRetPct >= 0 ? "+" : ""}
          {dossier.integrity.deletedAvgRetPct}% · $
          {Math.abs(dossier.integrity.deletedHiddenLoss).toLocaleString()} hidden
        </p>
      )}

      {dossier.insights.scoredCalls > 0 && (
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wide">Wallet contradicts</div>
            <div className="text-neutral-100 text-lg">{dossier.insights.contradictionRate}% of calls</div>
          </div>
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wide">Direction</div>
            <div className="text-neutral-100 text-lg">{dossier.insights.longPct}% long</div>
          </div>
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wide">Cadence</div>
            <div className="text-neutral-100 text-lg">{dossier.insights.callsPerWeek}/wk</div>
          </div>
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wide">Calls scored</div>
            <div className="text-neutral-100 text-lg">
              {dossier.insights.scoredCalls}/{dossier.insights.totalCalls}
            </div>
          </div>
          {dossier.insights.bestCall && (
            <div className="col-span-2">
              <div className="text-neutral-500 text-xs uppercase tracking-wide">Best / worst call</div>
              <div className="text-sm">
                <span className="text-green-400">
                  {dossier.insights.bestCall.asset} +{dossier.insights.bestCall.retPct}%
                </span>{" "}
                /{" "}
                <span className="text-red-400">
                  {dossier.insights.worstCall!.asset} {dossier.insights.worstCall!.retPct}%
                </span>
              </div>
            </div>
          )}
          {dossier.insights.byToken.length > 0 && (
            <div className="col-span-2">
              <div className="text-neutral-500 text-xs uppercase tracking-wide">Per-token (avg %)</div>
              <div className="text-sm text-neutral-300">
                {dossier.insights.byToken
                  .slice(0, 4)
                  .map((t) => `${t.asset} ${t.avgRetPct >= 0 ? "+" : ""}${t.avgRetPct}% (${t.winRate}%W)`)
                  .join(" · ")}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === t.key
                ? "border-neutral-200 text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "calls" && (
        <>
          {curve.length > 0 && (
            <div className="mb-10">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" stroke="#a3a3a3" fontSize={12} />
                  <YAxis stroke="#a3a3a3" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#171717", border: "1px solid #262626" }}
                    labelStyle={{ color: "#e5e5e5" }}
                  />
                  <Legend wrapperStyle={{ color: "#a3a3a3" }} />
                  <Line
                    type="monotone"
                    dataKey="call"
                    name="Calls"
                    stroke={callColor}
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="eth"
                    name="ETH"
                    stroke="#a3a3a3"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
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
