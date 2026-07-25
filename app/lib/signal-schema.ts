import { z } from "zod";
export const SignalSchema = z.object({
  template: z.enum(["DIRECTIONAL", "TARGET_CALL", "GEM_SHILL", "NOT_A_SIGNAL"]),
  asset_symbol: z.string().nullable(),
  direction: z.enum(["long", "short"]).nullable(),
  expiry_days: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});
export type Signal = z.infer<typeof SignalSchema>;
export const DEFAULT_EXPIRY: Record<string, number> = { DIRECTIONAL: 7, TARGET_CALL: 30, GEM_SHILL: 30 };
