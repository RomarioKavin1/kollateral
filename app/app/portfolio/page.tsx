"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { DitherArt } from "@/components/DitherArt";

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

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid var(--line-strong)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
};
const btnPrimary: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  border: "1px solid var(--ink)",
  borderRadius: "var(--radius)",
  padding: "10px 22px",
  background: "var(--ink)",
  color: "var(--bg)",
  cursor: "pointer",
};

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

  const pnlPositive = (data?.summary.totalPnlUsd ?? 0) >= 0;

  return (
    <main className="mx-auto max-w-6xl px-6" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
      <div className="label" style={{ marginBottom: 10 }}>// trade history &amp; realized performance</div>
      <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: 20 }}>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)" }}>Portfolio</h1>
      </div>

      {/* ---- dither hero band ---- */}
      <div
        style={{
          position: "relative",
          height: 130,
          marginTop: 24,
          background: "var(--dark)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <DitherArt shape="loop" invert gap={4} className="h-full w-full" />
        <div
          className="label"
          style={{ position: "absolute", bottom: 14, left: 16, color: "var(--dark-ink)", opacity: 0.75 }}
        >
          realized performance, compounding
        </div>
      </div>

      {!ready && <div className="label flick" style={{ padding: "40px 0" }}>loading auth…</div>}

      {ready && !authenticated && (
        <div className="panel" style={{ marginTop: 40, padding: "28px 26px", maxWidth: 480 }}>
          <p className="label" style={{ marginBottom: 16 }}>authentication required</p>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
            Log in to see your copy/fade trade history.
          </p>
          <button style={btnPrimary} onClick={() => login()}>Log in</button>
        </div>
      )}

      {ready && authenticated && (
        <>
          {loading && <div className="label flick" style={{ padding: "40px 0" }}>loading portfolio…</div>}
          {!loading && error && (
            <div className="label" style={{ padding: "40px 0", color: "var(--loss)" }}>
              could not load portfolio ({error})
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ---- summary strip ---- */}
              <div
                style={{
                  marginTop: 40,
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  background: "var(--line)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ background: "var(--bg)", padding: "22px 24px" }}>
                  <div className="label">total trades</div>
                  <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 32, marginTop: 8 }}>
                    {data.summary.totalTrades}
                  </div>
                </div>
                <div style={{ background: "var(--bg)", padding: "22px 24px" }}>
                  <div className="label">total P&amp;L</div>
                  <div
                    className={`tnum ${pnlPositive ? "gain" : "loss"}`}
                    style={{ fontFamily: "var(--font-display)", fontSize: 32, marginTop: 8 }}
                  >
                    {fmtUsd(data.summary.totalPnlUsd)}
                  </div>
                </div>
              </div>

              {/* ---- trade table ---- */}
              <section style={{ marginTop: 56 }}>
                <div className="label" style={{ marginBottom: 14 }}>// ledger</div>

                {data.trades.length === 0 ? (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: 200,
                      background: "var(--dark)",
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", inset: 0 }}>
                      <DitherArt shape="field" invert gap={4} className="h-full w-full" />
                    </div>
                    <div
                      className="label"
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        color: "var(--dark-ink)",
                        opacity: 0.85,
                      }}
                    >
                      no trades yet
                    </div>
                  </div>
                ) : (
                  <div className="panel" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr className="label">
                          <th style={th}>Creator</th>
                          <th style={th}>Mode</th>
                          <th style={th}>Token</th>
                          <th style={th}>Side</th>
                          <th style={{ ...th, textAlign: "right" }}>Amount</th>
                          <th style={{ ...th, textAlign: "right" }}>Entry price</th>
                          <th style={th}>Status</th>
                          <th style={{ ...th, textAlign: "right" }}>Yield</th>
                          <th style={th}>Tx</th>
                          <th style={th}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trades.map((t, i) => {
                          const yieldPositive = (t.yield_usd ?? 0) >= 0;
                          return (
                            <tr key={t.tx_hash ?? i}>
                              <td style={td}>
                                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                                  @{t.creator_handle}
                                </span>
                              </td>
                              <td style={{ ...td }}>
                                <span className="label" style={{ color: t.mode === "fade" ? "var(--loss)" : "var(--gain)" }}>
                                  {t.mode}
                                </span>
                              </td>
                              <td style={td}>{t.token_symbol ?? "—"}</td>
                              <td style={td}>{t.side ?? "—"}</td>
                              <td className="tnum" style={{ ...td, textAlign: "right" }}>
                                {t.amount_usd != null ? `$${t.amount_usd.toFixed(2)}` : "—"}
                              </td>
                              <td className="tnum" style={{ ...td, textAlign: "right" }}>
                                {t.entry_price_usd != null ? `$${t.entry_price_usd.toFixed(4)}` : "—"}
                              </td>
                              <td style={td}>
                                <span className="label">{t.status ?? "—"}</span>
                              </td>
                              <td
                                className={`tnum ${t.yield_usd == null ? "" : yieldPositive ? "gain" : "loss"}`}
                                style={{ ...td, textAlign: "right" }}
                              >
                                {fmtUsd(t.yield_usd)}
                              </td>
                              <td className="tnum" style={{ ...td, color: "var(--muted)" }}>
                                {t.tx_hash ? `${t.tx_hash.slice(0, 6)}…${t.tx_hash.slice(-4)}` : "—"}
                              </td>
                              <td className="label" style={td}>{fmtDate(t.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
