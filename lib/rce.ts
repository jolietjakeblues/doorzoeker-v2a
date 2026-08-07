const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const RM_TYPE = `${CEO}Rijksmonument`;
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const WERELDERFGOED_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/werelderfgoed_hvdl";
const GEZICHT_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/gezicht_hvdl";
const RIJKSMONUMENT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864";
const GEZICHT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/fd968529-bf70-4afa-8564-7c6c2fcfcc54";

export const RCE_SEMANTICS = Object.freeze({
  instancesGraph: INSTANCES_GRAPH,
  activeLegalStatus: RIJKSMONUMENT_STATUS,
  formalStatementRequiredFor: ["oorspronkelijke functie", "huidige functie", "formele omschrijving"],
  ranking: ["oorspronkelijke functie", "huidige functie", "type", "monumentaard", "formele omschrijving", "woonplaats"],
});

// BRK provinciecode -> volledige naam. CBS-provinciecodes, niet als SKOS-concept
// in de dataset aanwezig, dus hier vast opgeslagen in plaats van opgezocht.
export const PROVINCE_NAMES: Record<string, string> = {
  DR: "Drenthe",
  FL: "Flevoland",
  FR: "Friesland",
  GE: "Gelderland",
  GR: "Groningen",
  LI: "Limburg",
  NB: "Noord-Brabant",
  NH: "Noord-Holland",
  OV: "Overijssel",
  UT: "Utrecht",
  ZL: "Zeeland",
  ZH: "Zuid-Holland",
};

export function provinceName(code?: string): string | undefined {
  return code ? PROVINCE_NAMES[code] ?? code : undefined;
}

type JsonLdValue = { "@id"?: string; "@value"?: string };
type JsonLdNode = Record<string, unknown> & { "@id": string; "@type"?: string[] };

export type RceMonument = {
  choNumber: string;
  monumentNumber: string;
  registrationDate: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  sourceUrl: string;
  name?: string;
  functionName?: string;
  originalFunctionNames?: string[];
  currentFunctionNames?: string[];
  typeNames?: string[];
  legalStatus?: string;
  description?: string;
  monumentNature?: string;
  fullAddress?: string;
  place?: string;
  municipality?: string;
  provinceCode?: string;
  lat?: number;
  lng?: number;
  wkt?: string;
  parcels?: RceParcel[];
  matchSource?: string;
  matchedText?: string;
  matchScore?: number;
  archaeologicalSites?: ArcheologischTerrein[];
  complexes?: ComplexMembership[];
  officialUrl?: string;
};

export type RceParcel = {
  municipality: string;
  municipalityCode: string;
  section: string;
  parcelNumber: string;
  provinceCode: string;
};

type SparqlBinding = Record<string, { value?: string }>;

export type DiscoveryMatch = { monumentNumber: string; matchSource: string; matchedText: string; matchScore: number };

function escapeSparqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

// Each discovery source runs as its own SPARQL query. A single query that UNIONs
// all six sources together (with a shared FILTER/ORDER BY) makes Virtuoso build
// and sort one enormous intermediate result across a 58M-triple graph, which
// reliably times out. Per-source queries are simple, fast (each source alone
// resolves in well under a second), and let us do the scoring/merge/pagination
// in JS instead of relying on the query planner to do it efficiently.
const DISCOVERY_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "oorspronkelijke functie", rang: 1, pattern: "?cho ceo:heeftOorspronkelijkeFunctie ?functieNode .\n    ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?match ." },
  { bron: "huidige functie", rang: 2, pattern: "?cho ceo:heeftHuidigeFunctie ?functieNode .\n    ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?match ." },
  { bron: "type", rang: 3, pattern: "?cho ceo:heeftType/ceo:heeftTypeNaam/skos:prefLabel ?match ." },
  { bron: "monumentaard", rang: 4, pattern: "?cho ceo:heeftMonumentAard/skos:prefLabel ?match ." },
  { bron: "formele omschrijving", rang: 5, pattern: "?cho ceo:heeftOmschrijving ?omschrijvingNode .\n    ?omschrijvingNode ceo:omschrijving ?match ; ceo:formeelStandpunt true ." },
  { bron: "woonplaats", rang: 6, pattern: "?cho ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
];

