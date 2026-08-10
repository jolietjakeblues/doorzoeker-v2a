import { fetchSparql, timed } from "./sparql-client.ts";

// Fysiek een ander SPARQL-endpoint dan de rest van de app (rce/cho): de
// concept-URI's die de CEO-instantiedata gebruikt voor bv. monumentaard en
// functie (namespace data.cultureelerfgoed.nl/term/id/rn/2/...) leven op deze
// Referentienetwerk-dienst, niet op rce/cho zelf. Zie
// docs/vertical-slices/004-referentienetwerk-concepten.md voor de
// empirische onderbouwing.
export const REFERENTIENETWERK_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/thesauri/referentienetwerk/sparql";

export type ConceptRef = { uri: string; label: string };
export type ResolvedConcept = ConceptRef & { schemeUri?: string; schemeLabel?: string; broader?: ConceptRef[] };

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
