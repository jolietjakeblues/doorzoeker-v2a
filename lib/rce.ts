const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const RM_TYPE = `${CEO}Rijksmonument`;
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const WERELDERFGOED_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/werelderfgoed_hvdl";
const GEZICHT_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/gezicht_hvdl";
const IMAGE_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/image-1";
const GROENAANLEG_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/groenaanleg";
const MSP_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/msp_indicatie";
// Zelfde ActorEnRol-subject-URI's als in INSTANCES_GRAPH, maar hier heeft
// heeftActor/heeftRol een echte concept-URI (namespace term/id/rn/<uuid>,
// zonder de "2") in plaats van de platte tekst-literal die INSTANCES_GRAPH
// voor diezelfde properties geeft - zie docs/vertical-slices/007-bouwgeschiedenis.md.
const ACTORENROL_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/actorenrol";
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
  ranking: ["oorspronkelijke functie", "huidige functie", "type", "monumentaard", "naam", "formele omschrijving", "volledig adres", "woonplaats"],
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
  literature?: LiteratureRef[];
  gebeurtenissen?: Gebeurtenis[];
  archaeologicalValuation?: string;
  archaeologicalValuationConceptUri?: string;
  archaeologicalAcquisition?: string;
  archaeologicalAcquisitionConceptUri?: string;
  archaeologicalTraceCount?: number;
  archaeologicalType?: string;
  archaeologicalTypeConceptUri?: string;
  archaeologicalTypeSchemes?: { uri: string; label: string }[];
  parentObjectUrl?: string;
  parentObjectLabel?: string;
  archaeologicalFindCount?: number;
  archaeologicalFindTypes?: ArchaeologyConcept[];
  archaeologicalMaterials?: ArchaeologyConcept[];
  archaeologicalStyles?: ArchaeologyConcept[];
  archaeologicalCondition?: ArchaeologyConcept;
  archaeologicalComplexType?: ArchaeologyConcept;
  archaeologicalContexts?: { uri: string; label: string; type: "Vondstlocatie" | "Archeologisch terrein" | "Onderzoeksgebied" }[];
};

export type MonumentImage = { url: string; title?: string; license?: string; sourceUrl?: string };
export type Groenaanleg = { typeAanleg?: string; categorie?: string };
// Bouwgeschiedenis via ceo:heeftGebeurtenis - zie
// docs/vertical-slices/007-bouwgeschiedenis.md. `actorConceptUri` is alleen
// gevuld wanneer de aparte actorenrol-graph een resolvebare concept-URI
// teruggeeft voor deze actor (niet gegarandeerd - zie de verkenning).
export type GebeurtenisActor = { naam: string; rol?: string; actorConceptUri?: string };
export type Gebeurtenis = { naam: string; naamConceptUri?: string; beginDatum?: string; eindDatum?: string; actoren: GebeurtenisActor[] };
// Uit de aparte rce/bibliotheek-dataset (niet rce/cho zelf) - zie
// docs/vertical-slices/005-bibliotheek-literatuur.md. Query/parse-logica
// leeft in lib/server/bibliotheek-adapter.ts, net als bij de
// Referentienetwerk-concepten, omdat het een fysiek ander SPARQL-endpoint
// is; dit type staat hier omdat het aan RceMonument hangt.
export type LiteratureRef = { uri: string; title: string; year?: string; authors: string[]; sourceUrl?: string };

export type RceParcel = {
  municipality: string;
  municipalityCode: string;
  section: string;
  parcelNumber: string;
  provinceCode: string;
};

type SparqlBinding = Record<string, { value?: string }>;

export type DiscoveryMatch = { monumentNumber: string; matchSource: string; matchedText: string; matchScore: number };

export function escapeSparqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

// Each discovery source runs as its own SPARQL query. A single query that UNIONs
// all sources together (with a shared FILTER/ORDER BY) makes Virtuoso build
// and sort one enormous intermediate result across a 58M-triple graph, which
// reliably times out. Per-source queries are simple, fast (each source alone
// resolves in well under a second), and let us do the scoring/merge/pagination
// in JS instead of relying on the query planner to do it efficiently.
const DISCOVERY_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "oorspronkelijke functie", rang: 1, pattern: "?cho ceo:heeftOorspronkelijkeFunctie ?functieNode .\n    ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?match ." },
  { bron: "huidige functie", rang: 2, pattern: "?cho ceo:heeftHuidigeFunctie ?functieNode .\n    ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam/skos:prefLabel ?match ." },
  { bron: "type", rang: 3, pattern: "?cho ceo:heeftType/ceo:heeftTypeNaam/skos:prefLabel ?match ." },
  { bron: "monumentaard", rang: 4, pattern: "?cho ceo:heeftMonumentAard/skos:prefLabel ?match ." },
  { bron: "naam", rang: 5, pattern: "?cho ceo:heeftNaam/ceo:naam ?match ." },
  { bron: "formele omschrijving", rang: 6, pattern: "?cho ceo:heeftOmschrijving ?omschrijvingNode .\n    ?omschrijvingNode ceo:omschrijving ?match ; ceo:formeelStandpunt true ." },
  { bron: "volledig adres", rang: 7, pattern: "?cho ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:volledigAdres ?match ." },
  { bron: "woonplaats", rang: 8, pattern: "?cho ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
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

// Fase 2 (2026-08-10): dezelfde exacte conceptzoekopdracht, nu voor de
// archeologische waardering van een ArcheologischTerrein in plaats van de
// monumentaard van het Rijksmonument zelf. Live geverifieerd dat
// ceo:heeftArcheologischeWaardering naar dezelfde rn/2-namespace wijst als
// heeftMonumentAard (zie 004-referentienetwerk-concepten.md,
// "Openstaande vragen"). Het Rijksmonument wordt via ligtInObject
// bereikt, niet rechtstreeks op het terrein zelf gezocht.
export function buildArcheologischeWaarderingConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?terrein a ceo:ArcheologischTerrein ; ceo:heeftArcheologischeWaardering <${conceptUri}> ; ceo:ligtInObject ?rm .
    ?rm ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
  }
}
LIMIT 100`;
}

// Gedeeld door beide conceptzoekopdrachten hierboven - beide queries leveren
// uitsluitend een lijst ?rmnr-bindings op, ongeacht via welk veld ze zijn
// gevonden.
export function parseConceptSearchMatches(document: unknown): string[] {
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
SELECT DISTINCT ?rm ?terrein ?archisNummer ?waarderingLabel ?waarderingConcept WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?rm { ${values} }
    ?terrein a ceo:ArcheologischTerrein ; ceo:ligtInObject ?rm .
    OPTIONAL { ?terrein ceo:archis2Monumentnummer ?archisNummer . }
    OPTIONAL {
      ?terrein ceo:heeftArcheologischeWaardering ?waarderingConcept .
      ?waarderingConcept skos:prefLabel ?waarderingLabel .
    }
  }
}`;
}

