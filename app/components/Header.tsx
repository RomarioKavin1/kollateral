"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy, useWallets, useSigners } from "@privy-io/react-auth";

// Shared nav + Privy auth state, mounted once in the root layout so every
// page gets Home/Terminal/Allocations/Portfolio links plus login/logout and
// the embedded-wallet "enable auto-trading" delegation prompt.
export function Header() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  // This app uses Privy TEE wallets, so delegation is granted to a server-side
  // session signer (our registered authorization key quorum) rather than
  // on-device delegation.
  const { addSigners, removeSigners } = useSigners();
  const signerId = process.env.NEXT_PUBLIC_PRIVY_AUTH_ID_2;

  const [delegating, setDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [delegated, setDelegated] = useState(false);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAccount = user?.linkedAccounts.find(
    (a) => a.type === "wallet" && a.address === embeddedWallet?.address,
  ) as { delegated?: boolean } | undefined;
  const isDelegated = delegated || walletAccount?.delegated === true;

  async function handleDelegate() {
    if (!embeddedWallet) return;
    if (!signerId) {
      setDelegateError("Session signer id not configured (NEXT_PUBLIC_PRIVY_AUTH_ID_2)");
      return;
    }
    setDelegating(true);
    setDelegateError(null);
    try {
      await addSigners({ address: embeddedWallet.address, signers: [{ signerId }] });
      setDelegated(true);
    } catch (err) {
      setDelegateError(err instanceof Error ? err.message : "Delegation failed");
    } finally {
      setDelegating(false);
    }
  }

  // Revoke the session signer — the backend can no longer auto-sign for this
  // wallet. Fully user-controlled: they can turn auto-trading off anytime.
  async function handleRevoke() {
    if (!embeddedWallet) return;
    setDelegating(true);
    setDelegateError(null);
    try {
      await removeSigners({ address: embeddedWallet.address });
      setDelegated(false);
    } catch (err) {
      setDelegateError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setDelegating(false);
    }
  }

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
    border: "1px solid var(--line-strong)", borderRadius: "var(--radius)", padding: "6px 12px",
    background: "transparent", color: "var(--muted)", cursor: "pointer",
    transition: "color .2s, border-color .2s, background .2s",
  };
  const btnPrimary: React.CSSProperties = { ...btn, background: "var(--ink)", color: "var(--bg)", borderColor: "var(--ink)" };

  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16,
        padding: "10px 24px",
        borderBottom: "1px solid var(--line)",
        background: "color-mix(in oklch, var(--bg) 80%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Link href="/" className="pixel" style={{ fontSize: 15, letterSpacing: "0.04em", color: "var(--ink)" }}>
        <span className="kol">KOL</span>LATERAL
      </Link>
      <nav style={{ display: "flex", gap: 20 }}>
        {[["/terminal", "Terminal"], ["/leaderboard", "Leaderboard"], ["/allocations", "Allocations"], ["/portfolio", "Portfolio"]].map(([href, label]) => (
          <Link key={href} href={href} className="link label" style={{ fontSize: 11 }}>
            {label}
          </Link>
        ))}
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {!ready && <span className="label flick">auth…</span>}

        {ready && !authenticated && (
          <button style={btnPrimary} onClick={() => login()}>Log in</button>
        )}

        {ready && authenticated && (
          <>
            {embeddedWallet && (
              <span className="label tnum" style={{ color: "var(--muted)" }}>
                {embeddedWallet.address.slice(0, 6)}…{embeddedWallet.address.slice(-4)}
              </span>
            )}
            {embeddedWallet && !isDelegated && (
              <button style={btn} onClick={() => void handleDelegate()} disabled={delegating}>
                {delegating ? "enabling…" : "Enable auto-trading"}
              </button>
            )}
            {embeddedWallet && isDelegated && (
              <>
                <span className="label" style={{ color: "var(--gain)" }}>● auto-trading on</span>
                <button style={btn} onClick={() => void handleRevoke()} disabled={delegating}>
                  {delegating ? "disabling…" : "Disable"}
                </button>
              </>
            )}
            {delegateError && <span className="label" style={{ color: "var(--loss)" }}>{delegateError.slice(0, 40)}</span>}
            <button style={btn} onClick={() => void logout()}>Log out</button>
          </>
        )}
      </div>
    </header>
  );
}
