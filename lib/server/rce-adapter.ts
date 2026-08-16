import {
  buildActorConceptQuery,
  buildArchaeologyBrowseQuery,
  buildArcheologischeWaarderingConceptQuery,
  buildArcheologischOnderzoekDetailsQuery,
  buildArcheologischOnderzoekDiscoveryQueries,
  buildArcheologischeComplexConceptQuery,
  buildArcheologischeComplexDetailsQuery,
  buildArcheologischeComplexDiscoveryQueries,
  buildArcheologischTerreinDetailsQuery,
  buildArcheologischTerreinDiscoveryQueries,
  buildArcheologischTerreinQuery,
  buildComplexenQuery,
  buildComplexMembersQuery,
  buildComplexQuery,
  buildGebeurtenisConceptQuery,
  buildFunctieConceptQuery,
  buildGebeurtenissenQuery,
  buildGroenaanlegQuery,
  buildGrondsporenDetailsQuery,
  buildGrondsporenDiscoveryQueries,
  buildGrondspoorTypeConceptQuery,
  buildImageQuery,
  buildBouwkundigeStaatConceptQuery,
  buildMonumentAardConceptQuery,
  buildMonumentTypeConceptQuery,
  buildStijlConceptQuery,
  buildVerwervingConceptQuery,
  buildMspIndicatieQuery,
  buildOnderzoeksgebiedAggregatenQuery,
  buildOnderzoeksgebiedComplexenQuery,
  buildOnderzoeksgebiedVondstlocatiesQuery,
  buildOpDezeDagQuery,
  buildRceChoNumberQuery,
  buildRceDetailsQuery,
  buildRceDiscoveryQueries,
  buildRceFacetsQuery,
  buildRijksmonumentenBrowseQuery,
  buildGezichtQuery,
  buildRceParcelsQuery,
  buildWerelderfgoedQuery,
  buildVondstlocatieDetailsQuery,
  buildVondstlocatieDiscoveryQueries,
  buildVondstlocatieInhoudQuery,
  buildVondstlocatieInhoudTellingQuery,
  buildVondstenConceptQuery,
  buildVondstenDetailsQuery,
  buildVondstenDiscoveryQueries,
  mergeDiscoveryMatches,
  mergeVondstlocatieInhoud,
  parseArcheologischOnderzoekDiscoveryResults,
  parseArcheologischOnderzoekResults,
  parseArchaeologyBrowseNumbers,
  parseArcheologischeComplexDiscoveryResults,
  parseArcheologischeComplexResults,
  parseArcheologischTerreinDiscoveryResults,
  parseArcheologischTerreinResults,
  parseStandaloneArcheologischTerreinResults,
  parseComplexenResults,
  parseComplexMembersResults,
  parseComplexResults,
  parseConceptSearchMatches,
  parseDiscoveryBranchResults,
  parseFacetResults,
  parseGebeurtenissenResults,
  parseGezichtResults,
  parseGroenaanlegResults,
  parseGrondsporenDiscoveryResults,
  parseGrondsporenResults,
  parseImageResults,
  parseMspIndicatieResults,
  parseOnderzoeksgebiedAggregatenResults,
  parseOnderzoeksgebiedComplexenResults,
  parseOnderzoeksgebiedVondstlocatiesResults,
  parseOpDezeDagCandidates,
  parseParcelResults,
  parseRceMonuments,
  parseRijksmonumentenBrowseNumbers,
  parseSparqlResults,
  parseWerelderfgoedResults,
  parseVondstlocatieDiscoveryResults,
  parseVondstlocatieInhoudResults,
  parseVondstlocatieInhoudTelling,
  parseVondstlocatieResults,
  parseVondstenDiscoveryResults,
  parseVondstenResults,
  pickOpDezeDagCandidate,
  pickRandomCandidate,
  VONDSTLOCATIE_INHOUD_KLASSEN,
  type ArcheologischTerrein,
  type ComplexMember,
  type OpDezeDagCandidate,
  type RceMonument,
  type VondstenConceptField,
} from "../rce.ts";
import { fetchLiteratuur } from "./bibliotheek-adapter.ts";
import { resolveConcepts } from "./referentienetwerk-adapter.ts";
import { fetchSparql, requestSignal, timed } from "./sparql-client.ts";

const REST_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run";

type SparqlBinding = Record<string, { value?: string } | undefined>;