export type ArcheologischTerrein = { archisMonumentnummer?: string; waardering?: string; waarderingConceptUri?: string };

export function parseArcheologischTerreinResults(document: unknown): Map<string, ArcheologischTerrein[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, ArcheologischTerrein[]>();
  if (!Array.isArray(bindings)) return byMonument;
  for (const binding of bindings) {
    const monumentUri = binding.rm?.value;
    if (!monumentUri) continue;
    const terrein: ArcheologischTerrein = { archisMonumentnummer: binding.archisNummer?.value, waardering: binding.waarderingLabel?.value, waarderingConceptUri: binding.waarderingConcept?.value };
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

// Bouwgeschiedenis (taak: docs/vertical-slices/007-bouwgeschiedenis.md).
// De actorenrol-join staat bewust GENEST binnen dezelfde OPTIONAL die ?ar
// bindt: een aparte, niet-geneste OPTIONAL met een (soms) ongebonden ?ar
// laat de query-engine matchen tegen alle ~9.900 ActorEnRol-triples in de
// actorenrol-graph tegelijk - een kruisproduct-explosie die live is
// aangetoond (11+ miljoen tekens resultaat op één monument) voordat deze
// vorm empirisch is vastgesteld als de juiste.
export function buildGebeurtenissenQuery(choUris: string[]) {
  const values = choUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?rm ?g ?naamUri ?naamLabel ?beginDatum ?eindDatum ?ar ?actorNaam ?actorRol ?actorConceptUri WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?rm { ${values} }
    ?rm ceo:heeftGebeurtenis ?g .
    OPTIONAL { ?g ceo:heeftGebeurtenisNaam ?naamUri . ?naamUri skos:prefLabel ?naamLabel . }
    OPTIONAL { ?g ceo:heeftDatering/ceo:heeftBeginDatering/ceo:datum ?beginDatum . }
    OPTIONAL { ?g ceo:heeftDatering/ceo:heeftEindDatering/ceo:datum ?eindDatum . }
    OPTIONAL {
      ?g ceo:heeftActorEnRol ?ar .
      OPTIONAL { ?ar ceo:heeftActor ?actorNaam . }
      OPTIONAL { ?ar ceo:heeftRol ?actorRol . }
      OPTIONAL { GRAPH <${ACTORENROL_GRAPH}> { ?ar ceo:heeftActor ?actorConceptUri . } }
    }
  }
}`;
}

export function parseGebeurtenissenResults(document: unknown): Map<string, Gebeurtenis[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, Gebeurtenis[]>();
  if (!Array.isArray(bindings)) return byMonument;

  const byEvent = new Map<string, { rm: string; gebeurtenis: Gebeurtenis }>();
  for (const binding of bindings) {
    const rm = binding.rm?.value;
    const eventUri = binding.g?.value;
    const naam = binding.naamLabel?.value;
    if (!rm || !eventUri || !naam) continue;
    const existing = byEvent.get(eventUri);
    const gebeurtenis = existing?.gebeurtenis ?? {
      naam,
      naamConceptUri: binding.naamUri?.value,
      beginDatum: binding.beginDatum?.value,
      eindDatum: binding.eindDatum?.value,
      actoren: [],
    };
    if (!existing) byEvent.set(eventUri, { rm, gebeurtenis });
    const actorNaam = binding.actorNaam?.value;
    if (actorNaam && !gebeurtenis.actoren.some((actor) => actor.naam === actorNaam)) {
      gebeurtenis.actoren.push({ naam: actorNaam, rol: binding.actorRol?.value, actorConceptUri: binding.actorConceptUri?.value });
    }
  }

  for (const { rm, gebeurtenis } of byEvent.values()) {
    const forMonument = byMonument.get(rm) ?? [];
    forMonument.push(gebeurtenis);
    byMonument.set(rm, forMonument);
  }
  const MAX_PER_MONUMENT = 10;
  for (const [rm, events] of byMonument) {
    events.sort((a, b) => (a.beginDatum ?? "9999").localeCompare(b.beginDatum ?? "9999"));
    byMonument.set(rm, events.slice(0, MAX_PER_MONUMENT));
  }
  return byMonument;
}

// Exacte conceptzoekopdracht op het gebeurtenistype (bv. "vervaardiging",
// "restauratie") - zelfde patroon als monumentaard/waardering.
export function buildGebeurtenisConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
        ceo:heeftGebeurtenis ?g .
    ?g ceo:heeftGebeurtenisNaam <${conceptUri}> .
  }
}
LIMIT 100`;
}

