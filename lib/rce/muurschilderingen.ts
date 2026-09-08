// Muurschilderingen (019-muurschilderingen.md): gebouwen met muurschilderingen
// uit de RCE Muurschilderingendatabase. Net als scheepswrakken.ts (MASS) is
// dit een losstaande SPARQL-dienst (rce/Muurschilderingen i.p.v. rce/cho) met
// een eigen vocabulaire - hier zelfs een mix van drie (schema.org, een eigen
// mural-ontologie en het Gouda Tijdmachine-vocabulaire gtm:) - vandaar weer
// een volledig eigen module.
//
// Primair object is het gebouw (beslissing 1 in 019-muurschilderingen.md),
// met de schilderingen erin als onderdeel van het detail - niet de
// schilderingen zelf als los doorzoekbaar object.
import { escapeSparqlString } from "./sparql.ts";
import { scoreDiscoveryMatch, type DiscoveryMatch } from "./monuments.ts";
import { wktToLatLng } from "./geometry.ts";

export const MUUR_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/Muurschilderingen/sparql";
const GTM = "https://www.goudatijdmachine.nl/def#";
const DCTERMS = "http://purl.org/dc/terms/";
const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const MAPPING = "http://omeka.org/s/vocabs/module/mapping#";
const SCHEMA = "https://schema.org/";
const SEM = "http://semanticweb.cs.vu.nl/2009/11/sem/";
// GEOSPARQL van de hoofddienst (rce/cho), voor de rijksmonument-centroid-
// coördinaatfallback hieronder - een ander endpoint dan MUUR_ENDPOINT.
const RCE_INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
// Elke item-URI (gebouw, schildering, persoon, organisatie) is
// https://muurschilderingendatabase.nl/api/items/<geheel getal> - één
// gedeelde, doorlopende Omeka-ID-ruimte over alle entiteitstypen heen
// (empirisch gecontroleerd: data/raw/{gebouwen,paintings,personen}.json in
// de eigen explorer-repo delen dezelfde nummerreeks).
const ITEM_BASE = "https://muurschilderingendatabase.nl/api/items/";

type SparqlBinding = Record<string, { value?: string } | undefined>;

export type MuurschilderingGebouw = {
  uri: string;
  id: string;
  naam: string;
  identifier?: string;
  plaats?: string;
  rijksmonumentnummer?: string;
  huidigeFunctie?: string;
  lat?: number;
  lng?: number;
};

export type Muurschildering = {
  titel?: string;
  beschrijving?: string;
  dateringVan?: string;
  dateringTot?: string;
  dateringTekst?: string;
  locatieomschrijving?: string;
  makers: string[];
};

function idFromUri(uri: string): string {
  const match = uri.match(/\/items\/(\d+)$/);
  return match ? match[1] : uri.slice(uri.lastIndexOf("/") + 1);
}

// Coördinaten komen uit een Omeka mapping-module zonder lat/lon-onderscheid
// in het predicate zelf (m:geography-coordinates, twee keer per gebouw) -
// op waardebereik classificeren, zoals de eigen explorer al deed
// (scripts/fetch.py, split_lat_lon). Deze dataset is Nederland-only.
function splitLatLon(rawValues: string[]): { lat: number; lng: number } | undefined {
  const values = rawValues.map(Number).filter((value) => Number.isFinite(value));
  const lat = values.find((value) => value >= 50 && value <= 54);
  const lng = values.find((value) => value >= 3 && value <= 7.6);
  if (lat === undefined || lng === undefined) return undefined;
  return { lat, lng };
}

