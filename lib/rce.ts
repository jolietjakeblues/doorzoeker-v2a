const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const RM_TYPE = `${CEO}Rijksmonument`;
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const WERELDERFGOED_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/werelderfgoed_hvdl";
const GEZICHT_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/gezicht_hvdl";
const IMAGE_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/image-1";
const GROENAANLEG_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/groenaanleg";
const MSP_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/msp_indicatie";
const CHT_THESAURUS_GRAPH = "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus";
const ABR_THESAURUS_GRAPH = "https://data.cultureelerfgoed.nl/term/id/abr/thesaurus";
// De twee hoofdtakken (skos:hasTopConcept) van de CHT waar Termennetwerk een
// aparte "bron" van maakte ("materialen" en "stijlen en perioden") - empirisch
// gevonden, niet gedocumenteerd als een aparte skos:ConceptScheme of
// skos:Collection.
const CHT_MATERIALEN_TOP = "https://data.cultureelerfgoed.nl/term/id/cht/aa872ce6-a74c-4f81-96ec-6ee0e717f92a";
const CHT_STIJLEN_PERIODEN_TOP = "https://data.cultureelerfgoed.nl/term/id/cht/63cca950-f545-467a-9d70-db3a2b21bba3";
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
  monumentAardConceptUri?: string;
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
  complexMemberCount?: number;
  image?: MonumentImage;
  groenaanleg?: Groenaanleg;
  msp?: boolean;
};

export type MonumentImage = { url: string; title?: string; license?: string; sourceUrl?: string };
export type Groenaanleg = { typeAanleg?: string; categorie?: string };

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

// Een lng/lat-paar per punt, in WKT-volgorde (lng eerst).
export type WktRing = Array<[number, number]>;
export type WktGeometry =
  | { kind: "point"; lat: number; lng: number }
  | { kind: "polygon"; rings: WktRing[] }
  | { kind: "multipolygon"; polygons: WktRing[][] };

