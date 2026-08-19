import { scoreDiscoveryMatch, type DiscoveryMatch } from "./monuments.ts";
import { OBJECT_KIND, type RceMonument } from "./types.ts";
import { wktToLatLng } from "./geometry.ts";
import { escapeSparqlString } from "./sparql.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";

type SparqlBinding = Record<string, { value?: string }>;

// Een archeologisch Rijksmonument is doorgaans ook als zelfstandig
// ArcheologischTerrein geregistreerd. Deze query verrijkt een Rijksmonument
// via de eigen CHO-subject-URI.
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

const GEO = "http://www.opengis.net/ont/geosparql#";
const GEOF = "http://www.opengis.net/def/function/geosparql/";
// ~1,1km bij deze breedtegraad - ruim genoeg voor een lokaal opgravings-/
// onderzoeksgebied rond een gebouw, maar mist in theorie een zeldzaam,
// regionaal onderzoeksgebied dat zelf groter is dan deze marge (017-
// archeologische-context-onderzoeksgebied.md, bekende beperking: de eerste
// schijf optimaliseert niet verder dan dit).
export const ARCHEOLOGISCHE_CONTEXT_BBOX_PADDING_DEGREES = 0.01;

export type ArcheologischeContext = { onderzoeksgebiedUri: string; choNummer: string; omschrijving?: string; wkt: string };

// Live, on-demand "ligt dit gebouwde Rijksmonument op archeologie"-check
// (017-archeologische-context-onderzoeksgebied.md). Geen gemodelleerde
// relatie in de brondata (net als bij 006-werelderfgoed-ligt-in.md), wel
// geometrisch af te leiden - maar ArcheologischOnderzoeksgebied telt 112.184
// instanties met geometrie, te veel om als vaste kandidatenset per
// Rijksmonument te toetsen (dat werkte voor Werelderfgoed/Gezicht, 18/472
// instanties). Daarom hier wél een bounding-box-voorfilter nodig, net als
// het oorspronkelijke (later verworpen) offline ontwerp van slice 006: eerst
// een goedkope bbox-toets tegen alle 112.184 instanties (~15s, gemeten),
// dan een dure exacte geof:sfOverlaps-toets alleen op die kleine
// kandidatenset (~0,3-0,8s, gemeten). Vandaar de knop-en-wachttijd-UX in
// plaats van een lazy aanroep zoals bij Werelderfgoed/Gezicht.
export function buildRijksmonumentGeometrieQuery(monumentNumber: string) {
  const number = escapeSparqlString(monumentNumber);
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <${GEO}>
SELECT ?wkt WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:rijksmonumentnummer "${number}" ; ceo:heeftGeometrie/geo:asWKT ?wkt .
  }
}`;
}

export function parseRijksmonumentGeometrieResult(document: unknown): string | undefined {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  return bindings?.[0]?.wkt?.value;
}

// Fase 1: goedkope bbox-voorfilter. Alleen de URI - geometrie en omschrijving
// worden pas in fase 2 opgehaald, voor de kleine, overgebleven kandidatenset.
export function buildArcheologischeContextKandidatenQuery(bboxWkt: string) {
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <${GEO}>
PREFIX geof: <${GEOF}>
SELECT ?og WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?og a ceo:ArcheologischOnderzoeksgebied ; ceo:heeftGeometrie/geo:asWKT ?ogWkt .
    FILTER(geof:sfWithin(?ogWkt, "${bboxWkt}"^^geo:wktLiteral))
  }
}`;
}

export function parseArcheologischeContextKandidaten(document: unknown): string[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => (binding.og?.value ? [binding.og.value] : []));
}

