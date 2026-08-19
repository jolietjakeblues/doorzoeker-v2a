export const RCE_CHO_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const REQUEST_TIMEOUT_MS = 20_000;

export function requestSignal(signal?: AbortSignal, timeoutMs: number = REQUEST_TIMEOUT_MS) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

// GET is de standaard (kortere, cachebare URL's), maar sommige queries
// bevatten een WKT-literal die groot genoeg is om de URL-lengtelimiet van de
// RCE-dienst te raken - live geraakt door 017-archeologische-context-
// onderzoeksgebied.md's exacte-overlap-query (414 Request-URI Too Large,
// zelfde les als het oorspronkelijke, nu verwijderde Werelderfgoed-
// offline-script). `method: "POST"` stuurt de querytekst in de request-body
// in plaats van de querystring.
async function fetchSparqlOnce(endpoint: string, query: string, signal?: AbortSignal, timeoutMs?: number, method: "GET" | "POST" = "GET") {
  const response = method === "POST"
    ? await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: `query=${encodeURIComponent(query)}`,
        signal: requestSignal(signal, timeoutMs),
      })
    : await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/sparql-results+json" },
        signal: requestSignal(signal, timeoutMs),
      });
  if (!response.ok) throw new Error(`RCE SPARQL-service antwoordde met ${response.status}`, { cause: response.status });
  return response.json();
}

// Gedeeld door elke adapter die tegen een RCE SPARQL-dienst praat (monumenten,
// thesauri, Referentienetwerk, ...): één kans op een transiente 5xx wordt één
// keer herkanst voordat we het opgeven; een echte clientfout (4xx) wordt niet
// herkanst. `endpoint` is optioneel en valt terug op de hoofddienst
// (rce/cho) - alleen de Referentienetwerk-adapter geeft een ander endpoint
// mee, want dat is een fysiek apart SPARQL-endpoint. `timeoutMs` is optioneel
// en valt terug op de standaard 20s - alleen de archeologische-contextroute
// (017) geeft hier expliciet iets langers voor mee, gemeten op ~15,4s voor de
// bbox-voorfilterstap alleen al. `method` is optioneel en valt terug op GET.
export async function fetchSparql(query: string, signal?: AbortSignal, endpoint: string = RCE_CHO_ENDPOINT, timeoutMs?: number, method?: "GET" | "POST") {
  try {
    return await fetchSparqlOnce(endpoint, query, signal, timeoutMs, method);
  } catch (error) {
    const status = error instanceof Error ? error.cause : undefined;
    if (typeof status !== "number" || status < 500) throw error;
    return fetchSparqlOnce(endpoint, query, signal, timeoutMs, method);
  }
}

// Observability-only: meet de tijd per fase van een SPARQL-fan-out, zodat op
// basis van echte cijfers beslist kan worden wat gecachet, lazy gemaakt of
// gebundeld wordt, in plaats van dat te gokken. Verandert verder geen gedrag
// - alleen een console.info per fase. Gedeeld door elke adapter (rce/cho,
// Referentienetwerk, bibliotheek) in plaats van per adapter gedupliceerd.
export async function timed<T>(event: string, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const result = await work();
  console.info(JSON.stringify({ event, durationMs: Date.now() - startedAt }));
  return result;
}
