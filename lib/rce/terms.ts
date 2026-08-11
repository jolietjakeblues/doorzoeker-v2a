import { escapeSparqlString } from "./sparql.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const CHT_THESAURUS_GRAPH = "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus";
const ABR_THESAURUS_GRAPH = "https://data.cultureelerfgoed.nl/term/id/abr/thesaurus";
const CHT_MATERIALEN_TOP = "https://data.cultureelerfgoed.nl/term/id/cht/aa872ce6-a74c-4f81-96ec-6ee0e717f92a";
const CHT_STIJLEN_PERIODEN_TOP = "https://data.cultureelerfgoed.nl/term/id/cht/63cca950-f545-467a-9d70-db3a2b21bba3";

type SparqlBinding = Record<string, { value?: string }>;

export type TermSuggestion = {
  uri: string;
  label: string;
  sourceUri: string;
  sourceName: string;
  conceptField?: "functie" | "monumentaard" | "vondsttype" | "materiaal" | "toestand" | "archeologischcomplextype";
  usageCount?: number;
};

export function buildTermUsageQuery(conceptUris: string[]) {
  return `PREFIX ceo: <${CEO}>
SELECT ?concept ?field (COUNT(DISTINCT ?object) AS ?count) WHERE {
  VALUES ?concept { ${conceptUris.map((uri) => `<${uri}>`).join(" ")} }
  GRAPH <${INSTANCES_GRAPH}> {
    { ?object a ceo:Rijksmonument ; ceo:heeftMonumentAard ?concept . BIND("monumentaard" AS ?field) }
    UNION { ?object a ceo:Rijksmonument ; ceo:heeftOorspronkelijkeFunctie/ceo:heeftFunctieNaam ?concept . BIND("functie" AS ?field) }
    UNION { ?object a ceo:Rijksmonument ; ceo:heeftHuidigeFunctie/ceo:heeftFunctieNaam ?concept . BIND("functie" AS ?field) }
    UNION { ?object a ceo:Vondsten ; ceo:heeftType/ceo:heeftTypeNaam ?concept . BIND("vondsttype" AS ?field) }
    UNION { ?object a ceo:Vondsten ; ceo:heeftMateriaal/ceo:heeftMateriaalNaam ?concept . BIND("materiaal" AS ?field) }
    UNION { ?object a ceo:Vondsten ; ceo:heeftToestand ?concept . BIND("toestand" AS ?field) }
    UNION { ?object a ceo:ArcheologischComplex ; ceo:heeftType/ceo:heeftTypeNaam ?concept . BIND("archeologischcomplextype" AS ?field) }
  }
}
GROUP BY ?concept ?field`;
}

export function parseTermUsageResults(document: unknown) {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return new Map<string, { conceptField: NonNullable<TermSuggestion["conceptField"]>; usageCount: number }>();
  const usage = new Map<string, { conceptField: NonNullable<TermSuggestion["conceptField"]>; usageCount: number }>();
  for (const binding of bindings) {
    const uri = binding.concept?.value;
    const field = binding.field?.value;
    const conceptField = field === "functie" || field === "monumentaard" || field === "vondsttype" || field === "materiaal" || field === "toestand" || field === "archeologischcomplextype" ? field : undefined;
    const usageCount = Number(binding.count?.value ?? "0");
    if (!uri || !conceptField || !usageCount) continue;
    const current = usage.get(uri);
    if (!current || usageCount > current.usageCount) usage.set(uri, { conceptField, usageCount });
  }
  return usage;
}

const CHO_REFERENTIENETWERK_SCHEMES = [
  "https://data.cultureelerfgoed.nl/term/id/rn/2/a4a7933c-e096-4bcf-a921-4f70a78749fe",
  "https://data.cultureelerfgoed.nl/term/id/rn/2/bf88ef8b-eba4-46a7-9740-d58e983e4990",
  "https://data.cultureelerfgoed.nl/term/id/rn/2/364d5132-a090-4b2c-8cbe-e167f1243f3f",
  "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5",
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

export function parseReferentienetwerkTermSuggestResults(document: unknown): TermSuggestion[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.concept?.value;
    const label = binding.label?.value;
    if (!uri || !label) return [];
    return [{ uri, label, sourceUri: binding.scheme?.value ?? "https://data.cultureelerfgoed.nl/term/id/rn/2", sourceName: binding.schemeLabel?.value ?? "Referentienetwerk 2" }];
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
    const sourceName = binding.isMateriaal?.value === "true" ? "Cultuurhistorische Thesaurus - Materialen" : binding.isStijlPeriode?.value === "true" ? "Cultuurhistorische Thesaurus - Stijlen en periodes" : "Cultuurhistorische Thesaurus";
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
    return uri && label ? [{ uri, label, sourceUri: ABR_THESAURUS_GRAPH, sourceName: "Archeologisch Basisregister" }] : [];
  });
}