// Fase 2: exacte overlap-toets, alleen op de kandidaten uit fase 1. Het
// Rijksmonument-WKT wordt direct als literal ingebed (net als bij de
// Werelderfgoed-query's voor 006) - een gebouwvoetafdruk is klein genoeg om
// dat veilig te doen, in tegenstelling tot de megabytes-grote
// Werelderfgoed-polygonen die daar destijds wél problemen gaven.
//
// ?ogWkt wordt hier al opgehaald om geof:sfOverlaps zelf te kunnen toetsen -
// dus ook meegeven in de SELECT kost geen extra aanroep. Nodig om de
// gevonden Onderzoeksgebieden straks als polygoon op een kaart te tonen
// i.p.v. alleen als tekst (vervolg op 017, zie de kaart-toevoeging in
// HeritageDetailDialog.tsx).
export function buildArcheologischeContextExacteQuery(rmWkt: string, kandidaatUris: string[]) {
  const values = kandidaatUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <${GEO}>
PREFIX geof: <${GEOF}>
SELECT ?og (SAMPLE(STR(?choiValue)) AS ?choi) (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving) (SAMPLE(STR(?ogWkt)) AS ?wkt) WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?og { ${values} }
    ?og ceo:cultuurhistorischObjectnummer ?choiValue ; ceo:heeftGeometrie/geo:asWKT ?ogWkt .
    OPTIONAL { ?og ceo:heeftOmschrijving/ceo:omschrijving ?omschrijvingValue . }
    FILTER(geof:sfOverlaps("${rmWkt}"^^geo:wktLiteral, ?ogWkt))
  }
}
GROUP BY ?og`;
}

export function parseArcheologischeContextResults(document: unknown): ArcheologischeContext[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const onderzoeksgebiedUri = binding.og?.value;
    const choNummer = binding.choi?.value;
    const wkt = binding.wkt?.value;
    if (!onderzoeksgebiedUri || !choNummer || !wkt) return [];
    return [{ onderzoeksgebiedUri, choNummer, omschrijving: binding.omschrijving?.value, wkt }];
  });
}

export type ArcheologischTerrein = {
  archisMonumentnummer?: string;
  waardering?: string;
  waarderingConceptUri?: string;
};

export function parseArcheologischTerreinResults(document: unknown): Map<string, ArcheologischTerrein[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, ArcheologischTerrein[]>();
  if (!Array.isArray(bindings)) return byMonument;
  for (const binding of bindings) {
    const monumentUri = binding.rm?.value;
    if (!monumentUri) continue;
    const terrein: ArcheologischTerrein = {
      archisMonumentnummer: binding.archisNummer?.value,
      waardering: binding.waarderingLabel?.value,
      waarderingConceptUri: binding.waarderingConcept?.value,
    };
    byMonument.set(monumentUri, [...(byMonument.get(monumentUri) ?? []), terrein]);
  }
  return byMonument;
}

const ARCHEOLOGISCH_ONDERZOEK_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "CHO-nummer (onderzoeksgebied)", rang: 1, pattern: "BIND(?choi AS ?match)" },
  { bron: "woonplaats (onderzoeksgebied)", rang: 2, pattern: "?gebied ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "omschrijving (onderzoeksgebied)", rang: 3, pattern: "?gebied ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
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
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
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
      monumentNature: OBJECT_KIND.ArcheologischOnderzoeksgebied,
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
export type OnderzoeksgebiedComplex = { complexUri: string; choNumber: string; type?: ArchaeologyConcept };
export type OnderzoeksgebiedVondstlocatie = { vlUri: string; choNumber: string; locatienaam?: string };
export type OnderzoeksgebiedAggregaten = { vondstlocatieTotaal: number; grondsporenTotaal: number; vondstenTotaal: number; complexenViaVondstlocatieTotaal: number };

export function buildOnderzoeksgebiedComplexenQuery(gebiedUri: string) {
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?complex ?choi ?typeConcept
  (SAMPLE(STR(?typeLabelValue)) AS ?typeLabel)
WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    <${gebiedUri}> ceo:bevatObject ?complex .
    ?complex a ceo:ArcheologischComplex ; ceo:cultuurhistorischObjectnummer ?choi .
    OPTIONAL { ?complex ceo:heeftType/ceo:heeftTypeNaam ?typeConcept . ?typeConcept skos:prefLabel ?typeLabelValue . }
  }
}
GROUP BY ?complex ?choi ?typeConcept
LIMIT 100`;
}

