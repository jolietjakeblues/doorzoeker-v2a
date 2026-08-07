import {
  buildRceDetailsQuery,
  buildRceDiscoveryQuery,
  buildRceFacetsQuery,
  buildRceNumberQuery,
  buildRceParcelQuery,
  buildRceParcelsQuery,
  parseDiscoveryResults,
  parseFacetResults,
  parseParcelResults,
  parseRceMonuments,
  parseSparqlResults,
  type RceMonument,
} from "../rce.ts";

const REST_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run";
const SPARQL_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const REQUEST_TIMEOUT_MS = 20_000;

type SparqlBinding = Record<string, { value?: string } | undefined>;

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function fetchSparql(query: string, signal?: AbortSignal) {
  const response = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE SPARQL-service antwoordde met ${response.status}`);
  return response.json();
}

async function searchByNumber(monumentNumber: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const [monumentsDocument, parcelsDocument, facetsDocument] = await Promise.all([
    fetchSparql(buildRceNumberQuery(monumentNumber), signal),
    fetchSparql(buildRceParcelQuery(monumentNumber), signal),
    fetchSparql(buildRceFacetsQuery([monumentNumber]), signal),
  ]);
  const parcels = parseParcelResults(parcelsDocument);
  const facets = parseFacetResults(facetsDocument);
  return parseSparqlResults(monumentsDocument).map((monument) => ({ ...monument, ...facets.get(monument.monumentNumber), parcels }));
}

async function searchByText(term: string, signal?: AbortSignal, page = 1): Promise<RceMonument[]> {
  const discovery = parseDiscoveryResults(await fetchSparql(buildRceDiscoveryQuery(term, page), signal)).slice(0, 25);
  if (!discovery.length) return [];
  const numbers = discovery.map((match) => match.monumentNumber);
  const [detailsDocument, parcelsDocument, facetsDocument] = await Promise.all([
    fetchSparql(buildRceDetailsQuery(numbers), signal),
    fetchSparql(buildRceParcelsQuery(numbers), signal),
    fetchSparql(buildRceFacetsQuery(numbers), signal),
  ]);
  const facets = parseFacetResults(facetsDocument);
  const parcelBindings = (parcelsDocument as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const detailsByNumber = new Map(parseSparqlResults(detailsDocument).map((monument) => [monument.monumentNumber, monument]));
  return discovery.flatMap((match) => {
    const monument = detailsByNumber.get(match.monumentNumber);
    if (!monument) return [];
    const parcels = parseParcelResults({ results: { bindings: parcelBindings.filter((binding) => binding.rmnr?.value === monument.monumentNumber) } });
    return [{ ...monument, ...facets.get(monument.monumentNumber), ...match, parcels }];
  });
}

export async function searchRceMonuments(query: string, signal?: AbortSignal, page = 1): Promise<RceMonument[]> {
  const trimmed = query.trim();
  if (/^\d{4,6}$/.test(trimmed)) return searchByNumber(trimmed, signal);
  if (!/^\d{4}\s?[A-Za-z]{2}$/.test(trimmed)) return searchByText(trimmed, signal, page);
  const params = new URLSearchParams({ page: "1", pageSize: "100", postcode: trimmed.replace(/\s/g, "").toUpperCase() });
  const response = await fetch(`${REST_ENDPOINT}?${params}`, {
    headers: { Accept: "application/ld+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE-service antwoordde met ${response.status}`);
  return parseRceMonuments(await response.json());
}