// bron/rang: naam (gebouwnaam) en plaats zijn directe velden op het gebouw
// zelf; maker vereist een extra sprong via de schilderingen die het gebouw
// bevat (dcterms:creator staat op schema:Painting, niet op het gebouw) -
// vandaar een eigen queryvorm i.p.v. het GEBOUW_SOURCES-sjabloon hieronder.
// rijksmonumentnummer is exact (geen CONTAINS) en alleen relevant bij een
// numerieke term - zelfde patroon als scheepswrakken.ts' MASS-nummer-tak,
// en direct de sterke koppeling uit punt 3 van 019-muurschilderingen.md.
const GEBOUW_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "naam", rang: 1, pattern: `?v <${DCTERMS}title> ?match .` },
  { bron: "plaats", rang: 2, pattern: `?v <${CEO}woonplaatsnaam> ?match .` },
];
const BRON_RANG: Record<string, number> = { rijksmonumentnummer: 0, naam: 1, plaats: 2, maker: 3 };

export function buildMuurschilderingDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const trimmed = term.trim();
  const needle = escapeSparqlString(trimmed);
  const queries = GEBOUW_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX gtm: <${GTM}>
SELECT DISTINCT ?v ?match WHERE {
  ?v a gtm:Gebouw .
  ${pattern}
  FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))
}
LIMIT 100`,
  }));
  queries.push({
    bron: "maker",
    query: `PREFIX gtm: <${GTM}>
PREFIX dcterms: <${DCTERMS}>
PREFIX schema: <${SCHEMA}>
SELECT DISTINCT ?v ?match WHERE {
  VALUES ?makerType { schema:Person schema:Organization }
  ?maker a ?makerType ; dcterms:title ?match .
  ?painting dcterms:creator ?maker ; schema:location ?v .
  ?v a gtm:Gebouw .
  FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))
}
LIMIT 100`,
  });
  if (/^\d{1,6}$/.test(trimmed)) {
    queries.push({
      bron: "rijksmonumentnummer",
      query: `PREFIX gtm: <${GTM}>
PREFIX ceo: <${CEO}>
SELECT DISTINCT ?v (STR("${needle}") AS ?match) WHERE {
  ?v a gtm:Gebouw ; ceo:rijksmonumentnummer "${needle}" .
}
LIMIT 5`,
    });
  }
  return queries;
}

export function parseMuurschilderingDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = BRON_RANG[bron] ?? 99;
  const needle = term.trim().toLocaleLowerCase("nl");
  return bindings.flatMap((binding) => {
    const uri = binding.v?.value;
    if (!uri) return [];
    const matchedText = binding.match?.value ?? "";
    return [{ monumentNumber: idFromUri(uri), matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
  });
}

export function buildMuurschilderingGebouwDetailsQuery(ids: string[]): string {
  const values = ids.map((id) => `<${ITEM_BASE}${escapeSparqlString(id)}>`).join(" ");
  return `PREFIX gtm: <${GTM}>
PREFIX dcterms: <${DCTERMS}>
PREFIX ceo: <${CEO}>
PREFIX m: <${MAPPING}>
SELECT ?v
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?identifierValue)) AS ?identifier)
  (SAMPLE(STR(?rmValue)) AS ?rijksmonumentnummer)
  (SAMPLE(STR(?plaatsValue)) AS ?plaats)
  (SAMPLE(STR(?functieValue)) AS ?huidigeFunctie)
  (GROUP_CONCAT(DISTINCT STR(?coordValue); separator="|") AS ?coords)
