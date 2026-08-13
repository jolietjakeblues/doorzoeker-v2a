import { fetchComplexMembers } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een RCE CHO-complex-URI toestaan, geen willekeurige tekst: de query
// interpoleert deze waarde direct in een SPARQL <...>-node, dus een waarde
// met een ">" erin zou een injectie mogelijk maken.
const COMPLEX_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/complex\/\d+$/;

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.complex-members.error" }, async (startedAt) => {
    const url = new URL(request.url);
    const complex = url.searchParams.get("complex") ?? "";
    if (!COMPLEX_URI_PATTERN.test(complex)) {
      return Response.json({ error: "Ongeldige complex-URI." }, { status: 400 });
    }

    const members = await fetchComplexMembers(complex, request.signal);
    return Response.json({ members }, {
      headers: {
        "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  });
}
