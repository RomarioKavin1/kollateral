"use client";

import { useEffect, useState } from "react";
import type { DossierCall } from "@/lib/dossier";

interface Receipt {
  request_json: string;
  response_json: string;
  chat_id: string | null;
  tee_signature: string | null;
  provider_address: string | null;
  content_hash: string;
}

function fmtDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncateHash(hash: string | null | undefined, n: number) {
  if (!hash) return null;
  return hash.length > n ? `${hash.slice(0, n)}…` : hash;
}

function CopyButton({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="ml-2 text-neutral-500 hover:text-neutral-200 text-xs"
      title="Copy to clipboard"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-900 last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className="flex items-center">
        <span className="text-neutral-300">{value ?? "—"}</span>
        <CopyButton value={value} />
      </span>
    </div>
  );
}

export function CallDetail({
  call,
  onClose,
}: {
  call: DossierCall;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptMissing, setReceiptMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReceipt(null);
    setReceiptMissing(false);
    fetch(`/api/receipt/${call.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Receipt>;
      })
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch(() => {
        if (!cancelled) setReceiptMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [call.id]);

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40"
        aria-hidden="true"
      />
      <div className="fixed top-0 right-0 h-full w-[480px] bg-neutral-950 border-l border-neutral-800 z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-300">Call detail</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {call.deleted_at != null && (
            <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-400">
              Post deleted {fmtDate(call.deleted_at)}. Content preserved from archive (hash{" "}
              {truncateHash(receipt?.content_hash, 8) ?? "—"}).
            </div>
          )}

          {/* Tweet-like card */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
            <p className="text-neutral-200 whitespace-pre-wrap">{call.content}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span>{fmtDate(call.posted_at)}</span>
              <a
                href={call.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-neutral-400"
              >
                view original →
              </a>
            </div>
          </div>

          {/* Signal box */}
          <div className="rounded-lg border border-neutral-800 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-neutral-300">
              <span>{call.template}</span>
              <span className="text-neutral-600">·</span>
              <span>{call.asset_symbol ?? "—"}</span>
              <span className="text-neutral-600">·</span>
              <span>{call.direction ?? "—"}</span>
              <span className="text-neutral-600">·</span>
              <span>{call.expiry_at != null ? fmtDate(call.expiry_at) : "—"}</span>
              <span className="text-neutral-600">·</span>
              <span>{(call.confidence * 100).toFixed(0)}% confidence</span>
            </div>
          </div>

          {/* Receipt strip */}
          <div className="rounded-lg border border-neutral-800 px-4 py-3 font-mono text-xs">
            <div className="mb-2 text-neutral-500 uppercase tracking-wide text-[10px]">
              TEE receipt
            </div>
            {receiptMissing ? (
              <div className="text-neutral-500">No receipt available for this call.</div>
            ) : (
              <>
                <ReceiptRow
                  label="content hash"
                  value={truncateHash(receipt?.content_hash, 16)}
                />
                <ReceiptRow label="chat id" value={receipt?.chat_id ?? null} />
                <ReceiptRow
                  label="tee signature"
                  value={truncateHash(receipt?.tee_signature, 16)}
                />
                <ReceiptRow label="provider" value={receipt?.provider_address ?? null} />
              </>
            )}
            <a
              href={`/api/receipt/${call.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-neutral-400 hover:underline"
            >
              verify →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