export function buildRceDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return DISCOVERY_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?rmnr ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ;
       ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
  ${pattern}
  FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))
 }
}
LIMIT 100`,
  }));
}

export function parseDiscoveryBranchResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = DISCOVERY_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
  const needle = term.trim().toLocaleLowerCase("nl");
  return bindings.flatMap((binding) => {
    const monumentNumber = binding.rmnr?.value ?? "";
    const matchedText = binding.match?.value ?? "";
    if (!monumentNumber) return [];
    const lowerMatch = matchedText.toLocaleLowerCase("nl");
    const matchtype = lowerMatch === needle ? 0 : lowerMatch.startsWith(needle) ? 1 : 2;
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: rang * 10 + matchtype }];
  });
}

export function mergeDiscoveryMatches(resultsPerSource: DiscoveryMatch[][]): DiscoveryMatch[] {
  const matches = new Map<string, DiscoveryMatch>();
  for (const candidates of resultsPerSource) {
    for (const candidate of candidates) {
      const current = matches.get(candidate.monumentNumber);
      if (!current || candidate.matchScore < current.matchScore) matches.set(candidate.monumentNumber, candidate);
    }
  }
  return [...matches.values()].sort((a, b) =>
    a.matchScore - b.matchScore || a.matchedText.localeCompare(b.matchedText, "nl") || a.monumentNumber.localeCompare(b.monumentNumber),
  );
}

// RCE geeft geometrie als Point, Polygon of MultiPolygon WKT, bv.
// "Point (lng lat)" of "Polygon ((lng lat, lng lat, ...))" - met een spatie
// voor de haakjes. Archeologische terreinen zijn vrijwel altijd een
// (Multi)Polygon; die kregen zonder deze fallback nooit een kaartmarker,
// ook al had RCE de geometrie gewoon geleverd. Voor een marker is geen
// exacte centroid nodig: het gemiddelde van alle coördinaatparen in de
// (multi)polygon geeft een punt middenin de vorm, precies genoeg om op de
// kaart te tonen.
function wktToLatLng(wkt: string): { lat: number; lng: number } | undefined {
  const point = /POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i.exec(wkt);
  if (point) return { lng: Number(point[1]), lat: Number(point[2]) };
  const pairs = [...wkt.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  if (!pairs.length) return undefined;
  const lng = pairs.reduce((sum, [, lngValue]) => sum + Number(lngValue), 0) / pairs.length;
  const lat = pairs.reduce((sum, [, , latValue]) => sum + Number(latValue), 0) / pairs.length;
  return { lat, lng };
}

export function parseSparqlResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const wkt = binding.wkt?.value ?? "";
    const coordinates = wktToLatLng(wkt);
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.rmnr?.value ?? "",
      registrationDate: binding.inschrijving?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: binding.postcode?.value ?? "",
      sourceUrl: binding.cho?.value ?? "",
      name: binding.naam?.value,
      functionName: binding.functie?.value,
      originalFunctionNames: binding.oorspronkelijkeFuncties?.value?.split("||").filter(Boolean) ?? [],
      currentFunctionNames: binding.huidigeFuncties?.value?.split("||").filter(Boolean) ?? [],
      typeNames: binding.typen?.value?.split("||").filter(Boolean) ?? [],
      legalStatus: binding.juridischeStatus?.value ?? "rijksmonument",
      description: binding.omschrijving?.value,
      monumentNature: binding.monumentaard?.value,
      fullAddress: binding.volledigAdres?.value,
      // Archeologische terreinen hebben doorgaans geen BAG-relatie (geen
      // adres), maar wel een BRK-relatie (kadastraal perceel) met een
      // gemeentenaam. Val daarop terug zodat deze records ook een plaats
      // tonen in plaats van "Adres niet opgenomen" zonder locatie.
      place: binding.woonplaats?.value || binding.gemeente?.value,
      municipality: binding.gemeente?.value,
      provinceCode: binding.provinciecode?.value,
      lng: coordinates?.lng,
      lat: coordinates?.lat,
      wkt: wkt || undefined,
    };
  });
}

export function parseParcelResults(document: unknown): RceParcel[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => ({
    municipality: binding.gemeente?.value ?? "",
    municipalityCode: binding.gemeentecode?.value ?? "",
    section: binding.sectie?.value ?? "",
    parcelNumber: binding.perceel?.value ?? "",
    provinceCode: binding.provinciecode?.value ?? "",
  }));
}

export function buildRceDetailsQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?cho ?choi ?rmnr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?functieValue)) AS ?functie)
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(STR(?monumentaardValue)) AS ?monumentaard)
  (SAMPLE(STR(?adresValue)) AS ?volledigAdres)
  (SAMPLE(STR(?postcodeValue)) AS ?postcode)
  (SAMPLE(STR(?woonplaatsValue)) AS ?woonplaats)
  (SAMPLE(STR(?gemeenteValue)) AS ?gemeente)
  (SAMPLE(STR(?provinciecodeValue)) AS ?provinciecode)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
  (SAMPLE(STR(?inschrijvingValue)) AS ?inschrijving)
WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:cultuurhistorischObjectnummer ?choi ;
       ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
  VALUES ?rmnr { ${values} }
  OPTIONAL { ?cho ceo:heeftNaam/ceo:naam ?naamValue . }
  OPTIONAL {
    ?cho ceo:heeftOorspronkelijkeFunctie ?functieNode .
    ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?functieValue .
  }
  OPTIONAL {
    ?cho ceo:heeftOmschrijving ?omschrijvingNode .
    ?omschrijvingNode ceo:omschrijving ?omschrijvingValue ;
                      ceo:formeelStandpunt true .
  }
  OPTIONAL { ?cho ceo:heeftMonumentAard/skos:prefLabel ?monumentaardValue . }
  OPTIONAL {
    ?cho ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie ?bag .
    OPTIONAL { ?bag ceo:volledigAdres ?adresValue . }
    OPTIONAL { ?bag ceo:postcode ?postcodeValue . }
    OPTIONAL { ?bag ceo:woonplaatsnaam ?woonplaatsValue . }
  }
  OPTIONAL {
    ?cho ceo:heeftBasisregistratieRelatie/ceo:heeftBRKRelatie ?brk .
    OPTIONAL { ?brk ceo:gemeentenaam ?gemeenteValue . }
    OPTIONAL { ?brk ceo:provinciecode ?provinciecodeValue . }
  }
  OPTIONAL { ?cho ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  OPTIONAL { ?cho ceo:datumInschrijvingInMonumentenregister ?inschrijvingValue . }
 }
}
GROUP BY ?cho ?choi ?rmnr
LIMIT 100`;
}