function parseCoordinatePairs(text: string): WktRing {
  return [...text.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(([, lng, lat]) => [Number(lng), Number(lat)]);
}

// Splitst "(a),(b),(c)" op de komma's die BUITEN alle haakjes staan, zodat
// komma's binnen een ring (tussen coördinatenparen) niet worden aangezien
// voor scheidingen tussen ringen of polygonen.
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

function stripOuterParens(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;
}

function parsePolygonRings(text: string): WktRing[] {
  return splitTopLevel(text).map((ring) => parseCoordinatePairs(stripOuterParens(ring)));
}

function parseMultiPolygonPolygons(text: string): WktRing[][] {
  return splitTopLevel(text).map((polygon) => parsePolygonRings(stripOuterParens(polygon)));
}

// Doorzoeker ondersteunt bewust alleen het WKT-profiel dat de huidige RCE
// CHO-data daadwerkelijk levert: Point, Polygon en MultiPolygon, plat in
// lng/lat (geen Z-coördinaat, geen SRID-prefix, geen GEOMETRYCOLLECTION,
// geen wetenschappelijke notatie). Dat is een bewuste grens, geen toevallige
// beperking - zodra RCE een ander profiel levert, moet dit expliciet worden
// uitgebreid in plaats van dat de parser er stilzwijgend op struikelt. Bij
// wat dan ook buiten dit profiel geeft deze functie undefined terug in
// plaats van te gooien.
//
// RCE geeft geometrie als "Point (lng lat)" of
// "Polygon ((lng lat, lng lat, ...))" - met een spatie voor de haakjes. Dit
// behoudt de volledige ringstructuur (inclusief gaten en losse
// deelpolygonen), zodat de kaart de echte vorm kan tekenen in plaats van hem
// plat te slaan tot één punt.
export function parseWktGeometry(wkt: string): WktGeometry | undefined {
  const trimmed = wkt.trim();
  const point = /^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(trimmed);
  if (point) return { kind: "point", lng: Number(point[1]), lat: Number(point[2]) };
  const multiPolygon = /^MULTIPOLYGON\s*\(([\s\S]*)\)$/i.exec(trimmed);
  if (multiPolygon) return { kind: "multipolygon", polygons: parseMultiPolygonPolygons(multiPolygon[1]) };
  const polygon = /^POLYGON\s*\(([\s\S]*)\)$/i.exec(trimmed);
  if (polygon) return { kind: "polygon", rings: parsePolygonRings(polygon[1]) };
  return undefined;
}

function boundingBoxFootprint(ring: WktRing): number {
  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  return (Math.max(...lngs) - Math.min(...lngs)) * (Math.max(...lats) - Math.min(...lats));
}

// Voor bv. sorteren of een kaartmarker als de vorm zelf niet getekend wordt.
// Een (multi)polygon kan uit meerdere, los van elkaar liggende ringen
// bestaan - bijvoorbeeld de Waddenzee, die uit eilanden en wadplaten over
// honderden kilometers kust bestaat. Het gemiddelde nemen van ALLE
// coördinaten door elkaar (over alle ringen heen) geeft dan een punt ergens
// in de lege ruimte tussen die delen, in het ergste geval midden op het
// vasteland. Kies daarom de ring met de grootste bounding box - de
// dominante, zichtbaar bepalende hoofdvorm - en middel alleen daarbinnen.
// Voor een gewone enkelvoudige polygon (het overgrote deel van de gevallen)
// is er maar één ring en verandert dit niets aan het resultaat.
function wktToLatLng(wkt: string): { lat: number; lng: number } | undefined {
  const geometry = parseWktGeometry(wkt);
  if (!geometry) return undefined;
  if (geometry.kind === "point") return { lat: geometry.lat, lng: geometry.lng };

  const rings = (geometry.kind === "polygon" ? geometry.rings : geometry.polygons.flat()).filter((ring) => ring.length > 0);
  if (!rings.length) return undefined;

  const largestRing = rings.reduce((largest, ring) => (boundingBoxFootprint(ring) > boundingBoxFootprint(largest) ? ring : largest));
  const lng = largestRing.reduce((sum, [lngValue]) => sum + lngValue, 0) / largestRing.length;
  const lat = largestRing.reduce((sum, [, latValue]) => sum + latValue, 0) / largestRing.length;
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
      monumentAardConceptUri: binding.monumentaardConcept?.value,
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
  (SAMPLE(STR(?monumentaardConceptValue)) AS ?monumentaardConcept)
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
  OPTIONAL {
    ?cho ceo:heeftMonumentAard ?monumentaardConceptValue .
    ?monumentaardConceptValue skos:prefLabel ?monumentaardValue .
  }
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

// Exacte conceptzoekopdracht: in plaats van een CONTAINS-tekstmatch op een
// label, matcht dit rechtstreeks op de concept-URI waarmee het record zelf
// is geclassificeerd (zie docs/vertical-slices/004-referentienetwerk-concepten.md).
// De aanroeper valideert `conceptUri` vooraf tegen een vaste lijst bekende
// namespaces - dezelfde regel als bij elke andere <...>-interpolatie in dit
// bestand.
export function buildMonumentAardConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftMonumentAard <${conceptUri}> ;
         ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
  }
}
LIMIT 100`;
}

export function parseMonumentAardConceptMatches(document: unknown): string[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => binding.rmnr?.value ? [binding.rmnr.value] : []);
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

// Beeldbank-afbeeldingen staan in een eigen graph, gekoppeld via het
// rijksmonumentnummer dat rechtstreeks op de afbeelding zelf staat (geen CHO-
// URI-omweg nodig). Een monument kan meerdere foto's hebben (gemiddeld ~6);
// voor één representatieve foto per resultaat is SAMPLE() voldoende, net als
// elders in dit bestand bij meerdere kandidaten.
export function buildImageQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX edm: <http://www.europeana.eu/schemas/edm/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?rmnr
  (SAMPLE(STR(?depictionValue)) AS ?depiction)
  (SAMPLE(STR(?titleValue)) AS ?title)
  (SAMPLE(STR(?rightsValue)) AS ?rights)
  (SAMPLE(STR(?shownAtValue)) AS ?shownAt)
WHERE {
  GRAPH <${IMAGE_GRAPH}> {
    VALUES ?rmnr { ${values} }
    ?image ceo:rijksmonumentnummer ?rmnr .
    OPTIONAL { ?image foaf:depiction ?depictionValue . }
    OPTIONAL { ?image dc:title ?titleValue . }
    OPTIONAL { ?image dc:rights ?rightsValue . }
    OPTIONAL { ?image edm:isShownAt ?shownAtValue . }
  }
}
GROUP BY ?rmnr`;
}

