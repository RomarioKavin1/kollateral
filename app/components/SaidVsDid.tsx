"use client";

import { useState } from "react";
import type { SaidVsDid as SaidVsDidData, SaidVsDidCase } from "@/lib/dossier";

function fmtDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtUsd(v: number) {
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function CaseCard({ c, onClose }: { c: SaidVsDidCase; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-40" aria-hidden="true" />
      <div className="fixed top-0 right-0 h-full w-[480px] bg-neutral-950 border-l border-neutral-800 z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-300">Said vs. Did</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
            <p className="text-neutral-200 whitespace-pre-wrap">{c.call.content}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span>{fmtDate(c.call.posted_at)}</span>
              <a
                href={c.call.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-neutral-400"
              >
                view original →
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            sold {c.gapHours}h after this post
          </div>

          <div className="rounded-lg border border-neutral-800 px-4 py-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">amount</span>
              <span className="text-neutral-200 tabular-nums">{fmtUsd(c.event.usd_value)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">occurred</span>
              <span className="text-neutral-200">{fmtDate(c.event.occurred_at)}</span>
            </div>
            <a
              href={`https://etherscan.io/tx/${c.event.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-neutral-400 hover:underline"
            >
              view tx on etherscan →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export function SaidVsDid({ data }: { data: SaidVsDidData }) {
  const [selected, setSelected] = useState<SaidVsDidCase | null>(null);

  if (!data.wallet) {
    return <div className="py-10 text-neutral-500 text-sm">No linked wallet.</div>;
  }

  return (
    <div className="py-6">
      <p className="text-xs text-neutral-500 mb-6">
        Wallet linked via public attribution: {data.attribution ?? "—"}. Not our attribution.
      </p>

      {data.cases.length === 0 ? (
        <div className="text-neutral-500 text-sm">
          No contradictions in window. {data.walletEventsChecked} wallet events checked.
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-900">
          <div className="grid grid-cols-[1fr_auto_1fr] text-xs text-neutral-500 px-4 py-2">
            <span>Post</span>
            <span className="text-center px-4">gap</span>
            <span className="text-right">Wallet event</span>
          </div>
          {data.cases.map((c, i) => (
            <button
              key={i}
              onClick={() => setSelected(c)}
              className="w-full grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 text-sm text-left hover:bg-neutral-900/60"
            >
              <span className="text-neutral-300 pr-3">
                <span className="text-neutral-600 text-xs mr-2 tabular-nums">
                  {fmtDate(c.call.posted_at)}
                </span>
                {truncate(c.call.content, 60)}
                {c.call.asset_symbol && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] align-middle">
                    {c.call.asset_symbol}
                  </span>
                )}
              </span>
              <span className="px-4 text-center whitespace-nowrap">
                <span className="inline-block h-px w-6 bg-red-500 align-middle" />
                <span className="mx-1 text-red-500 text-xs tabular-nums align-middle">
                  {c.gapHours}h
                </span>
                <span className="inline-block h-px w-6 bg-red-500 align-middle" />
              </span>
              <span className="text-neutral-300 pl-3 text-right tabular-nums">
                sold {fmtUsd(c.event.usd_value)}
                <span className="text-neutral-600 text-xs ml-2">{fmtDate(c.event.occurred_at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && <CaseCard c={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