export function buildRceNumberQuery(monumentNumber: string) {
  return buildRceDetailsQuery([monumentNumber]);
}

export function buildRceFacetsQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?rmnr
  (GROUP_CONCAT(DISTINCT STR(?oorspronkelijkeFunctie); separator="||") AS ?oorspronkelijkeFuncties)
  (GROUP_CONCAT(DISTINCT STR(?huidigeFunctie); separator="||") AS ?huidigeFuncties)
  (GROUP_CONCAT(DISTINCT STR(?typeNaam); separator="||") AS ?typen)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?rmnr { ${values} }
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ;
         ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
    OPTIONAL {
      ?cho ceo:heeftOorspronkelijkeFunctie ?oorspronkelijkeNode .
      ?oorspronkelijkeNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?oorspronkelijkeFunctie .
    }
    OPTIONAL {
      ?cho ceo:heeftHuidigeFunctie ?huidigeNode .
      ?huidigeNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?huidigeFunctie .
    }
    OPTIONAL { ?cho ceo:heeftType/ceo:heeftTypeNaam/skos:prefLabel ?typeNaam . }
  }
}
GROUP BY ?rmnr`;
}

export function parseFacetResults(document: unknown) {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  return new Map(bindings.map((binding) => [binding.rmnr?.value ?? "", {
    originalFunctionNames: binding.oorspronkelijkeFuncties?.value?.split("||").filter(Boolean) ?? [],
    currentFunctionNames: binding.huidigeFuncties?.value?.split("||").filter(Boolean) ?? [],
    typeNames: binding.typen?.value?.split("||").filter(Boolean) ?? [],
    legalStatus: "rijksmonument",
  }]));
}

export function buildRceParcelQuery(monumentNumber: string) {
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT DISTINCT ?gemeente ?gemeentecode ?sectie ?perceel ?provinciecode
WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?cho a ceo:Rijksmonument ;
       ceo:rijksmonumentnummer "${escapeSparqlString(monumentNumber)}" ;
       ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
       ceo:heeftBasisregistratieRelatie/ceo:heeftBRKRelatie ?brk .
  ?brk ceo:gemeentenaam ?gemeente ;
       ceo:sectie ?sectie ;
       ceo:perceelnummer ?perceel .
  OPTIONAL { ?brk ceo:gemeentecode ?gemeentecode . }
  OPTIONAL { ?brk ceo:provinciecode ?provinciecode . }
 }
}`;
}

