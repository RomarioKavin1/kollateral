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
import type { Dossier, DossierCall } from "@/lib/dossier";

export default function DossierPage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle;

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // no-op for now — Task 8 wires this to the call detail slide-over
  function handleSelect(call: DossierCall) {
    console.log("selected call", call.id);
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
    </div>
  );
}
