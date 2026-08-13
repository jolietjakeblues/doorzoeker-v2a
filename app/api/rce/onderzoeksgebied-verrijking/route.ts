import { fetchOnderzoeksgebiedVerrijking } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een RCE CHO-onderzoeksgebied-URI toestaan, geen willekeurige tekst:
// de query interpoleert deze waarde direct in een SPARQL <...>-node, dus een
// waarde met een ">" erin zou een injectie mogelijk maken.
const GEBIED_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/archeologischonderzoeksgebied\/\d+$/;

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.onderzoeksgebied-verrijking.error" }, async (startedAt) => {
    const url = new URL(request.url);
    const gebied = url.searchParams.get("gebied") ?? "";
    if (!GEBIED_URI_PATTERN.test(gebied)) {
      return Response.json({ error: "Ongeldige onderzoeksgebied-URI." }, { status: 400 });
    }

    const verrijking = await fetchOnderzoeksgebiedVerrijking(gebied, request.signal);
    return Response.json(verrijking, {
      headers: {
        "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  });
}