// Exacte conceptzoekopdracht op de actor (architect/aannemer/...) - anders
// dan de andere conceptzoekopdrachten moet deze over twee named graphs op
// hetzelfde rce/cho-endpoint heen: de match zelf zit in de actorenrol-graph,
// de weg terug naar het Rijksmonument in instanties-rce.
export function buildActorConceptQuery(actorConceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${ACTORENROL_GRAPH}> {
    ?ar ceo:heeftActor <${actorConceptUri}> .
  }
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
        ceo:heeftGebeurtenis/ceo:heeftActorEnRol ?ar .
  }
}
LIMIT 100`;
}

// "Op deze dag"-widget (docs/vertical-slices/010-op-deze-dag.md). Live
// geverifieerd: heeftBeginDatering/heeftEindDatering (Gebeurtenis) is
// ONGESCHIKT voor dit doel (dag/maand staat vrijwel altijd vast op "01-01",
// een jaarnauwkeurige precisie-conventie, geen echte datum).
// datumInschrijvingInMonumentenregister (al gebruikt als registrationDate)
// heeft wél een echte, gespreide dag-verdeling. EXISTS (in plaats van een
// OPTIONAL-join) voorkomt dat een monument met meerdere foto's meerdere
// keren in het resultaat verschijnt.
export function buildOpDezeDagQuery(maandDag: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr (EXISTS { GRAPH <${IMAGE_GRAPH}> { ?image ceo:rijksmonumentnummer ?rmnr } } AS ?heeftFoto) WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
        ceo:rijksmonumentnummer ?rmnr ;
        ceo:datumInschrijvingInMonumentenregister ?ins .
    FILTER(SUBSTR(STR(?ins), 6, 5) = "${escapeSparqlString(maandDag)}")
  }
}`;
}

export type OpDezeDagCandidate = { monumentNumber: string; heeftFoto: boolean };

export function parseOpDezeDagCandidates(document: unknown): OpDezeDagCandidate[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => binding.rmnr?.value ? [{ monumentNumber: binding.rmnr.value, heeftFoto: binding.heeftFoto?.value === "true" }] : []);
}

// Kiest deterministisch één kandidaat: dezelfde dag geeft elke bezoeker
// hetzelfde monument (belangrijk voor caching), bij voorkeur één met een
// foto uit de beeldbank (visueel aantrekkelijker dan alleen tekst) - live
// geverifieerd dat zelfs op 29 februari (schrikkeldag) nog 31 van de 312
// kandidaten een foto hebben, dus de met-foto-voorkeur valt zelden terug op
// de volledige lijst. `dayOfYear` (1-366) laat hetzelfde kalenderjaar in
// een volgend jaar een ander monument uit dezelfde dag-groep kiezen, in
// plaats van elk jaar exact dezelfde.
export function pickOpDezeDagCandidate(candidates: OpDezeDagCandidate[], dayOfYear: number): string | undefined {
  if (!candidates.length) return undefined;
  const withPhoto = candidates.filter((candidate) => candidate.heeftFoto);
  const pool = withPhoto.length ? withPhoto : candidates;
  return pool[dayOfYear % pool.length].monumentNumber;
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

// Termsuggesties komen rechtstreeks uit de thesauri van de RCE. CHT en ABR
// staan als named graphs op rce/cho; Referentienetwerk 2 heeft een eigen
// SPARQL-endpoint. RN2 is dus niet alleen een resolver voor concept-URI's,
// maar zelf ook een thesaurus die met de objectdata is verweven.
export type TermSuggestion = { uri: string; label: string; sourceUri: string; sourceName: string };

const CHO_REFERENTIENETWERK_SCHEMES = [
  "https://data.cultureelerfgoed.nl/term/id/rn/2/a4a7933c-e096-4bcf-a921-4f70a78749fe", // Archeologisch Informatie Systeem
  "https://data.cultureelerfgoed.nl/term/id/rn/2/bf88ef8b-eba4-46a7-9740-d58e983e4990", // Cultuurhistorische Object Informatie
  "https://data.cultureelerfgoed.nl/term/id/rn/2/364d5132-a090-4b2c-8cbe-e167f1243f3f", // Kennisregistratie
  "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5", // Monumenten Registratie Systeem
] as const;

export function buildReferentienetwerkTermSuggestQuery(term: string, limit: number) {
  const needle = escapeSparqlString(term.trim().toLocaleLowerCase("nl"));
  return `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dct: <http://purl.org/dc/terms/>
SELECT ?concept ?label ?scheme ?schemeLabel WHERE {
  VALUES ?scheme { ${CHO_REFERENTIENETWERK_SCHEMES.map((uri) => `<${uri}>`).join(" ")} }
  ?concept a skos:Concept ; skos:prefLabel ?label ; skos:inScheme ?scheme .
  FILTER(LANG(?label) = "nl")
  FILTER(CONTAINS(LCASE(STR(?label)), "${needle}"))
  OPTIONAL { ?scheme dct:title ?schemeLabel . FILTER(LANG(?schemeLabel) = "" || LANG(?schemeLabel) = "nl") }
}
LIMIT ${limit}`;
}

const ARCHEOLOGISCH_TERREIN_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "Archis-monumentnummer", rang: 1, pattern: "?terrein ceo:archis2Monumentnummer ?match ." },
  { bron: "naam (archeologisch terrein)", rang: 2, pattern: "?terrein ceo:heeftNaam/ceo:naam ?match ." },
  { bron: "woonplaats (archeologisch terrein)", rang: 3, pattern: "?terrein ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "omschrijving (archeologisch terrein)", rang: 4, pattern: "?terrein ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "waardering (archeologisch terrein)", rang: 5, pattern: "?terrein ceo:heeftArcheologischeWaardering/skos:prefLabel ?match ." },
];

export type ArchaeologyBrowseKind = "archeologischterrein" | "onderzoeksgebied";