export function buildRceParcelsQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT DISTINCT ?rmnr ?gemeente ?gemeentecode ?sectie ?perceel ?provinciecode WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  VALUES ?rmnr { ${values} }
  ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ;
       ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
       ceo:heeftBasisregistratieRelatie/ceo:heeftBRKRelatie ?brk .
  ?brk ceo:gemeentenaam ?gemeente ; ceo:sectie ?sectie ; ceo:perceelnummer ?perceel .
  OPTIONAL { ?brk ceo:gemeentecode ?gemeentecode . }
  OPTIONAL { ?brk ceo:provinciecode ?provinciecode . }
 }
}`;
}

// A Rijksmonument with an archaeological monumentaard is, in practice, almost
// always also registered as its own ArcheologischTerrein: of the 1,812
// terreinen with the "beschermd" waardering, all 1,812 link back to a
// Rijksmonument via ceo:ligtInObject, and 1,457 of the 1,499 archaeological
// Rijksmonument records link back to at least one such terrein. So this is
// not a parallel search feature - it is an enrichment lookup keyed by the
// Rijksmonument's own CHO subject URI (RceMonument.sourceUrl).
export function buildArcheologischTerreinQuery(choUris: string[]) {
  const values = choUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?rm ?terrein ?archisNummer ?waarderingLabel WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?rm { ${values} }
    ?terrein a ceo:ArcheologischTerrein ; ceo:ligtInObject ?rm .
    OPTIONAL { ?terrein ceo:archis2Monumentnummer ?archisNummer . }
    OPTIONAL { ?terrein ceo:heeftArcheologischeWaardering/skos:prefLabel ?waarderingLabel . }
  }
}`;
}

export type ArcheologischTerrein = { archisMonumentnummer?: string; waardering?: string };

export function parseArcheologischTerreinResults(document: unknown): Map<string, ArcheologischTerrein[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, ArcheologischTerrein[]>();
  if (!Array.isArray(bindings)) return byMonument;
  for (const binding of bindings) {
    const monumentUri = binding.rm?.value;
    if (!monumentUri) continue;
    const terrein: ArcheologischTerrein = { archisMonumentnummer: binding.archisNummer?.value, waardering: binding.waarderingLabel?.value };
    byMonument.set(monumentUri, [...(byMonument.get(monumentUri) ?? []), terrein]);
  }
  return byMonument;
}