// Seven independent enrichment lookups keyed by the monument's own CHO
// subject URI (or, for images/MSP/literatuur, its rijksmonumentnummer -
// that's the join key those graphs themselves use), run in parallel:
// archaeological terrain data (only for monuments with an archaeological
// monumentaard), complex membership, a representative photo, historic
// garden/landscape classification, MSP-aanwijzing, gekoppelde literatuur uit
// de aparte rce/bibliotheek-dataset, en bouwgeschiedenis (heeftGebeurtenis,
// zie 007-bouwgeschiedenis.md) (only relevant for their respective subsets,
// but cheap enough to just ask for all of them). None of these is a
// parallel search - all seven just attach extra facts to Rijksmonument
// records already found.
async function enrichMonuments(monuments: RceMonument[], signal?: AbortSignal): Promise<RceMonument[]> {
  const choUris = monuments.map((monument) => monument.sourceUrl).filter(Boolean);
  if (!choUris.length) return monuments;
  const archaeological = monuments.filter((monument) => monument.monumentNature?.toLocaleLowerCase("nl").includes("archeolog") && monument.sourceUrl);
  const monumentNumbers = monuments.map((monument) => monument.monumentNumber).filter(Boolean);

  const [terreinenByMonument, complexesByMonument, imagesByNumber, groenaanlegByMonument, mspNumbers, literatuurByNumber, gebeurtenissenByMonument] = await Promise.all([
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
    monumentNumbers.length
      ? timed("enrich.literatuur", () => fetchLiteratuur(monumentNumbers, signal))
      : Promise.resolve(new Map<string, RceMonument["literature"]>()),
    timed("enrich.gebeurtenissen", () => fetchSparql(buildGebeurtenissenQuery(choUris), signal).then(parseGebeurtenissenResults)),
  ]);

  return monuments.map((monument) => {
    const archaeologicalSites = terreinenByMonument.get(monument.sourceUrl);
    const complexes = complexesByMonument.get(monument.sourceUrl);
    const image = imagesByNumber.get(monument.monumentNumber);
    const groenaanleg = groenaanlegByMonument.get(monument.sourceUrl);
    const msp = mspNumbers.has(monument.monumentNumber);
    const literature = literatuurByNumber.get(monument.monumentNumber);
    const gebeurtenissen = gebeurtenissenByMonument.get(monument.sourceUrl);
    if (!archaeologicalSites && !complexes && !image && !groenaanleg && !msp && !literature && !gebeurtenissen) return monument;
    return {
      ...monument,
      ...(archaeologicalSites ? { archaeologicalSites } : {}),
      ...(complexes ? { complexes } : {}),
      ...(image ? { image } : {}),
      ...(groenaanleg ? { groenaanleg } : {}),
      ...(msp ? { msp } : {}),
      ...(literature ? { literature } : {}),
      ...(gebeurtenissen ? { gebeurtenissen } : {}),
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

// P1: elk ander objectsoort (complex, archeologisch terrein, vondstlocatie,
// ...) matcht een numerieke zoekopdracht ook op CHO-nummer, niet alleen op
// zijn eigen primaire nummer. Rijksmonumenten deden dat niet: een geldig
// CHO-nummer (bv. "71286") gaf 0 resultaten omdat alleen op
// rijksmonumentnummer werd gezocht. Beide nummers kunnen tegelijk naar
// verschillende, ongerelateerde monumenten wijzen (net als bij de andere
// objectsoorten) - daarom hier expliciet gelabeld via matchSource, in plaats
// van de CHO-nummer-match stilzwijgend te laten samenvallen met de
// rijksmonumentnummer-match.
async function searchByNumber(monumentNumber: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const choDocument = await fetchSparql(buildRceChoNumberQuery(monumentNumber), signal);
  const choMatches = parseSparqlResults(choDocument).map((monument) => monument.monumentNumber);
  const numbers = [...new Set([monumentNumber, ...choMatches])];
  const monuments = await buildMonumentsFromNumbers(numbers, signal);
  return monuments.map((monument) =>
    monument.monumentNumber === monumentNumber
      ? monument
      : { ...monument, matchSource: "CHO-nummer (rijksmonument)", matchedText: monumentNumber },
  );
}

// Exacte conceptzoekopdracht - geen CONTAINS-tekstmatch op een label, maar
// een directe match op de concept-URI waarmee het record zelf (of, voor
// waardering, het gekoppelde ArcheologischTerrein) is geclassificeerd.
// Beide velden leveren dezelfde ?rmnr-vorm op (zie
// buildMonumentAardConceptQuery/buildArcheologischeWaarderingConceptQuery),
// dus delen ze vanaf hier dezelfde afhandeling: rijksmonumentnummers
// opzoeken, dan de gewone detail/percelen/facetten-ophaalslag hergebruiken.
// Ook hergebruikt door fetchOpDezeDag (één vast rijksmonumentnummer in
// plaats van een matchquery-uitkomst) en door searchByNumber hierboven.
async function buildMonumentsFromNumbers(numbers: string[], signal?: AbortSignal): Promise<RceMonument[]> {
  if (!numbers.length) return [];
  const [detailsDocument, parcelsDocument, facetsDocument] = await Promise.all([
    fetchSparql(buildRceDetailsQuery(numbers), signal),
    fetchSparql(buildRceParcelsQuery(numbers), signal),
    fetchSparql(buildRceFacetsQuery(numbers), signal),
  ]);
  const facets = parseFacetResults(facetsDocument);
  const parcelBindings = (parcelsDocument as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const detailsByNumber = new Map(parseSparqlResults(detailsDocument).map((monument) => [monument.monumentNumber, monument]));
  const monuments = numbers.flatMap((number) => {
    const monument = detailsByNumber.get(number);
    if (!monument) return [];
    const parcels = parseParcelResults({ results: { bindings: parcelBindings.filter((binding) => binding.rmnr?.value === monument.monumentNumber) } });
    return [{ ...monument, ...facets.get(monument.monumentNumber), parcels }];
  });
  return enrichMonuments(monuments, signal);
}

async function searchByConceptMatchQuery(matchQuery: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const matchDocument = await fetchSparql(matchQuery, signal);
  const numbers = parseConceptSearchMatches(matchDocument).slice(0, 25);
  return buildMonumentsFromNumbers(numbers, signal);
}

// `conceptUri` is door de aanroepende route al gevalideerd tegen een vaste
// lijst bekende namespaces vóór dit aangeroepen wordt.
export async function searchByMonumentAardConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildMonumentAardConceptQuery(conceptUri), signal);
}

export async function searchByStijlConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildStijlConceptQuery(conceptUri), signal);
}

export async function searchByBouwkundigeStaatConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildBouwkundigeStaatConceptQuery(conceptUri), signal);
}

