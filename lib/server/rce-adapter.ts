import {
  buildArcheologischOnderzoekDetailsQuery,
  buildArcheologischOnderzoekDiscoveryQueries,
  buildArcheologischTerreinQuery,
  buildComplexenQuery,
  buildComplexMembersQuery,
  buildComplexQuery,
  buildGroenaanlegQuery,
  buildImageQuery,
  buildMspIndicatieQuery,
  buildOnderzoeksgebiedAggregatenQuery,
  buildOnderzoeksgebiedComplexenQuery,
  buildOnderzoeksgebiedVondstlocatiesQuery,
  buildRceDetailsQuery,
  buildRceDiscoveryQueries,
  buildRceFacetsQuery,
  buildRceNumberQuery,
  buildGezichtQuery,
  buildRceParcelQuery,
  buildRceParcelsQuery,
  buildWerelderfgoedQuery,
  mergeDiscoveryMatches,
  parseArcheologischOnderzoekDiscoveryResults,
  parseArcheologischOnderzoekResults,
  parseArcheologischTerreinResults,
  parseComplexenResults,
  parseComplexMembersResults,
  parseComplexResults,
  parseDiscoveryBranchResults,
  parseFacetResults,
  parseGezichtResults,
  parseGroenaanlegResults,
  parseImageResults,
  parseMspIndicatieResults,
  parseOnderzoeksgebiedAggregatenResults,
  parseOnderzoeksgebiedComplexenResults,
  parseOnderzoeksgebiedVondstlocatiesResults,
  parseParcelResults,
  parseRceMonuments,
  parseSparqlResults,
  parseWerelderfgoedResults,
  type ArcheologischTerrein,
  type ComplexMember,
  type RceMonument,
} from "../rce.ts";
import { fetchSparql, requestSignal } from "./sparql-client.ts";

const REST_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run";

type SparqlBinding = Record<string, { value?: string } | undefined>;

// Observability-only: meet de tijd per fase van de fan-out, zodat op basis
// van echte cijfers beslist kan worden wat gecachet, lazy gemaakt of
// gebundeld wordt, in plaats van dat nu al te gokken. Verandert verder geen
// gedrag - alleen een console.info per fase naast de bestaande totale
// rce.search-log in de route.
async function timed<T>(event: string, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const result = await work();
  console.info(JSON.stringify({ event, durationMs: Date.now() - startedAt }));
  return result;
}

// Five independent enrichment lookups keyed by the monument's own CHO subject
// URI (or, for images/MSP, its rijksmonumentnummer - that's the join key
// those two graphs themselves use), run in parallel: archaeological terrain
// data (only for monuments with an archaeological monumentaard), complex
// membership, a representative photo, historic garden/landscape
// classification, and MSP-aanwijzing (only relevant for their respective
// subsets, but cheap enough to just ask for all of them). None of these is a
// parallel search - all five just attach extra facts to Rijksmonument
// records already found.
async function enrichMonuments(monuments: RceMonument[], signal?: AbortSignal): Promise<RceMonument[]> {
  const choUris = monuments.map((monument) => monument.sourceUrl).filter(Boolean);
  if (!choUris.length) return monuments;
  const archaeological = monuments.filter((monument) => monument.monumentNature?.toLocaleLowerCase("nl").includes("archeolog") && monument.sourceUrl);
  const monumentNumbers = monuments.map((monument) => monument.monumentNumber).filter(Boolean);

  const [terreinenByMonument, complexesByMonument, imagesByNumber, groenaanlegByMonument, mspNumbers] = await Promise.all([
    archaeological.length
      ? timed("enrich.terrein", () => fetchSparql(buildArcheologischTerreinQuery(archaeological.map((monument) => monument.sourceUrl)), signal).then(parseArcheologischTerreinResults))
      : Promise.resolve(new Map<string, ArcheologischTerrein[]>()),
    timed("enrich.complexes", () => fetchSparql(buildComplexQuery(choUris), signal).then(parseComplexResults)),
    monumentNumbers.length
      ? timed("enrich.images", () => fetchSparql(buildImageQuery(monumentNumbers), signal).then(parseImageResults))
      : Promise.resolve(new Map<string, RceMonument["image"]>()),
    timed("enrich.groenaanleg", () => fetchSparql(buildGroenaanlegQuery(choUris), signal).then(parseGroenaanlegResults)),
    monumentNumbers.length
      ? timed("enrich.msp", () => fetchSparql(buildMspIndicatieQuery(monumentNumbers), signal).then(parseMspIndicatieResults))
      : Promise.resolve(new Set<string>()),
  ]);

  return monuments.map((monument) => {
    const archaeologicalSites = terreinenByMonument.get(monument.sourceUrl);
    const complexes = complexesByMonument.get(monument.sourceUrl);
    const image = imagesByNumber.get(monument.monumentNumber);
    const groenaanleg = groenaanlegByMonument.get(monument.sourceUrl);
    const msp = mspNumbers.has(monument.monumentNumber);
    if (!archaeologicalSites && !complexes && !image && !groenaanleg && !msp) return monument;
    return {
      ...monument,
      ...(archaeologicalSites ? { archaeologicalSites } : {}),
      ...(complexes ? { complexes } : {}),
      ...(image ? { image } : {}),
      ...(groenaanleg ? { groenaanleg } : {}),
      ...(msp ? { msp } : {}),
    };
  });
}

