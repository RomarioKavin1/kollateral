import { getDb } from "./db";
import { privyClient } from "./privy";
import type { PlannedTrade } from "./copytrade";

// Base Sepolia canonical WETH (quote asset for buys/sells).
const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006";
const UNISWAP = "https://trade-api.gateway.uniswap.org/v1";
const BASE_SEPOLIA = 84532;

function uniHeaders() {
  return {
    "x-api-key": process.env.UNISWAP_API_KEY!,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface ExecInput {
  userId: number;
  privyWalletId: string | null; // Privy embedded wallet id (needed to sign)
  walletAddress: string | null;
  delegated: boolean;
  allocationId: number;
  callId: number | null;
  creatorHandle: string;
  mode: "copy" | "fade";
  planned: PlannedTrade;
  entryPriceUsd?: number | null;
}

// Execute one copy/fade trade for a user: get a Uniswap quote → (if the wallet
// is delegated + funded) sign & send via Privy on Base Sepolia → log the trade.
// Honest about prerequisites: logs status 'failed' with a reason when the
// wallet isn't delegated/funded rather than pretending it traded.
export async function executeCopyTrade(inp: ExecInput): Promise<{ status: string; txHash?: string; reason?: string }> {
  const db = getDb();
  const p = inp.planned;
  const tokenIn = p.side === "buy" ? WETH_BASE_SEPOLIA : p.tokenAddress;
  const tokenOut = p.side === "buy" ? p.tokenAddress : WETH_BASE_SEPOLIA;
  // Demo sizing: fixed small wei amount (real USD→wei sizing needs an oracle;
  // the USD amount is recorded for the portfolio, the on-chain leg is small).
  const amountWei = "1000000000000000"; // 0.001 WETH-equiv

  const logTrade = (status: string, txHash?: string) =>
    db
      .prepare(
        `INSERT INTO copy_trades (user_id, allocation_id, call_id, creator_handle, mode,
           token_symbol, token_address, side, amount_usd, entry_price_usd, tx_hash, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        inp.userId, inp.allocationId, inp.callId, inp.creatorHandle, inp.mode,
        p.tokenSymbol, p.tokenAddress, p.side, p.amountUsd, inp.entryPriceUsd ?? null,
        txHash ?? null, status, Math.floor(Date.now() / 1000)
      );

  // Prerequisites for real execution.
  if (!inp.delegated || !inp.privyWalletId || !inp.walletAddress) {
    logTrade("failed");
    return { status: "failed", reason: "wallet not delegated for auto-trading" };
  }

  try {
    // Uniswap quote → swap calldata (protocols guard avoids UniswapX $300 min).
    const quote = await fetch(`${UNISWAP}/quote`, {
      method: "POST",
      headers: uniHeaders(),
      body: JSON.stringify({
        type: "EXACT_INPUT", tokenIn, tokenOut,
        tokenInChainId: BASE_SEPOLIA, tokenOutChainId: BASE_SEPOLIA,
        amount: amountWei, swapper: inp.walletAddress,
        autoSlippage: "DEFAULT", protocols: ["V2", "V3", "V4"],
      }),
    }).then((r) => r.json());

    if (quote.permitData) {
      // Permit2 needed — the delegated backend would sign the EIP-712 permit then
      // /swap. Left as the next execution step; log honestly for now.
      logTrade("failed");
      return { status: "failed", reason: "permit2 signature step pending for delegated flow" };
    }

    const swap = await fetch(`${UNISWAP}/swap`, {
      method: "POST",
      headers: uniHeaders(),
      body: JSON.stringify({ quote: quote.quote }),
    }).then((r) => r.json());

    const tx = swap.swap;
    if (!tx?.to || !tx?.data) {
      logTrade("failed");
      return { status: "failed", reason: "no swap calldata" };
    }

    // Delegated server-side signing on the user's Privy wallet.
    // Delegated signing uses the authorization key configured on the client.
    const res = await privyClient().walletApi.ethereum.sendTransaction({
      walletId: inp.privyWalletId,
      caip2: `eip155:${BASE_SEPOLIA}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Privy tx shape
      transaction: { to: tx.to, data: tx.data, value: tx.value ?? "0x0", chainId: BASE_SEPOLIA } as any,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape varies
    const txHash = (res as any).hash ?? (res as any).transactionHash ?? undefined;
    logTrade("executed", txHash);
    return { status: "executed", txHash };
  } catch (e) {
    logTrade("failed");
    return { status: "failed", reason: (e as Error).message?.slice(0, 160) };
  }
}
