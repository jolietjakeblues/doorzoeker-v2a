import {
  buildArcheologischTerreinQuery,
  buildComplexenQuery,
  buildComplexQuery,
  buildRceDetailsQuery,
  buildRceDiscoveryQueries,
  buildRceFacetsQuery,
  buildRceNumberQuery,
  buildGezichtQuery,
  buildRceParcelQuery,
  buildRceParcelsQuery,
  buildWerelderfgoedQuery,
  mergeDiscoveryMatches,
  parseArcheologischTerreinResults,
  parseComplexenResults,
  parseComplexResults,
  parseDiscoveryBranchResults,
  parseFacetResults,
  parseGezichtResults,
  parseParcelResults,
  parseRceMonuments,
  parseSparqlResults,
  parseWerelderfgoedResults,
  type ArcheologischTerrein,
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

async function fetchSparqlOnce(query: string, signal?: AbortSignal) {
  const response = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE SPARQL-service antwoordde met ${response.status}`, { cause: response.status });
  return response.json();
}

// Fanning discovery searches out into six parallel branch queries means six
// chances for a transient 5xx from RCE instead of one. Retry those once
// before giving up; a genuine client-side query error (4xx) is not retried.
async function fetchSparql(query: string, signal?: AbortSignal) {
  try {
    return await fetchSparqlOnce(query, signal);
  } catch (error) {
    const status = error instanceof Error ? error.cause : undefined;
    if (typeof status !== "number" || status < 500) throw error;
    return fetchSparqlOnce(query, signal);
  }
}

// Two independent enrichment lookups keyed by the monument's own CHO subject
// URI, run in parallel: archaeological terrain data (only for monuments with
// an archaeological monumentaard) and complex membership (any monument can
// be part of a complex, so this always runs). Neither is a parallel search -
// both just attach extra facts to Rijksmonument records already found.
async function enrichMonuments(monuments: RceMonument[], signal?: AbortSignal): Promise<RceMonument[]> {
  const choUris = monuments.map((monument) => monument.sourceUrl).filter(Boolean);
  if (!choUris.length) return monuments;
  const archaeological = monuments.filter((monument) => monument.monumentNature?.toLocaleLowerCase("nl").includes("archeolog") && monument.sourceUrl);

  const [terreinenByMonument, complexesByMonument] = await Promise.all([
    archaeological.length
      ? fetchSparql(buildArcheologischTerreinQuery(archaeological.map((monument) => monument.sourceUrl)), signal).then(parseArcheologischTerreinResults)
      : Promise.resolve(new Map<string, ArcheologischTerrein[]>()),
    fetchSparql(buildComplexQuery(choUris), signal).then(parseComplexResults),
  ]);

  return monuments.map((monument) => {
    const archaeologicalSites = terreinenByMonument.get(monument.sourceUrl);
    const complexes = complexesByMonument.get(monument.sourceUrl);
    if (!archaeologicalSites && !complexes) return monument;
    return { ...monument, ...(archaeologicalSites ? { archaeologicalSites } : {}), ...(complexes ? { complexes } : {}) };
  });
}

async function searchByNumber(monumentNumber: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const [monumentsDocument, parcelsDocument, facetsDocument] = await Promise.all([
    fetchSparql(buildRceNumberQuery(monumentNumber), signal),
    fetchSparql(buildRceParcelQuery(monumentNumber), signal),
    fetchSparql(buildRceFacetsQuery([monumentNumber]), signal),
  ]);
  const parcels = parseParcelResults(parcelsDocument);
  const facets = parseFacetResults(facetsDocument);
  const monuments = parseSparqlResults(monumentsDocument).map((monument) => ({ ...monument, ...facets.get(monument.monumentNumber), parcels }));
  return enrichMonuments(monuments, signal);
}

// Werelderfgoed, Gezicht en Complex zijn andere CHO-types dan Rijksmonument
// (geen adres, geen functie, geen archeologie-enrichment - Complex krijgt wel
// zijn eigen complex-enrichment via enrichMonuments, gewoon zoals elk ander
// monument), en met resp. 18, 472 en ~4.200 instanties nooit meer dan een
// handvol treffers per zoekterm. Die worden alleen op de eerste pagina
// meegenomen, vóór de Rijksmonument-discoveryresultaten, zodat "laad meer"
// op latere pagina's ze niet opnieuw ophaalt of dupliceert.
async function searchByText(term: string, signal?: AbortSignal, page = 1): Promise<RceMonument[]> {
  const [branchResults, werelderfgoed, gezichten, complexen] = await Promise.all([
    Promise.all(
      buildRceDiscoveryQueries(term).map(({ bron, query }) => fetchSparql(query, signal).then((document) => parseDiscoveryBranchResults(document, bron, term))),
    ),
    page === 1
      ? fetchSparql(buildWerelderfgoedQuery(term), signal).then(parseWerelderfgoedResults)
      : Promise.resolve<RceMonument[]>([]),
    page === 1
      ? fetchSparql(buildGezichtQuery(term), signal).then(parseGezichtResults)
      : Promise.resolve<RceMonument[]>([]),
    page === 1
      ? fetchSparql(buildComplexenQuery(term), signal).then(parseComplexenResults)
      : Promise.resolve<RceMonument[]>([]),
  ]);
  const extras = [...werelderfgoed, ...gezichten, ...complexen];
  const start = Math.max(0, page - 1) * 25;
  const discovery = mergeDiscoveryMatches(branchResults).slice(start, start + 25);
  if (!discovery.length) return extras;
  const numbers = discovery.map((match) => match.monumentNumber);
  const [detailsDocument, parcelsDocument, facetsDocument] = await Promise.all([
    fetchSparql(buildRceDetailsQuery(numbers), signal),
    fetchSparql(buildRceParcelsQuery(numbers), signal),
    fetchSparql(buildRceFacetsQuery(numbers), signal),
  ]);
  const facets = parseFacetResults(facetsDocument);
  const parcelBindings = (parcelsDocument as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const detailsByNumber = new Map(parseSparqlResults(detailsDocument).map((monument) => [monument.monumentNumber, monument]));
  const monuments = discovery.flatMap((match) => {
    const monument = detailsByNumber.get(match.monumentNumber);
    if (!monument) return [];
    const parcels = parseParcelResults({ results: { bindings: parcelBindings.filter((binding) => binding.rmnr?.value === monument.monumentNumber) } });
    return [{ ...monument, ...facets.get(monument.monumentNumber), ...match, parcels }];
  });
  return [...extras, ...(await enrichMonuments(monuments, signal))];
}

// Browsen (alle Werelderfgoed, Gezichten of Complexen tonen) is geen
// tekstzoekopdracht: het slaat de Rijksmonument-discovery en de naam-FILTER
// helemaal over en geeft gewoon de volledige collectie terug (18, 472
// respectievelijk ~4.200 items).
export async function browseRceObjects(kind: "werelderfgoed" | "gezicht" | "complex", signal?: AbortSignal): Promise<RceMonument[]> {
  if (kind === "werelderfgoed") return fetchSparql(buildWerelderfgoedQuery(""), signal).then(parseWerelderfgoedResults);
  if (kind === "gezicht") return fetchSparql(buildGezichtQuery(""), signal).then(parseGezichtResults);
  return fetchSparql(buildComplexenQuery(""), signal).then(parseComplexenResults);
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