// Complexleden zijn bewust geen onderdeel van de gewone zoekresultaten (dat
// zou de resultatenlijst overspoelen) - dit wordt lazy opgehaald zodra een
// gebruiker een complex daadwerkelijk opent.
export async function fetchComplexMembers(complexUri: string, signal?: AbortSignal): Promise<ComplexMember[]> {
  return fetchSparql(buildComplexMembersQuery(complexUri), signal).then(parseComplexMembersResults);
}

// Zelfde lazy-aanpak als complexleden, maar dan voor de archeologische
// domeinen onder een Onderzoeksgebied (zie de toelichting bij de
// query-builders in rce.ts voor waarom dit drie losse queries zijn in
// plaats van één).
export async function fetchOnderzoeksgebiedVerrijking(gebiedUri: string, signal?: AbortSignal) {
  const [complexenDocument, vondstlocatiesDocument, aggregatenDocument] = await Promise.all([
    fetchSparql(buildOnderzoeksgebiedComplexenQuery(gebiedUri), signal),
    fetchSparql(buildOnderzoeksgebiedVondstlocatiesQuery(gebiedUri), signal),
    fetchSparql(buildOnderzoeksgebiedAggregatenQuery(gebiedUri), signal),
  ]);
  return {
    complexen: parseOnderzoeksgebiedComplexenResults(complexenDocument),
    vondstlocaties: parseOnderzoeksgebiedVondstlocatiesResults(vondstlocatiesDocument),
    ...parseOnderzoeksgebiedAggregatenResults(aggregatenDocument),
  };
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

// Archeologisch onderzoeksgebied is geen kleine collectie zoals Werelderfgoed/
// Gezicht/Complex (112K instanties) en heeft geen naam-achtig veld: dit krijgt
// daarom zijn eigen mini-discoveryronde (woonplaats + omschrijving, zie
// ARCHEOLOGISCH_ONDERZOEK_SOURCES in rce.ts) in plaats van één CONTAINS-query
// op de hele collectie.
async function searchArcheologischOnderzoek(term: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const branchResults = await Promise.all(
    buildArcheologischOnderzoekDiscoveryQueries(term).map(({ bron, query }) =>
      fetchSparql(query, signal).then((document) => parseArcheologischOnderzoekDiscoveryResults(document, bron, term)),
    ),
  );
  const discovery = mergeDiscoveryMatches(branchResults).slice(0, 25);
  if (!discovery.length) return [];
  const detailsDocument = await fetchSparql(buildArcheologischOnderzoekDetailsQuery(discovery.map((match) => match.monumentNumber)), signal);
  const detailsByNumber = new Map(parseArcheologischOnderzoekResults(detailsDocument).map((item) => [item.monumentNumber, item]));
  return discovery.flatMap((match) => {
    const item = detailsByNumber.get(match.monumentNumber);
    return item ? [{ ...item, ...match }] : [];
  });
}

// Werelderfgoed, Gezicht en Complex zijn andere CHO-types dan Rijksmonument
// (geen adres, geen functie, geen archeologie-enrichment - Complex krijgt wel
// zijn eigen complex-enrichment via enrichMonuments, gewoon zoals elk ander
// monument), en met resp. 18, 472 en ~4.200 instanties nooit meer dan een
// handvol treffers per zoekterm. Die worden alleen op de eerste pagina
// meegenomen, vóór de Rijksmonument-discoveryresultaten, zodat "laad meer"
// op latere pagina's ze niet opnieuw ophaalt of dupliceert.
async function searchByText(term: string, signal?: AbortSignal, page = 1): Promise<RceMonument[]> {
  const [branchResults, werelderfgoed, gezichten, complexen, onderzoeksgebieden] = await Promise.all([
    timed("search.discovery", () => Promise.all(
      buildRceDiscoveryQueries(term).map(({ bron, query }) => fetchSparql(query, signal).then((document) => parseDiscoveryBranchResults(document, bron, term))),
    )),
    page === 1
      ? timed("search.werelderfgoed", () => fetchSparql(buildWerelderfgoedQuery(term), signal).then(parseWerelderfgoedResults))
      : Promise.resolve<RceMonument[]>([]),
    page === 1
      ? timed("search.gezichten", () => fetchSparql(buildGezichtQuery(term), signal).then(parseGezichtResults))
      : Promise.resolve<RceMonument[]>([]),
    page === 1
      ? timed("search.complexen", () => fetchSparql(buildComplexenQuery(term), signal).then(parseComplexenResults))
      : Promise.resolve<RceMonument[]>([]),
    page === 1
      ? timed("search.onderzoeksgebieden", () => searchArcheologischOnderzoek(term, signal))
      : Promise.resolve<RceMonument[]>([]),
  ]);
  const extras = [...werelderfgoed, ...gezichten, ...complexen, ...onderzoeksgebieden];
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
