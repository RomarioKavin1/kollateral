# KOLlateral — submission answers

## Short description (max 100 characters)

The accountability layer for crypto influencers: build a verifiable record, back the real traders.

## Description

Crypto influencers operate with almost no accountability. They post hundreds of "calls" a week, delete the ones that lose, and there is no shared record of whether following them ever made money. KOLlateral fixes both sides of that with one thing: a public, verifiable track record.

For a caller who is actually good, that record is an asset they own. Every explicit call they make in public becomes a structured signal (asset, direction, target, confidence) and gets priced against real DEX history, so their edge shows up as numbers they can point to: what following them returned versus just holding ETH. Losing calls are archived and flagged in red instead of disappearing. Each call is checked against the caller's own on-chain wallet, so "said accumulate, sold four hours later" is a contradiction with a transaction hash attached. And every score is produced by AI inference running inside a verifiable enclave, so the record holds up even against us.

For everyone else, that record is a filter. A leaderboard surfaces the callers who have genuinely earned trust rather than the loudest ones, and each influencer gets a dossier with the equity curve of every call they have made. Once you find someone real, you ride along: copy their calls, or fade the ones who keep getting it wrong, in one click, executed on-chain from a self-custody wallet.

## How it's made

The app is Next.js on the App Router with a dither/halftone theme, and it keeps state in a local SQLite database through better-sqlite3, so the whole pipeline runs from one process: reading an influencer's public calls, classifying them, pricing them, and executing trades.

The AI that reads and judges every call runs on 0G Compute, and that inference is the part we cannot fake. Each post goes to 0G's OpenAI-compatible router with `verify_tee` turned on and a private trust-mode header, so the model executes inside a TDX secure enclave and the router hands back an attestation that this exact inference ran on the stated model, untouched. That is the core claim of the product: a caller's verdict is genuinely the model's output, not a number we typed in, and no one, including us, could edit the reasoning between their tweet and the score. The same verifiable inference powers 0-yap mode, which distills a rambling post down to its bias, a one-line thesis, and the price levels.

The Graph is the live on-chain data all of that scoring reasons over. We query the Uniswap v2 and v3 subgraphs through the gateway (v3 first, v2 as a fallback) for two things the product cannot work without: pricing every call at its exact posted timestamp, so a claim turns into a real return, and pulling a caller's own swap history to run the said-versus-did check. The forensic layer takes each call the AI extracted and matches it against what that wallet actually did on-chain, so a contradiction is grounded in live Subgraph data rather than a static snapshot.

Execution is Uniswap. On Base mainnet we use the hosted Trading API. Base Sepolia is where it got hacky: the Trading API does not index that chain, so we located the deployed WETH/USDC v3 pools on-chain and call SwapRouter02 directly, quoting in USDC and then decoding the ERC-20 Transfer out of the swap receipt so the portfolio records the real fill instead of a nominal number. Wallets and signing are Privy: each user gets an embedded self-custody wallet and delegates a session signer once, after which every Follow or Fade executes server-side with no popup.