export function parseOnderzoeksgebiedComplexenResults(document: unknown): OnderzoeksgebiedComplex[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => ({
    complexUri: binding.complex?.value ?? "",
    choNumber: binding.choi?.value ?? "",
    type: binding.typeConcept?.value && binding.typeLabel?.value
      ? { uri: binding.typeConcept.value, label: binding.typeLabel.value }
      : undefined,
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

const ARCHEOLOGISCH_TERREIN_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "CHO-nummer (archeologisch terrein)", rang: 1, pattern: "BIND(?choi AS ?match)" },
  { bron: "Archis-monumentnummer", rang: 2, pattern: "?terrein ceo:archis2Monumentnummer ?match ." },
  { bron: "naam (archeologisch terrein)", rang: 3, pattern: "?terrein ceo:heeftNaam/ceo:naam ?match ." },
  { bron: "woonplaats (archeologisch terrein)", rang: 4, pattern: "?terrein ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "omschrijving (archeologisch terrein)", rang: 5, pattern: "?terrein ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "waardering (archeologisch terrein)", rang: 6, pattern: "?terrein ceo:heeftArcheologischeWaardering/skos:prefLabel ?match ." },
];

export type ArchaeologyBrowseKind =
  | "archeologischterrein"
  | "onderzoeksgebied"
  | "vondstlocatie"
  | "archeologischcomplex"
  | "vondsten"
  | "grondsporen";

// Collecties worden alleen op hun stabiele CHO-nummer gepagineerd. De
// bestaande detailquery haalt daarna voor precies deze 25 nummers de
// inhoudelijke velden op; zo hoeft een zware detailquery nooit de volledige
// archeologische collectie te sorteren.
export function buildArchaeologyBrowseQuery(kind: ArchaeologyBrowseKind, page: number) {
  const className = {
    archeologischterrein: "ArcheologischTerrein",
    onderzoeksgebied: "ArcheologischOnderzoeksgebied",
    vondstlocatie: "Vondstlocatie",
    archeologischcomplex: "ArcheologischComplex",
    vondsten: "Vondsten",
    grondsporen: "Grondsporen",
  }[kind];
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
  ${(bron === "Archis-monumentnummer" || bron.startsWith("CHO-nummer")) && /^\d+$/.test(term.trim())
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
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
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
  (SAMPLE(?rmValue) AS ?rm)
  (SAMPLE(STR(?rmnrValue)) AS ?rmnr)
  (SAMPLE(STR(?rmNaamValue)) AS ?rmNaam)
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
  OPTIONAL {
   ?terrein ceo:ligtInObject ?rmValue .
   ?rmValue a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnrValue .
   OPTIONAL { ?rmValue ceo:heeftNaam/ceo:naam ?rmNaamValue . }
  }
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
    const rmnr = binding.rmnr?.value;
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.archisNummer?.value || binding.choi?.value || "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.terrein?.value ?? "",
      name: binding.naam?.value,
      monumentNature: OBJECT_KIND.ArcheologischTerrein,
      description: binding.omschrijving?.value || "Archeologisch terrein.",
      place: woonplaats,
      municipality: woonplaats,
      archaeologicalValuation: binding.waarderingLabel?.value,
      archaeologicalValuationConceptUri: binding.waarderingConcept?.value,
      parentObjectUrl: binding.rm?.value,
      parentObjectLabel: rmnr ? (binding.rmNaam?.value || `Rijksmonument ${rmnr}`) : undefined,
      parentObjectNumber: rmnr,
    };
  });
}

