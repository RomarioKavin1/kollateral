import { describe, it, expect } from "vitest";
import { pickCandleClose, paginate } from "../lib/graph";
describe("pricing", () => {
  it("picks the candle covering the timestamp", () => {
    const candles = [
      { datetime: "2025-03-01T09:00:00Z", close: 1.0 },
      { datetime: "2025-03-01T10:00:00Z", close: 2.0 },
      { datetime: "2025-03-01T11:00:00Z", close: 3.0 }];
    const ts = Math.floor(new Date("2025-03-01T10:30:00Z").getTime() / 1000);
    expect(pickCandleClose(candles, ts)).toBe(2.0);
  });
});