export async function searchByMonumentTypeConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildMonumentTypeConceptQuery(conceptUri), signal);
}

// Anders dan monumentaard/stijl/bouwkundige staat matcht verwerving op het
// CHO-nummer van een Vondstlocatie, niet op een rijksmonumentnummer -
// searchByConceptMatchQuery (via buildMonumentsFromNumbers) zou die
// nummers dus ten onrechte als rijksmonumentnummer opzoeken. Haalt daarom,
// net als searchVondstlocaties, de Vondstlocatie-eigen detailquery op.
export async function searchByVerwervingConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const document = await fetchSparql(buildVerwervingConceptQuery(conceptUri), signal);
  const numbers = parseConceptSearchMatches(document).slice(0, 25);
  if (!numbers.length) return [];
  const details = await fetchSparql(buildVondstlocatieDetailsQuery(numbers), signal);
  return parseVondstlocatieResults(details);
}

// Matcht op het eigen CHO-nummer van het Archeologisch terrein, niet op een
// gekoppeld rijksmonumentnummer (zie de toelichting bij
// buildArcheologischeWaarderingConceptQuery: slechts ~14% van de terreinen
// met een waardering heeft zo'n koppeling). Haalt daarom de terrein-eigen
// detailquery op, net als searchByVerwervingConcept voor Vondstlocatie.
export async function searchByArcheologischeWaarderingConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const document = await fetchSparql(buildArcheologischeWaarderingConceptQuery(conceptUri), signal);
  const numbers = parseConceptSearchMatches(document).slice(0, 25);
  if (!numbers.length) return [];
  const details = await fetchSparql(buildArcheologischTerreinDetailsQuery(numbers), signal);
  return parseStandaloneArcheologischTerreinResults(details);
}

// Matcht op het eigen CHO-nummer van het grondspoor, zelfde patroon als
// verwerving/waardering hierboven.
export async function searchByGrondspoorTypeConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const document = await fetchSparql(buildGrondspoorTypeConceptQuery(conceptUri), signal);
  const numbers = parseConceptSearchMatches(document).slice(0, 25);
  if (!numbers.length) return [];
  const details = await fetchSparql(buildGrondsporenDetailsQuery(numbers), signal);
  return parseGrondsporenResults(details);
}

export async function searchByGebeurtenisConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildGebeurtenisConceptQuery(conceptUri), signal);
}

export async function searchByActorConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildActorConceptQuery(conceptUri), signal);
}

// Gedeeld door fetchOpDezeDag en fetchVerrasMe: beide proberen een paar
// maand-dagen met buildOpDezeDagQuery af (niet elke dag heeft een gebouwd
// monument met afbeelding) en verschillen alleen in hoe de volgende
// maand-dag wordt gekozen (kalenderdag terugtellend vs. willekeurig) en hoe
// een kandidaat uit de resultaten wordt gekozen (dag-deterministisch vs.
// willekeurig).
async function findMonumentWithImage(
  maxAttempts: number,
  nextMaandDag: (attempt: number) => string,
  pickCandidate: (candidates: OpDezeDagCandidate[]) => string | undefined,
  signal?: AbortSignal,
): Promise<RceMonument | undefined> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const maandDag = nextMaandDag(attempt);
    const candidatesDocument = await fetchSparql(buildOpDezeDagQuery(maandDag), signal);
    const candidates = parseOpDezeDagCandidates(candidatesDocument);
    const chosen = pickCandidate(candidates);
    if (!chosen) continue;
    const [monument] = await buildMonumentsFromNumbers([chosen], signal);
    if (monument?.image?.url) return monument;
  }

  return undefined;
}

