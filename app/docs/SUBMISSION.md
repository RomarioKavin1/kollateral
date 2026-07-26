# KOLlateral — submission answers

## Short description (max 100 characters)

Backtest crypto influencers against on-chain reality, then copy the honest and fade the rest.

## Description

Crypto influencers post hundreds of "calls" a week and quietly delete the ones that lose. KOLlateral keeps the receipts.

It scrapes an influencer's public posts, uses AI to turn each explicit call into a structured signal (asset, direction, target, confidence), and prices every one against real DEX history, so you can see what following them would actually have returned versus just holding ETH. Deleted calls get flagged in red instead of disappearing, and each call is cross-checked against the caller's own on-chain wallet to catch the classic "said accumulate, sold four hours later." Every score is produced by AI inference running inside a verifiable enclave, so the verdict between their tweet and your screen is provably untampered.

Then it closes the loop. From the same feed you copy the callers with a real track record or fade the ones without, in one click, executed on-chain from a self-custody wallet. There is a leaderboard of who is actually worth following, a per-influencer dossier with the equity curve of every call, and a "0-yap" mode that strips a rambling post down to just the trade logic.

## How it's made

The app is Next.js on the App Router with a dither/halftone theme, and it keeps state in a local SQLite database through better-sqlite3, which lets the whole scrape, classify, price, and trade pipeline run from one process.

Classification and the 0-yap distillation both run on 0G Compute. We call 0G's OpenAI-compatible router with `verify_tee` turned on and a private trust-mode header, so the model runs inside a TDX enclave and the router returns an attested result. That attestation is the point of the whole project: it is what lets us say no one, including us, edited the signal between the tweet and the verdict.

Pricing and wallet forensics run on The Graph. We query the Uniswap v2 and v3 subgraphs (v3 first, v2 as a fallback) to price each call at its posted timestamp and to rebuild a caller's on-chain trade history for the said-versus-did comparison.

Execution is Uniswap. On Base mainnet we use the hosted Trading API. Base Sepolia is where it got hacky: the Trading API does not index that chain, so we located the deployed WETH/USDC v3 pools on-chain and call SwapRouter02 directly, quoting in USDC and then decoding the ERC-20 Transfer out of the swap receipt so the portfolio records the real fill instead of a nominal number. Wallets and signing are Privy: each user gets an embedded self-custody wallet and delegates a session signer once, after which every Follow or Fade executes server-side with no popup.
