import { fetchOpDezeDag } from "../../../../lib/server/rce-adapter.ts";

export const runtime = "edge";

// Het resultaat verandert maar één keer per kalenderdag (zelfde monument
// voor iedereen die dag, zie fetchOpDezeDag) - een langere cache dan de
// gewone zoekroutes is hier dus veilig en scheelt onnodige SPARQL-belasting.
const CACHE_SECONDS = 21_600;

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const monument = await fetchOpDezeDag(request.signal);
    if (!monument) return Response.json({ monument: null });

    return Response.json({ monument }, {
      headers: {
        "Cache-Control": `public, max-age=3600, s-maxage=${CACHE_SECONDS}`,
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.op-deze-dag.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "De RCE Linked Data-service is momenteel niet bereikbaar." }, { status: 502 });
  }
}
