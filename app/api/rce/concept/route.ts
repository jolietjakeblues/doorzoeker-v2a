import { resolveConcept } from "../../../../lib/server/referentienetwerk-adapter.ts";

export const runtime = "edge";

// Concept-metadata (label, scheme, broader) verandert zelden - langere cache
// dan de gewone zoekroutes is hier veilig.
const CACHE_SECONDS = 3600;
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
  const startedAt = Date.now();

  try {
    const url = new URL(request.url);
    const uri = url.searchParams.get("uri") ?? "";
    if (!CONCEPT_URI_PATTERN.test(uri)) {
      return Response.json({ error: "Ongeldige concept-URI." }, { status: 400 });
    }

    const concept = await resolveConcept(uri, request.signal);
    if (!concept) return Response.json({ error: "Concept niet gevonden." }, { status: 404 });

    return Response.json(concept, {
      headers: {
        "Cache-Control": `public, max-age=300, s-maxage=${CACHE_SECONDS}`,
        "Server-Timing": `rn;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.concept.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "De Referentienetwerk-service is momenteel niet bereikbaar." }, { status: 502 });
  }
}
