// Scheepswrakken uit de MASS-dataset (018-mass-scheepswrakken.md). Dit is
// een heel andere SPARQL-dienst dan de rest van Doorzoeker (rce/mass i.p.v.
// rce/cho) mét een eigen, aangepast `sdo:`-vocabulaire i.p.v. de
// CEO-ontologie - vandaar een volledig losstaande module, net als
// archaeology.ts t.o.v. monuments.ts.
import { escapeSparqlString } from "./sparql.ts";
import { scoreDiscoveryMatch, type DiscoveryMatch } from "./monuments.ts";

export const MASS_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/mass/sparql";
const SDO = "https://sdo.org/";
const SCHEMA = "https://schema.org/";
// Elke Vehicle-URI is https://mass.cultureelerfgoed.nl/id/<geheel getal> -
// het staartgetal is het enige bruikbare, mens-leesbare identifier dat deze
// dataset kent (geen CHO-nummer zoals de rest van Doorzoeker).
const MASS_ID_BASE = "https://mass.cultureelerfgoed.nl/id/";

type SparqlBinding = Record<string, { value?: string } | undefined>;

export type Scheepswrak = {
  uri: string;
  id: string;
  naam: string;
  scheepstype?: string;
  omschrijvingHtml?: string;
  lat: number;
  lng: number;
  ontdekt?: string;
  licentieNaam?: string;
  licentieUrl?: string;
  bronUrl?: string;
};

function idFromUri(uri: string): string {
  return uri.slice(uri.lastIndexOf("/") + 1);
}

const SCHEEPSWRAK_SOURCES: { bron: string; rang: number; pattern: string }[] = [
  { bron: "naam", rang: 1, pattern: `?v <${SDO}name> ?match .` },
];

// Alleen zoeken op naam (018-mass-scheepswrakken.md, beslissing 3: eerst
// alleen het detail bouwen, geen apart scheepstype-facet) plus een exacte
// MASS-ID-lookup wanneer de zoekterm puur numeriek is - zelfde patroon als
// de exacte-CHO-nummer-kortsluiting bij de andere objectsoorten.
export function buildScheepswrakDiscoveryQueries(term: string): { bron: string; query: string }[] {
  const trimmed = term.trim();
  const needle = escapeSparqlString(trimmed);
  const queries = SCHEEPSWRAK_SOURCES.map(({ bron, pattern }) => ({
    bron,
    query: `PREFIX sdo: <${SDO}>
SELECT DISTINCT ?v ?match WHERE {
  ?v a sdo:Vehicle .
  ${pattern}
  FILTER(CONTAINS(LCASE(STR(?match)), LCASE("${needle}")))
}
LIMIT 100`,
  }));
  if (/^\d+$/.test(trimmed)) {
    queries.push({
      bron: "MASS-nummer",
      query: `PREFIX sdo: <${SDO}>
SELECT ?v (STR("${needle}") AS ?match) WHERE {
  BIND(IRI(CONCAT("${MASS_ID_BASE}", "${needle}")) AS ?v)
  ?v a sdo:Vehicle .
}
LIMIT 1`,
    });
  }
  return queries;
}

export function parseScheepswrakDiscoveryResults(document: unknown, bron: string, term: string): DiscoveryMatch[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const rang = SCHEEPSWRAK_SOURCES.find((source) => source.bron === bron)?.rang ?? (bron === "MASS-nummer" ? 0 : 99);
  const needle = term.trim().toLocaleLowerCase("nl");
  return bindings.flatMap((binding) => {
    const uri = binding.v?.value;
    if (!uri) return [];
    const matchedText = binding.match?.value ?? "";
    return [{ monumentNumber: idFromUri(uri), matchSource: bron, matchedText, matchScore: scoreDiscoveryMatch(rang, matchedText, needle) }];
  });
}

export function buildScheepswrakDetailsQuery(ids: string[]) {
  const values = ids.map((id) => `<${MASS_ID_BASE}${escapeSparqlString(id)}>`).join(" ");
  return `PREFIX sdo: <${SDO}>
PREFIX schema: <${SCHEMA}>
SELECT ?v
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?typeValue)) AS ?scheepstype)
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(?latValue) AS ?lat)
  (SAMPLE(?lngValue) AS ?lng)
  (SAMPLE(STR(?ontdektValue)) AS ?ontdekt)
  (SAMPLE(STR(?licentieNaamValue)) AS ?licentieNaam)
  (SAMPLE(STR(?licentieUrlValue)) AS ?licentieUrl)
  (SAMPLE(STR(?bronUrlValue)) AS ?bronUrl)
WHERE {
  VALUES ?v { ${values} }
  ?v a sdo:Vehicle .
  OPTIONAL {
    ?v sdo:name ?naamValue .
    # Elk schip heeft twee sdo:name-waarden (bv. "Hendrika" en
    # "Hendrika (+1850)") - de variant zonder sterfjaar is de leesbaarste
    # primaire naam.
    FILTER(!CONTAINS(STR(?naamValue), "(+"))
  }
  OPTIONAL { ?v schema:additionalType ?typeValue . }
  OPTIONAL { ?v sdo:description ?omschrijvingValue . }
  OPTIONAL {
    ?v sdo:location ?loc .
    ?loc sdo:geo ?geo .
    ?geo sdo:latitude ?latValue ; sdo:longitude ?lngValue .
  }
  OPTIONAL { ?v schema:discovered ?ontdektValue . }
  OPTIONAL {
    ?v sdo:license ?lic .
    ?lic sdo:name ?licentieNaamValue ; sdo:url ?licentieUrlValue .
  }
  OPTIONAL { ?v sdo:url ?bronUrlValue . }
}
GROUP BY ?v
LIMIT 100`;
}

export function parseScheepswrakResults(document: unknown): Scheepswrak[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.v?.value;
    const naam = binding.naam?.value;
    const lat = binding.lat?.value;
    const lng = binding.lng?.value;
    if (!uri || !naam || !lat || !lng) return [];
    return [{
      uri,
      id: idFromUri(uri),
      naam,
      scheepstype: binding.scheepstype?.value,
      omschrijvingHtml: binding.omschrijving?.value,
      lat: Number(lat),
      lng: Number(lng),
      ontdekt: binding.ontdekt?.value,
      licentieNaam: binding.licentieNaam?.value,
      licentieUrl: binding.licentieUrl?.value,
      bronUrl: binding.bronUrl?.value,
    }];
  });
}
