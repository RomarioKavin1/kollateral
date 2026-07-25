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
  const { addSigners } = useSigners();
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

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: 12,
        borderBottom: "1px solid #444",
      }}
    >
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/">Home</Link>
        <Link href="/terminal">Terminal</Link>
        <Link href="/allocations">Allocations</Link>
        <Link href="/portfolio">Portfolio</Link>
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        {!ready && <span>loading auth…</span>}

        {ready && !authenticated && <button onClick={() => login()}>Log in</button>}

        {ready && authenticated && (
          <>
            <span style={{ fontFamily: "monospace", fontSize: 12 }}>
              {embeddedWallet
                ? `${embeddedWallet.address.slice(0, 6)}…${embeddedWallet.address.slice(-4)}`
                : "no embedded wallet"}
            </span>

            {embeddedWallet && !isDelegated && (
              <button onClick={() => void handleDelegate()} disabled={delegating}>
                {delegating ? "enabling…" : "Enable auto-trading"}
              </button>
            )}
            {isDelegated && <span>auto-trading enabled</span>}
            {delegateError && <span style={{ color: "red" }}>{delegateError}</span>}

            <button onClick={() => void logout()}>Log out</button>
          </>
        )}
      </div>
    </header>
  );
}
