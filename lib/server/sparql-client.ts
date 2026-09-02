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
  if (!response.ok) {
    const error = new Error(`RCE SPARQL-service antwoordde met ${response.status}`, { cause: response.status });
    // Additief, niet-breaking: bestaande callers die alleen .cause (de
    // status) lezen blijven ongewijzigd werken. lib/vraag/spatial-fallback.ts
    // gebruikt .body om na afloop (dus ook na de herkansingen hieronder) een
    // TopologyException/GEOS-fout te herkennen en op een andere strategie
    // over te schakelen in plaats van de kapotte query te blijven herhalen.
    (error as Error & { body?: string }).body = await response.text().catch(() => "");
    throw error;
  }
  return response.json();
}

// Gedeeld door elke adapter die tegen een RCE SPARQL-dienst praat (monumenten,
// thesauri, Referentienetwerk, ...): een transiente 5xx wordt herkanst; een
// echte clientfout (4xx) wordt niet herkanst. `endpoint` is optioneel en
// valt terug op de hoofddienst (rce/cho) - alleen de Referentienetwerk-
// adapter geeft een ander endpoint mee, want dat is een fysiek apart
// SPARQL-endpoint. `timeoutMs` is optioneel en valt terug op de standaard
// 20s - alleen de archeologische-contextroute (017) geeft hier expliciet
// iets langers voor mee, gemeten op ~15,4s voor de bbox-voorfilterstap
// alleen al. `method` is optioneel en valt terug op GET.
//
// Tot 3 pogingen (was 1 herkansing = 2 pogingen totaal): live geconstateerd
// (22-08-2026, wrangler-logs tijdens het onderzoeken van een gemelde
// "Scheepswrak kon niet worden geladen"-melding voor "Utrecht" - die term
// heeft wél degelijk treffers, zie MASS-ID's 1189/1263/233/3080/445/454/553)
// dat zowel rce/cho als rce/mass soms twee 503's ná elkaar geven binnen
// hetzelfde verzoek, dus één herkansing was niet altijd genoeg. Elke
// individuele poging is snel (100-350ms in dezelfde logs) zodra de dienst
// wél antwoordt, dus een korte, oplopende pauze tussen pogingen kost
// nauwelijks tijd t.o.v. de 20s-timeoutbudget.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

export async function fetchSparql(query: string, signal?: AbortSignal, endpoint: string = RCE_CHO_ENDPOINT, timeoutMs?: number, method?: "GET" | "POST") {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchSparqlOnce(endpoint, query, signal, timeoutMs, method);
    } catch (error) {
      const status = error instanceof Error ? error.cause : undefined;
      if (typeof status !== "number" || status < 500 || attempt >= MAX_ATTEMPTS) throw error;
      await delay(RETRY_DELAY_MS * attempt, signal);
    }
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
