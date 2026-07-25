"use client";

import { useState } from "react";
import type { DossierCall } from "@/lib/dossier";

type Filter = "all" | "deleted" | "ambiguous";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deleted", label: "Deleted" },
  { key: "ambiguous", label: "Ambiguous" },
];

function fmtPrice(v: number | null) {
  if (v == null) return "—";
  return v < 1 ? v.toPrecision(4) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function CallLedger({
  calls,
  onSelect,
}: {
  calls: DossierCall[];
  onSelect: (call: DossierCall) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = calls.filter((c) => {
    if (filter === "deleted") return c.deleted_at != null;
    if (filter === "ambiguous") return c.status === "ambiguous";
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-sm rounded-full border ${
              filter === f.key
                ? "border-neutral-400 text-neutral-100"
                : "border-neutral-800 text-neutral-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-800">
              <th className="py-2 pr-3 font-normal">Post</th>
              <th className="py-2 pr-3 font-normal">Asset</th>
              <th className="py-2 pr-3 font-normal">Dir</th>
              <th className="py-2 pr-3 font-normal">Entry → Latest</th>
              <th className="py-2 pr-3 font-normal">Return</th>
              <th className="py-2 pr-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className="border-b border-neutral-900 cursor-pointer hover:bg-neutral-900/60"
              >
                <td className="py-2 pr-3 max-w-xs">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-neutral-300 hover:underline"
                  >
                    {truncate(c.content, 80)}
                  </a>
                </td>
                <td className="py-2 pr-3">
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">
                    {c.asset_symbol ?? "—"}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {c.direction === "long" ? "↑" : c.direction === "short" ? "↓" : "—"}
                </td>
                <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                  {fmtPrice(c.entry)} → {fmtPrice(c.latest)}
                </td>
                <td
                  className={`py-2 pr-3 tabular-nums ${
                    c.retPct == null
                      ? "text-neutral-500"
                      : c.retPct < 0
                        ? "text-red-500"
                        : "text-green-500"
                  }`}
                >
                  {c.retPct != null ? `${c.retPct >= 0 ? "+" : ""}${c.retPct}%` : "—"}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {c.deleted_at != null && <span title="deleted">🗑️ </span>}
                  {c.status === "open" && <span title="open">⏳ </span>}
                  {c.chat_id != null && <span title="TEE artifact">✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
