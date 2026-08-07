import { fetchComplexMembers } from "../../../../lib/server/rce-adapter.ts";

export const runtime = "edge";

const CACHE_SECONDS = 300;
// Alleen een RCE CHO-complex-URI toestaan, geen willekeurige tekst: de query
// interpoleert deze waarde direct in een SPARQL <...>-node, dus een waarde
// met een ">" erin zou een injectie mogelijk maken.
const COMPLEX_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/complex\/\d+$/;

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(request.url);
    const complex = url.searchParams.get("complex") ?? "";
    if (!COMPLEX_URI_PATTERN.test(complex)) {
      return Response.json({ error: "Ongeldige complex-URI." }, { status: 400 });
    }

    const members = await fetchComplexMembers(complex, request.signal);
    return Response.json({ members }, {
      headers: {
        "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.complex-members.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "De RCE Linked Data-service is momenteel niet bereikbaar." }, { status: 502 });
  }
}
