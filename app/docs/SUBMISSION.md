# KOLlateral — submission answers

## Short description (max 100 characters)

Accountability for crypto influencers: score their real record, copy the honest, fade the rest.

## Description

Crypto influencers operate with almost no accountability. They post hundreds of "calls" a week, delete the ones that lose, and there is no shared record of whether following them ever made money. KOLlateral is the accountability layer that makes their track record permanent, priced, and impossible to quietly walk back.

It scrapes an influencer's public posts and turns each explicit call into a structured signal (asset, direction, target, confidence), then prices every one against real DEX history, so a claim becomes a number: what following them would have returned versus just holding ETH.

Three things keep that accountability honest. Deleted calls are archived and flagged in red, so a loss cannot vanish once it goes against them. Each call is checked against the caller's own on-chain wallet, so "said accumulate, sold four hours later" becomes a citation with a transaction hash instead of an accusation. And every score is produced by AI inference running inside a verifiable enclave, so the verdict between their tweet and your screen is provably untampered, including by us. Nobody has to take our word for the record, and nobody can edit it after the fact.

Then accountability turns into action. From the same feed you copy the callers who have earned it or fade the ones who have not, in one click, executed on-chain from a self-custody wallet. A leaderboard ranks who is actually worth trusting, each influencer gets a dossier with the equity curve of every call they have made, and a "0-yap" mode strips a rambling post down to just the trade logic.

## How it's made

The app is Next.js on the App Router with a dither/halftone theme, and it keeps state in a local SQLite database through better-sqlite3, which lets the whole scrape, classify, price, and trade pipeline run from one process.

Classification and the 0-yap distillation both run on 0G Compute. We call 0G's OpenAI-compatible router with `verify_tee` turned on and a private trust-mode header, so the model runs inside a TDX enclave and the router returns an attested result. That attestation is the point of the whole project: it is what lets us say no one, including us, edited the signal between the tweet and the verdict.

Pricing and wallet forensics run on The Graph. We query the Uniswap v2 and v3 subgraphs (v3 first, v2 as a fallback) to price each call at its posted timestamp and to rebuild a caller's on-chain trade history for the said-versus-did comparison.

Execution is Uniswap. On Base mainnet we use the hosted Trading API. Base Sepolia is where it got hacky: the Trading API does not index that chain, so we located the deployed WETH/USDC v3 pools on-chain and call SwapRouter02 directly, quoting in USDC and then decoding the ERC-20 Transfer out of the swap receipt so the portfolio records the real fill instead of a nominal number. Wallets and signing are Privy: each user gets an embedded self-custody wallet and delegates a session signer once, after which every Follow or Fade executes server-side with no popup.
