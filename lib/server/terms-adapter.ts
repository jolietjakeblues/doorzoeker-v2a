import { buildReferentienetwerkTermSuggestQuery, parseReferentienetwerkTermSuggestResults, type TermSuggestion } from "../rce.ts";
import { fetchSparql } from "./sparql-client.ts";
import { REFERENTIENETWERK_ENDPOINT } from "./referentienetwerk-adapter.ts";

export type { TermSuggestion };

// De algemene zoekbalk doorzoekt CHO-data. Daarom komen de woordsuggesties
// alleen uit de vier RN2-schema's die met die data zijn verweven. CHT hoort
// bij bibliotheek/beeldbank; het losse ABR wordt intern niet gebruikt.
export async function suggestTerms(query: string, signal?: AbortSignal, limit = 8): Promise<TermSuggestion[]> {
  const rnDocument = await fetchSparql(buildReferentienetwerkTermSuggestQuery(query, limit), signal, REFERENTIENETWERK_ENDPOINT);
  const needle = query.trim().toLocaleLowerCase("nl");
  const suggestions = parseReferentienetwerkTermSuggestResults(rnDocument);
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
