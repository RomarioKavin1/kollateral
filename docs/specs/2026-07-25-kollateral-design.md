# KOLlateral — Design Spec

*ETHGlobal Lisbon 2026 · working name: **KOLlateral** ("KOL" + collateral; also: collateral damage) · submissions due Sun Jul 26, 9:00 AM WEST*

## One-liner

**KOLlateral is a trading terminal where the signal feed is crypto influencers' public calls — backtested, TEE-verified, and tradeable in either direction.** Every call gets priced. Every deletion gets caught. Every caller can post collateral.

Tagline: **"The market remembers."**

## Product statement (the reframe that wins Uniswap)

KOLlateral is NOT a wall of shame with a swap button. It is a **trading terminal** whose edge is accountability data:

- The **feed** is influencer calls, parsed into structured signals in near-real-time.
- Every call card carries the caller's **live track record** (win rate, P&L vs ETH benchmark).
- Traders hit **FADE** (opposite side) or **FOLLOW** (same side) — real swaps via Uniswap Trading API.
- The **dossier** (per-influencer forensic page) is the research layer under the terminal.
- **KOLlateral staking**: callers back their own calls with stake; failed calls get clawed back to the follower pool. (Hackathon: UI states real, escrow simple/simulated.)

## Signal taxonomy (closed templates — no free-text signals)

| Template | Fields | Default expiry |
|---|---|---|
| `DIRECTIONAL` | asset, long/short, expiry | as stated |
| `TARGET_CALL` | asset, entry zone, target, stop? | target-hit or 30d |
| `GEM_SHILL` | asset, implied long | 30d |
| `NOT_A_SIGNAL` / `AMBIGUOUS` | — | not scored (visible bucket in UI) |

All extraction output: `{template, asset, chain, direction, expiry, confidence, evidence: {post_id, content_hash, timestamp}}`. Confidence threshold: publish only ≥0.85; precision over recall.

## Scoring methodology (published in-app)

- $1,000 notional into every published call at call-time price.
- Settlement at template expiry + standard checkpoints (1d/7d/30d).
- Benchmark: same-notional ETH buy-and-hold ("if you'd ignored them").
- Present-day marks for open calls: **executable Uniswap `/quote`** (slippage-aware), never midpoints.
- EVM tokens only in v1; Solana calls shown but labeled "unpriceable in v1".

## Architecture

```
X/Farcaster posts (per tracked handle)
  → Tier-1 prefilter: 0G Router, cheap model (gpt-oss-20b), unverified — signal vs noise
  → Tier-2 classify: 0G Router, DeepSeek-V3.1, TEE-VERIFIED — template JSON via tool-call
      artifact per call: {request, response, chatID (ZG-Res-Key), TEE signature, provider addr}
  → Pricing: Graph Token API (Pinax) /pools/ohlc + /pools  [fallback: Uniswap v3/v4 subgraph
      time-travel queries when OHLC depth/lookback caps hit]
  → Said-vs-Did: Graph Token API /v1/evm/swaps filtered by influencer wallet + token + window
  → Live loops: open-call re-marking · deletion detection (post existence recheck) ·
      wallet-alert ("caller's wallet selling what he told you to buy")
  → Live leg: Uniswap Trading API check_approval → quote (protocols: [V2,V3,V4] — never
      UniswapX, $300 min!) → sign (Permit2) → swap → poll /swaps. Chain: Base (demo swap OK
      on Base Sepolia — same endpoint, prize accepts testnet tx IDs)
```

**All inference on 0G** (both tiers through Router) so the sentence "every AI judgment in this product runs on 0G; every published judgment is TEE-signed" is literally true.

Key endpoints/keys (all instant self-serve):
- Uniswap: `trade-api.gateway.uniswap.org/v1`, key at developers.uniswap.org/dashboard, 6 rps
- 0G Router: `router-api.0g.ai/v1` (OpenAI-compatible), key at pc.0g.ai; tool-calling for JSON (no confirmed response_format); 30 req/min
- Graph Token API: `api.pinax.network/v1/evm/...`, JWT from app.pinax.network; **free tier = 10 results/query → paginate everywhere**; 200 req/min
- Subgraph Studio key (100k free queries/mo) for Uniswap v3 subgraph `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV` (mainnet) time-travel

## Frontend — five screens