export function parseImageResults(document: unknown): Map<string, MonumentImage> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonumentNumber = new Map<string, MonumentImage>();
  if (!Array.isArray(bindings)) return byMonumentNumber;
  for (const binding of bindings) {
    const monumentNumber = binding.rmnr?.value;
    const url = binding.depiction?.value;
    if (!monumentNumber || !url) continue;
    byMonumentNumber.set(monumentNumber, {
      url,
      title: binding.title?.value,
      license: binding.rights?.value,
      sourceUrl: binding.shownAt?.value,
    });
  }
  return byMonumentNumber;
}

// ceo:msp_indicatie is een "alleen-aanwezig-als-waar"-boolean (afwezigheid
// van de triple, niet een expliciete false, betekent "niet via MSP
// aangewezen") - zie docs/reference/rce-linked-data-graphs.md voor de
// uitgezochte betekenis (Monumenten Selectie Project, ±1997-2002).
export function buildMspIndicatieQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
  GRAPH <${MSP_GRAPH}> {
    VALUES ?rmnr { ${values} }
    ?rm ceo:rijksmonumentnummer ?rmnr ; ceo:msp_indicatie true .
  }
}`;
}

export function parseMspIndicatieResults(document: unknown): Set<string> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const monumentNumbers = new Set<string>();
  if (!Array.isArray(bindings)) return monumentNumbers;
  for (const binding of bindings) {
    const monumentNumber = binding.rmnr?.value;
    if (monumentNumber) monumentNumbers.add(monumentNumber);
  }
  return monumentNumbers;
}

// Groenaanleg (historische tuinen en parken) is een eigen graph bovenop
// gewone Rijksmonument-records - dezelfde CHO-URI, extra eigenschappen. Geen
// aparte geometrie tonen (heeftAanlegGeometrie) in deze eerste stap, alleen
// de classificatie als tekstuele verrijking.
export function buildGroenaanlegQuery(choUris: string[]) {
  const values = choUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?rm
  (SAMPLE(STR(?typeLabel)) AS ?type)
  (SAMPLE(STR(?categorieLabel)) AS ?categorie)
WHERE {
  GRAPH <${GROENAANLEG_GRAPH}> {
    VALUES ?rm { ${values} }
    OPTIONAL { ?rm ceo:heeftTypeAanleg/skos:prefLabel ?typeLabel . }
    OPTIONAL { ?rm ceo:heeftCategorieGroenaanleg/skos:prefLabel ?categorieLabel . }
  }
}
GROUP BY ?rm`;
}

export function parseGroenaanlegResults(document: unknown): Map<string, Groenaanleg> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, Groenaanleg>();
  if (!Array.isArray(bindings)) return byMonument;
  for (const binding of bindings) {
    const monumentUri = binding.rm?.value;
    const typeAanleg = binding.type?.value;
    const categorie = binding.categorie?.value;
    if (!monumentUri || (!typeAanleg && !categorie)) continue;
    byMonument.set(monumentUri, { typeAanleg, categorie });
  }
  return byMonument;
}