WHERE {
  VALUES ?v { ${values} }
  ?v a gtm:Gebouw .
  OPTIONAL { ?v dcterms:title ?naamValue }
  OPTIONAL { ?v dcterms:identifier ?identifierValue }
  OPTIONAL { ?v ceo:rijksmonumentnummer ?rmValue }
  OPTIONAL { ?v ceo:woonplaatsnaam ?plaatsValue }
  OPTIONAL { ?v ceo:heeftHuidigeFunctie ?functieValue }
  OPTIONAL { ?v m:feature ?feat . ?feat m:geography-coordinates ?coordValue }
}
GROUP BY ?v
LIMIT 100`;
}

export function parseMuurschilderingGebouwResults(document: unknown): MuurschilderingGebouw[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.v?.value;
    const naam = binding.naam?.value?.trim();
    if (!uri || !naam) return [];
    const coordsRaw = binding.coords?.value;
    const latlng = coordsRaw ? splitLatLon(coordsRaw.split("|").filter(Boolean)) : undefined;
    // Live geconstateerd (opleveringscontrole 019-muurschilderingen.md): een
    // enkel gebouwrecord heeft een trailing newline in dcterms:identifier/
    // ceo:rijksmonumentnummer. Onschuldig om te tonen, maar fataal voor de
    // exacte VALUES-join in buildMuurschilderingRijksmonumentGeometrieQuery
    // hierboven en voor onObjectSearch's rijksmonumentnummer-lookup als het
    // niet getrimd wordt.
    return [{
      uri,
      id: idFromUri(uri),
      naam,
      identifier: binding.identifier?.value?.trim(),
      rijksmonumentnummer: binding.rijksmonumentnummer?.value?.trim(),
      plaats: binding.plaats?.value?.trim(),
      huidigeFunctie: binding.huidigeFunctie?.value?.trim(),
      lat: latlng?.lat,
      lng: latlng?.lng,
    }];
  });
}

// Schilderingen horen bij het gebouw (schema:location) - een los-van-het-
// gebouw doorzoekbare schilderingsentiteit is bewust geen scope van deze
// eerste bouwstap (zie Scope-afbakening in 019-muurschilderingen.md).
// Makers worden direct als naam meegehaald (dcterms:creator -> dcterms:title
// op schema:Person/Organization, dezelfde dataset - geen Wikidata-sprong
// nodig, in tegenstelling tot de iconografie-onderwerpen die deze eerste
// bouwstap daarom nog niet toont).
export function buildMuurschilderingSchilderingenQuery(gebouwIds: string[]): string {
  const values = gebouwIds.map((id) => `<${ITEM_BASE}${escapeSparqlString(id)}>`).join(" ");
  return `PREFIX schema: <${SCHEMA}>
PREFIX dcterms: <${DCTERMS}>
PREFIX ceo: <${CEO}>
PREFIX sem: <${SEM}>
SELECT ?s ?gebouw
  (SAMPLE(STR(?titelValue)) AS ?titel)
  (SAMPLE(STR(?beschrijvingValue)) AS ?beschrijving)
  (SAMPLE(STR(?beginValue)) AS ?begin)
  (SAMPLE(STR(?eindValue)) AS ?eind)
  (SAMPLE(STR(?temporeelValue)) AS ?temporeel)
  (SAMPLE(STR(?locatieomschrijvingValue)) AS ?locatieomschrijving)
  (GROUP_CONCAT(DISTINCT STR(?makerNaamValue); separator="|") AS ?makers)
