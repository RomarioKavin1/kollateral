import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Sequence } from "remotion";

// A forensic "reel": influencer calls stack up, a price line draws then crashes,
// red verdicts slam down. Designed high-contrast and dense so ANY single frame
// reads well through the live dither filter layered over it in the app.
const BG = "#14161c";
const INK = "#f6f7fa";
const MUTE = "#c2c8d4";
const LINE = "#3a4150";
const LOSS = "#ff5a42";
const CARD = "#20242e";

const CALLS = [
  { h: "@AshCrypto", t: "$WILD is the future. Loading my bags.", v: "-93.8%" },
  { h: "@LarkDavis", t: "$EUL massively undervalued here.", v: "-64.7%" },
  { h: "@CryptoTony__", t: "$PEPE 10x incoming, don't fade this.", v: "-71.2%" },
];

function CallCard({ index, appear }: { index: number; appear: number }) {
  const c = CALLS[index];
  const y = interpolate(appear, [0, 1], [46, 0]);
  const op = interpolate(appear, [0, 1], [0, 1]);
  return (
    <div
      style={{
        transform: `translateY(${y}px)`,
        opacity: op,
        border: `1px solid ${LINE}`,
        background: CARD,
        borderRadius: 5,
        padding: "22px 26px",
        fontFamily: "monospace",
        marginBottom: 20,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ color: INK, fontSize: 27, fontWeight: 700 }}>{c.h}</div>
        <div style={{ color: MUTE, fontSize: 13, letterSpacing: 2 }}>CALL #{String(index + 1).padStart(3, "0")}</div>
      </div>
      <div style={{ color: MUTE, fontSize: 22, lineHeight: 1.35 }}>{c.t}</div>
    </div>
  );
}

function Stamp({ index, prog }: { index: number; prog: number }) {
  const c = CALLS[index];
  const s = interpolate(prog, [0, 0.6, 1], [1.7, 0.9, 1], { extrapolateRight: "clamp" });
  const op = interpolate(prog, [0, 0.25], [0, 1], { extrapolateRight: "clamp" });
  const rot = interpolate(prog, [0, 1], [-10, -6]);
  return (
    <div
      style={{
        position: "absolute",
        right: 34,
        top: 150 + index * 130,
        transform: `rotate(${rot}deg) scale(${s})`,
        opacity: op,
        border: `3px solid ${LOSS}`,
        color: LOSS,
        background: "rgba(255,90,66,0.08)",
        fontFamily: "monospace",
        fontWeight: 800,
        fontSize: 42,
        padding: "6px 16px",
        borderRadius: 5,
        letterSpacing: 1,
      }}
    >
      {c.v}
    </div>
  );
}

function CrashLine({ frame }: { frame: number }) {
  const w = 1200;
  const draw = interpolate(frame, [24, 128], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pts: [number, number][] = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = 40 + t * w;
    let yv = 0.5 - Math.sin(t * 3.1) * 0.13 * (1 - t);
    if (t > 0.45) yv = 0.5 + (t - 0.45) * 1.2; // dump
    yv += Math.sin(i * 1.7) * 0.012;
    pts.push([x, 150 + yv * 380]);
  }
  const visible = Math.floor(pts.length * draw);
  const d = pts.slice(0, Math.max(2, visible)).map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[Math.max(1, visible - 1)];
  return (
    <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill={LOSS} opacity="0.55" />
        </pattern>
      </defs>
      {visible > 3 && <path d={`${d} L${last[0]},560 L40,560 Z`} fill="url(#dots)" opacity={0.4} />}
      <path d={d} fill="none" stroke={LOSS} strokeWidth={3.5} />
      {last && <circle cx={last[0]} cy={last[1]} r={7} fill={LOSS} />}
    </svg>
  );
}

export const HeroReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06);
  const sweep = interpolate(frame % durationInFrames, [0, durationInFrames], [0, 1280]);

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* persistent luminous base so the dither always has tone to render */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(75% 65% at ${58 + pulse * 12}% 42%, #3d4453 0%, #262b34 36%, ${BG} 72%)`,
        }}
      />
      {/* brighter grid */}
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0, opacity: 0.7 }}>
        {Array.from({ length: 17 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 80} y1={0} x2={i * 80} y2={720} stroke="#242a34" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 80} x2={1280} y2={i * 80} stroke="#20252e" />
        ))}
      </svg>

      {/* scanning cursor line */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: sweep, width: 2, background: "rgba(246,247,250,0.10)" }} />

      {/* persistent header label */}
      <div style={{ position: "absolute", left: 40, top: 40, fontFamily: "monospace", color: MUTE, fontSize: 15, letterSpacing: 4 }}>
        FORENSIC LEDGER <span style={{ color: LOSS }}>// LIVE</span>
      </div>

      <div style={{ position: "absolute", left: 470, top: 95, width: 770 }}>
        {CALLS.map((_, i) => {
          const appear = interpolate(frame, [i * 12, i * 12 + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <CallCard key={i} index={i} appear={appear} />;
        })}
      </div>

      <CrashLine frame={frame} />

      {CALLS.map((_, i) => {
        const prog = interpolate(frame, [64 + i * 8, 90 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return prog > 0 ? <Stamp key={i} index={i} prog={prog} /> : null;
      })}

      <Sequence from={148}>
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: 44 }}>
          <div style={{ fontFamily: "monospace", color: INK, fontSize: 32, fontWeight: 800, opacity: interpolate(frame, [148, 172], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            THE MARKET REMEMBERS.
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
