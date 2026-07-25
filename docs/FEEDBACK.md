# Uniswap Trading API — integration feedback

Notes from wiring the FADE/FOLLOW live-trade leg of KOLlateral (Task 10:
server-side `/quote` → `/swap` proxy + Base Sepolia `sendTransaction`).

- **The `Accept` header is load-bearing and undocumented as such.** Sending
  `Accept: application/json` isn't optional boilerplate here — omitting it
  (or sending a looser value like `*/*`) changed the response shape we got
  back in early testing. Worth calling out explicitly in the quickstart
  rather than leaving it implied by the example curl snippet.
- **`protocols` defaulting to include UniswapX is a demo-killer if you don't
  know to override it.** UniswapX's ~$300 minimum order size means any
  small testnet/demo swap (we're quoting ~0.001 WETH) silently fails or
  routes nowhere unless you explicitly pass `protocols: ["V2","V3","V4"]`
  on every `/quote` call. This should either be surfaced as a prominent
  warning near the quote endpoint docs, or the minimum should be returned
  as a structured error instead of an opaque non-route.
- **The permit vs. swap branch forces a two-step client flow that isn't
  obvious from the `/quote` response alone.** You only find out you need a
  Permit2 signature by checking for `permitData` on the quote response and
  branching before ever calling `/swap` — there's no single "give me
  everything to execute" endpoint for the common ERC-20 case. We built our
  proxy (`app/app/api/quote/route.ts`) to do this branch server-side so the
  client only ever sees `{step: "permit" | "swap", ...}`, but a first-time
  integrator following the docs linearly would likely call `/swap` first
  and get a confusing failure.
- **`check_approval` composes cleanly once you treat it as "just another
  proxied POST"** — routing it through the same handler via an `action`
  field (`"approval" | "quote"`) on one Next.js route kept the API key on
  the server without needing a second route file. No complaints here, just
  noting it worked exactly as expected.