WHERE {
  VALUES ?gebouw { ${values} }
  ?s a schema:Painting ; schema:location ?gebouw .
  OPTIONAL { ?s dcterms:title ?titelValue . FILTER(lang(?titelValue) = "" || lang(?titelValue) = "nl") }
  OPTIONAL { ?s dcterms:description ?beschrijvingValue . FILTER(lang(?beschrijvingValue) = "" || lang(?beschrijvingValue) = "nl") }
  OPTIONAL { ?s sem:hasEarliestBeginTimeStamp ?beginValue }
  OPTIONAL { ?s sem:hasLatestEndTimeStamp ?eindValue }
  OPTIONAL {
    ?s schema:temporal ?temporeelValue .
    # Bronfout (zie punt 5, 019-muurschilderingen.md): een handvol
    # schema:temporal-waarden is per ongeluk een item-URL i.p.v. vrije
    # tekst. Live uitfilteren i.p.v. een verkeerd "datering" tonen.
    FILTER(!STRSTARTS(STR(?temporeelValue), "https://muurschilderingendatabase.nl/api/items/"))
  }
  OPTIONAL { ?s ceo:locatieomschrijving ?locatieomschrijvingValue }
  OPTIONAL {
    ?s dcterms:creator ?maker .
    ?maker dcterms:title ?makerNaamValue .
  }
}
GROUP BY ?s ?gebouw
LIMIT 1000`;
}

// Bronwaarde "0" is een sentinel voor "geen datering bekend", geen
// letterlijk jaar 0 (geen Nederlandse kerk dateert uit 0-99 n.Chr.) - zelfde
// opschoning als scripts/fetch.py's clean_year() in de eigen explorer.
function cleanYear(value: string | undefined): string | undefined {
  return value === "0" ? undefined : value;
}

export function parseMuurschilderingSchilderingenResults(document: unknown): Map<string, Muurschildering[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byGebouw = new Map<string, Muurschildering[]>();
  if (!Array.isArray(bindings)) return byGebouw;
  for (const binding of bindings) {
    const gebouwUri = binding.gebouw?.value;
    if (!gebouwUri) continue;
    const gebouwId = idFromUri(gebouwUri);
    const makers = binding.makers?.value ? binding.makers.value.split("|").filter(Boolean) : [];
    const schildering: Muurschildering = {
      titel: binding.titel?.value,
      beschrijving: binding.beschrijving?.value,
      dateringVan: cleanYear(binding.begin?.value),
      dateringTot: cleanYear(binding.eind?.value),
      dateringTekst: binding.temporeel?.value,
      locatieomschrijving: binding.locatieomschrijving?.value,
      makers,
    };
    const bucket = byGebouw.get(gebouwId);
    if (bucket) bucket.push(schildering);
    else byGebouw.set(gebouwId, [schildering]);
  }
  return byGebouw;
}

// Coördinaat-fallback (beslissing 2, 019-muurschilderingen.md): voor een
// gebouw zonder eigen mapping-coördinaat maar met een rijksmonumentnummer,
// het rijksmonument-vlak uit de hoofddienst (rce/cho) opzoeken en daarvan
// het representatieve punt nemen (wktToLatLng, gedeeld met de rest van
// Doorzoeker) - een exacte VALUES-join op rijksmonumentnummer, geen
// geo:sfWithin/sfIntersects nodig (geen risico op de Virtuoso-timeouts die
// dat bij grote scans geeft). De Reliwiki-adres+PDOK-geocoding-stap die de
// eigen explorer daarna nog toepast (voor gebouwen zonder eigen coördinaat
// ÉN zonder rijksmonumentnummer) is in deze eerste bouwstap bewust niet
// meegenomen: dat zou Doorzoekers live zoekpad een geheel nieuwe externe
// afhankelijkheid (PDOK) geven die de rest van de app niet kent, voor een
// klein aanvullend aantal gebouwen (~10 van de 576) - een reële
// vervolgstap, geen dagtaak samen met de rest.
export function buildMuurschilderingRijksmonumentGeometrieQuery(rijksmonumentnummers: string[]): string {
  const values = rijksmonumentnummers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?rm ?wkt WHERE {
  GRAPH <${RCE_INSTANCES_GRAPH}> {
    VALUES ?rm { ${values} }
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rm ; ceo:heeftGeometrie ?geom .
  }
  ?geom geo:asWKT ?wkt .
}
LIMIT 200`;
}

export function parseMuurschilderingRijksmonumentGeometrieResults(document: unknown): Map<string, { lat: number; lng: number }> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const result = new Map<string, { lat: number; lng: number }>();
  if (!Array.isArray(bindings)) return result;
  for (const binding of bindings) {
    const rm = binding.rm?.value;
    const wkt = binding.wkt?.value;
    if (!rm || !wkt || result.has(rm)) continue;
    const latlng = wktToLatLng(wkt);
    if (latlng) result.set(rm, latlng);
  }
  return result;
}