// De leden van een complex zijn bewust NIET onderdeel van de gewone
// zoekresultaten (dat zou de resultatenlijst overspoelen) - dit wordt pas
// opgehaald zodra een gebruiker een complex daadwerkelijk opent. Elk lid
// krijgt zijn eigen geometrie mee: een complex is een samenraapsel van
// meerdere zelfstandige monumenten, niet één gebouw, dus "de vorm van het
// complex" is het samenspel van al die eigen polygonen op de kaart - niet
// de losse footprint van alleen het hoofdobject.
export function buildComplexMembersQuery(complexUri: string) {
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?rm ?rmnr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?functieValue)) AS ?functie)
  (SAMPLE(?hoofdobjectValue) AS ?hoofdobject)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    <${complexUri}> ceo:heeftRijksmonument ?rm .
    OPTIONAL { <${complexUri}> ceo:heeftHoofdobject ?hoofdobjectValue . }
    ?rm ceo:rijksmonumentnummer ?rmnr .
    OPTIONAL { ?rm ceo:heeftNaam/ceo:naam ?naamValue . }
    OPTIONAL {
      ?rm ceo:heeftOorspronkelijkeFunctie ?functieNode .
      ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?functieValue .
    }
    OPTIONAL { ?rm ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  }
}
GROUP BY ?rm ?rmnr`;
}

export type ComplexMember = { choUri: string; monumentNumber: string; name: string; isHoofdobject: boolean; wkt?: string; lat?: number; lng?: number };

export function parseComplexMembersResults(document: unknown): ComplexMember[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const choUri = binding.rm?.value;
    const monumentNumber = binding.rmnr?.value;
    if (!choUri || !monumentNumber) return [];
    const wkt = binding.wkt?.value ?? "";
    const coordinates = wktToLatLng(wkt);
    return [{
      choUri,
      monumentNumber,
      name: binding.naam?.value || binding.functie?.value || `Rijksmonument ${monumentNumber}`,
      isHoofdobject: binding.hoofdobject?.value === choUri,
      wkt: wkt || undefined,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
    }];
  });
}

// Werelderfgoed staat als CultuurhistorischObject in instanties-rce (naam,
// registratiedatum, geometrie) en - met dezelfde subject-URI - aanvullend in
// de aparte graph werelderfgoed_hvdl (type, jaar van inschrijving, UNESCO-
// link). Met maar 18 instanties totaal is een enkele gefilterde query hier
// snel genoeg; de per-branch opsplitsing die voor Rijksmonumenten nodig is
// (58M triples) is voor dit kleine type overbodig.
//
// Sommige Werelderfgoed-polygonen (bv. de Hollandse Waterlinies) zijn
// megabytes aan WKT groot. Die wordt hier toch volledig opgehaald - een
// voorvoegsel afknippen (zoals eerder met SUBSTR) laat wktToLatLng() maar
// één willekeurig deel van een meerdelige vorm zien, wat bij de Waddenzee
// een kaartmarker middenin de Achterhoek opleverde in plaats van in zee.
// Zonder term (browse-modus: alle 18 tonen) wordt de FILTER weggelaten in
// plaats van een altijd-waar CONTAINS("") te forceren - dat scheelt niets aan
// resultaat maar maakt de intentie ("alles tonen" versus "op naam zoeken")
// expliciet leesbaar in de query zelf.
export function buildWerelderfgoedQuery(term: string) {
  const needle = escapeSparqlString(term.toLocaleLowerCase("nl"));
  const filter = term ? `FILTER(CONTAINS(LCASE(STR(?naamValue)), "${needle}") || CONTAINS(LCASE(STR(?typeValue)), "${needle}"))` : "";
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?cho ?choi ?wenr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?typeValue)) AS ?type)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
  (SAMPLE(STR(?jaarValue)) AS ?jaar)
  (SAMPLE(STR(?urlValue)) AS ?url)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
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
  ${filter}
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
  const filter = term ? `FILTER(CONTAINS(LCASE(STR(?naamValue)), "${needle}"))` : "";
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?cho ?choi ?gnr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
  (SAMPLE(STR(?urlValue)) AS ?url)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
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
  ${filter}
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

// Een Complex is zelf geen monument en heeft geen eigen geometrie - het is
// een samenhang tussen rijksmonumenten die als één geheel zijn aangewezen
// (bv. een buitenplaats met hoofdhuis, koetshuis en tuinaanleg). Voor een
// kaartpositie wordt daarom de geometrie van het hoofdobject gebruikt: dat
// is het monument dat het complex inhoudelijk bepaalt, in plaats van een
// gemiddelde over alle leden die een groot landgoed kunstmatig "midden op
// het erf" zou kunnen laten landen.
export function buildComplexenQuery(term: string) {
  const needle = escapeSparqlString(term.toLocaleLowerCase("nl"));
  const filter = term ? `FILTER(CONTAINS(LCASE(STR(?naamValue)), "${needle}"))` : "";
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?complex ?choi ?complexnummer
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
  (COUNT(DISTINCT ?lidValue) AS ?aantalLeden)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?complex a ceo:Complex ; ceo:complexnummer ?complexnummer ; ceo:cultuurhistorischObjectnummer ?choi .
    ?complex ceo:heeftRijksmonument ?lidValue .
    OPTIONAL { ?complex ceo:heeftNaam/ceo:naam ?naamValue . }
    OPTIONAL { ?complex ceo:heeftOmschrijving/ceo:omschrijving ?omschrijvingValue . }
    OPTIONAL { ?complex ceo:registratiedatum ?registratiedatumValue . }
    OPTIONAL {
      ?complex ceo:heeftHoofdobject ?hoofdobjectValue .
      OPTIONAL { ?hoofdobjectValue ceo:heeftGeometrie/geo:asWKT ?wktValue . }
    }
  }
  ${filter}
}
GROUP BY ?complex ?choi ?complexnummer`;
}

