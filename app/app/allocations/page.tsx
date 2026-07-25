"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { InfluencerSummary } from "@/app/api/influencers/route";

type Mode = "copy" | "fade";
type CapType = "fixed_usd" | "percent";

interface Allocation {
  id?: string | number;
  handle: string;
  mode: Mode;
  capType: CapType;
  capValue: number;
  createdAt?: string;
}

// The /api/allocations contract isn't locked down yet (built in parallel),
// so accept either a bare array or `{ allocations: [...] }`.
function normalizeAllocations(json: unknown): Allocation[] {
  if (Array.isArray(json)) return json as Allocation[];
  if (json && typeof json === "object" && Array.isArray((json as { allocations?: unknown }).allocations)) {
    return (json as { allocations: Allocation[] }).allocations;
  }
  return [];
}

const fieldLabel: React.CSSProperties = { marginBottom: 6, display: "block" };
const fieldControl: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  padding: "10px 12px",
  outline: "none",
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
export default function AllocationsPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();

  const [influencers, setInfluencers] = useState<InfluencerSummary[] | null>(null);
  const [influencersError, setInfluencersError] = useState<string | null>(null);

  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocationsError, setAllocationsError] = useState<string | null>(null);

  const [handle, setHandle] = useState("");
  const [mode, setMode] = useState<Mode>("copy");
  const [capType, setCapType] = useState<CapType>("fixed_usd");
  const [capValue, setCapValue] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  // Trending/known handles for the picker — reuses the same list as Home.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/influencers")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<InfluencerSummary[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setInfluencers(data);
          if (data.length > 0) setHandle((h) => h || data[0].handle);
        }
      })
      .catch((e) => {
        if (!cancelled) setInfluencersError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAllocations = useCallback(async () => {
    if (!authenticated) return;
    setLoadingAllocations(true);
    setAllocationsError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/allocations", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setAllocations(normalizeAllocations(json));
    } catch (e) {
      setAllocationsError(String(e));
    } finally {
      setLoadingAllocations(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    void loadAllocations();
  }, [loadAllocations]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedHandle = handle.trim().replace(/^@/, "");
    const parsedCapValue = Number(capValue);
    if (!trimmedHandle || Number.isNaN(parsedCapValue)) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(false);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          handle: trimmedHandle,
          mode,
          capType,
          capValue: parsedCapValue,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && typeof json === "object" && "error" in json && String(json.error)) ||
            `${res.status}`,
        );
      }
      setSubmitOk(true);
      void loadAllocations();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6" style={{ padding: "clamp(48px, 10vw, 110px) 24px 100px" }}>
      <div className="label" style={{ marginBottom: 10 }}>// auto-trade configuration</div>
      <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: 20 }}>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)" }}>Allocations</h1>
        <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 14, maxWidth: "58ch" }}>
          Set up per-creator copy/fade rules so the backend can auto-trade on your behalf.
        </p>
      </div>

      {!ready && <div className="label flick" style={{ padding: "40px 0" }}>loading auth…</div>}

      {ready && !authenticated && (
        <div className="panel" style={{ marginTop: 40, padding: "28px 26px", maxWidth: 480 }}>
          <p className="label" style={{ marginBottom: 16 }}>authentication required</p>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
            Log in to manage allocations.
          </p>
          <button style={btnPrimary} onClick={() => login()}>Log in</button>
        </div>
      )}

      {ready && authenticated && (
        <>
          <section style={{ marginTop: 48 }}>
            <div className="label" style={{ marginBottom: 14 }}>// add an allocation</div>
            <form onSubmit={handleSubmit} className="panel" style={{ padding: "26px 26px 28px", maxWidth: 460, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <span className="label" style={fieldLabel}>Creator</span>
                {influencers && influencers.length > 0 ? (
                  <select value={handle} onChange={(e) => setHandle(e.target.value)} style={fieldControl}>
                    {influencers.map((inf) => (
                      <option key={inf.handle} value={inf.handle}>
                        @{inf.handle}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="handle"
                    style={fieldControl}
                  />
                )}
                {influencersError && (
                  <span className="label" style={{ display: "block", marginTop: 6, color: "var(--loss)" }}>
                    could not load influencer list ({influencersError}); type a handle instead
                  </span>
                )}
              </div>

              <div>
                <span className="label" style={fieldLabel}>Mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={fieldControl}>
                  <option value="copy">copy</option>
                  <option value="fade">fade</option>
                </select>
              </div>

              <div>
                <span className="label" style={fieldLabel}>Cap type</span>
                <select value={capType} onChange={(e) => setCapType(e.target.value as CapType)} style={fieldControl}>
                  <option value="fixed_usd">fixed USD</option>
                  <option value="percent">percent</option>
                </select>
              </div>

              <div>
                <span className="label" style={fieldLabel}>Cap value</span>
                <input
                  type="number"
                  value={capValue}
                  onChange={(e) => setCapValue(e.target.value)}
                  min="0"
                  step="any"
                  style={fieldControl}
                  className="tnum"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
                <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? "Saving…" : "Add allocation"}
                </button>
                {submitError && (
                  <span className="label" style={{ color: "var(--loss)" }}>could not save ({submitError})</span>
                )}
                {submitOk && <span className="label" style={{ color: "var(--gain)" }}>saved.</span>}
              </div>
            </form>
          </section>

          <section style={{ marginTop: 64 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h2 style={{ fontSize: "clamp(20px, 3.5vw, 28px)" }}>Your allocations</h2>
              {allocations && allocations.length > 0 && (
                <span className="label tnum">{allocations.length} configured</span>
              )}
            </div>

            {loadingAllocations && <div className="label flick" style={{ padding: "32px 0" }}>loading allocations…</div>}
            {!loadingAllocations && allocationsError && (
              <div className="label" style={{ padding: "32px 0", color: "var(--loss)" }}>
                could not load allocations ({allocationsError})
              </div>
            )}
            {!loadingAllocations && !allocationsError && allocations && allocations.length === 0 && (
              <div className="label" style={{ padding: "32px 0", color: "var(--muted)" }}>no allocations yet.</div>
            )}
            {!loadingAllocations && !allocationsError && allocations && allocations.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {allocations.map((a, i) => (
                  <div
                    key={a.id ?? `${a.handle}-${i}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                      gap: 16,
                      alignItems: "center",
                      padding: "16px 4px",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
                      @{a.handle}
                    </span>
                    <span className="label" style={{ color: a.mode === "fade" ? "var(--loss)" : "var(--gain)" }}>
                      {a.mode}
                    </span>
                    <span className="label">{a.capType === "fixed_usd" ? "fixed usd" : "percent"}</span>
                    <span className="tnum" style={{ fontSize: 14, textAlign: "right" }}>
                      {a.capType === "percent" ? `${a.capValue}%` : `$${a.capValue}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