// "Op deze dag" (docs/vertical-slices/010-op-deze-dag.md): één
// gebouwd Rijksmonument dat op de huidige kalenderdag is ingeschreven in het
// Monumentenregister en een gekoppelde afbeelding heeft. `now` is optioneel
// injecteerbaar voor tests - zonder argument wordt de echte serverklok
// gebruikt.
export async function fetchOpDezeDag(signal?: AbortSignal, now: Date = new Date()): Promise<RceMonument | undefined> {
  const utcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((utcDay - startOfYear) / 86_400_000) + 1;

  // Niet iedere kalenderdag heeft een gebouwd monument met beeld. Zoek dan
  // maximaal een week terug, zodat de ontdekfunctie zichtbaar blijft zonder
  // de inhoudelijke eis "gebouwd én met afbeelding" los te laten.
  return findMonumentWithImage(
    8,
    (daysBack) => {
      const candidateDay = new Date(utcDay - daysBack * 86_400_000);
      return `${String(candidateDay.getUTCMonth() + 1).padStart(2, "0")}-${String(candidateDay.getUTCDate()).padStart(2, "0")}`;
    },
    (candidates) => pickOpDezeDagCandidate(candidates, dayOfYear),
    signal,
  );
}

const VERRAS_ME_ATTEMPTS = 7;

// Elk kalenderjaar heeft dezelfde maandlengtes, behalve februari. 2024 is een
// schrikkeljaar, dus "dagen in de maand" hieronder klopt voor elke maand
// inclusief 29 februari - zonder dat er een echt jaartal bij hoeft (`maandDag`
// bevat toch geen jaartal).
const LEAP_YEAR_FOR_MONTH_LENGTHS = 2024;

function randomMaandDag(): string {
  const month = 1 + Math.floor(Math.random() * 12);
  const daysInMonth = new Date(Date.UTC(LEAP_YEAR_FOR_MONTH_LENGTHS, month, 0)).getUTCDate();
  const day = 1 + Math.floor(Math.random() * daysInMonth);
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// "Verras me" (docs/vertical-slices/014-verras-me.md): op klik, geen
// idle-load. Hergebruikt buildOpDezeDagQuery met een willekeurige maand-dag
// in plaats van vandaag, en pickRandomCandidate in plaats van de
// dagelijks-deterministische keuze - zo blijft de query dezelfde als "Op
// deze dag" (gebouwd Rijksmonument met afbeelding), maar is de uitkomst per
// aanroep anders. Niet elke maand-dag heeft kandidaten; zoals bij "Op deze
// dag" wordt daarom een paar keer een andere maand-dag geprobeerd.
export async function fetchVerrasMe(signal?: AbortSignal): Promise<RceMonument | undefined> {
  return findMonumentWithImage(VERRAS_ME_ATTEMPTS, randomMaandDag, pickRandomCandidate, signal);
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
async function optionalSearch<T>(event: string, work: () => Promise<T>, fallback: T, signal?: AbortSignal): Promise<T> {
  try {
    return await timed(event, work);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn(JSON.stringify({ event: `${event}.unavailable`, message: error instanceof Error ? error.message : "unknown" }));
    return fallback;
  }
}

export async function searchByFunctieConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  return searchByConceptMatchQuery(buildFunctieConceptQuery(conceptUri), signal);
}

export async function fetchVondstlocatieInhoud(locatieUri: string, signal?: AbortSignal) {
  // Elke klasse (ArcheologischComplex/Grondsporen/Vondsten) krijgt zijn eigen
  // query en eigen LIMIT, zodat een vondstlocatie met veel complexen of
  // grondsporen niet de vondsten kan verdringen - zie de toelichting bij
  // buildVondstlocatieInhoudQuery.
  const [klasseDocuments, tellingDocument] = await Promise.all([
    Promise.all(VONDSTLOCATIE_INHOUD_KLASSEN.map((klasse) => fetchSparql(buildVondstlocatieInhoudQuery(locatieUri, klasse), signal))),
    fetchSparql(buildVondstlocatieInhoudTellingQuery(locatieUri), signal),
  ]);
  const inhoud = mergeVondstlocatieInhoud(klasseDocuments.map((document) => parseVondstlocatieInhoudResults(document)));
  const conceptUris = [
    ...inhoud.complexen.flatMap((item) => item.type ? [item.type.uri] : []),
    ...inhoud.vondsten.flatMap((item) => [...item.types, ...item.materialen, ...item.stijlen, ...(item.toestand ? [item.toestand] : [])].map((concept) => concept.uri)),
    ...inhoud.grondsporen.flatMap((item) => item.type ? [item.type.uri] : []),
  ];
  const resolved = await resolveConcepts(conceptUris, signal);
  const enrichConcept = <T extends { uri: string; label: string }>(concept: T): T & { schemeUri?: string; schemeLabel?: string } => ({ ...concept, ...resolved.get(concept.uri) });
  return {
    complexen: inhoud.complexen.map((item) => ({ ...item, type: item.type ? enrichConcept(item.type) : undefined })),
    vondsten: inhoud.vondsten.map((item) => ({ ...item, types: item.types.map(enrichConcept), materialen: item.materialen.map(enrichConcept), stijlen: item.stijlen.map(enrichConcept), toestand: item.toestand ? enrichConcept(item.toestand) : undefined })),
    grondsporen: inhoud.grondsporen.map((item) => ({ ...item, type: item.type ? enrichConcept(item.type) : undefined })),
    ...parseVondstlocatieInhoudTelling(tellingDocument),
  };
}

async function searchArcheologischeTerreinen(term: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const queries = buildArcheologischTerreinDiscoveryQueries(term);
  const settled = await Promise.allSettled(
    queries.map(({ bron, query }) =>
      fetchSparql(query, signal).then((document) => parseArcheologischTerreinDiscoveryResults(document, bron, term)),
    ),
  );
  if (signal?.aborted) throw signal.reason;
  const branchResults = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({ event: "search.archeologische-terreinen.branch.unavailable", source: queries[index].bron, message: result.reason instanceof Error ? result.reason.message : "unknown" }));
    return [];
  });
  if (!branchResults.length) throw settled.find((result) => result.status === "rejected")?.reason ?? new Error("Geen terreinzoekbron bereikbaar");
  const discovery = mergeDiscoveryMatches(branchResults).slice(0, 25);
  if (!discovery.length) return [];
  const detailsDocument = await fetchSparql(buildArcheologischTerreinDetailsQuery(discovery.map((match) => match.monumentNumber)), signal);
  const detailsByNumber = new Map(parseStandaloneArcheologischTerreinResults(detailsDocument).map((item) => [item.choNumber, item]));
  return discovery.flatMap((match) => {
    const item = detailsByNumber.get(match.monumentNumber);
    return item ? [{ ...item, ...match, monumentNumber: item.monumentNumber }] : [];
  });
}

