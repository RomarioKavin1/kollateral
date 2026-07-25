"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InteractiveDither } from "@/components/InteractiveDither";
import { DitherArt } from "@/components/DitherArt";
import { CreatorFeed } from "@/components/CreatorFeed";

const EVIDENCE = [
  { n: "01", k: "BACKTEST", t: "Every call, priced.", shape: "signal" as const, d: "We scrape their public calls and mark each one against real DEX prices. $1,000 per call, versus just holding ETH. The verdict is arithmetic." },
  { n: "02", k: "SAID / DID", t: "Their wallet betrays them.", shape: "loop" as const, d: "We cross-reference each call against the caller's own on-chain wallet. Said accumulate, sold four hours later. Cited to the transaction." },
  { n: "03", k: "FADE", t: "Trade against the noise.", shape: "arrows" as const, d: "Copy the honest, fade the rest. Auto-executed from a self-custody vault, capped per creator. The most reliable alpha is the other side of a bad call." },
];

export default function HomePage() {
  const router = useRouter();
  const [handleInput, setHandleInput] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const handle = handleInput.trim().replace(/^@/, "");
    if (handle) router.push(`/k/${handle}`);
  }

  return (
    <main>
      {/* ---- HERO ---- */}
      <section className="relative overflow-hidden" style={{ minHeight: "min(92vh, 900px)", borderBottom: "1px solid var(--line)" }}>
        <InteractiveDither className="absolute inset-0 h-full w-full" />
        {/* light legibility scrim: keep the left readable, let the grain breathe */}
        <div
          className="absolute inset-0"
          style={{
            pointerEvents: "none",
            background:
              "linear-gradient(90deg, color-mix(in oklch, var(--bg) 82%, transparent) 0%, color-mix(in oklch, var(--bg) 42%, transparent) 34%, transparent 68%), linear-gradient(0deg, var(--bg), transparent 26%), linear-gradient(180deg, color-mix(in oklch, var(--bg) 45%, transparent), transparent 14%)",
          }}
        />
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6" style={{ minHeight: "min(92vh, 900px)" }}>
          <div className="pixel rise" style={{ animationDelay: "0ms", fontSize: 18, letterSpacing: "0.06em", color: "var(--ink)" }}>
            <span className="kol">KOL</span>LATERAL<span className="flick" style={{ color: "var(--ink)" }}>_</span>
          </div>

          <h1 className="rise" style={{ animationDelay: "80ms", fontSize: "clamp(44px, 9vw, 116px)", margin: "18px 0 0", lineHeight: 0.94 }}>
            THE MARKET<br />REMEMBERS.
          </h1>

          <p className="rise" style={{ animationDelay: "180ms", maxWidth: "52ch", marginTop: 22, color: "var(--muted)", fontSize: 15 }}>
            Forensic accountability for crypto influencers. Backtest their calls,
            catch their wallets in the act, and fade the noise, automatically.
          </p>

          <form onSubmit={handleSubmit} className="rise" style={{ animationDelay: "280ms", display: "flex", gap: 8, marginTop: 34, maxWidth: 520 }}>
            <div className="panel scan" style={{ display: "flex", flex: 1, alignItems: "center", paddingLeft: 12, background: "color-mix(in oklch, var(--surface) 88%, transparent)" }}>
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
              style={{ border: "1px solid var(--ink)", borderRadius: "var(--radius)", padding: "0 20px", background: "var(--ink)", color: "var(--surface)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
            >
              Depose
            </button>
          </form>

          <div className="rise" style={{ animationDelay: "420ms", marginTop: 34 }}>
            <div className="label" style={{ marginBottom: 14 }}>// built on</div>
            <div style={{ display: "flex", alignItems: "center", gap: 34, flexWrap: "wrap" }}>
              <span className="sponsor" title="0G" style={{ width: 84, height: 40, WebkitMaskImage: "url(/logos/0g.png)", maskImage: "url(/logos/0g.png)" }} />
              <span className="sponsor" title="The Graph" style={{ width: 40, height: 40, WebkitMaskImage: "url(/logos/the-graph.svg)", maskImage: "url(/logos/the-graph.svg)" }} />
              <span className="sponsor" title="Uniswap" style={{ width: 38, height: 40, WebkitMaskImage: "url(/logos/uniswap.png)", maskImage: "url(/logos/uniswap.png)" }} />
            </div>
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
              <div style={{ marginTop: 20, height: 150, background: "var(--dark)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <DitherArt shape={e.shape} invert gap={4} className="h-full w-full" />
              </div>
              <h3 style={{ fontSize: 22, marginTop: 22 }}>{e.t}</h3>
              <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.7 }}>{e.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- THE FEED ---- */}
      <section className="mx-auto max-w-3xl px-6" style={{ paddingBottom: "clamp(72px, 12vw, 140px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>// the feed</div>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 34px)" }}>Every call on the record.</h2>
          </div>
          <span className="label" style={{ textAlign: "right" }}>follow the honest<br />fade the rest</span>
        </div>

        <CreatorFeed />
      </section>

      <footer className="mx-auto max-w-6xl px-6" style={{ padding: "28px 24px 48px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span className="pixel" style={{ color: "var(--faint)" }}><span className="kol">KOL</span>LATERAL</span>
        <span className="label">the market remembers · numbers and citations, zero adjectives</span>
      </footer>
    </main>
  );
}