// A Complex (gebouwd erfgoed, not to be confused with ArcheologischComplex)
// has no geometry of its own and is not independently searchable - it groups
// Rijksmonument records that each have their own geometry. Every complex has
// exactly one hoofdobject (confirmed: 0 of 2,834 complexes have more than
// one), so a monument's role is "hoofdobject" when it equals the complex's
// own heeftHoofdobject value, and "onderdeel" otherwise.
export function buildComplexQuery(choUris: string[]) {
  const values = choUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
SELECT ?rm ?complex
  (SAMPLE(STR(?complexnummer)) AS ?complexnummerValue)
  (SAMPLE(STR(?complexnaamValue)) AS ?complexnaam)
  (SAMPLE(?hoofdobject) AS ?hoofdobjectValue)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?rm { ${values} }
    ?complex a ceo:Complex ; ceo:heeftRijksmonument ?rm .
    OPTIONAL { ?complex ceo:complexnummer ?complexnummer . }
    OPTIONAL { ?complex ceo:heeftNaam/ceo:naam ?complexnaamValue . }
    OPTIONAL { ?complex ceo:heeftHoofdobject ?hoofdobject . }
  }
}
GROUP BY ?rm ?complex`;
}

export type ComplexMembership = { complexnummer?: string; complexnaam?: string; role: "hoofdobject" | "onderdeel" };

export function parseComplexResults(document: unknown): Map<string, ComplexMembership[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, ComplexMembership[]>();
  if (!Array.isArray(bindings)) return byMonument;
  for (const binding of bindings) {
    const monumentUri = binding.rm?.value;
    if (!monumentUri) continue;
    const membership: ComplexMembership = {
      complexnummer: binding.complexnummerValue?.value,
      complexnaam: binding.complexnaam?.value,
      role: binding.hoofdobjectValue?.value === monumentUri ? "hoofdobject" : "onderdeel",
    };
    byMonument.set(monumentUri, [...(byMonument.get(monumentUri) ?? []), membership]);
  }
  return byMonument;
}

// Werelderfgoed staat als CultuurhistorischObject in instanties-rce (naam,
// registratiedatum, geometrie) en - met dezelfde subject-URI - aanvullend in
// de aparte graph werelderfgoed_hvdl (type, jaar van inschrijving, UNESCO-
// link). Met maar 18 instanties totaal is een enkele gefilterde query hier
// snel genoeg; de per-branch opsplitsing die voor Rijksmonumenten nodig is
// (58M triples) is voor dit kleine type overbodig.
//
// Sommige Werelderfgoed-polygonen (bv. de Hollandse Waterlinies) zijn
// megabytes aan WKT groot. Voor een kaartmarker is geen volledige geometrie
// nodig, dus SUBSTR() beperkt wat de SPARQL-service teruggeeft tot een
// voorvoegsel met ruim voldoende coördinatenparen voor een representatief
// punt via wktToLatLng().
export function buildWerelderfgoedQuery(term: string) {
  const needle = escapeSparqlString(term.toLocaleLowerCase("nl"));
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?cho ?choi ?wenr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?typeValue)) AS ?type)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
  (SAMPLE(STR(?jaarValue)) AS ?jaar)
  (SAMPLE(STR(?urlValue)) AS ?url)
  (SAMPLE(SUBSTR(STR(?wktValue), 1, 3000)) AS ?wkt)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Werelderfgoed ; ceo:cultuurhistorischObjectnummer ?choi ; ceo:werelderfgoednummer ?wenr .
    OPTIONAL { ?cho ceo:heeftNaam/ceo:naam ?naamValue . }
    OPTIONAL { ?cho ceo:registratiedatum ?registratiedatumValue . }
    OPTIONAL { ?cho ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  }
  GRAPH <${WERELDERFGOED_GRAPH}> {
    OPTIONAL { ?cho ceo:heeftWerelderfgoedType/skos:prefLabel ?typeValue . }
    OPTIONAL { ?cho ceo:jaarVanInschrijving ?jaarValue . }
    OPTIONAL { ?cho ceo:wordtGetoondOp ?urlValue . }
  }
  FILTER(CONTAINS(LCASE(STR(?naamValue)), "${needle}") || CONTAINS(LCASE(STR(?typeValue)), "${needle}"))
}
GROUP BY ?cho ?choi ?wenr`;
}

