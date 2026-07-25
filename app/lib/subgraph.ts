// Uniswap v3 subgraph fallback for pricing (Task 11). Activates only when
// Pinax OHLC (lib/graph.ts priceAt) returns null — e.g. thin pools or gaps
// before Pinax's OHLC history starts. Composing Token API (Pinax) + The
// Graph subgraph queries qualifies this for the Graph Composable track.
const SUBGRAPH_ID = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV";

// Built lazily inside a function (not a module-level const) so importing this
// module never depends on GRAPH_STUDIO_KEY being set — mirrors lib/graph.ts's
// headers() pattern, keeping this module safely importable in tests.
function endpoint() {
  return `https://gateway.thegraph.com/api/${process.env.GRAPH_STUDIO_KEY}/subgraphs/id/${SUBGRAPH_ID}`;
}

function headers() {
  return { "Content-Type": "application/json" };
}

export async function subgraphPriceAt(tokenAddress: string, tsSec: number): Promise<number | null> {
  if (!process.env.GRAPH_STUDIO_KEY) return null;
  try {
    const query = `{
      tokenHourDatas(
        first: 1,
        orderBy: periodStartUnix,
        orderDirection: desc,
        where: { token: "${tokenAddress.toLowerCase()}", periodStartUnix_lte: ${tsSec} }
      ) { priceUSD periodStartUnix }
    }`;
    const r = await fetch(endpoint(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ query }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const row = j?.data?.tokenHourDatas?.[0];
    if (!row?.priceUSD) return null;
    const price = parseFloat(row.priceUSD);
    return Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}
