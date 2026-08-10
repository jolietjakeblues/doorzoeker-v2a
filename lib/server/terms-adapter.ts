import { buildAbrTermSuggestQuery, buildChtTermSuggestQuery, buildReferentienetwerkTermSuggestQuery, parseAbrTermSuggestResults, parseChtTermSuggestResults, parseReferentienetwerkTermSuggestResults, type TermSuggestion } from "../rce.ts";
import { fetchSparql } from "./sparql-client.ts";
import { REFERENTIENETWERK_ENDPOINT } from "./referentienetwerk-adapter.ts";

export type { TermSuggestion };

// De drie RCE-thesaurusbronnen worden naast elkaar bevraagd. Eerst op
// labelkwaliteit ordenen voorkomt dat een exacte RN2-treffer buiten beeld
// valt door een handvol bredere CHT- of ABR-treffers.
export async function suggestTerms(query: string, signal?: AbortSignal, limit = 8): Promise<TermSuggestion[]> {
  const [chtDocument, rnDocument, abrDocument] = await Promise.all([
    fetchSparql(buildChtTermSuggestQuery(query, limit), signal),
    fetchSparql(buildReferentienetwerkTermSuggestQuery(query, limit), signal, REFERENTIENETWERK_ENDPOINT),
    fetchSparql(buildAbrTermSuggestQuery(query, limit), signal),
  ]);
  const needle = query.trim().toLocaleLowerCase("nl");
  const suggestions = [
    ...parseChtTermSuggestResults(chtDocument),
    ...parseReferentienetwerkTermSuggestResults(rnDocument),
    ...parseAbrTermSuggestResults(abrDocument),
  ];
  return [...new Map(suggestions.map((suggestion) => [suggestion.uri, suggestion])).values()]
    .sort((left, right) => {
      const rank = (label: string) => {
        const value = label.toLocaleLowerCase("nl");
        return value === needle ? 0 : value.startsWith(needle) ? 1 : 2;
      };
      return rank(left.label) - rank(right.label) || left.label.localeCompare(right.label, "nl");
    })
    .slice(0, limit);
}