const VONDSTLOCATIE_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "CHO-nummer (vondstlocatie)", rang: 1, pattern: "BIND(?choi AS ?match)" },
  { bron: "Archis-vondstmeldingsnummer", rang: 2, pattern: "?locatie ceo:archis2Vondstmeldingsnummer ?match ." },
  { bron: "Archis-waarnemingsnummer", rang: 3, pattern: "?locatie ceo:archis2Waarnemingsnummer ?match ." },
  { bron: "locatienaam", rang: 4, pattern: "?locatie ceo:heeftLocatieAanduiding/ceo:locatienaam ?match ." },
  { bron: "woonplaats (vondstlocatie)", rang: 5, pattern: "?locatie ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie/ceo:woonplaatsnaam ?match ." },
  { bron: "omschrijving (vondstlocatie)", rang: 6, pattern: "?locatie ceo:heeftOmschrijving/ceo:omschrijving ?match ." },
  { bron: "verwervingswijze", rang: 7, pattern: "?locatie ceo:heeftVerwerving/skos:prefLabel ?match ." },
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
  ${(bron.startsWith("Archis-") || bron.startsWith("CHO-nummer")) && /^\d+$/.test(term.trim())
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
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
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
  (SAMPLE(?gebiedValue) AS ?gebied)
  (SAMPLE(STR(?gebiedChoiValue)) AS ?gebiedChoi)
  (SAMPLE(STR(?gebiedNaamValue)) AS ?gebiedNaam)
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
  OPTIONAL {
   ?locatie ceo:ligtInObject ?gebiedValue .
   ?gebiedValue a ceo:ArcheologischOnderzoeksgebied ; ceo:cultuurhistorischObjectnummer ?gebiedChoiValue .
   OPTIONAL { ?gebiedValue ceo:heeftNaam/ceo:naam ?gebiedNaamValue . }
  }
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
    const gebiedChoi = binding.gebiedChoi?.value;
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: vondstmelding || waarneming || binding.choi?.value || "",
      registrationDate: binding.registratiedatum?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: "",
      sourceUrl: binding.locatie?.value ?? "",
      name: binding.locatienaam?.value && binding.locatienaam.value !== "-" ? binding.locatienaam.value : undefined,
      monumentNature: OBJECT_KIND.Vondstlocatie,
      description: binding.omschrijving?.value || "Archeologische vondstlocatie.",
      place: woonplaats,
      municipality: woonplaats,
      archaeologicalAcquisition: binding.verwervingLabel?.value,
      archaeologicalAcquisitionConceptUri: binding.verwervingConcept?.value,
      parentObjectUrl: binding.gebied?.value,
      parentObjectLabel: gebiedChoi ? (binding.gebiedNaam?.value || `Onderzoeksgebied ${gebiedChoi}`) : undefined,
      parentObjectNumber: gebiedChoi,
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
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
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
 (SAMPLE(STR(?vondstlocatieChoiValue)) AS ?vondstlocatieChoi)
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
   OPTIONAL { ?vondstlocatieValue ceo:cultuurhistorischObjectnummer ?vondstlocatieChoiValue . }
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
      monumentNature: OBJECT_KIND.Grondsporen,
      description,
      place: binding.woonplaats?.value,
      municipality: binding.woonplaats?.value,
      archaeologicalTraceCount: Number(binding.aantal?.value ?? "0"),
      archaeologicalType: typeLabel,
      archaeologicalTypeConceptUri: binding.typeConcept?.value,
      parentObjectUrl: binding.vondstlocatie?.value,
      parentObjectLabel: parentName && parentName !== "-" ? parentName : "Bijbehorende vondstlocatie",
      parentObjectNumber: binding.vondstlocatieChoi?.value,
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
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
  });
}

