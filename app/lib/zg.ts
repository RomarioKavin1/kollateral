import OpenAI from "openai";
import { SignalSchema, type Signal } from "./signal-schema";

export type Classification = {
  signal: Signal | null;
  raw: unknown;
  chatId: string | null;
  teeSignature: string | null;
  providerAddress: string | null;
};

// Endpoint + default model are env-configurable so the same code runs against
// the 0G mainnet Private Computer or the testnet router without edits:
//   ZG_BASE_URL (default mainnet router), ZG_MODEL (default DeepSeek-V3.1).
const ZG_BASE_URL = process.env.ZG_BASE_URL || "https://router-api.0g.ai/v1";
const ZG_DEFAULT_MODEL = process.env.ZG_MODEL || "deepseek-ai/DeepSeek-V3.1";

// Lazy-init: instantiating OpenAI eagerly at module load would throw at
// import time (and in tests) whenever ZG_API_KEY is unset. Building the
// client on first use keeps `parseToolCall` importable with no env vars.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ baseURL: ZG_BASE_URL, apiKey: (process.env.ZG_API_KEY || "").trim() });
  }
  return client;
}

const TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "emit_trade_signal",
    description: "Classify a crypto post as a trade signal using the closed template set.",
    parameters: {
      type: "object",
      properties: {
        template: { enum: ["DIRECTIONAL", "TARGET_CALL", "GEM_SHILL", "NOT_A_SIGNAL"] },
        asset_symbol: { type: ["string", "null"] },
        direction: { enum: ["long", "short", null] },
        expiry_days: { type: ["number", "null"] },
        confidence: { type: "number" },
      },
      required: ["template", "confidence"],
    },
  },
};

const SYSTEM = `You classify a crypto X post into ONE trade-signal template via the emit_trade_signal tool.

A post is a SIGNAL only if it makes an EXPLICIT tradeable call on a specific token:
- DIRECTIONAL: says to long/short a token (e.g. "longing ETH", "short SOL").
- TARGET_CALL: names a token with an entry/target/price prediction (e.g. "$PEPE to $0.00003").
- GEM_SHILL: hypes a token to buy (e.g. "$WIF is the next 10x").
Otherwise (news, commentary, macro takes, sarcasm, memes, questions, retrospectives, no specific token) => NOT_A_SIGNAL.

When it IS a signal you MUST fill:
- asset_symbol: the bare ticker WITHOUT the $ sign, uppercase (e.g. PEPE, ETH, WIF). Never null for a signal.
- direction: "long" for buy/bullish calls (default when a token is hyped), "short" for bearish.
- expiry_days: number of days if a timeframe is stated, else null.
- confidence: 0-1, how sure you are this is a real explicit call.
For NOT_A_SIGNAL set asset_symbol null and confidence low.

Examples:
"$PEPE about to 10x 🚀" -> {template:"GEM_SHILL", asset_symbol:"PEPE", direction:"long", expiry_days:null, confidence:0.9}
"Longing ETH here, target $4000 by month end" -> {template:"TARGET_CALL", asset_symbol:"ETH", direction:"long", expiry_days:30, confidence:0.9}
"gm frens, beautiful day" -> {template:"NOT_A_SIGNAL", asset_symbol:null, direction:null, expiry_days:null, confidence:0.0}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts loosely-shaped SDK/test completions
export function parseToolCall(completion: any): Signal | null {
  const tc = completion?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc || tc.function?.name !== "emit_trade_signal") return null;
  let args: unknown;
  try {
    args = JSON.parse(tc.function.arguments);
  } catch {
    return null;
  }
  const parsed = SignalSchema.safeParse(args);
  return parsed.success ? parsed.data : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// HTTP statuses worth retrying (transient); everything else fails fast so the
// caller sees the real error (e.g. 401 bad key, 402 insufficient balance).
function isTransient(status: number | undefined): boolean {
  return status === 429 || status === 408 || (status !== undefined && status >= 500);
}

export async function classifyPost(
  text: string,
  postedAt: number,
  model = ZG_DEFAULT_MODEL,
  retries = 2
): Promise<Classification> {
  const postedAtIso = new Date(postedAt * 1000).toISOString();
  for (let i = 0; i <= retries; i++) {
    let data: OpenAI.Chat.ChatCompletion;
    let response: Response;
    try {
      const res = await getClient()
        .chat.completions.create({
          model,
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "emit_trade_signal" } },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Posted at: ${postedAtIso}\n\n${text}` },
          ],
        })
        .withResponse();
      data = res.data;
      response = res.response;
    } catch (err) {
      // Transient (rate limit / 5xx / network): back off and retry. Permanent
      // errors (bad key, insufficient balance) and the final attempt re-throw
      // so the pipeline can log the real cause and continue to the next post.
      const status = (err as { status?: number }).status;
      if (i < retries && (isTransient(status) || status === undefined)) {
        await sleep(1000 * (i + 1));
        continue;
      }
      throw err;
    }
    const signal = parseToolCall(data);
    if (signal) {
      return {
        signal,
        raw: data,
        chatId: data.id ?? null,
        teeSignature: response.headers.get("zg-res-key") ?? null,
        // 0G router identifies the serving node/provider via the `x-provider`
        // response header (confirmed live, also mirrored in the body under
        // `x_0g_trace.provider`) — an on-chain provider address, not a TEE
        // attestation. We surface it as-is; no fabrication if it's ever absent.
        providerAddress: response.headers.get("x-provider") ?? null,
      };
    }
  }
  // Reached the retry cap without a parseable tool call: treat as "not a signal"
  // rather than an error (the model answered, just not usefully).
  return { signal: null, raw: null, chatId: null, teeSignature: null, providerAddress: null };
}