// Collecties worden alleen op hun stabiele CHO-nummer gepagineerd. De
// bestaande detailquery haalt daarna voor precies deze 25 nummers de
// inhoudelijke velden op; zo hoeft een zware detailquery nooit de volledige
// archeologische collectie te sorteren.
export function buildArchaeologyBrowseQuery(kind: ArchaeologyBrowseKind, page: number) {
  const className = kind === "archeologischterrein" ? "ArcheologischTerrein" : "ArcheologischOnderzoeksgebied";
  const offset = Math.max(0, page - 1) * 25;
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?choi WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?object a ceo:${className} ; ceo:cultuurhistorischObjectnummer ?choi .
  }
}
ORDER BY ?choi
LIMIT 25
OFFSET ${offset}`;
}

export function parseArchaeologyBrowseNumbers(document: unknown) {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => binding.choi?.value ?? "").filter(Boolean);
}

export function buildArcheologischTerreinDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return ARCHEOLOGISCH_TERREIN_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?choi ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?terrein a ceo:ArcheologischTerrein ; ceo:cultuurhistorischObjectnummer ?choi .
  ${pattern}
  ${bron === "Archis-monumentnummer" && /^\d+$/.test(term.trim())
    ? `FILTER(STR(?match) = "${needle}")`
    : `FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))`}
 }
}
LIMIT 100`,
  }));
}

export function parseArcheologischTerreinDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = ARCHEOLOGISCH_TERREIN_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
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

export function buildArcheologischTerreinDetailsQuery(choNumbers: string[]) {
  const valuesClause = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?terrein ?choi
  (SAMPLE(STR(?archisValue)) AS ?archisNummer)
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(STR(?woonplaatsValue)) AS ?woonplaats)
  (SAMPLE(STR(?waarderingLabelValue)) AS ?waarderingLabel)
  (SAMPLE(?waarderingConceptValue) AS ?waarderingConcept)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?terrein a ceo:ArcheologischTerrein ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?choi { ${valuesClause} }
  OPTIONAL { ?terrein ceo:archis2Monumentnummer ?archisValue . }
  OPTIONAL { ?terrein ceo:heeftNaam/ceo:naam ?naamValue . }
  OPTIONAL { ?terrein ceo:heeftOmschrijving/ceo:omschrijving ?omschrijvingValue . }
  OPTIONAL { ?terrein ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?woonplaatsValue . }
  OPTIONAL { ?terrein ceo:heeftArcheologischeWaardering ?waarderingConceptValue . ?waarderingConceptValue skos:prefLabel ?waarderingLabelValue . }
  OPTIONAL { ?terrein ceo:registratiedatum ?registratiedatumValue . }
 }
}
GROUP BY ?terrein ?choi
LIMIT 100`;
}

export function parseStandaloneArcheologischTerreinResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const woonplaats = binding.woonplaats?.value;
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.archisNummer?.value || binding.choi?.value || "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.terrein?.value ?? "",
      name: binding.naam?.value,
      monumentNature: "archeologischterrein",
      description: binding.omschrijving?.value || "Archeologisch terrein.",
      place: woonplaats,
      municipality: woonplaats,
      archaeologicalValuation: binding.waarderingLabel?.value,
      archaeologicalValuationConceptUri: binding.waarderingConcept?.value,
    };
  });
}

const VONDSTLOCATIE_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "Archis-vondstmeldingsnummer", rang: 1, pattern: "?locatie ceo:archis2Vondstmeldingsnummer ?match ." },
  { bron: "Archis-waarnemingsnummer", rang: 2, pattern: "?locatie ceo:archis2Waarnemingsnummer ?match ." },
  { bron: "locatienaam", rang: 3, pattern: "?locatie ceo:heeftLocatieAanduiding/ceo:locatienaam ?match ." },
  { bron: "woonplaats (vondstlocatie)", rang: 4, pattern: "?locatie ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "omschrijving (vondstlocatie)", rang: 5, pattern: "?locatie ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "verwervingswijze", rang: 6, pattern: "?locatie ceo:heeftVerwerving/skos:prefLabel ?match ." },
];

export function buildVondstlocatieDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return VONDSTLOCATIE_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?choi ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?locatie a ceo:Vondstlocatie ; ceo:cultuurhistorischObjectnummer ?choi .
  ${pattern}
  ${bron.startsWith("Archis-") && /^\d+$/.test(term.trim())
    ? `FILTER(STR(?match) = "${needle}")`
    : `FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))`}
 }
}
LIMIT 100`,
  }));
}

export function parseVondstlocatieDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = VONDSTLOCATIE_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
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