export function parseComplexenResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const wkt = binding.wkt?.value ?? "";
    const coordinates = wktToLatLng(wkt);
    const memberCount = Number(binding.aantalLeden?.value ?? "0");
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.complexnummer?.value ?? "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.complex?.value ?? "",
      name: binding.naam?.value,
      monumentNature: "complex",
      description: binding.omschrijving?.value || `Complex van ${memberCount} rijksmonument${memberCount === 1 ? "" : "en"}.`,
      complexMemberCount: memberCount || undefined,
      lng: coordinates?.lng,
      lat: coordinates?.lat,
      wkt: wkt || undefined,
    };
  });
}

// ArcheologischOnderzoeksgebied heeft geen naam- of registernummerveld zoals
// Rijksmonument, Werelderfgoed of Gezicht, en is met 112K instanties te groot
// voor het "hele collectie in één CONTAINS-query"-patroon van die drie. Wel
// heeft elk record een woonplaatsnaam (via dezelfde BAG-relatie-fallback als
// archeologische Rijksmonumenten) en een prozaomschrijving. Dat past op het
// bestaande DISCOVERY_SOURCES-patroon: twee losse per-veld branches, elk met
// een eigen CONTAINS-filter, gemerged in JS - empirisch geverifieerd dat dit
// ruim binnen de tijd blijft, ook op de volle graaf.
const ARCHEOLOGISCH_ONDERZOEK_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "woonplaats (onderzoeksgebied)", rang: 1, pattern: "?gebied ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "omschrijving (onderzoeksgebied)", rang: 2, pattern: "?gebied ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
];

export function buildArcheologischOnderzoekDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return ARCHEOLOGISCH_ONDERZOEK_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?choi ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?gebied a ceo:ArcheologischOnderzoeksgebied ; ceo:cultuurhistorischObjectnummer ?choi .
  ${pattern}
  FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))
 }
}
LIMIT 100`,
  }));
}

export function parseArcheologischOnderzoekDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = ARCHEOLOGISCH_ONDERZOEK_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
  const needle = term.trim().toLocaleLowerCase("nl");
  return bindings.flatMap((binding) => {
    const monumentNumber = binding.choi?.value ?? "";
    const matchedText = binding.match?.value ?? "";
    if (!monumentNumber) return [];
    const lowerMatch = matchedText.toLocaleLowerCase("nl");
    const matchtype = lowerMatch === needle ? 0 : lowerMatch.startsWith(needle) ? 1 : 2;
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: rang * 10 + matchtype }];
  });
}

export function buildArcheologischOnderzoekDetailsQuery(choNumbers: string[]) {
  const valuesClause = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?gebied ?choi
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(STR(?woonplaatsValue)) AS ?woonplaats)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?gebied a ceo:ArcheologischOnderzoeksgebied ; ceo:cultuurhistorischObjectnummer ?choi .
    VALUES ?choi { ${valuesClause} }
    OPTIONAL { ?gebied ceo:heeftOmschrijving/ceo:omschrijving ?omschrijvingValue . }
    OPTIONAL { ?gebied ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?woonplaatsValue . }
    OPTIONAL { ?gebied ceo:registratiedatum ?registratiedatumValue . }
    OPTIONAL { ?gebied ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  }
}
GROUP BY ?gebied ?choi
LIMIT 100`;
}

export function parseArcheologischOnderzoekResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const wkt = binding.wkt?.value ?? "";
    const coordinates = wktToLatLng(wkt);
    const woonplaats = binding.woonplaats?.value;
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.choi?.value ?? "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.gebied?.value ?? "",
      monumentNature: "archeologischonderzoeksgebied",
      description: binding.omschrijving?.value || "Archeologisch onderzoeksgebied.",
      place: woonplaats,
      municipality: woonplaats,
      lng: coordinates?.lng,
      lat: coordinates?.lat,
      wkt: wkt || undefined,
    };
  });
}

