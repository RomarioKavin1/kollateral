"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DitherShader } from "@/components/DitherShader";

interface InfluencerSummary {
  handle: string;
  display_name: string | null;
  headlinePct: number;
  callCount: number;
}

const EVIDENCE = [
  { n: "01", k: "BACKTEST", t: "Every call, priced.", d: "We scrape their public calls and mark each one against real DEX prices. $1,000 per call, versus just holding ETH. The verdict is arithmetic." },
  { n: "02", k: "SAID / DID", t: "Their wallet betrays them.", d: "We cross-reference each call against the caller's own on-chain wallet. Said accumulate, sold four hours later. Cited to the transaction." },
  { n: "03", k: "FADE", t: "Trade against the noise.", d: "Copy the honest, fade the rest. Auto-executed from a self-custody vault, capped per creator. The most reliable alpha is the other side of a bad call." },
];

export default function HomePage() {
  const router = useRouter();
  const [handleInput, setHandleInput] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/influencers")
      .then((r) => (r.ok ? (r.json() as Promise<InfluencerSummary[]>) : []))
      .then((data) => !cancelled && setInfluencers(data))
      .catch(() => !cancelled && setInfluencers([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const handle = handleInput.trim().replace(/^@/, "");
    if (handle) router.push(`/k/${handle}`);
  }

  return (
    <main>
      {/* ---- HERO ---- */}
      <section className="relative overflow-hidden" style={{ minHeight: "min(92vh, 900px)" }}>
        <DitherShader className="absolute inset-0 h-full w-full" />
        {/* legibility scrim, biased left */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, var(--bg) 0%, color-mix(in oklch, var(--bg) 78%, transparent) 42%, transparent 72%), linear-gradient(0deg, var(--bg), transparent 30%)",
          }}
        />
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6" style={{ minHeight: "min(92vh, 900px)" }}>
          <div className="pixel rise" style={{ animationDelay: "0ms", fontSize: 18, letterSpacing: "0.06em", color: "var(--ink)" }}>
            KOLLATERAL<span className="flick" style={{ color: "var(--signal)" }}>_</span>
          </div>

          <h1
            className="rise"
            style={{
              animationDelay: "80ms",
              fontSize: "clamp(44px, 9vw, 116px)",
              margin: "18px 0 0",
              lineHeight: 0.94,
            }}
          >
            THE MARKET<br />REMEMBERS.
          </h1>

          <p
            className="rise"
            style={{ animationDelay: "180ms", maxWidth: "52ch", marginTop: 22, color: "var(--muted)", fontSize: 15 }}
          >
            Forensic accountability for crypto influencers. Backtest their calls,
            catch their wallets in the act, and fade the noise, automatically.
          </p>

          <form
            onSubmit={handleSubmit}
            className="rise"
            style={{ animationDelay: "280ms", display: "flex", gap: 8, marginTop: 34, maxWidth: 520 }}
          >
            <div className="panel scan" style={{ display: "flex", flex: 1, alignItems: "center", paddingLeft: 12, background: "color-mix(in oklch, var(--surface) 80%, transparent)" }}>
              <span className="label" style={{ marginRight: 8 }}>@</span>
              <input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="run a handle through the ledger"
                aria-label="Influencer handle"
                style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--ink)", padding: "12px 8px", fontFamily: "var(--font-mono)", fontSize: 14 }}
              />
            </div>
            <button
              type="submit"
              className="link"
              style={{ border: "1px solid var(--line-strong)", borderRadius: "var(--radius)", padding: "0 20px", background: "var(--ink)", color: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
            >
              Depose
            </button>
          </form>

          <div className="rise label" style={{ animationDelay: "420ms", marginTop: 28, display: "flex", gap: 20, flexWrap: "wrap" }}>
            <span>0G TEE-VERIFIED</span>
            <span>THE GRAPH SUBGRAPHS</span>
            <span>UNISWAP · BASE</span>
            <span>PRIVY SELF-CUSTODY</span>
          </div>
        </div>

        <div className="label" style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
          ↓ scroll to the evidence
        </div>
      </section>

      {/* ---- EVIDENCE ---- */}
      <section className="mx-auto max-w-6xl px-6" style={{ padding: "clamp(64px, 12vw, 140px) 24px" }}>
        <div className="label" style={{ marginBottom: 10 }}>// how the ledger works</div>
        <h2 style={{ fontSize: "clamp(28px, 5vw, 52px)", maxWidth: "18ch" }}>
          Damning by evidence, never by opinion.
        </h2>
        <div
          style={{
            marginTop: 56,
            display: "grid",
            gap: 1,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            background: "var(--line)",
            border: "1px solid var(--line)",
          }}
        >
          {EVIDENCE.map((e) => (
            <div key={e.n} className="scan" style={{ background: "var(--bg)", padding: "28px 26px 34px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="pixel" style={{ fontSize: 22, color: "var(--faint)" }}>{e.n}</span>
                <span className="label">{e.k}</span>
              </div>
              <h3 style={{ fontSize: 22, marginTop: 24 }}>{e.t}</h3>
              <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.7 }}>{e.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- WATCHLIST ---- */}
      <section className="mx-auto max-w-6xl px-6" style={{ paddingBottom: "clamp(72px, 12vw, 140px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 34px)" }}>The watchlist</h2>
          <span className="label">indexed · sorted by exposure</span>
        </div>

        {loading && <div className="label flick" style={{ padding: "40px 0" }}>reading the ledger…</div>}

        {!loading && influencers && influencers.length === 0 && (
          <div className="label" style={{ padding: "40px 0", color: "var(--muted)" }}>no creators indexed yet.</div>
        )}

        <div>
          {!loading &&
            influencers?.map((inf, i) => {
              const neg = inf.headlinePct < 0;
              return (
                <Link
                  key={inf.handle}
                  href={`/k/${inf.handle}`}
                  className="wl-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: 18,
                    alignItems: "center",
                    padding: "18px 4px",
                    borderBottom: "1px solid var(--line)",
                    animation: `rise 0.5s var(--ease-out-expo) both`,
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  <span className="pixel" style={{ color: "var(--faint)", fontSize: 16, width: 28 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>@{inf.handle}</span>
                    {inf.display_name && <span className="label" style={{ marginLeft: 10 }}>{inf.display_name}</span>}
                  </span>
                  <span className="label tnum">{inf.callCount} call{inf.callCount === 1 ? "" : "s"}</span>
                  <span
                    className="tnum"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 17, minWidth: 92, textAlign: "right", color: neg ? "var(--loss)" : "var(--gain)" }}
                  >
                    {neg ? "" : "+"}
                    {inf.headlinePct}%
                  </span>
                </Link>
              );
            })}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6" style={{ padding: "28px 24px 48px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span className="pixel" style={{ color: "var(--faint)" }}>KOLLATERAL</span>
        <span className="label">the market remembers · numbers and citations, zero adjectives</span>
      </footer>
    </main>
  );
}