export function buildVondstenDetailsQuery(choNumbers: string[]) {
  const values = choNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?vondst ?choi ?archisVondstnummer ?aantal ?omschrijving ?registratiedatum ?vondstlocatie ?vondstlocatieChoi ?vondstlocatieNaam ?woonplaats ?conceptSoort ?concept ?conceptLabel WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?vondst a ceo:Vondsten ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?choi { ${values} }
  OPTIONAL { ?vondst ceo:archis2Vondstnummer ?archisVondstnummer . }
  OPTIONAL { ?vondst ceo:aantalVondsten ?aantal . }
  OPTIONAL { ?vondst ceo:heeftOmschrijving/ceo:omschrijving ?omschrijving . }
  OPTIONAL { ?vondst ceo:registratiedatum ?registratiedatum . }
  OPTIONAL {
   ?vondst ceo:ligtInObject ?vondstlocatie .
   OPTIONAL { ?vondstlocatie ceo:cultuurhistorischObjectnummer ?vondstlocatieChoi . }
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
      monumentNature: OBJECT_KIND.Vondsten, description,
      place: binding.woonplaats?.value, municipality: binding.woonplaats?.value,
      archaeologicalFindCount: Number(binding.aantal?.value ?? "0"),
      archaeologicalFindTypes: [], archaeologicalMaterials: [], archaeologicalStyles: [],
      parentObjectUrl: binding.vondstlocatie?.value,
      parentObjectLabel: binding.vondstlocatieNaam?.value && binding.vondstlocatieNaam.value !== "-" ? binding.vondstlocatieNaam.value : "Bijbehorende vondstlocatie",
      parentObjectNumber: binding.vondstlocatieChoi?.value,
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
    return [{ monumentNumber, matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
  });
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
      monumentNature: OBJECT_KIND.ArcheologischComplex, description,
      place: binding.parentPlaats?.value, municipality: binding.parentPlaats?.value,
      archaeologicalComplexType: typeConcept,
      archaeologicalContexts: [],
    };
    if (!record.place && binding.parentPlaats?.value) record.place = record.municipality = binding.parentPlaats.value;
    const parent = binding.parent?.value;
    const parentClass = binding.parentClass?.value ?? "";
    if (parent && !record.archaeologicalContexts!.some((item) => item.uri === parent)) {
      const type = parentClass.endsWith("Vondstlocatie") ? "Vondstlocatie" : parentClass.endsWith("ArcheologischTerrein") ? "Archeologisch terrein" : "Onderzoeksgebied";
      const parentChoNumber = binding.parentChoi?.value ?? "";
      record.archaeologicalContexts!.push({ uri: parent, choNumber: parentChoNumber, type, label: binding.parentNaam?.value && binding.parentNaam.value !== "-" ? binding.parentNaam.value : `${type} ${parentChoNumber}`.trim() });
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

export const VONDSTLOCATIE_INHOUD_KLASSEN = ["ArcheologischComplex", "Grondsporen", "Vondsten"] as const;
export type VondstlocatieInhoudKlasse = (typeof VONDSTLOCATIE_INHOUD_KLASSEN)[number];

// Vóór deze wijziging deelden ArcheologischComplex, Grondsporen en Vondsten
// één gezamenlijke `LIMIT 500` op triples (niet op objecten - elk
// concept-veld levert een eigen rij op), gesorteerd op ?klasse. Omdat
// "Vondsten" daarin alfabetisch als laatste sorteert, kon een vondstlocatie
// met genoeg complexen/grondsporen-rijen de Vondsten-rijen volledig
// verdringen: de UI toonde dan een positief aantal (uit de aparte,
// onbegrensde buildVondstlocatieInhoudTellingQuery) naast een lege lijst,
// niet te onderscheiden van een echte bug. Elke klasse krijgt daarom nu een
// eigen, onafhankelijke query en limiet (zie fetchVondstlocatieInhoud in
// lib/server/rce-adapter.ts, dat de drie documenten samenvoegt).
export function buildVondstlocatieInhoudQuery(locatieUri: string, klasse: VondstlocatieInhoudKlasse) {
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?object ?klasse ?choi ?archisVondstnummer ?aantal ?conceptSoort ?concept ?conceptLabel ?wkt WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  <${locatieUri}> ceo:bevatObject ?object .
  ?object a ?klasse ; ceo:cultuurhistorischObjectnummer ?choi .
  VALUES ?klasse { ceo:${klasse} }
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
ORDER BY ?choi
LIMIT 200`;
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

// Voegt de drie per-klasse documenten van buildVondstlocatieInhoudQuery
// samen. Elk document bevat door de eigen VALUES-klausel alleen rijen van
// zijn eigen klasse, dus de andere twee velden zijn al leeg - platslaan en
// opnieuw cappen op 25 is daarom voldoende, zonder dat er dubbele URI's
// tussen documenten kunnen ontstaan.
export function mergeVondstlocatieInhoud(
  parts: Omit<VondstlocatieInhoud, "complexenTotaal" | "vondstenTotaal" | "grondsporenTotaal">[],
): Omit<VondstlocatieInhoud, "complexenTotaal" | "vondstenTotaal" | "grondsporenTotaal"> {
  return {
    complexen: parts.flatMap((part) => part.complexen).slice(0, 25),
    vondsten: parts.flatMap((part) => part.vondsten).slice(0, 25),
    grondsporen: parts.flatMap((part) => part.grondsporen).slice(0, 25),
  };
}

export function parseVondstlocatieInhoudTelling(document: unknown) {
  const binding = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings?.[0];
  return { complexenTotaal: Number(binding?.complexenTotaal?.value ?? "0"), vondstenTotaal: Number(binding?.vondstenTotaal?.value ?? "0"), grondsporenTotaal: Number(binding?.grondsporenTotaal?.value ?? "0") };
}
