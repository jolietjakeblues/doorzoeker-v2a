export const RCE_CHO_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const REQUEST_TIMEOUT_MS = 20_000;

export function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function fetchSparqlOnce(endpoint: string, query: string, signal?: AbortSignal) {
  const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE SPARQL-service antwoordde met ${response.status}`, { cause: response.status });
  return response.json();
}

// Gedeeld door elke adapter die tegen een RCE SPARQL-dienst praat (monumenten,
// thesauri, Referentienetwerk, ...): één kans op een transiente 5xx wordt één
// keer herkanst voordat we het opgeven; een echte clientfout (4xx) wordt niet
// herkanst. `endpoint` is optioneel en valt terug op de hoofddienst
// (rce/cho) - alleen de Referentienetwerk-adapter geeft een ander endpoint
// mee, want dat is een fysiek apart SPARQL-endpoint.
export async function fetchSparql(query: string, signal?: AbortSignal, endpoint: string = RCE_CHO_ENDPOINT) {
  try {
    return await fetchSparqlOnce(endpoint, query, signal);
  } catch (error) {
    const status = error instanceof Error ? error.cause : undefined;
    if (typeof status !== "number" || status < 500) throw error;
    return fetchSparqlOnce(endpoint, query, signal);
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