export function buildVondstlocatieDetailsQuery(choNumbers: string[]) {
  const values = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?locatie ?choi
  (SAMPLE(STR(?vondstmeldingValue)) AS ?vondstmelding)
  (SAMPLE(STR(?waarnemingValue)) AS ?waarneming)
  (SAMPLE(STR(?locatienaamValue)) AS ?locatienaam)
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(STR(?woonplaatsValue)) AS ?woonplaats)
  (SAMPLE(?verwervingConceptValue) AS ?verwervingConcept)
  (SAMPLE(STR(?verwervingLabelValue)) AS ?verwervingLabel)
  (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?locatie a ceo:Vondstlocatie ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?choi { ${values} }
  OPTIONAL { ?locatie ceo:archis2Vondstmeldingsnummer ?vondstmeldingValue . }
  OPTIONAL { ?locatie ceo:archis2Waarnemingsnummer ?waarnemingValue . }
  OPTIONAL { ?locatie ceo:heeftLocatieAanduiding/ceo:locatienaam ?locatienaamValue . }
  OPTIONAL { ?locatie ceo:heeftOmschrijving/ceo:omschrijving ?omschrijvingValue . }
  OPTIONAL { ?locatie ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?woonplaatsValue . }
  OPTIONAL { ?locatie ceo:heeftVerwerving ?verwervingConceptValue . ?verwervingConceptValue skos:prefLabel ?verwervingLabelValue . }
  OPTIONAL { ?locatie ceo:registratiedatum ?registratiedatumValue . }
 }
}
GROUP BY ?locatie ?choi
LIMIT 100`;
}

export function parseVondstlocatieResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const woonplaats = binding.woonplaats?.value;
    const vondstmelding = binding.vondstmelding?.value;
    const waarneming = binding.waarneming?.value;
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: vondstmelding || waarneming || binding.choi?.value || "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.locatie?.value ?? "",
      name: binding.locatienaam?.value && binding.locatienaam.value !== "-" ? binding.locatienaam.value : undefined,
      monumentNature: "vondstlocatie",
      description: binding.omschrijving?.value || "Archeologische vondstlocatie.",
      place: woonplaats,
      municipality: woonplaats,
      archaeologicalAcquisition: binding.verwervingLabel?.value,
      archaeologicalAcquisitionConceptUri: binding.verwervingConcept?.value,
    };
  });
}

const GRONDSPOREN_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "CHO-nummer (grondspoor)", rang: 1, pattern: "BIND(?choi AS ?match)" },
  { bron: "omschrijving (grondspoor)", rang: 2, pattern: "?grondspoor ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "woonplaats (grondspoor)", rang: 3, pattern: "?grondspoor ceo:ligtInObject/ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "type grondspoor", rang: 4, pattern: "?grondspoor ceo:heeftType/ceo:heeftTypeNaam ?typeConcept . ?typeConcept skos:prefLabel ?match ." },
];

export function buildGrondsporenDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return GRONDSPOREN_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?choi ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?grondspoor a ceo:Grondsporen ; ceo:cultuurhistorischObjectnummer ?choi .
  ${pattern}
  ${bron.startsWith("CHO-") && /^\d+$/.test(term.trim())
    ? `FILTER(STR(?match) = "${needle}")`
    : `FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))`}
 }
}
LIMIT 100`,
  }));
}

export function parseGrondsporenDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = GRONDSPOREN_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
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

export function buildGrondsporenDetailsQuery(choNumbers: string[]) {
  const values = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?grondspoor ?choi
 (SAMPLE(STR(?aantalValue)) AS ?aantal)
 (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
 (SAMPLE(?typeConceptValue) AS ?typeConcept)
 (SAMPLE(STR(?typeLabelValue)) AS ?typeLabel)
 (SAMPLE(?vondstlocatieValue) AS ?vondstlocatie)
 (SAMPLE(STR(?vondstlocatieNaamValue)) AS ?vondstlocatieNaam)
 (SAMPLE(STR(?woonplaatsValue)) AS ?woonplaats)
 (SAMPLE(STR(?registratiedatumValue)) AS ?registratiedatum)
WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?grondspoor a ceo:Grondsporen ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?choi { ${values} }
  OPTIONAL { ?grondspoor ceo:aantalGrondsporen ?aantalValue . }
  OPTIONAL { ?grondspoor ceo:heeftOmschrijving/ceo:omschrijving ?omschrijvingValue . }
  OPTIONAL { ?grondspoor ceo:heeftType/ceo:heeftTypeNaam ?typeConceptValue . ?typeConceptValue skos:prefLabel ?typeLabelValue . }
  OPTIONAL {
   ?grondspoor ceo:ligtInObject ?vondstlocatieValue .
   OPTIONAL { ?vondstlocatieValue ceo:heeftLocatieAanduiding/ceo:locatienaam ?vondstlocatieNaamValue . }
   OPTIONAL { ?vondstlocatieValue ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?woonplaatsValue . }
  }
  OPTIONAL { ?grondspoor ceo:registratiedatum ?registratiedatumValue . }
 }
}
GROUP BY ?grondspoor ?choi
LIMIT 100`;
}

export function parseGrondsporenResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const choNumber = binding.choi?.value ?? "";
    const typeLabel = binding.typeLabel?.value;
    const description = binding.omschrijving?.value || "Archeologisch grondspoor.";
    const parentName = binding.vondstlocatieNaam?.value;
    return {
      choNumber,
      monumentNumber: choNumber,
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.grondspoor?.value ?? "",
      name: description.length <= 100 && description !== "Archeologisch grondspoor."
        ? description
        : typeLabel && typeLabel.toLocaleLowerCase("nl") !== "onbekend"
          ? typeLabel
          : undefined,
      monumentNature: "grondsporen",
      description,
      place: binding.woonplaats?.value,
      municipality: binding.woonplaats?.value,
      archaeologicalTraceCount: Number(binding.aantal?.value ?? "0"),
      archaeologicalType: typeLabel,
      archaeologicalTypeConceptUri: binding.typeConcept?.value,
      parentObjectUrl: binding.vondstlocatie?.value,
      parentObjectLabel: parentName && parentName !== "-" ? parentName : "Bijbehorende vondstlocatie",
    };
  });
}

const VONDSTEN_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "CHO-nummer (vondst)", rang: 1, pattern: "BIND(?choi AS ?match)" },
  { bron: "Archis-vondstnummer", rang: 2, pattern: "?vondst ceo:archis2Vondstnummer ?match ." },
  { bron: "omschrijving (vondst)", rang: 3, pattern: "?vondst ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "type vondst", rang: 4, pattern: "?vondst ceo:heeftType/ceo:heeftTypeNaam ?concept . ?concept skos:prefLabel ?match ." },
  { bron: "materiaal vondst", rang: 5, pattern: "?vondst ceo:heeftMateriaal/ceo:heeftMateriaalNaam ?concept . ?concept skos:prefLabel ?match ." },
  { bron: "toestand vondst", rang: 6, pattern: "?vondst ceo:heeftToestand ?concept . ?concept skos:prefLabel ?match ." },
  { bron: "woonplaats (vondst)", rang: 7, pattern: "?vondst ceo:ligtInObject/ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
];

export function buildVondstenDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return VONDSTEN_SOURCES.map(({ bron, pattern }) => {
    const exactNumber = /^\d+$/.test(term.trim()) && (bron.startsWith("CHO-") || bron.startsWith("Archis-"));
    const effectivePattern = exactNumber
      ? bron.startsWith("CHO-")
        ? `?vondst ceo:cultuurhistorischObjectnummer "${needle}" . BIND("${needle}" AS ?match)`
        : `?vondst ceo:archis2Vondstnummer "${needle}" . BIND("${needle}" AS ?match)`
      : pattern;
    return { bron, query: `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?choi ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?vondst a ceo:Vondsten ; ceo:cultuurhistorischObjectnummer ?choi .
  ${effectivePattern}
  ${exactNumber ? "" : `FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))`}
 }
}
LIMIT 100` };
  });
}

export function parseVondstenDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = VONDSTEN_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
  const needle = term.trim().toLocaleLowerCase("nl");
  return bindings.flatMap((binding) => {
    const monumentNumber = binding.choi?.value ?? "";
    const matchedText = binding.match?.value ?? "";
    if (!monumentNumber) return [];
    const lower = matchedText.toLocaleLowerCase("nl");
    const matchtype = lower === needle ? 0 : lower.startsWith(needle) ? 1 : 2;
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: rang * 10 + matchtype }];
  });
}

export type VondstenConceptField = "vondsttype" | "materiaal" | "toestand";

export function buildVondstenConceptQuery(conceptUri: string, field: VondstenConceptField) {
  const propertyPath = field === "vondsttype" ? "ceo:heeftType/ceo:heeftTypeNaam" : field === "materiaal" ? "ceo:heeftMateriaal/ceo:heeftMateriaalNaam" : "ceo:heeftToestand";
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?vondst a ceo:Vondsten ; ceo:cultuurhistorischObjectnummer ?choi ; ${propertyPath} <${conceptUri}> .
  BIND(?choi AS ?rmnr)
 }
}
LIMIT 100`;
}