1. **Home/Search** — search-engine layout; trending dossier grid (avatar, big colored P&L, sparkline); non-indexed handles → "add to queue" with progress.
2. **Dossier** — verdict block ("$1,000 into every call since Jan 2025 → $390. ETH instead → $1,310."), equity curve vs ETH, stat strip (win rate, calls, 🗑️ deleted count as filter), call ledger table. Second tab: **Said vs. Did** dual timeline with red contradiction connectors + case cards.
3. **Call detail** — slide-over: archived post render, chart with entry line + expiry shading, parsed-signal box, **receipt strip** (content hash, chatID, TEE sig, "verify" link).
4. **Terminal** — live call feed cards (signal + caller track-record pill) with FADE/FOLLOW; card flips into swap ticket (live Uniswap quote, route shown, Sign & Execute); right rail = open positions as you-vs-them duel chips settling at call expiry.
5. **Claim & Stake** — tweet-a-nonce handle verification; claimed profiles get context-reply ability + "Back this call" stake flow; staked calls render gold-border + "$X staked" chip everywhere.

Design rules: numbers before narrative; citation on every claim; **zero editorial adjectives anywhere in UI** (defamation posture + brand). Share-card generator (OG image: handle, damning stat, QR, "TEE-verified" footer) is the growth engine — build it.

## Sponsor track mapping (3 sponsors, ~$19k exposure)

| Track | Fit mechanism | Compliance checklist |
|---|---|---|
| Uniswap Best API Integration ($7k) | FADE/FOLLOW real swaps + ALL present-day marks via /quote (API load-bearing in the math) | own API key · public repo · **FEEDBACK.md** · feedback form · README pointing at integration code · **save all tx hashes** |
| 0G Best AI Product ($6k) | all inference on 0G; published calls TEE-signed; receipts UI; (own the "we use the verifiable half" framing — no fake privacy story) | working product · public repo · **video < 3 min** · Telegram & X contacts |
| Graph Best AI Use Case ($3k) | agent w/ Graph as load-bearing data source + LIVE loops (re-marking, deletion detection, wallet alerts) | public repo · demo video showing live consumption |
| Graph Composable ($3k) | Token API + Uniswap subgraph time-travel (organic composition); optional Token API MCP as agent access path | confirm interpretation w/ Graph booth mentor FIRST |

## Demo script (3 min, persona order)

1. **Rita/search gasp:** type famous handle → "−61% · ETH +31%" verdict → scroll deleted-call filter.
2. **Zoe/scandal:** Said-vs-Did dual timeline → red connector → "tweeted 'accumulating' 14:02, wallet sold $212k 17:40" case card.
3. **Dev/Uniswap moment:** Terminal → live call lands → FADE → real swap executes on stage (Base Sepolia, CLASSIC).
4. **Marco/redemption beat:** claimed profile + staked call w/ gold border — "we pay honest callers as much as we cost liars."
Close: receipt strip click — "every judgment TEE-signed on 0G; the platform cannot rig its own referee."

## Risks & fallbacks

| Risk | Mitigation |
|---|---|
| X data access (UNRESOLVED — decide NOW) | X API paid tier if keys obtainable today; else Farcaster live + pre-indexed archive set (~15–20 famous accounts) |
| 0G Router flaky / JSON discipline | tool-call schema + zod + retry; provider failover; worst case: conventional model flagged "unverified" in UI, keep 0G for subset |
| Token API OHLC depth / 180d transfer lookback caps | subgraph time-travel fallback (also = Composable qualification) |
| Memecoin not routable on Uniswap (FOT/illiquid) | test target tokens early; demo tokens = liquid majors + 1-2 known memecoins |
| Extraction misparse on stage | pre-indexed accounts hand-reviewed Sat night; publish-threshold 0.85; ambiguous bucket visible |
| One green dossier needed (board can't be all red) | index at least one genuinely good caller |

## Cut order (if behind)

stake escrow → claim flow → share-card generator → Said-vs-Did (keep ONE canned case for demo) → live wallet alerts → Composable/MCP adapter. **Never cut:** dossier verdict block, call ledger with receipts, one real FADE swap, TEE receipt strip.

## Open decisions

1. X API vs Farcaster+archive (hour-zero blocker).
2. Chain for demo swap: Base mainnet dust vs Base Sepolia (recommend Sepolia — zero risk, same code, prize-valid).
3. Graph Composable: build MCP adapter only after booth confirmation.
