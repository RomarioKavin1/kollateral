import OpenAI from "openai";
import { SignalSchema, type Signal } from "./signal-schema";

export type Classification = {
  signal: Signal | null;
  raw: unknown;
  chatId: string | null;
  teeSignature: string | null;
};

// Lazy-init: instantiating OpenAI eagerly at module load would throw at
// import time (and in tests) whenever ZG_API_KEY is unset. Building the
// client on first use keeps `parseToolCall` importable with no env vars.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ baseURL: "https://router-api.0g.ai/v1", apiKey: process.env.ZG_API_KEY! });
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

const SYSTEM = `You classify crypto X posts. Only EXPLICIT directional/target/shill calls are signals.
Sarcasm, memes, questions, retrospectives => NOT_A_SIGNAL. Be conservative: when unsure, NOT_A_SIGNAL with low confidence.`;

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
  model = "deepseek-ai/DeepSeek-V3.1",
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
      };
    }
  }
  // Reached the retry cap without a parseable tool call: treat as "not a signal"
  // rather than an error (the model answered, just not usefully).
  return { signal: null, raw: null, chatId: null, teeSignature: null };
}
