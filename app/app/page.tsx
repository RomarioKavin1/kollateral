"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface InfluencerSummary {
  handle: string;
  display_name: string | null;
  headlinePct: number;
  callCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [handleInput, setHandleInput] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/influencers")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<InfluencerSummary[]>;
      })
      .then((data) => {
        if (!cancelled) setInfluencers(data);
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
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const handle = handleInput.trim().replace(/^@/, "");
    if (!handle) return;
    router.push(`/k/${handle}`);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>KOLlateral</h1>

      <form onSubmit={handleSubmit}>
        <input
          value={handleInput}
          onChange={(e) => setHandleInput(e.target.value)}
          placeholder="Enter an X handle (e.g. someinfluencer)"
          aria-label="Influencer handle"
        />
        <button type="submit">Search</button>
      </form>

      <h2>Trending</h2>

      {loading && <p>Loading trending influencers…</p>}

      {!loading && error && <p>Could not load trending influencers ({error}).</p>}

      {!loading && !error && influencers && influencers.length === 0 && (
        <p>No influencers indexed yet.</p>
      )}

      {!loading && !error && influencers && influencers.length > 0 && (
        <ul>
          {influencers.map((inf) => (
            <li key={inf.handle}>
              <Link href={`/k/${inf.handle}`}>
                @{inf.handle}
                {inf.display_name ? ` (${inf.display_name})` : ""} —{" "}
                {inf.headlinePct >= 0 ? "+" : ""}
                {inf.headlinePct}% · {inf.callCount} call
                {inf.callCount === 1 ? "" : "s"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
