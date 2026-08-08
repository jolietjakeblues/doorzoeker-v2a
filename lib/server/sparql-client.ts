const SPARQL_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const REQUEST_TIMEOUT_MS = 20_000;

export function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function fetchSparqlOnce(query: string, signal?: AbortSignal) {
  const response = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE SPARQL-service antwoordde met ${response.status}`, { cause: response.status });
  return response.json();
}

// Gedeeld door elke adapter die tegen de RCE CHO SPARQL-dienst praat (monumenten,
// thesauri, ...): één kans op een transiente 5xx wordt één keer herkanst voordat
// we het opgeven; een echte clientfout (4xx) wordt niet herkanst.
export async function fetchSparql(query: string, signal?: AbortSignal) {
  try {
    return await fetchSparqlOnce(query, signal);
  } catch (error) {
    const status = error instanceof Error ? error.cause : undefined;
    if (typeof status !== "number" || status < 500) throw error;
    return fetchSparqlOnce(query, signal);
  }
}