export function buildVondstenDetailsQuery(choNumbers: string[]) {
  const values = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?vondst ?choi ?archisVondstnummer ?aantal ?omschrijving ?registratiedatum ?vondstlocatie ?vondstlocatieNaam ?woonplaats ?conceptSoort ?concept ?conceptLabel WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?vondst a ceo:Vondsten ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?choi { ${values} }
  OPTIONAL { ?vondst ceo:archis2Vondstnummer ?archisVondstnummer . }
  OPTIONAL { ?vondst ceo:aantalVondsten ?aantal . }
  OPTIONAL { ?vondst ceo:heeftOmschrijving/ceo:omschrijving ?omschrijving . }
  OPTIONAL { ?vondst ceo:registratiedatum ?registratiedatum . }
  OPTIONAL {
   ?vondst ceo:ligtInObject ?vondstlocatie .
   OPTIONAL { ?vondstlocatie ceo:heeftLocatieAanduiding/ceo:locatienaam ?vondstlocatieNaam . }
   OPTIONAL { ?vondstlocatie ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?woonplaats . }
  }
  OPTIONAL {
   { ?vondst ceo:heeftType/ceo:heeftTypeNaam ?concept . BIND("type" AS ?conceptSoort) }
   UNION { ?vondst ceo:heeftMateriaal/ceo:heeftMateriaalNaam ?concept . BIND("materiaal" AS ?conceptSoort) }
   UNION { ?vondst ceo:heeftStijlEnCultuur/ceo:heeftStijlEnCultuurNaam ?concept . BIND("stijl" AS ?conceptSoort) }
   UNION { ?vondst ceo:heeftToestand ?concept . BIND("toestand" AS ?conceptSoort) }
   ?concept skos:prefLabel ?conceptLabel .
  }
 }
}
ORDER BY ?choi ?conceptSoort ?conceptLabel
LIMIT 1000`;
}

export function parseVondstenResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const records = new Map<string, RceMonument>();
  const add = (target: ArchaeologyConcept[], concept: ArchaeologyConcept) => {
    if (!target.some((item) => item.uri === concept.uri)) target.push(concept);
  };
  for (const binding of bindings) {
    const choNumber = binding.choi?.value;
    const uri = binding.vondst?.value;
    if (!choNumber || !uri) continue;
    const description = binding.omschrijving?.value || "Archeologische vondst.";
    const record: RceMonument = records.get(choNumber) ?? {
      choNumber,
      monumentNumber: binding.archisVondstnummer?.value || choNumber,
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "", houseNumber: "", postalCode: "", sourceUrl: uri,
      name: description.length <= 100 && description !== "Archeologische vondst." ? description : undefined,
      monumentNature: "vondsten", description,
      place: binding.woonplaats?.value, municipality: binding.woonplaats?.value,
      archaeologicalFindCount: Number(binding.aantal?.value ?? "0"),
      archaeologicalFindTypes: [], archaeologicalMaterials: [], archaeologicalStyles: [],
      parentObjectUrl: binding.vondstlocatie?.value,
      parentObjectLabel: binding.vondstlocatieNaam?.value && binding.vondstlocatieNaam.value !== "-" ? binding.vondstlocatieNaam.value : "Bijbehorende vondstlocatie",
    };
    const concept = binding.concept?.value && binding.conceptLabel?.value ? { uri: binding.concept.value, label: binding.conceptLabel.value } : undefined;
    if (concept && binding.conceptSoort?.value === "type") add(record.archaeologicalFindTypes!, concept);
    if (concept && binding.conceptSoort?.value === "materiaal") add(record.archaeologicalMaterials!, concept);
    if (concept && binding.conceptSoort?.value === "stijl") add(record.archaeologicalStyles!, concept);
    if (concept && binding.conceptSoort?.value === "toestand") record.archaeologicalCondition = concept;
    records.set(choNumber, record);
  }
  return [...records.values()];
}

const ARCHEOLOGISCHE_COMPLEX_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "CHO-nummer (archeologisch complex)", rang: 1, pattern: "BIND(?choi AS ?match)" },
  { bron: "omschrijving (archeologisch complex)", rang: 2, pattern: "?complex ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "type archeologisch complex", rang: 3, pattern: "?complex ceo:heeftType/ceo:heeftTypeNaam ?concept . ?concept skos:prefLabel ?match ." },
  { bron: "woonplaats (archeologisch complex)", rang: 4, pattern: "?complex ceo:ligtInObject/ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
];

export function buildArcheologischeComplexDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const needle = escapeSparqlString(term.trim());
  return ARCHEOLOGISCHE_COMPLEX_SOURCES.map(({ bron, pattern }) => {
    const exact = /^\d+$/.test(term.trim()) && bron.startsWith("CHO-");
    const effective = exact ? `?complex ceo:cultuurhistorischObjectnummer "${needle}" . BIND("${needle}" AS ?match)` : pattern;
    return { bron, query: `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?choi ?match WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?complex a ceo:ArcheologischComplex ; ceo:cultuurhistorischObjectnummer ?choi .
  ${effective}
  ${exact ? "" : `FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))`}
 }
}
LIMIT 100` };
  });
}

export function parseArcheologischeComplexDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = ARCHEOLOGISCHE_COMPLEX_SOURCES.find((source) => source.bron === bron)?.rang ?? 99;
  const needle = term.trim().toLocaleLowerCase("nl");
  return bindings.flatMap((binding) => {
    const monumentNumber = binding.choi?.value ?? "";
    const matchedText = binding.match?.value ?? "";
    if (!monumentNumber) return [];
    const lower = matchedText.toLocaleLowerCase("nl");
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: rang * 10 + (lower === needle ? 0 : lower.startsWith(needle) ? 1 : 2) }];
  });
}

export function buildArcheologischeComplexConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?complex a ceo:ArcheologischComplex ; ceo:cultuurhistorischObjectnummer ?choi ; ceo:heeftType/ceo:heeftTypeNaam <${conceptUri}> .
  BIND(?choi AS ?rmnr)
 }
}
LIMIT 100`;
}

