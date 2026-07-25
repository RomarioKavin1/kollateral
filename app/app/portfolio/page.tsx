"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface PortfolioTrade {
  creator_handle: string;
  mode: "copy" | "fade" | string;
  token_symbol: string | null;
  side: string | null;
  amount_usd: number | null;
  entry_price_usd: number | null;
  tx_hash: string | null;
  status: string | null;
  yield_usd: number | null;
  created_at: string | number | null;
}

interface PortfolioResponse {
  summary: { totalTrades: number; totalPnlUsd: number };
  trades: PortfolioTrade[];
}

function fmtDate(value: string | number | null) {
  if (value == null) return "—";
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function fmtUsd(value: number | null) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
}

export default function PortfolioPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/portfolio", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as PortfolioResponse;
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Portfolio</h1>

      {!ready && <p>Loading auth…</p>}

      {ready && !authenticated && (
        <div>
          <p>Log in to see your copy/fade trade history.</p>
          <button onClick={() => login()}>Log in</button>
        </div>
      )}

      {ready && authenticated && (
        <>
          {loading && <p>Loading portfolio…</p>}
          {!loading && error && <p>Could not load portfolio ({error}).</p>}

          {!loading && !error && data && (
            <>
              <p>
                {data.summary.totalTrades} trade{data.summary.totalTrades === 1 ? "" : "s"} ·
                total P&amp;L {fmtUsd(data.summary.totalPnlUsd)}
              </p>

              {data.trades.length === 0 ? (
                <p>No trades yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Mode</th>
                      <th>Token</th>
                      <th>Side</th>
                      <th>Amount (USD)</th>
                      <th>Entry price (USD)</th>
                      <th>Status</th>
                      <th>Yield (USD)</th>
                      <th>Tx</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((t, i) => (
                      <tr key={t.tx_hash ?? i}>
                        <td>@{t.creator_handle}</td>
                        <td>{t.mode}</td>
                        <td>{t.token_symbol ?? "—"}</td>
                        <td>{t.side ?? "—"}</td>
                        <td>{t.amount_usd != null ? `$${t.amount_usd.toFixed(2)}` : "—"}</td>
                        <td>{t.entry_price_usd != null ? `$${t.entry_price_usd.toFixed(4)}` : "—"}</td>
                        <td>{t.status ?? "—"}</td>
                        <td>{fmtUsd(t.yield_usd)}</td>
                        <td>
                          {t.tx_hash ? (
                            <span style={{ fontFamily: "monospace" }}>
                              {t.tx_hash.slice(0, 6)}…{t.tx_hash.slice(-4)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{fmtDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
