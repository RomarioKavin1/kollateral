import { describe, it, expect } from "vitest";
import { importArchive } from "../scripts/import-archive";
import { writeFileSync } from "fs";
describe("importArchive", () => {
  it("inserts posts with sha256 content hash, dedupes on re-run", () => {
    process.env.DB_PATH = ":memory:";
    writeFileSync("/tmp/fixture.json", JSON.stringify([
      { id: "111", text: "$PEPE 10x incoming", created_at: "2025-03-01T10:00:00Z",
        url: "https://x.com/kaleo/status/111" }]));
    const r1 = importArchive("CryptoKaleo", "/tmp/fixture.json");
    expect(r1.inserted).toBe(1);
    const r2 = importArchive("CryptoKaleo", "/tmp/fixture.json");
    expect(r2.skipped).toBe(1);
  });
});
