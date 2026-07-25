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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Allocations</h1>
      <p>Set up per-creator copy/fade rules so the backend can auto-trade on your behalf.</p>

      {!ready && <p>Loading auth…</p>}

      {ready && !authenticated && (
        <div>
          <p>Log in to manage allocations.</p>
          <button onClick={() => login()}>Log in</button>
        </div>
      )}

      {ready && authenticated && (
        <>
          <h2>Add an allocation</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
            <label>
              Creator{" "}
              {influencers && influencers.length > 0 ? (
                <select value={handle} onChange={(e) => setHandle(e.target.value)}>
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
                />
              )}
            </label>
            {influencersError && (
              <span>Could not load influencer list ({influencersError}); type a handle instead.</span>
            )}

            <label>
              Mode{" "}
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="copy">copy</option>
                <option value="fade">fade</option>
              </select>
            </label>

            <label>
              Cap type{" "}
              <select value={capType} onChange={(e) => setCapType(e.target.value as CapType)}>
                <option value="fixed_usd">fixed USD</option>
                <option value="percent">percent</option>
              </select>
            </label>

            <label>
              Cap value{" "}
              <input
                type="number"
                value={capValue}
                onChange={(e) => setCapValue(e.target.value)}
                min="0"
                step="any"
              />
            </label>

            <button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add allocation"}
            </button>
            {submitError && <span>Could not save allocation ({submitError}).</span>}
            {submitOk && <span>Saved.</span>}
          </form>

          <h2>Your allocations</h2>
          {loadingAllocations && <p>Loading allocations…</p>}
          {!loadingAllocations && allocationsError && (
            <p>Could not load allocations ({allocationsError}).</p>
          )}
          {!loadingAllocations && !allocationsError && allocations && allocations.length === 0 && (
            <p>No allocations yet.</p>
          )}
          {!loadingAllocations && !allocationsError && allocations && allocations.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Mode</th>
                  <th>Cap type</th>
                  <th>Cap value</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, i) => (
                  <tr key={a.id ?? `${a.handle}-${i}`}>
                    <td>@{a.handle}</td>
                    <td>{a.mode}</td>
                    <td>{a.capType}</td>
                    <td>{a.capValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
