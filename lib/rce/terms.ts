import { escapeSparqlString } from "./sparql.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const CEOX = "https://linkeddata.cultureelerfgoed.nl/def/ceox#";
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const ARCHIEFDAGEN_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/archiefdagen";
const OMSCHRIJVINGEN_ONDERWERP_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/OmschrijvingenOnderwerp";
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

// Cultuurhistorische Object Informatie en Kennisregistratie leverden geen
// bruikbare suggesties op voor een CHO-zoekbalk (gemeld door de eigenaar,
// 21 augustus 2026: "COI en Kennisregistratie mogen uit de zoekbalk. Daar
// doen we niets mee.") - alleen de twee schema's die wél op CHO-velden
// aansluiten (Archeologisch Informatie Systeem, Monumenten Registratie
// Systeem) blijven over.
const CHO_REFERENTIENETWERK_SCHEMES = [
  "https://data.cultureelerfgoed.nl/term/id/rn/2/a4a7933c-e096-4bcf-a921-4f70a78749fe",
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

// Doorzoekt bewust NIET de volledige CHT/ABR-thesaurus (dat deden de eerdere,
// nooit aangesloten buildChtTermSuggestQuery/buildAbrTermSuggestQuery): een
// zoekbalk-suggestie moet alleen begrippen tonen die daadwerkelijk aan
// CHO-data hangen, anders suggereert de balk duizenden termen zonder
// zoekresultaat (gemeld door de eigenaar, 21 augustus 2026: "Daarin zitten
// toch alleen de termen die gebruikt worden in de data he? Niet 'alle
// mogelijkheden'?"). Dezelfde archiefdagen/OmschrijvingenOnderwerp-koppeling
// als buildRceDetailsQueryBody (lib/rce/monuments.ts) IS die "gebruikt"-
// grens: een concept hier staat per definitie op minstens één formele
// omschrijving. RN-begrippen (/term/id/rn/) worden uitgesloten - die lopen
// al via de preciezere buildReferentienetwerkTermSuggestQuery hierboven, met
// een eigen conceptField/usageCount.
export function buildOnderwerpTermSuggestQuery(term: string, limit: number) {
  const needle = escapeSparqlString(term.trim().toLocaleLowerCase("nl"));
  return `PREFIX ceox: <${CEOX}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?concept ?label
  (BOUND(?viaMaterialen) AS ?isMateriaal)
  (BOUND(?viaStijlen) AS ?isStijlPeriode)
WHERE {
  { GRAPH <${ARCHIEFDAGEN_GRAPH}> { ?omschrijvingNode ceox:heeftOmschrijvingOnderwerp ?concept . } }
  UNION
  { GRAPH <${OMSCHRIJVINGEN_ONDERWERP_GRAPH}> { ?omschrijvingNode ceox:heeftOmschrijvingOnderwerp ?concept . } }
  ?concept skos:prefLabel ?label .
  FILTER(LANG(?label) = "nl")
  FILTER(CONTAINS(LCASE(STR(?label)), "${needle}"))
  FILTER(!CONTAINS(STR(?concept), "/term/id/rn/"))
  OPTIONAL { ?concept skos:broader* <${CHT_MATERIALEN_TOP}> . BIND(true AS ?viaMaterialen) }
  OPTIONAL { ?concept skos:broader* <${CHT_STIJLEN_PERIODEN_TOP}> . BIND(true AS ?viaStijlen) }
}
LIMIT ${limit}`;
}

function onderwerpConceptSource(uri: string): { sourceUri: string; sourceName: string } {
  if (uri.includes("/term/id/abr/")) return { sourceUri: ABR_THESAURUS_GRAPH, sourceName: "Archeologisch Basisregister" };
  return { sourceUri: CHT_THESAURUS_GRAPH, sourceName: "Cultuurhistorische Thesaurus" };
}

export function parseOnderwerpTermSuggestResults(document: unknown): TermSuggestion[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => {
    const uri = binding.concept?.value;
    const label = binding.label?.value;
    if (!uri || !label) return [];
    const { sourceUri, sourceName: baseName } = onderwerpConceptSource(uri);
    const sourceName = binding.isMateriaal?.value === "true" ? `${baseName} - Materialen` : binding.isStijlPeriode?.value === "true" ? `${baseName} - Stijlen en periodes` : baseName;
    return [{ uri, label, sourceUri, sourceName }];
  });
}
