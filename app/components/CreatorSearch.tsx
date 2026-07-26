"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface CreatorOption {
  handle: string;
  display_name?: string | null;
}

// Reusable creator search with autocomplete over the indexed creators. Used on
// the allocations page (pick a creator to override) and the terminal (jump to /
// filter by a creator). Purely presentational — the parent supplies the list
// and handles selection.
export function CreatorSearch({
  creators,
  onSelect,
  placeholder = "search creators…",
  autoFocus,
}: {
  creators: CreatorOption[];
  onSelect: (handle: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^@/, "");
    const pool = creators ?? [];
    if (!t) return pool.slice(0, 8);
    return pool
      .filter((c) => c.handle.toLowerCase().includes(t) || (c.display_name?.toLowerCase().includes(t) ?? false))
      .slice(0, 8);
  }, [q, creators]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(handle: string) {
    onSelect(handle);
    setQ("");
    setOpen(false);
    setActive(0);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div className="term-search" style={{ margin: 0 }}>
        <span aria-hidden style={{ color: "var(--faint)" }}>⌕</span>
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const m = matches[active];
              if (m) pick(m.handle);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label="Search creators"
        />
        {q && (
          <button aria-label="clear" onClick={() => { setQ(""); setOpen(false); }} style={{ background: "none", border: 0, color: "var(--faint)", cursor: "pointer", fontSize: 12 }}>✕</button>
        )}
      </div>

      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 40,
            background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius)",
            overflow: "hidden", boxShadow: "0 12px 32px color-mix(in oklch, var(--ink) 10%, transparent)",
          }}
        >
          {matches.map((c, i) => (
            <button
              key={c.handle}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(c.handle); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                padding: "9px 12px", border: 0, cursor: "pointer",
                background: i === active ? "color-mix(in oklch, var(--ink) 6%, transparent)" : "transparent",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://unavatar.io/twitter/${c.handle}`} alt="" width={22} height={22} style={{ borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.display_name || c.handle}
                </span>
                <span className="label" style={{ color: "var(--muted)" }}>@{c.handle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
