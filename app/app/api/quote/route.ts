import { NextResponse } from "next/server";

// Server-side only: UNISWAP_API_KEY never reaches the client. Same base URL
// for mainnet and testnet — Base Sepolia quotes hit this exact endpoint.
const BASE = "https://trade-api.gateway.uniswap.org/v1";

function headers() {
  return {
    "x-api-key": process.env.UNISWAP_API_KEY!,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

interface QuoteRequestBody {
  action?: "approval" | "quote";
  tokenIn: string;
  tokenOut: string;
  amount: string;
  swapper: string;
  chainId: number;
  // check_approval passthrough fields
  walletAddress?: string;
  token?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as QuoteRequestBody;
  const action = body.action ?? "quote";

  if (action === "approval") {
    const approval = await fetch(`${BASE}/check_approval`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        walletAddress: body.walletAddress ?? body.swapper,
        token: body.token ?? body.tokenIn,
        amount: body.amount,
        chainId: body.chainId,
      }),
    }).then((r) => r.json());
    return NextResponse.json({ step: "approval", approval });
  }

  const quote = await fetch(`${BASE}/quote`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "EXACT_INPUT",
      tokenIn: body.tokenIn,
      tokenOut: body.tokenOut,
      tokenInChainId: body.chainId,
      tokenOutChainId: body.chainId,
      amount: body.amount,
      swapper: body.swapper,
      autoSlippage: "DEFAULT",
      // ALWAYS restrict to on-chain protocols: UniswapX carries a $300
      // minimum order size that breaks the small demo swap amounts here.
      protocols: ["V2", "V3", "V4"],
    }),
  }).then((r) => r.json());

  if (quote.permitData) {
    return NextResponse.json({ step: "permit", quote });
  }

  const swap = await fetch(`${BASE}/swap`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ quote: quote.quote }),
  }).then((r) => r.json());

  return NextResponse.json({ step: "swap", quote, swap });
}
