import {
  ARCHEOLOGISCHE_CONTEXT_BBOX_PADDING_DEGREES,
  boundingBoxWktLiteral,
  buildActorConceptQuery,
  buildArchaeologyBrowseQuery,
  buildArcheologischeContextExacteQuery,
  buildArcheologischeContextKandidatenQuery,
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
  buildGezichtLidmaatschapQuery,
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
  buildRijksmonumentGeometrieQuery,
  buildGezichtQuery,
  buildRceParcelsQuery,
  buildWerelderfgoedLidmaatschapQuery,
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
  parseArcheologischeContextKandidaten,
  parseArcheologischeContextResults,
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
  parseGezichtLidmaatschapResults,
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
  parseRijksmonumentGeometrieResult,
  parseSparqlResults,
  parseWerelderfgoedLidmaatschapResults,
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
  type ArcheologischeContext,
  type ArcheologischTerrein,
  type ComplexMember,
  type DiscoveryMatch,
  type GezichtLidmaatschap,
  type OpDezeDagCandidate,
  type RceMonument,
  type VondstenConceptField,
  type WerelderfgoedLidmaatschap,
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
//
// Werelderfgoed/Gezicht-lidmaatschap (006-werelderfgoed-ligt-in.md) is
// bewust GEEN achtste enrichment hier: geof:sfWithin tegen alle geladen
// monumenten tegelijk (een VALUES-batch van 25) bleek ~9,7s te kosten -
// veruit boven het budget van deze batch-enrichments. Per rijksmonument
// tegen de kleine, vaste kandidatenset (18 Werelderfgoed + 472 Gezicht) is
// wel snel (~0,3-0,7s), dus dat gebeurt lazy, alleen voor het ene record dat
// een gebruiker daadwerkelijk opent - zie fetchLigtIn hieronder en
// hooks/useSelectedDetailEnrichment.ts, dezelfde aanpak als complexleden.
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

// Zelfde lazy-aanpak als complexleden: pas opgehaald zodra een gebruiker een
// Rijksmonument daadwerkelijk opent, niet vooraf voor elk zoekresultaat (zie
// docs/vertical-slices/006-werelderfgoed-ligt-in.md - de batch-variant van
// deze check, tegen alle 25 geladen resultaten tegelijk, bleek ~9,7s te
// kosten; per record los is elke aanroep ~0,3-0,7s). Twee losse aanroepen in
// plaats van één UNION-query, zie de toelichting bij de query-builders in
// monuments.ts.
export async function fetchLigtIn(monumentNumber: string, signal?: AbortSignal): Promise<{ gezicht: GezichtLidmaatschap[]; werelderfgoed: WerelderfgoedLidmaatschap[] }> {
  const [gezichtDocument, werelderfgoedDocument] = await Promise.all([
    fetchSparql(buildGezichtLidmaatschapQuery(monumentNumber), signal),
    fetchSparql(buildWerelderfgoedLidmaatschapQuery(monumentNumber), signal),
  ]);
  return {
    gezicht: parseGezichtLidmaatschapResults(gezichtDocument),
    werelderfgoed: parseWerelderfgoedLidmaatschapResults(werelderfgoedDocument),
  };
}

// On-demand "ligt dit gebouwde Rijksmonument op archeologie"-check
// (017-archeologische-context-onderzoeksgebied.md). In tegenstelling tot
// fetchLigtIn hierboven is dit BEWUST niet lazy-bij-openen: de bbox-stap
// alleen al kost ~15,4s (112.184 ArcheologischOnderzoeksgebied-instanties,
// geen kleine vaste kandidatenset zoals bij Werelderfgoed/Gezicht), dus dit
// wordt alleen aangeroepen als een gebruiker er expliciet op klikt (zie de
// knop-en-waarschuwing-UX in het plan). Drie stappen, elk een eigen
// SPARQL-round-trip:
//   1. het Rijksmonument-WKT ophalen (nodig voor zowel de bbox als de
//      exacte overlap-toets);
//   2. een goedkope bbox-voorfilter (langere timeout dan de standaard 20s -
//      gemeten 15,4s, dus 40s marge);
//   3. de dure exacte geof:sfOverlaps-toets, maar dan alleen op de kleine,
//      overgebleven kandidatenset uit stap 2 (~0,3-0,8s gemeten).
export async function fetchArcheologischeContext(monumentNumber: string, signal?: AbortSignal): Promise<ArcheologischeContext[]> {
  const rmGeometrieDocument = await fetchSparql(buildRijksmonumentGeometrieQuery(monumentNumber), signal);
  const rmWkt = parseRijksmonumentGeometrieResult(rmGeometrieDocument);
  if (!rmWkt) return [];

  const bboxWkt = boundingBoxWktLiteral(rmWkt, ARCHEOLOGISCHE_CONTEXT_BBOX_PADDING_DEGREES);
  if (!bboxWkt) return [];

  const kandidatenDocument = await fetchSparql(buildArcheologischeContextKandidatenQuery(bboxWkt), signal, undefined, 40_000);
  const kandidaten = parseArcheologischeContextKandidaten(kandidatenDocument);
  if (kandidaten.length === 0) return [];

  // POST: het Rijksmonument-WKT + de kandidaten-VALUES kunnen samen de
  // GET-URL-lengtelimiet raken (414 Request-URI Too Large, live geraakt
  // tijdens het bouwen van deze slice - zie sparql-client.ts).
  const exacteDocument = await fetchSparql(buildArcheologischeContextExacteQuery(rmWkt, kandidaten), signal, undefined, 30_000, "POST");
  return parseArcheologischeContextResults(exacteDocument);
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
  const complexen = parseOnderzoeksgebiedComplexenResults(complexenDocument);
  const resolved = await resolveConcepts(complexen.flatMap((item) => item.type ? [item.type.uri] : []), signal);
  return {
    complexen: complexen.map((item) => ({ ...item, type: item.type ? { ...item.type, ...resolved.get(item.type.uri) } : undefined })),
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
  const branchResults = await runDiscoveryBranches(
    "search.onderzoeksgebieden",
    buildArcheologischOnderzoekDiscoveryQueries(term),
    term,
    parseArcheologischOnderzoekDiscoveryResults,
    signal,
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
//
// Een categorie die hier faalt (bv. een trage RCE-SPARQL-tak) levert stil
// een lege lijst op in plaats van een zichtbare fout - een tekstzoekopdracht
// bestaat uit te veel losse categorieën om bij één hapering de hele
// zoekopdracht te laten mislukken. Zonder de partialFailure-tracker zou de
// route zo'n onvolledig resultaat (bv. "0 resultaten" terwijl het object
// alleen in de gefaalde categorie zat) 5 minuten lang als geldig cachen en
// aan iedereen serveren; zie searchByText/searchRceMonuments en de
// cache-beslissing in app/api/rce/search/route.ts.
export type SearchPartialFailure = { partial: boolean };

async function optionalSearch<T>(event: string, work: () => Promise<T>, fallback: T, signal?: AbortSignal, tracker?: SearchPartialFailure): Promise<T> {
  try {
    return await timed(event, work);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn(JSON.stringify({ event: `${event}.unavailable`, message: error instanceof Error ? error.message : "unknown" }));
    if (tracker) tracker.partial = true;
    return fallback;
  }
}

// Gedeelde mechaniek voor "loop ranked discovery-brontakken af, laat een
// falende tak individueel vallen (warn + drop), faal alleen als ALLE
// aangeroepen takken faalden" (TD-04). Vervangt de losse, bijna-identieke
// kopie die tot nu in 6-7 functies apart stond - waaronder
// searchArcheologischOnderzoek, die daar per ongeluk Promise.all gebruikte
// i.p.v. allSettled: één falende van zijn 3 brontakken liet daardoor de
// hele onderzoeksgebieden-categorie verdwijnen, terwijl de andere takken
// allang klaar waren (bugfix 17-08-2026). `branches.length > 0 &&` sluit
// aan op searchByText's eigen `includeCore && branchResults.length === 0`:
// bij een leeg aangeroepen brontakkenlijst (scope sluit core uit) is dat
// geen falen, gewoon "niets aangeroepen".
async function runDiscoveryBranches(
  event: string,
  branches: { bron: string; query: string }[],
  term: string,
  parse: (document: unknown, bron: string, term: string) => DiscoveryMatch[],
  signal?: AbortSignal,
  tracker?: SearchPartialFailure,
): Promise<DiscoveryMatch[][]> {
  const settled = await Promise.allSettled(
    branches.map(({ bron, query }) => fetchSparql(query, signal).then((document) => parse(document, bron, term))),
  );
  if (signal?.aborted) throw signal.reason;
  const branchResults = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn(JSON.stringify({
      event: `${event}.branch.unavailable`,
      source: branches[index].bron,
      message: result.reason instanceof Error ? result.reason.message : "unknown",
    }));
    if (tracker) tracker.partial = true;
    return [];
  });
  if (branches.length > 0 && branchResults.length === 0) {
    throw settled.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason
      ?? new Error(`Geen ${event}-bron bereikbaar`);
  }
  return branchResults;
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
  const branchResults = await runDiscoveryBranches(
    "search.archeologische-terreinen",
    buildArcheologischTerreinDiscoveryQueries(term),
    term,
    parseArcheologischTerreinDiscoveryResults,
    signal,
  );
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
  const branches = await runDiscoveryBranches(
    "search.vondstlocaties",
    buildVondstlocatieDiscoveryQueries(term),
    term,
    parseVondstlocatieDiscoveryResults,
    signal,
  );
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
  const branches = await runDiscoveryBranches(
    "search.grondsporen",
    buildGrondsporenDiscoveryQueries(term),
    term,
    parseGrondsporenDiscoveryResults,
    signal,
  );
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
  const branches = await runDiscoveryBranches(
    "search.vondsten",
    buildVondstenDiscoveryQueries(term),
    term,
    parseVondstenDiscoveryResults,
    signal,
  );
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
  const branches = await runDiscoveryBranches(
    "search.archeologische-complexen",
    buildArcheologischeComplexDiscoveryQueries(term),
    term,
    parseArcheologischeComplexDiscoveryResults,
    signal,
  );
  return buildArcheologischeComplexenFromDiscovery(mergeDiscoveryMatches(branches).slice(0, 25), signal);
}

export async function searchByArcheologischeComplexTypeConcept(conceptUri: string, signal?: AbortSignal): Promise<RceMonument[]> {
  const document = await fetchSparql(buildArcheologischeComplexConceptQuery(conceptUri), signal);
  const matches = parseConceptSearchMatches(document).map((number) => ({ monumentNumber: number, matchSource: "type archeologisch complex", matchedText: "", matchScore: 0 }));
  return buildArcheologischeComplexenFromDiscovery(matches, signal);
}

export type TextSearchScope = "all" | "core" | "heritage" | "archaeology-a" | "archaeology-b";

async function searchByText(term: string, signal?: AbortSignal, page = 1, scope: TextSearchScope = "all", tracker?: SearchPartialFailure): Promise<RceMonument[]> {
  const includeCore = scope === "all" || scope === "core";
  const discoveryQueries = includeCore ? buildRceDiscoveryQueries(term) : [];
  const branchResults = await timed("search.discovery", () =>
    runDiscoveryBranches("search.discovery", discoveryQueries, term, parseDiscoveryBranchResults, signal, tracker),
  );

  const [werelderfgoed, gezichten, complexen, onderzoeksgebieden, archeologischeTerreinen, vondstlocaties, grondsporen, vondsten, archeologischeComplexen] = await Promise.all([
    page === 1 && (scope === "all" || scope === "heritage")
      ? optionalSearch("search.werelderfgoed", () => fetchSparql(buildWerelderfgoedQuery(term), signal).then(parseWerelderfgoedResults), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "heritage")
      ? optionalSearch("search.gezichten", () => fetchSparql(buildGezichtQuery(term), signal).then(parseGezichtResults), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "heritage")
      ? optionalSearch("search.complexen", () => fetchSparql(buildComplexenQuery(term), signal).then(parseComplexenResults), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-a")
      ? optionalSearch("search.onderzoeksgebieden", () => searchArcheologischOnderzoek(term, signal), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-a")
      ? optionalSearch("search.archeologische-terreinen", () => searchArcheologischeTerreinen(term, signal), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-a")
      ? optionalSearch("search.vondstlocaties", () => searchVondstlocaties(term, signal), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-b")
      ? optionalSearch("search.grondsporen", () => searchGrondsporen(term, signal), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-b")
      ? optionalSearch("search.vondsten", () => searchVondsten(term, signal), [], signal, tracker)
      : Promise.resolve<RceMonument[]>([]),
    page === 1 && (scope === "all" || scope === "archaeology-b")
      ? optionalSearch("search.archeologische-complexen", () => searchArcheologischeComplexen(term, signal), [], signal, tracker)
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

export async function searchRceMonuments(query: string, signal?: AbortSignal, page = 1, scope: TextSearchScope = "all", tracker?: SearchPartialFailure): Promise<RceMonument[]> {
  const trimmed = query.trim();
  // {1,6}, niet {4,6}: sommige rijksmonumentnummers uit vroege registraties
  // zijn korter dan vier cijfers (bv. rijksmonument 20 bestaat echt) - met
  // {4,6} viel zo'n exacte, geldige zoekopdracht stil terug op vrij
  // tekstzoeken op de losse cijfers, met tientallen ongerelateerde
  // resultaten tot gevolg. Ontdekt via een klik op "Vergelijkbare
  // rijksmonumenten" die op zo'n kort nummer uitkwam.
  if (/^\d{1,6}$/.test(trimmed)) {
    // searchByNumber was hier bewust niet via optionalSearch gewrapt (in
    // tegenstelling tot de zes bijvangst-categorieën eronder) - een trage of
    // tijdelijk onbereikbare RCE-tak liet daardoor de hele Promise.all
    // falen, ook als de andere zes allang klaar waren. Live gereproduceerd
    // tijdens verhoogde RCE-latency (securityassessment 17-08-2026).
    const [rijksmonumenten, complexen, terreinen, vondstlocaties, grondsporen, vondsten, archeologischeComplexen] = await Promise.all([
      optionalSearch("search.rijksmonumenten-op-nummer", () => searchByNumber(trimmed, signal), [], signal, tracker),
      optionalSearch("search.complexen", () => fetchSparql(buildComplexenQuery(trimmed), signal)
        .then(parseComplexenResults)
        .then((items) => items.map((item) => ({ ...item, matchSource: "complexnummer", matchedText: trimmed, matchScore: 0 }))), [], signal, tracker),
      optionalSearch("search.archeologische-terreinen", () => searchArcheologischeTerreinen(trimmed, signal), [], signal, tracker),
      optionalSearch("search.vondstlocaties", () => searchVondstlocaties(trimmed, signal), [], signal, tracker),
      optionalSearch("search.grondsporen", () => searchGrondsporen(trimmed, signal), [], signal, tracker),
      optionalSearch("search.vondsten", () => searchVondsten(trimmed, signal), [], signal, tracker),
      optionalSearch("search.archeologische-complexen", () => searchArcheologischeComplexen(trimmed, signal), [], signal, tracker),
    ]);
    return [...rijksmonumenten, ...complexen, ...terreinen, ...vondstlocaties, ...grondsporen, ...vondsten, ...archeologischeComplexen];
  }
  if (!/^\d{4}\s?[A-Za-z]{2}$/.test(trimmed)) return searchByText(trimmed, signal, page, scope, tracker);
  const params = new URLSearchParams({ page: "1", pageSize: "100", postcode: trimmed.replace(/\s/g, "").toUpperCase() });
  const response = await fetch(`${REST_ENDPOINT}?${params}`, {
    headers: { Accept: "application/ld+json" },
    signal: requestSignal(signal),
  });
  if (!response.ok) throw new Error(`RCE-service antwoordde met ${response.status}`);
  return parseRceMonuments(await response.json());
}
