"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useSendTransaction } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import type { DossierCall } from "@/lib/dossier";
import { TOKENS } from "@/lib/tokens";

// Base Sepolia canonical WETH (same address across OP-stack chains).
const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006";
const DEFAULT_AMOUNT = "1000000000000000"; // 0.001 WETH-equivalent, in wei

type Mode = "fade" | "follow";

interface QuoteEnvelope {
  step?: "permit" | "swap";
  quote?: {
    permitData?: unknown;
    quote?: {
      amountIn?: string;
      amountOut?: string;
      route?: unknown;
      priceImpact?: number | string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  swap?: {
    swap?: {
      to?: string;
      data?: `0x${string}`;
      value?: string;
    };
    [key: string]: unknown;
  };
  error?: string;
}

// FADE inverts the call's direction; FOLLOW mirrors it. Both then map to a
// buy (WETH -> asset) or sell (asset -> WETH) leg — see task-10 brief.
function resolveSide(direction: "long" | "short" | null, mode: Mode): "long" | "short" {
  const base = direction ?? "long";
  if (mode === "follow") return base;
  return base === "long" ? "short" : "long";
}

function summarizeQuote(env: QuoteEnvelope | null): string | null {
  const q = env?.quote?.quote;
  if (!q) return null;
  const parts: string[] = [];
  if (q.amountIn) parts.push(`in ${q.amountIn}`);
  if (q.amountOut) parts.push(`out ${q.amountOut}`);
  if (q.priceImpact !== undefined) parts.push(`impact ${q.priceImpact}`);
  if (parts.length === 0) return JSON.stringify(q).slice(0, 240);
  return parts.join(" · ");
}

export function FadeTicket({ call }: { call: DossierCall }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { sendTransaction, data: hash, isPending: isSending, error: sendError, reset } =
    useSendTransaction();

  const defaultAssetAddress = call.asset_symbol ? TOKENS[call.asset_symbol] ?? "" : "";

  const [assetAddress, setAssetAddress] = useState(defaultAssetAddress);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<QuoteEnvelope | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggedHashRef = useRef<string | null>(null);

  const side = mode ? resolveSide(call.direction, mode) : null;
  const tokenIn = side === "long" ? WETH_BASE_SEPOLIA : assetAddress;
  const tokenOut = side === "long" ? assetAddress : WETH_BASE_SEPOLIA;

  async function runQuote(currentMode: Mode) {
    if (!assetAddress) {
      setError("No token address for this asset — enter one to price the demo swap.");
      return;
    }
    if (!address) {
      setError("Connect a wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = resolveSide(call.direction, currentMode);
      const body = {
        action: "quote" as const,
        tokenIn: s === "long" ? WETH_BASE_SEPOLIA : assetAddress,
        tokenOut: s === "long" ? assetAddress : WETH_BASE_SEPOLIA,
        amount,
        swapper: address,
        chainId: baseSepolia.id,
      };
      // Trading API's check_approval gate — fire-and-forget for the demo;
      // a real wallet flow would block on its result before /quote.
      fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approval",
          walletAddress: address,
          token: body.tokenIn,
          amount,
          chainId: baseSepolia.id,
        }),
      }).catch(() => {});

      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as QuoteEnvelope;
      if (!res.ok) {
        setError(json.error ?? `Quote failed (${res.status})`);
        setEnvelope(null);
        return;
      }
      setEnvelope(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote request failed");
    } finally {
      setLoading(false);
    }
  }

  function handlePick(next: Mode) {
    setMode(next);
    loggedHashRef.current = null;
    reset();
    void runQuote(next);
  }

  // Live-refresh the quote every 20s while a mode is selected and the swap
  // hasn't executed yet, so the route shown stays close to the fill price.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (mode && !hash) {
      pollRef.current = setInterval(() => void runQuote(mode), 20_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hash, amount, assetAddress]);

  useEffect(() => {
    if (!hash || loggedHashRef.current === hash) return;
    loggedHashRef.current = hash;
    fetch("/api/txlog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash, callId: call.id, side: mode }),
    }).catch(() => {});
  }, [hash, call.id, mode]);

  function handleExecute() {
    const tx = envelope?.swap?.swap;
    if (!tx?.to || !tx?.data) return;
    sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : undefined,
    });
  }

  const routeSummary = summarizeQuote(envelope);
  const step = envelope?.step;

  return (
    <div className="rounded-lg border border-neutral-800 px-4 py-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-neutral-500 uppercase tracking-wide text-[10px]">
          Fade / Follow · Base Sepolia
        </span>
        {!isConnected ? (
          <button
            onClick={() => connectors[0] && connect({ connector: connectors[0] })}
            className="text-xs text-neutral-400 hover:text-neutral-200 underline"
          >
            connect wallet
          </button>
        ) : (
          <span className="text-xs text-neutral-500 font-mono">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-xs">token address</span>
          <input
            value={assetAddress}
            onChange={(e) => setAssetAddress(e.target.value)}
            placeholder="0x…"
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-neutral-200"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500 text-xs">amount (wei)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-neutral-200"
          />
        </label>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => handlePick("fade")}
          disabled={loading}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium border ${
            mode === "fade"
              ? "border-red-700 text-red-400 bg-red-950/30"
              : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
          }`}
        >
          FADE
        </button>
        <button
          onClick={() => handlePick("follow")}
          disabled={loading}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium border ${
            mode === "follow"
              ? "border-emerald-700 text-emerald-400 bg-emerald-950/30"
              : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
          }`}
        >
          FOLLOW
        </button>
      </div>

      {loading && <div className="text-xs text-neutral-500 mb-2">fetching quote…</div>}
      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      {mode && side && (
        <div className="text-xs text-neutral-500 mb-2 font-mono">
          {side === "long" ? "buy" : "sell"} · in {tokenIn.slice(0, 8)}… → out{" "}
          {tokenOut.slice(0, 8)}…
        </div>
      )}

      {envelope && (
        <div className="rounded border border-neutral-900 bg-neutral-900/40 px-3 py-2 mb-2">
          <div className="text-neutral-500 text-[10px] uppercase tracking-wide mb-1">
            {step === "permit" ? "permit required" : "route"}
          </div>
          <div className="text-neutral-300 text-xs font-mono break-all">
            {routeSummary ?? "no route data returned"}
          </div>
        </div>
      )}

      {step === "swap" && envelope?.swap?.swap?.to && !hash && (
        <button
          onClick={handleExecute}
          disabled={isSending}
          className="w-full rounded bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
        >
          {isSending ? "confirm in wallet…" : "Sign & Execute"}
        </button>
      )}

      {step === "permit" && (
        <div className="text-xs text-neutral-500">
          Quote requires a Permit2 signature step before swap — not wired in this demo build.
        </div>
      )}

      {sendError && (
        <div className="text-xs text-red-400 mt-2">{sendError.message}</div>
      )}

      {hash && (
        <div className="text-xs text-emerald-400 mt-2 font-mono break-all">
          sent: {hash}
        </div>
      )}
    </div>
  );
}
