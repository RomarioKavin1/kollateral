import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { classifyPost } from "@/lib/zg";

// Live 0G TEE verification for one call. Re-runs the call's post through the 0G
// router with verify_tee:true (pinned to a private/TEE provider); the router
// performs on-chain signature verification and returns x_0g_trace.tee_verified.
// This is the real check surfaced as a button. Costs one small inference.
export async function GET(_req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.content as content, p.posted_at as posted_at
       FROM calls c JOIN posts p ON p.id = c.post_id WHERE c.id = ?`
    )
    .get(callId) as { content: string; posted_at: number } | undefined;

  if (!row) {
    return NextResponse.json({ status: "unavailable", verified: false, detail: "call not found" });
  }

  try {
    const c = await classifyPost(row.content, row.posted_at);
    if (c.teeVerified === true) {
      return NextResponse.json({
        status: "verified",
        verified: true,
        provider: c.providerAddress,
        detail: "The 0G router verified the provider's on-chain TEE signature for this inference (verify_tee).",
      });
    }
    if (c.teeVerified === false) {
      return NextResponse.json({
        status: "failed",
        verified: false,
        provider: c.providerAddress,
        detail: "The provider's TEE signature did not verify on-chain.",
      });
    }
    return NextResponse.json({
      status: "unavailable",
      verified: false,
      provider: c.providerAddress,
      detail:
        "This model is served with transport-layer (TeeTLS) attestation and returns no per-response signature, so there is nothing to verify. Use a TeeML model (e.g. 0gm-1.0-35b-a3b) for an on-chain-verified check.",
    });
  } catch (e) {
    return NextResponse.json({
      status: "unavailable",
      verified: false,
      detail: `Verification could not run: ${(e as Error).message?.slice(0, 140) || "unknown error"}.`,
    });
  }
}