// Lazy detailverrijking voor een geopend Onderzoeksgebied: ArcheologischComplex,
// Vondstlocatie, Grondsporen en Vondsten staan er los van (zie
// docs/vertical-slices/002-archeologisch-onderzoek.md, sectie "Exacte
// relatiestructuur"), en worden daarom nooit vooraf voor de hele zoekresultatenlijst
// opgehaald - net als bij Complex-ledenlijst pas zodra het detailpaneel opengaat.
//
// Directe ArcheologischComplex-kinderen blijven klein genoeg om altijd volledig te
// tonen (empirisch gemeten maximum: 31 per onderzoeksgebied). Vondstlocaties kunnen
// juist sterk uitschieten (gemeten maximum: 2.191 in één onderzoeksgebied), dus die
// krijgen een harde LIMIT met een aparte, ongelimiteerde telling. Grondsporen,
// Vondsten en complexen-onder-een-Vondstlocatie worden nooit als lijst opgehaald -
// alleen als aggregaattelling, want zelfs in het grootste onderzoeksgebied bleek dat
// in de praktijk (7.750 vondsten, 3.458 complexen) geen bruikbare lijst op te leveren.
export type OnderzoeksgebiedComplex = { complexUri: string; choNumber: string; typeLabel?: string };
export type OnderzoeksgebiedVondstlocatie = { vlUri: string; choNumber: string; locatienaam?: string };
export type OnderzoeksgebiedAggregaten = { vondstlocatieTotaal: number; grondsporenTotaal: number; vondstenTotaal: number; complexenViaVondstlocatieTotaal: number };

export function buildOnderzoeksgebiedComplexenQuery(gebiedUri: string) {
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?complex ?choi
  (SAMPLE(STR(?typeLabelValue)) AS ?typeLabel)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    <${gebiedUri}> ceo:bevatObject ?complex .
    ?complex a ceo:ArcheologischComplex ; ceo:cultuurhistorischObjectnummer ?choi .
    OPTIONAL { ?complex ceo:heeftType/ceo:heeftTypeNaam/skos:prefLabel ?typeLabelValue . }
  }
}
GROUP BY ?complex ?choi
LIMIT 100`;
}

export function parseOnderzoeksgebiedComplexenResults(document: unknown): OnderzoeksgebiedComplex[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => ({
    complexUri: binding.complex?.value ?? "",
    choNumber: binding.choi?.value ?? "",
    typeLabel: binding.typeLabel?.value || undefined,
  }));
}

export function buildOnderzoeksgebiedVondstlocatiesQuery(gebiedUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?vl ?choi
  (SAMPLE(STR(?locatienaamValue)) AS ?locatienaam)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    <${gebiedUri}> ceo:bevatObject ?vl .
    ?vl a ceo:Vondstlocatie ; ceo:cultuurhistorischObjectnummer ?choi .
    OPTIONAL { ?vl ceo:heeftLocatieAanduiding/ceo:locatienaam ?locatienaamValue . }
  }
}
GROUP BY ?vl ?choi
LIMIT 25`;
}

export function parseOnderzoeksgebiedVondstlocatiesResults(document: unknown): OnderzoeksgebiedVondstlocatie[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => ({
    vlUri: binding.vl?.value ?? "",
    choNumber: binding.choi?.value ?? "",
    // "-" is een veelgebruikte placeholder in plaats van een ontbrekende waarde,
    // geen echte locatienaam - daar willen we niet mee stoere details tonen.
    locatienaam: binding.locatienaam?.value && binding.locatienaam.value !== "-" ? binding.locatienaam.value : undefined,
  }));
}

