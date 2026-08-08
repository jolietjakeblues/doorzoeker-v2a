import { buildAbrTermSuggestQuery, buildChtTermSuggestQuery, parseAbrTermSuggestResults, parseChtTermSuggestResults, type TermSuggestion } from "../rce.ts";
import { fetchSparql } from "./sparql-client.ts";

export type { TermSuggestion };

// CHT (breed cultuurhistorisch) staat voorop; ABR (archeologische
// vondsttypologie) vult aan. Beide worden onder dezelfde limiet bevraagd en
// pas na het samenvoegen gezamenlijk afgekapt, zodat CHT-treffers niet worden
// verdrongen door ABR-treffers wanneer beide term overvloedig matchen.
export async function suggestTerms(query: string, signal?: AbortSignal, limit = 8): Promise<TermSuggestion[]> {
  const [chtDocument, abrDocument] = await Promise.all([
    fetchSparql(buildChtTermSuggestQuery(query, limit), signal),
    fetchSparql(buildAbrTermSuggestQuery(query, limit), signal),
  ]);
  const suggestions = [...parseChtTermSuggestResults(chtDocument), ...parseAbrTermSuggestResults(abrDocument)];
  return [...new Map(suggestions.map((suggestion) => [suggestion.uri, suggestion])).values()].slice(0, limit);
}