export function parseWerelderfgoedResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const wkt = binding.wkt?.value ?? "";
    const coordinates = wktToLatLng(wkt);
    const typeLabel = binding.type?.value;
    const jaar = binding.jaar?.value;
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.wenr?.value ?? "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.cho?.value ?? "",
      name: binding.naam?.value,
      monumentNature: "werelderfgoed",
      description: [
        typeLabel ? typeLabel.charAt(0).toLocaleUpperCase("nl") + typeLabel.slice(1) : undefined,
        jaar ? `Op de Werelderfgoedlijst sinds ${jaar}.` : undefined,
      ].filter(Boolean).join(". "),
      officialUrl: binding.url?.value,
      lng: coordinates?.lng,
      lat: coordinates?.lat,
      wkt: wkt || undefined,
    };
  });
}

// Zelfde tweegraphs-patroon als Werelderfgoed: naam/geometrie in
// instanties-rce, de Archis-link in gezicht_hvdl. Van de 482 Gezicht-
// instanties zijn er 472 daadwerkelijk "rijksbeschermd" (de rest is
// ingetrokken of nog in procedure); alleen die worden getoond, net zoals
// Rijksmonument-queries filteren op de actieve juridische status.
export function buildGezichtQuery(term: string) {
  const needle = escapeSparqlString(term.toLocaleLowerCase("nl"));
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?cho ?choi ?gnr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
  (SAMPLE(STR(?urlValue)) AS ?url)
  (SAMPLE(SUBSTR(STR(?wktValue), 1, 3000)) AS ?wkt)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Gezicht ; ceo:cultuurhistorischObjectnummer ?choi ; ceo:gezichtsnummer ?gnr ;
         ceo:heeftGezichtsstatus <${GEZICHT_STATUS}> .
    OPTIONAL { ?cho ceo:heeftNaam/ceo:naam ?naamValue . }
    OPTIONAL { ?cho ceo:registratiedatum ?registratiedatumValue . }
    OPTIONAL { ?cho ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  }
  GRAPH <${GEZICHT_GRAPH}> {
    OPTIONAL { ?cho ceo:wordtGetoondOp ?urlValue . }
  }
  FILTER(CONTAINS(LCASE(STR(?naamValue)), "${needle}"))
}
GROUP BY ?cho ?choi ?gnr`;
}

export function parseGezichtResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const wkt = binding.wkt?.value ?? "";
    const coordinates = wktToLatLng(wkt);
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.gnr?.value ?? "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.cho?.value ?? "",
      name: binding.naam?.value,
      monumentNature: "gezicht",
      description: "Rijksbeschermd stads- of dorpsgezicht.",
      officialUrl: binding.url?.value,
      lng: coordinates?.lng,
      lat: coordinates?.lat,
      wkt: wkt || undefined,
    };
  });
}

function values(node: JsonLdNode | undefined, property: string): JsonLdValue[] {
  const result = node?.[`${CEO}${property}`];
  return Array.isArray(result) ? result as JsonLdValue[] : [];
}

function value(node: JsonLdNode | undefined, property: string) {
  return values(node, property)[0]?.["@value"] ?? "";
}

function linkedNode(nodes: Map<string, JsonLdNode>, node: JsonLdNode | undefined, property: string) {
  const id = values(node, property)[0]?.["@id"];
  return id ? nodes.get(id) : undefined;
}

export function parseRceMonuments(document: unknown): RceMonument[] {
  if (!Array.isArray(document)) return [];
  const graph = document.filter((node): node is JsonLdNode => Boolean(node && typeof node === "object" && "@id" in node));
  const nodes = new Map(graph.map((node) => [node["@id"], node]));

  return graph.filter((node) => node["@type"]?.includes(RM_TYPE)).map((monument) => {
    const registration = linkedNode(nodes, monument, "heeftBasisregistratieRelatie");
    const bag = linkedNode(nodes, registration, "heeftBAGRelatie");
    const registerUrl = value(monument, "rijksmonumentnummer");
    return {
      choNumber: value(monument, "cultuurhistorischObjectnummer") || monument["@id"].split("/").pop() || "",
      monumentNumber: registerUrl.split("/").pop() || "",
      registrationDate: value(monument, "datumInschrijvingInMonumentenregister"),
      street: value(bag, "openbareRuimte"),
      houseNumber: value(bag, "huisnummer"),
      postalCode: value(bag, "postcode"),
      sourceUrl: monument["@id"],
    };
  });
}