export function buildOnderzoeksgebiedAggregatenQuery(gebiedUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT
  (COUNT(DISTINCT ?vl) AS ?vondstlocatieTotaal)
  (COUNT(?grondspoor) AS ?grondsporenTotaal)
  (COUNT(?vondst) AS ?vondstenTotaal)
  (COUNT(DISTINCT ?complexViaVl) AS ?complexenViaVondstlocatieTotaal)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    <${gebiedUri}> ceo:bevatObject ?vl .
    ?vl a ceo:Vondstlocatie .
    OPTIONAL { ?vl ceo:bevatObject ?grondspoor . ?grondspoor a ceo:Grondsporen . }
    OPTIONAL { ?vl ceo:bevatObject ?vondst . ?vondst a ceo:Vondsten . }
    OPTIONAL { ?vl ceo:bevatObject ?complexViaVl . ?complexViaVl a ceo:ArcheologischComplex . }
  }
}`;
}

export function parseOnderzoeksgebiedAggregatenResults(document: unknown): OnderzoeksgebiedAggregaten {
  const binding = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings?.[0];
  // Geen Vondstlocaties onder dit onderzoeksgebied betekent geen enkele binding
  // (de query vereist ?gebied bevatObject ?vl), niet een rij met nullen.
  if (!binding) return { vondstlocatieTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 0, complexenViaVondstlocatieTotaal: 0 };
  return {
    vondstlocatieTotaal: Number(binding.vondstlocatieTotaal?.value ?? "0"),
    grondsporenTotaal: Number(binding.grondsporenTotaal?.value ?? "0"),
    vondstenTotaal: Number(binding.vondstenTotaal?.value ?? "0"),
    complexenViaVondstlocatieTotaal: Number(binding.complexenViaVondstlocatieTotaal?.value ?? "0"),
  };
}

// Termsuggesties komen rechtstreeks uit RCE's eigen Referentienetwerk (de CHT-
// en ABR-thesauri), niet via het externe Termennetwerk van Netwerk Digitaal
// Erfgoed. Dat laatste is slechts een doorgeefluik: dezelfde termen worden
// vanuit het Referentienetwerk daar ook naartoe gepubliceerd voor sectorbrede
// kruisbevraging, maar voor een RCE-specifieke app als Doorzoeker is die
// omweg overbodig - de brondata staat al op dezelfde SPARQL-dienst die de
// rest van de applicatie gebruikt, zonder extra netwerkafhankelijkheid.
export type TermSuggestion = { uri: string; label: string; sourceUri: string; sourceName: string };

export function buildChtTermSuggestQuery(term: string, limit: number) {
  const needle = escapeSparqlString(term.trim().toLocaleLowerCase("nl"));
  return `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?concept ?label
  (BOUND(?viaMaterialen) AS ?isMateriaal)
  (BOUND(?viaStijlen) AS ?isStijlPeriode)
WHERE {
  GRAPH <${CHT_THESAURUS_GRAPH}> {
    ?concept a skos:Concept ; skos:prefLabel ?label .
    FILTER(LANG(?label) = "nl")
    FILTER(CONTAINS(LCASE(STR(?label)), "${needle}"))
    OPTIONAL { ?concept skos:broader* <${CHT_MATERIALEN_TOP}> . BIND(true AS ?viaMaterialen) }
    OPTIONAL { ?concept skos:broader* <${CHT_STIJLEN_PERIODEN_TOP}> . BIND(true AS ?viaStijlen) }
  }
}
LIMIT ${limit}`;
}

export function parseChtTermSuggestResults(document: unknown): TermSuggestion[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.concept?.value;
    const label = binding.label?.value;
    if (!uri || !label) return [];
    const sourceName = binding.isMateriaal?.value === "true"
      ? "Cultuurhistorische Thesaurus - Materialen"
      : binding.isStijlPeriode?.value === "true"
        ? "Cultuurhistorische Thesaurus - Stijlen en periodes"
        : "Cultuurhistorische Thesaurus";
    return [{ uri, label, sourceUri: CHT_THESAURUS_GRAPH, sourceName }];
  });
}

export function buildAbrTermSuggestQuery(term: string, limit: number) {
  const needle = escapeSparqlString(term.trim().toLocaleLowerCase("nl"));
  return `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?concept ?label WHERE {
  GRAPH <${ABR_THESAURUS_GRAPH}> {
    ?concept a skos:Concept ; skos:prefLabel ?label .
    FILTER(LANG(?label) = "nl")
    FILTER(CONTAINS(LCASE(STR(?label)), "${needle}"))
  }
}
LIMIT ${limit}`;
}

export function parseAbrTermSuggestResults(document: unknown): TermSuggestion[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.concept?.value;
    const label = binding.label?.value;
    if (!uri || !label) return [];
    return [{ uri, label, sourceUri: ABR_THESAURUS_GRAPH, sourceName: "Archeologisch Basisregister" }];
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