export function buildArcheologischeComplexDetailsQuery(choNumbers: string[]) {
  const values = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?complex ?choi ?omschrijving ?registratiedatum ?typeConcept ?typeLabel ?parent ?parentClass ?parentChoi ?parentNaam ?parentPlaats WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?complex a ceo:ArcheologischComplex ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?choi { ${values} }
  OPTIONAL { ?complex ceo:heeftOmschrijving/ceo:omschrijving ?omschrijving . }
  OPTIONAL { ?complex ceo:registratiedatum ?registratiedatum . }
  OPTIONAL { ?complex ceo:heeftType/ceo:heeftTypeNaam ?typeConcept . ?typeConcept skos:prefLabel ?typeLabel . }
  OPTIONAL {
   ?complex ceo:ligtInObject ?parent . ?parent a ?parentClass ; ceo:cultuurhistorischObjectnummer ?parentChoi .
   VALUES ?parentClass { ceo:Vondstlocatie ceo:ArcheologischTerrein ceo:ArcheologischOnderzoeksgebied }
   OPTIONAL { ?parent ceo:heeftLocatieAanduiding/ceo:locatienaam ?parentNaam . }
   OPTIONAL { ?parent ceo:heeftNaam/ceo:naam ?parentNaam . }
   OPTIONAL { ?parent ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?parentPlaats . }
  }
 }
}
ORDER BY ?choi ?parentClass ?parentChoi
LIMIT 500`;
}

export function parseArcheologischeComplexResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const records = new Map<string, RceMonument>();
  for (const binding of bindings) {
    const choNumber = binding.choi?.value;
    const uri = binding.complex?.value;
    if (!choNumber || !uri) continue;
    const typeConcept = binding.typeConcept?.value && binding.typeLabel?.value ? { uri: binding.typeConcept.value, label: binding.typeLabel.value } : undefined;
    const description = binding.omschrijving?.value || "Archeologisch complex.";
    const record: RceMonument = records.get(choNumber) ?? {
      choNumber, monumentNumber: choNumber, registrationDate: binding.registratiedatum?.value ?? "",
      street: "", houseNumber: "", postalCode: "", sourceUrl: uri,
      name: typeConcept && typeConcept.label.toLocaleLowerCase("nl") !== "complextype niet te bepalen" ? typeConcept.label : undefined,
      monumentNature: "archeologischcomplex", description,
      place: binding.parentPlaats?.value, municipality: binding.parentPlaats?.value,
      archaeologicalComplexType: typeConcept,
      archaeologicalContexts: [],
    };
    if (!record.place && binding.parentPlaats?.value) record.place = record.municipality = binding.parentPlaats.value;
    const parent = binding.parent?.value;
    const parentClass = binding.parentClass?.value ?? "";
    if (parent && !record.archaeologicalContexts!.some((item) => item.uri === parent)) {
      const type = parentClass.endsWith("Vondstlocatie") ? "Vondstlocatie" : parentClass.endsWith("ArcheologischTerrein") ? "Archeologisch terrein" : "Onderzoeksgebied";
      record.archaeologicalContexts!.push({ uri: parent, type, label: binding.parentNaam?.value && binding.parentNaam.value !== "-" ? binding.parentNaam.value : `${type} ${binding.parentChoi?.value ?? ""}`.trim() });
    }
    records.set(choNumber, record);
  }
  return [...records.values()];
}

export type ArchaeologyConcept = { uri: string; label: string; schemeUri?: string; schemeLabel?: string; schemes?: { uri: string; label: string }[] };
export type VondstlocatieComplex = { uri: string; choNumber: string; type?: ArchaeologyConcept };
export type VondstlocatieVondst = { uri: string; choNumber: string; archisVondstnummer?: string; aantal: number; types: ArchaeologyConcept[]; materialen: ArchaeologyConcept[]; stijlen: ArchaeologyConcept[]; toestand?: ArchaeologyConcept };
export type VondstlocatieGrondspoor = { uri: string; choNumber: string; aantal: number; type?: ArchaeologyConcept; wkt?: string };
export type VondstlocatieInhoud = { complexen: VondstlocatieComplex[]; vondsten: VondstlocatieVondst[]; grondsporen: VondstlocatieGrondspoor[]; complexenTotaal: number; vondstenTotaal: number; grondsporenTotaal: number };

export function buildVondstlocatieInhoudQuery(locatieUri: string) {
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?object ?klasse ?choi ?archisVondstnummer ?aantal ?conceptSoort ?concept ?conceptLabel ?wkt WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  <${locatieUri}> ceo:bevatObject ?object .
  ?object a ?klasse ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?klasse { ceo:ArcheologischComplex ceo:Vondsten ceo:Grondsporen }
  OPTIONAL { ?object ceo:archis2Vondstnummer ?archisVondstnummer . }
  OPTIONAL { ?object ceo:aantalVondsten ?aantalVondsten . }
  OPTIONAL { ?object ceo:aantalGrondsporen ?aantalGrondsporen . }
  BIND(COALESCE(?aantalVondsten, ?aantalGrondsporen, 0) AS ?aantal)
  OPTIONAL { ?object ceo:heeftGeometrie/geo:asWKT ?wkt . }
  OPTIONAL {
    { ?object ceo:heeftType/ceo:heeftTypeNaam ?concept . BIND("type" AS ?conceptSoort) }
    UNION { ?object ceo:heeftMateriaal/ceo:heeftMateriaalNaam ?concept . BIND("materiaal" AS ?conceptSoort) }
    UNION { ?object ceo:heeftStijlEnCultuur/ceo:heeftStijlEnCultuurNaam ?concept . BIND("stijl" AS ?conceptSoort) }
    UNION { ?object ceo:heeftToestand ?concept . BIND("toestand" AS ?conceptSoort) }
    ?concept skos:prefLabel ?conceptLabel .
  }
 }
}
ORDER BY ?klasse ?choi
LIMIT 500`;
}

