const TERM_NETWORK_ENDPOINT = "https://termennetwerk-api.netwerkdigitaalerfgoed.nl/graphql";
const TERM_SOURCES = [
  "https://data.cultureelerfgoed.nl/term/id/cht",
  "https://data.cultureelerfgoed.nl/term/id/cht#materials",
  "https://data.cultureelerfgoed.nl/term/id/cht#styles-and-periodes",
];

export type TermSuggestion = { uri: string; label: string; sourceUri: string; sourceName: string };

const SUGGEST_QUERY = `
query SuggestTerms($sources: [ID]!, $query: String!, $limit: Int!, $timeoutMs: Int!) {
  terms(sources: $sources, query: $query, queryMode: OPTIMIZED, languages: [nl], limit: $limit, timeoutMs: $timeoutMs) {
    source { uri name }
    result {
      __typename
      ... on TranslatedTerms { terms { uri prefLabel { value language } } }
      ... on Terms { terms { uri prefLabel } }
    }
  }
}`;

type TermsDocument = {
  data?: { terms?: Array<{
    source?: { uri?: string; name?: string };
    result?: { __typename?: string; terms?: Array<{ uri?: string; prefLabel?: Array<string | { value?: string }> }> };
  }> };
};

export async function suggestTerms(query: string, signal?: AbortSignal, limit = 8): Promise<TermSuggestion[]> {
  const timeout = AbortSignal.timeout(4_000);
  const response = await fetch(TERM_NETWORK_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ query: SUGGEST_QUERY, variables: { sources: TERM_SOURCES, query, limit, timeoutMs: 3_000 } }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`Termennetwerk antwoordde met ${response.status}`);
  const document = await response.json() as TermsDocument;
  const suggestions = (document.data?.terms ?? []).flatMap((sourceResult) =>
    (sourceResult.result?.terms ?? []).flatMap((term) => {
      const firstLabel = term.prefLabel?.[0];
      const label = typeof firstLabel === "string" ? firstLabel : firstLabel?.value;
      return term.uri && label ? [{ uri: term.uri, label, sourceUri: sourceResult.source?.uri ?? "", sourceName: sourceResult.source?.name ?? "Termennetwerk" }] : [];
    }),
  );
  return [...new Map(suggestions.map((suggestion) => [suggestion.uri, suggestion])).values()].slice(0, limit);
}