async function searchVondstlocaties(term: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const queries = buildVondstlocatieDiscoveryQueries(term);
  const settled = await Promise.allSettled(queries.map(({ bron, query }) =>
    fetchSparql(query, signal).then((document) => parseVondstlocatieDiscoveryResults(document, bron, term)),
  ));
  if (signal?.aborted) throw signal.reason;
  const branches = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({ event: "search.vondstlocaties.branch.unavailable", source: queries[index].bron, message: result.reason instanceof Error ? result.reason.message : "unknown" }));
    return [];
  });
  if (!branches.length) throw settled.find((result) => result.status === "rejected")?.reason ?? new Error("Geen vondstlocatiezoekbron bereikbaar");
  const discovery = mergeDiscoveryMatches(branches).slice(0, 25);
  if (!discovery.length) return [];
  const details = await fetchSparql(buildVondstlocatieDetailsQuery(discovery.map((match) => match.monumentNumber)), signal);
  const byNumber = new Map(parseVondstlocatieResults(details).map((item) => [item.choNumber, item]));
  return discovery.flatMap((match) => {
    const item = byNumber.get(match.monumentNumber);
    return item ? [{ ...item, ...match, monumentNumber: item.monumentNumber }] : [];
  });
}

async function searchGrondsporen(term: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const queries = buildGrondsporenDiscoveryQueries(term);
  const settled = await Promise.allSettled(queries.map(({ bron, query }) =>
    fetchSparql(query, signal).then((document) => parseGrondsporenDiscoveryResults(document, bron, term)),
  ));
  if (signal?.aborted) throw signal.reason;
  const branches = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({ event: "search.grondsporen.branch.unavailable", source: queries[index].bron, message: result.reason instanceof Error ? result.reason.message : "unknown" }));
    return [];
  });
  if (!branches.length) throw settled.find((result) => result.status === "rejected")?.reason ?? new Error("Geen grondspoorzoekbron bereikbaar");
  const discovery = mergeDiscoveryMatches(branches).slice(0, 25);
  if (!discovery.length) return [];
  const details = await fetchSparql(buildGrondsporenDetailsQuery(discovery.map((match) => match.monumentNumber)), signal);
  const records = parseGrondsporenResults(details);
  const resolved = await resolveConcepts(records.flatMap((item) => item.archaeologicalTypeConceptUri ? [item.archaeologicalTypeConceptUri] : []), signal);
  const byNumber = new Map(records.map((item) => {
    const concept = item.archaeologicalTypeConceptUri ? resolved.get(item.archaeologicalTypeConceptUri) : undefined;
    return [item.choNumber, { ...item, archaeologicalType: concept?.label ?? item.archaeologicalType, archaeologicalTypeSchemes: concept?.schemes }];
  }));
  return discovery.flatMap((match) => {
    const item = byNumber.get(match.monumentNumber);
    return item ? [{ ...item, ...match, monumentNumber: item.monumentNumber }] : [];
  });
}