export function buildVondstlocatieInhoudTellingQuery(locatieUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT
 (COUNT(DISTINCT ?complex) AS ?complexenTotaal)
 (COUNT(DISTINCT ?vondst) AS ?vondstenTotaal)
 (COUNT(DISTINCT ?grondspoor) AS ?grondsporenTotaal)
WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  OPTIONAL { <${locatieUri}> ceo:bevatObject ?complex . ?complex a ceo:ArcheologischComplex . }
  OPTIONAL { <${locatieUri}> ceo:bevatObject ?vondst . ?vondst a ceo:Vondsten . }
  OPTIONAL { <${locatieUri}> ceo:bevatObject ?grondspoor . ?grondspoor a ceo:Grondsporen . }
 }
}`;
}

export function parseVondstlocatieInhoudResults(document: unknown): Omit<VondstlocatieInhoud, "complexenTotaal" | "vondstenTotaal" | "grondsporenTotaal"> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const complexen = new Map<string, VondstlocatieComplex>();
  const vondsten = new Map<string, VondstlocatieVondst>();
  const grondsporen = new Map<string, VondstlocatieGrondspoor>();
  const addConcept = (target: ArchaeologyConcept[], concept: ArchaeologyConcept) => {
    if (!target.some((item) => item.uri === concept.uri)) target.push(concept);
  };
  for (const binding of bindings) {
    const uri = binding.object?.value;
    const choNumber = binding.choi?.value;
    const klasse = binding.klasse?.value;
    if (!uri || !choNumber || !klasse) continue;
    const concept = binding.concept?.value && binding.conceptLabel?.value ? { uri: binding.concept.value, label: binding.conceptLabel.value } : undefined;
    const soort = binding.conceptSoort?.value;
    if (klasse.endsWith("ArcheologischComplex")) {
      const item = complexen.get(uri) ?? { uri, choNumber };
      if (concept && soort === "type") item.type = concept;
      complexen.set(uri, item);
    } else if (klasse.endsWith("Vondsten")) {
      const item = vondsten.get(uri) ?? { uri, choNumber, archisVondstnummer: binding.archisVondstnummer?.value, aantal: Number(binding.aantal?.value ?? "0"), types: [], materialen: [], stijlen: [] };
      if (concept && soort === "type") addConcept(item.types, concept);
      if (concept && soort === "materiaal") addConcept(item.materialen, concept);
      if (concept && soort === "stijl") addConcept(item.stijlen, concept);
      if (concept && soort === "toestand") item.toestand = concept;
      vondsten.set(uri, item);
    } else if (klasse.endsWith("Grondsporen")) {
      const item = grondsporen.get(uri) ?? { uri, choNumber, aantal: Number(binding.aantal?.value ?? "0"), wkt: binding.wkt?.value };
      if (concept && soort === "type") item.type = concept;
      grondsporen.set(uri, item);
    }
  }
  return { complexen: [...complexen.values()].slice(0, 25), vondsten: [...vondsten.values()].slice(0, 25), grondsporen: [...grondsporen.values()].slice(0, 25) };
}

export function parseVondstlocatieInhoudTelling(document: unknown) {
  const binding = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings?.[0];
  return { complexenTotaal: Number(binding?.complexenTotaal?.value ?? "0"), vondstenTotaal: Number(binding?.vondstenTotaal?.value ?? "0"), grondsporenTotaal: Number(binding?.grondsporenTotaal?.value ?? "0") };
}

export function parseReferentienetwerkTermSuggestResults(document: unknown): TermSuggestion[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.concept?.value;
    const label = binding.label?.value;
    if (!uri || !label) return [];
    return [{
      uri,
      label,
      sourceUri: binding.scheme?.value ?? "https://data.cultureelerfgoed.nl/term/id/rn/2",
      sourceName: binding.schemeLabel?.value ?? "Referentienetwerk 2",
    }];
  });
}

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
