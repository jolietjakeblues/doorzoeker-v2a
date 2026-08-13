import { resolveConcept } from "../../../../lib/server/referentienetwerk-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Concept-metadata (label, scheme, broader) verandert zelden - langere cache
// dan de gewone zoekroutes is hier veilig.
// Alleen bekende, publieke term-namespaces toestaan, geen willekeurige
// gebruikersinput: de query interpoleert deze waarde direct in een SPARQL
// <...>-node, dus een waarde met een ">" erin zou een injectie mogelijk
// maken. rn/2 = Referentienetwerk, cht/abr = de al bestaande thesauri, rn
// (zonder /2/) = actor-concepten uit graph/actorenrol (zie
// docs/vertical-slices/007-bouwgeschiedenis.md). Let op: resolveConcept()
// hieronder bevraagt alleen het aparte Referentienetwerk-endpoint, niet
// rce/cho - een rn/<uuid>-actor-URI valideert hier dus wel, maar levert nu
// nog een 404 op via déze route (wordt momenteel alleen gebruikt via
// /api/rce/search?veld=actor, dat wél de juiste graph bevraagt).
export const CONCEPT_URI_PATTERN = /^https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/(rn\/2|rn|cht|abr)\/[0-9a-fA-F-]+$/;

export async function GET(request: Request) {
  return withRceErrorHandling(
    { event: "rce.concept.error", message: "De Referentienetwerk-service is momenteel niet bereikbaar." },
    async (startedAt) => {
      const url = new URL(request.url);
      const uri = url.searchParams.get("uri") ?? "";
      if (!CONCEPT_URI_PATTERN.test(uri)) {
        return Response.json({ error: "Ongeldige concept-URI." }, { status: 400 });
      }

      const concept = await resolveConcept(uri, request.signal);
      if (!concept) return Response.json({ error: "Concept niet gevonden." }, { status: 404 });

      return Response.json(concept, {
        headers: {
          "Cache-Control": sharedCacheControl(CACHE_POLICY.conceptDetails),
          "Server-Timing": `rn;dur=${Date.now() - startedAt}`,
        },
      });
    },
  );
}