async function enrichVondstenConcepts(records: RceMonument[], signal?: AbortSignal) {
  const concepts = records.flatMap((item) => [
    ...(item.archaeologicalFindTypes ?? []),
    ...(item.archaeologicalMaterials ?? []),
    ...(item.archaeologicalStyles ?? []),
    ...(item.archaeologicalCondition ? [item.archaeologicalCondition] : []),
  ]);
  const resolved = await resolveConcepts(concepts.map((concept) => concept.uri), signal);
  const enrich = <T extends { uri: string; label: string }>(concept: T) => ({ ...concept, ...resolved.get(concept.uri) });
  return records.map((item) => ({
    ...item,
    archaeologicalFindTypes: item.archaeologicalFindTypes?.map(enrich),
    archaeologicalMaterials: item.archaeologicalMaterials?.map(enrich),
    archaeologicalStyles: item.archaeologicalStyles?.map(enrich),
    archaeologicalCondition: item.archaeologicalCondition ? enrich(item.archaeologicalCondition) : undefined,
  }));
}

async function buildVondstenFromDiscovery(discovery: ReturnType<typeof mergeDiscoveryMatches>, signal?: AbortSignal) {
  if (!discovery.length) return [];
  const details = await fetchSparql(buildVondstenDetailsQuery(discovery.map((match) => match.monumentNumber)), signal);
  const records = await enrichVondstenConcepts(parseVondstenResults(details), signal);
  const byNumber = new Map(records.map((item) => [item.choNumber, item]));
  return discovery.flatMap((match) => {
    const item = byNumber.get(match.monumentNumber);
    return item ? [{ ...item, ...match, monumentNumber: item.monumentNumber }] : [];
  });
}

async function searchVondsten(term: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const queries = buildVondstenDiscoveryQueries(term);
  const settled = await Promise.allSettled(queries.map(({ bron, query }) =>
    fetchSparql(query, signal).then((document) => parseVondstenDiscoveryResults(document, bron, term)),
  ));
  if (signal?.aborted) throw signal.reason;
  const branches = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({ event: "search.vondsten.branch.unavailable", source: queries[index].bron, message: result.reason instanceof Error ? result.reason.message : "unknown" }));
    return [];
  });
  if (!branches.length) throw settled.find((result) => result.status === "rejected")?.reason ?? new Error("Geen vondstzoekbron bereikbaar");
  return buildVondstenFromDiscovery(mergeDiscoveryMatches(branches).slice(0, 25), signal);
}

export async function searchByVondstenConcept(conceptUri: string, field: VondstenConceptField, signal?: AbortSignal): Promise<RceMonument[]> {
  const document = await fetchSparql(buildVondstenConceptQuery(conceptUri, field), signal);
  const matches = parseConceptSearchMatches(document).map((number) => ({ monumentNumber: number, matchSource: field === "vondsttype" ? "type vondst" : field === "materiaal" ? "materiaal vondst" : "toestand vondst", matchedText: "", matchScore: 0 }));
  return buildVondstenFromDiscovery(matches, signal);
}

async function buildArcheologischeComplexenFromDiscovery(discovery: ReturnType<typeof mergeDiscoveryMatches>, signal?: AbortSignal) {
  if (!discovery.length) return [];
  const details = await fetchSparql(buildArcheologischeComplexDetailsQuery(discovery.map((match) => match.monumentNumber)), signal);
  const records = parseArcheologischeComplexResults(details);
  const resolved = await resolveConcepts(records.flatMap((item) => item.archaeologicalComplexType ? [item.archaeologicalComplexType.uri] : []), signal);
  const byNumber = new Map(records.map((item) => [item.choNumber, {
    ...item,
    archaeologicalComplexType: item.archaeologicalComplexType ? { ...item.archaeologicalComplexType, ...resolved.get(item.archaeologicalComplexType.uri) } : undefined,
  }]));
  return discovery.flatMap((match) => {
    const item = byNumber.get(match.monumentNumber);
    return item ? [{ ...item, ...match, monumentNumber: item.monumentNumber }] : [];
  });
}

async function searchArcheologischeComplexen(term: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const queries = buildArcheologischeComplexDiscoveryQueries(term);
  const settled = await Promise.allSettled(queries.map(({ bron, query }) => fetchSparql(query, signal).then((document) => parseArcheologischeComplexDiscoveryResults(document, bron, term))));
  if (signal?.aborted) throw signal.reason;
  const branches = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({ event: "search.archeologische-complexen.branch.unavailable", source: queries[index].bron, message: result.reason instanceof Error ? result.reason.message : "unknown" }));
    return [];
  });
  if (!branches.length) throw settled.find((result) => result.status === "rejected")?.reason ?? new Error("Geen archeologisch-complexzoekbron bereikbaar");
  return buildArcheologischeComplexenFromDiscovery(mergeDiscoveryMatches(branches).slice(0, 25), signal);
}

export async function searchByArcheologischeComplexTypeConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const document = await fetchSparql(buildArcheologischeComplexConceptQuery(conceptUri), signal);
  const matches = parseConceptSearchMatches(document).map((number) => ({ monumentNumber: number, matchSource: "type archeologisch complex", matchedText: "", matchScore: 0 }));
  return buildArcheologischeComplexenFromDiscovery(matches, signal);
}

export type TextSearchScope = "all" | "core" | "heritage" | "archaeology-a" | "archaeology-b";

async function searchByText(term: string, signal?: AbortSignal, page = 1, scope: TextSearchScope = "all"): Promise<RceMonument[]> {
  const includeCore = scope === "all" || scope === "core";
  const discoveryQueries = includeCore ? buildRceDiscoveryQueries(term) : [];
  const discoverySettled = await timed("search.discovery", () => Promise.allSettled(
    discoveryQueries.map(({ bron, query }) =>
      fetchSparql(query, signal).then((document) => parseDiscoveryBranchResults(document, bron, term)),
    ),
  ));
  if (signal?.aborted) throw signal.reason;
  const branchResults = discoverySettled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({ event: "search.discovery.branch.unavailable", source: discoveryQueries[index].bron, message: result.reason instanceof Error ? result.reason.message : "unknown" }));
    return [];
  });
  if (includeCore && branchResults.length === 0) {
    const firstFailure = discoverySettled.find((result) => result.status === "rejected");
    throw firstFailure?.reason ?? new Error("Geen zoekbron bereikbaar");
  }

  const [werelderfgoed, gezichten, complexen, onderzoeksgebieden, archeologischeTerreinen, vondstlocaties, grondsporen, vondsten, archeologischeComplexen] = await Promise.all([
    page === 1 && (scope === "all" || scope === "heritage")
      ? optionalSearch("search.werelderfgoed", () => fetchSparql(buildWerelderfgoedQuery(term), signal).then(parseWerelderfgoedResults), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "heritage")
      ? optionalSearch("search.gezichten", () => fetchSparql(buildGezichtQuery(term), signal).then(parseGezichtResults), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "heritage")
      ? optionalSearch("search.complexen", () => fetchSparql(buildComplexenQuery(term), signal).then(parseComplexenResults), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-a")
      ? optionalSearch("search.onderzoeksgebieden", () => searchArcheologischOnderzoek(term, signal), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-a")
      ? optionalSearch("search.archeologische-terreinen", () => searchArcheologischeTerreinen(term, signal), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-a")
      ? optionalSearch("search.vondstlocaties", () => searchVondstlocaties(term, signal), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-b")
      ? optionalSearch("search.grondsporen", () => searchGrondsporen(term, signal), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-b")
      ? optionalSearch("search.vondsten", () => searchVondsten(term, signal), [], signal)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-b")
      ? optionalSearch("search.archeologische-complexen", () => searchArcheologischeComplexen(term, signal), [], signal)
      : Promise.resolve<RceMonument[]>([]),
  ]);
  const extras = [...werelderfgoed, ...gezichten, ...complexen, ...onderzoeksgebieden, ...archeologischeTerreinen, ...vondstlocaties, ...grondsporen, ...vondsten, ...archeologischeComplexen];
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
export async function browseRceObjects(kind: "rijksmonument" | "archeologischterrein" | "onderzoeksgebied" | "vondstlocatie" | "archeologischcomplex" | "vondsten" | "grondsporen" | "werelderfgoed" | "gezicht" | "complex", signal?: AbortSignal, page = 1): Promise<RceMonument[]> {
  if (kind === "rijksmonument") {
    const numbers = parseRijksmonumentenBrowseNumbers(
      await fetchSparql(buildRijksmonumentenBrowseQuery(page), signal),
    );
    if (!numbers.length) return [];
    const [detailsDocument, parcelsDocument, facetsDocument] = await Promise.all([
      fetchSparql(buildRceDetailsQuery(numbers), signal),
      fetchSparql(buildRceParcelsQuery(numbers), signal),
      fetchSparql(buildRceFacetsQuery(numbers), signal),
    ]);
    const facets = parseFacetResults(facetsDocument);
    const parcelBindings = (parcelsDocument as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
    const detailsByNumber = new Map(parseSparqlResults(detailsDocument).map((monument) => [monument.monumentNumber, monument]));
    const monuments = numbers.flatMap((number) => {
      const monument = detailsByNumber.get(number);
      if (!monument) return [];
      const parcels = parseParcelResults({ results: { bindings: parcelBindings.filter((binding) => binding.rmnr?.value === number) } });
      return [{ ...monument, ...facets.get(number), parcels }];
    });
    return enrichMonuments(monuments, signal);
  }
  if (kind === "archeologischterrein" || kind === "onderzoeksgebied" || kind === "vondstlocatie" || kind === "archeologischcomplex" || kind === "vondsten" || kind === "grondsporen") {
    const numbers = parseArchaeologyBrowseNumbers(
      await fetchSparql(buildArchaeologyBrowseQuery(kind, page), signal),
    );
    if (!numbers.length) return [];
    if (kind === "archeologischterrein") {
      return fetchSparql(buildArcheologischTerreinDetailsQuery(numbers), signal)
        .then(parseStandaloneArcheologischTerreinResults);
    }
    if (kind === "onderzoeksgebied") {
      return fetchSparql(buildArcheologischOnderzoekDetailsQuery(numbers), signal)
        .then(parseArcheologischOnderzoekResults);
    }
    if (kind === "vondstlocatie") {
      return fetchSparql(buildVondstlocatieDetailsQuery(numbers), signal)
        .then(parseVondstlocatieResults);
    }
    if (kind === "vondsten") {
      return enrichVondstenConcepts(
        parseVondstenResults(await fetchSparql(buildVondstenDetailsQuery(numbers), signal)),
        signal,
      );
    }
    if (kind === "grondsporen") {
      const records = parseGrondsporenResults(
        await fetchSparql(buildGrondsporenDetailsQuery(numbers), signal),
      );
      const resolved = await resolveConcepts(
        records.flatMap((item) => item.archaeologicalTypeConceptUri ? [item.archaeologicalTypeConceptUri] : []),
        signal,
      );
      return records.map((item) => {
        const concept = item.archaeologicalTypeConceptUri
          ? resolved.get(item.archaeologicalTypeConceptUri)
          : undefined;
        return {
          ...item,
          archaeologicalType: concept?.label ?? item.archaeologicalType,
          archaeologicalTypeSchemes: concept?.schemes,
        };
      });
    }
    const records = parseArcheologischeComplexResults(
      await fetchSparql(buildArcheologischeComplexDetailsQuery(numbers), signal),
    );
    const resolved = await resolveConcepts(
      records.flatMap((item) => item.archaeologicalComplexType ? [item.archaeologicalComplexType.uri] : []),
      signal,
    );
    return records.map((item) => ({
      ...item,
      archaeologicalComplexType: item.archaeologicalComplexType
        ? { ...item.archaeologicalComplexType, ...resolved.get(item.archaeologicalComplexType.uri) }
        : undefined,
    }));
  }
  if (kind === "werelderfgoed") return fetchSparql(buildWerelderfgoedQuery(""), signal).then(parseWerelderfgoedResults);
  if (kind === "gezicht") return fetchSparql(buildGezichtQuery(""), signal).then(parseGezichtResults);
  return fetchSparql(buildComplexenQuery(""), signal).then(parseComplexenResults);
}

export async function searchRceMonuments(query: string, signal?: AbortSignal, page = 1, scope: TextSearchScope = "all"): Promise<RceMonument[]> {
  const trimmed = query.trim();
  // {1,6}, niet {4,6}: sommige rijksmonumentnummers uit vroege registraties
  // zijn korter dan vier cijfers (bv. rijksmonument 20 bestaat echt) - met
  // {4,6} viel zo'n exacte, geldige zoekopdracht stil terug op vrij
  // tekstzoeken op de losse cijfers, met tientallen ongerelateerde
  // resultaten tot gevolg. Ontdekt via een klik op "Vergelijkbare
  // rijksmonumenten" die op zo'n kort nummer uitkwam.
  if (/^\d{1,6}$/.test(trimmed)) {
    const [rijksmonumenten, complexen, terreinen, vondstlocaties, grondsporen, vondsten, archeologischeComplexen] = await Promise.all([
      searchByNumber(trimmed, signal),
      optionalSearch("search.complexen", () => fetchSparql(buildComplexenQuery(trimmed), signal)
        .then(parseComplexenResults)
        .then((items) => items.map((item) => ({ ...item, matchSource: "complexnummer", matchedText: trimmed, matchScore: 0 }))), [], signal),
      optionalSearch("search.archeologische-terreinen", () => searchArcheologischeTerreinen(trimmed, signal), [], signal),
      optionalSearch("search.vondstlocaties", () => searchVondstlocaties(trimmed, signal), [], signal),
      optionalSearch("search.grondsporen", () => searchGrondsporen(trimmed, signal), [], signal),
      optionalSearch("search.vondsten", () => searchVondsten(trimmed, signal), [], signal),
      optionalSearch("search.archeologische-complexen", () => searchArcheologischeComplexen(trimmed, signal), [], signal),
    ]);
    return [...rijksmonumenten, ...complexen, ...terreinen, ...vondstlocaties, ...grondsporen, ...vondsten, ...archeologischeComplexen];
  }
  if (!/^\d{4}\s?[A-Za-z]{2}$/.test(trimmed)) return searchByText(trimmed, signal, page, scope);
  const params = new URLSearchParams({ page: "1", pageSize: "100", postcode: trimmed.replace(/\s/g, "").toUpperCase() });
  const response = await fetch(`${REST_ENDPOINT}?${params}`, {
    headers: { Accept: "application/ld+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE-service antwoordde met ${response.status}`);
  return parseRceMonuments(await response.json());
}
