import type { RceMonument } from "./types.ts";
import { wktToLatLng } from "./geometry.ts";
import { escapeSparqlString } from "./sparql.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const RM_TYPE = `${CEO}Rijksmonument`;
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const WERELDERFGOED_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/werelderfgoed_hvdl";
const GEZICHT_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/gezicht_hvdl";
const RIJKSMONUMENT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864";
const GEZICHT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/fd968529-bf70-4afa-8564-7c6c2fcfcc54";

type SparqlBinding = Record<string, { value?: string }>;
type JsonLdValue = { "@id"?: string; "@value"?: string };
type JsonLdNode = Record<string, unknown> & { "@id": string; "@type"?: string[] };

export const RCE_SEMANTICS = Object.freeze({
  instancesGraph: INSTANCES_GRAPH,
  activeLegalStatus: RIJKSMONUMENT_STATUS,
  formalStatementRequiredFor: ["oorspronkelijke functie", "huidige functie", "formele omschrijving"],
  ranking: ["oorspronkelijke functie", "huidige functie", "type", "monumentaard", "naam", "formele omschrijving", "volledig adres", "woonplaats"],
});

export const PROVINCE_NAMES: Record<string, string> = {
  DR: "Drenthe", FL: "Flevoland", FR: "Friesland", GE: "Gelderland",
  GR: "Groningen", LI: "Limburg", NB: "Noord-Brabant", NH: "Noord-Holland",
  OV: "Overijssel", UT: "Utrecht", ZL: "Zeeland", ZH: "Zuid-Holland",
};

export function provinceName(code?: string): string | undefined {
  return code ? PROVINCE_NAMES[code] ?? code : undefined;
}

export type RceParcel = {
  municipality: string;
  municipalityCode: string;
  section: string;
  parcelNumber: string;
  provinceCode: string;
};

export type DiscoveryMatch = { monumentNumber: string; matchSource: string; matchedText: string; matchScore: number };

export type ComplexMembership = { complexnummer?: string; complexnaam?: string; role: "hoofdobject" | "onderdeel" };

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

export function buildRijksmonumentenBrowseQuery(page: number) {
  const offset = Math.max(0, page - 1) * 25;
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ;
        ceo:rijksmonumentnummer ?rmnr ;
        ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
  }
}
ORDER BY xsd:integer(?rmnr)
LIMIT 25
OFFSET ${offset}`;
}

export function parseRijksmonumentenBrowseNumbers(document: unknown): string[] {
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
  (GROUP_CONCAT(DISTINCT CONCAT(STR(?functieConcept), "~~", STR(?functieLabel)); separator="||") AS ?functieConcepten)
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
    OPTIONAL {
      { ?cho ceo:heeftOorspronkelijkeFunctie ?functieNode . }
      UNION
      { ?cho ceo:heeftHuidigeFunctie ?functieNode . }
      ?functieNode ceo:formeelStandpunt true ; ceo:heeftFunctieNaam ?functieConcept .
      ?functieConcept skos:prefLabel ?functieLabel .
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
    functionConcepts: binding.functieConcepten?.value?.split("||").flatMap((value) => {
      const [uri, label] = value.split("~~");
      return uri && label ? [{ uri, label }] : [];
    }) ?? [],
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
  const filter = term
    ? `FILTER(
      CONTAINS(LCASE(STR(?naamValue)), "${needle}") ||
      STR(?complexnummer) = "${escapeSparqlString(term)}" ||
      STR(?choi) = "${escapeSparqlString(term)}"
    )`
    : "";
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
