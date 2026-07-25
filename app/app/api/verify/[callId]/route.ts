import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyInference } from "@/lib/verify";

// Live 0G inference verification for one call. Reads the stored provider +
// chat id, then runs the 0G Compute broker's own check (processResponse):
// it reads the provider's on-chain-attested TEE signer from the 0G Serving
// contract and recovers the response's EIP-191 signature against it. This is
// the verification 0G itself provides, surfaced as a button. Read-only (an
// on-chain read + one HTTPS GET), no gas.
export async function GET(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const db = getDb();
  const row = db
    .prepare("SELECT provider_address as provider, chat_id as chatId FROM artifacts WHERE call_id = ?")
    .get(callId) as { provider: string | null; chatId: string | null } | undefined;

  if (!row || !row.provider || !row.chatId) {
    return NextResponse.json({
      status: "unavailable",
      verified: false,
      signer: null,
      detail: "no provider or chat id on file for this call",
    });
  }

  const result = await verifyInference(row.provider, row.chatId);
  return NextResponse.json({ ...result, provider: row.provider, chatId: row.chatId });
}
