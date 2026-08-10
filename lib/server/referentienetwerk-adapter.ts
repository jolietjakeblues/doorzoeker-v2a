import { fetchSparql, timed } from "./sparql-client.ts";

// Fysiek een ander SPARQL-endpoint dan de rest van de app (rce/cho): de
// concept-URI's die de CEO-instantiedata gebruikt voor bv. monumentaard en
// functie (namespace data.cultureelerfgoed.nl/term/id/rn/2/...) leven op deze
// Referentienetwerk-dienst, niet op rce/cho zelf. Zie
// docs/vertical-slices/004-referentienetwerk-concepten.md voor de
// empirische onderbouwing.
export const REFERENTIENETWERK_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/thesauri/referentienetwerk/sparql";

export type ConceptRef = { uri: string; label: string };
export type ResolvedConcept = ConceptRef & { schemeUri?: string; schemeLabel?: string; schemes?: ConceptRef[]; broader?: ConceptRef[] };

type SparqlBinding = Record<string, { value?: string } | undefined>;

// Geen escaping nodig hier: de aanroeper (API-route) valideert de URI al
// tegen een vaste lijst bekende namespaces vóór dit aangeroepen wordt, exact
// hetzelfde patroon als bij de complex-members- en
// onderzoeksgebied-verrijkingsroutes.
function buildResolveConceptQuery(uri: string) {
  return `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dct: <http://purl.org/dc/terms/>
SELECT ?label ?scheme ?schemeLabel ?broader ?broaderLabel WHERE {
  <${uri}> skos:prefLabel ?label .
  OPTIONAL {
    <${uri}> skos:inScheme ?scheme .
    OPTIONAL { ?scheme dct:title ?schemeLabel . }
  }
  OPTIONAL {
    <${uri}> skos:broader ?broader .
    OPTIONAL { ?broader skos:prefLabel ?broaderLabel . }
  }
}`;
}

function parseResolveConceptResult(uri: string, document: unknown): ResolvedConcept | undefined {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings) || bindings.length === 0) return undefined;
  const label = bindings[0].label?.value;
  if (!label) return undefined;
  const broader = bindings.flatMap((binding) => {
    const broaderUri = binding.broader?.value;
    const broaderLabel = binding.broaderLabel?.value;
    return broaderUri && broaderLabel ? [{ uri: broaderUri, label: broaderLabel }] : [];
  });
  return {
    uri,
    label,
    schemeUri: bindings[0].scheme?.value,
    schemeLabel: bindings[0].schemeLabel?.value,
    broader: broader.length ? broader : undefined,
  };
}

export async function resolveConcept(uri: string, signal?: AbortSignal): Promise<ResolvedConcept | undefined> {
  const document = await timed("rn.resolveConcept", () => fetchSparql(buildResolveConceptQuery(uri), signal, REFERENTIENETWERK_ENDPOINT));
  return parseResolveConceptResult(uri, document);
}

function buildResolveConceptsQuery(uris: string[]) {
  return `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dct: <http://purl.org/dc/terms/>
SELECT ?concept ?label ?scheme ?schemeLabel WHERE {
  VALUES ?concept { ${uris.map((uri) => `<${uri}>`).join(" ")} }
  ?concept skos:prefLabel ?label .
  OPTIONAL { ?concept skos:inScheme ?scheme . OPTIONAL { ?scheme dct:title ?schemeLabel . } }
  FILTER(LANG(?label) = "" || LANG(?label) = "nl")
}`;
}

export async function resolveConcepts(uris: string[], signal?: AbortSignal): Promise<Map<string, ResolvedConcept>> {
  const unique = [...new Set(uris.filter((uri) => /^https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/rn\/2\/[0-9a-fA-F-]+$/.test(uri)))];
  if (!unique.length) return new Map();
  const document = await timed("rn.resolveConcepts", () => fetchSparql(buildResolveConceptsQuery(unique), signal, REFERENTIENETWERK_ENDPOINT));
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings ?? [];
  const concepts = new Map<string, ResolvedConcept>();
  const knownSchemes: Record<string, string> = {
    "https://data.cultureelerfgoed.nl/term/id/rn/2/a4a7933c-e096-4bcf-a921-4f70a78749fe": "Archeologisch Informatie Systeem",
    "https://data.cultureelerfgoed.nl/term/id/rn/2/bf88ef8b-eba4-46a7-9740-d58e983e4990": "Cultuurhistorische Object Informatie",
    "https://data.cultureelerfgoed.nl/term/id/rn/2/364d5132-a090-4b2c-8cbe-e167f1243f3f": "Kennisregistratie",
    "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5": "Monumenten Registratie Systeem",
  };
  for (const binding of bindings) {
    const uri = binding.concept?.value;
    const label = binding.label?.value;
    if (!uri || !label) continue;
    const schemeUri = binding.scheme?.value;
    const schemeLabel = binding.schemeLabel?.value || (schemeUri ? knownSchemes[schemeUri] : undefined);
    const current = concepts.get(uri) ?? { uri, label, schemes: [] };
    if (schemeUri && !current.schemes?.some((scheme) => scheme.uri === schemeUri)) current.schemes = [...(current.schemes ?? []), { uri: schemeUri, label: schemeLabel || "Referentienetwerk 2" }];
    current.schemeUri ??= schemeUri;
    current.schemeLabel ??= schemeLabel;
    concepts.set(uri, current);
  }
  return concepts;
}
