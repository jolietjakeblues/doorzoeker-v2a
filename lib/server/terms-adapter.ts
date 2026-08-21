import { buildOnderwerpTermSuggestQuery, buildReferentienetwerkTermSuggestQuery, buildTermUsageQuery, parseOnderwerpTermSuggestResults, parseReferentienetwerkTermSuggestResults, parseTermUsageResults, type TermSuggestion } from "../rce.ts";
import { fetchSparql } from "./sparql-client.ts";
import { REFERENTIENETWERK_ENDPOINT } from "./referentienetwerk-adapter.ts";

export type { TermSuggestion };

// De algemene zoekbalk doorzoekt CHO-data, dus woordsuggesties komen uit
// twee parallelle bronnen die allebei al aan die data hangen: de twee
// CHO-relevante RN2-schema's (Archeologisch Informatie Systeem, Monumenten
// Registratie Systeem) en CHT/ABR-begrippen die daadwerkelijk aan een
// formele omschrijving gekoppeld zijn (buildOnderwerpTermSuggestQuery,
// lib/rce/terms.ts - bewust niet de volledige thesaurus).
export async function suggestTerms(query: string, signal?: AbortSignal, limit = 8): Promise<TermSuggestion[]> {
  const needle = query.trim().toLocaleLowerCase("nl");
  // RN2 blijft de primaire, harde bron (bestaand gedrag: een fout hier laat
  // suggestTerms falen). CHT/ABR is een aanvulling - een fout daar mag de
  // RN2-suggesties niet meeslepen, dus faalt open naar een lege lijst
  // (zelfde patroon als de usageCheck hieronder).
  const [rnDocument, onderwerpSuggestions] = await Promise.all([
    fetchSparql(buildReferentienetwerkTermSuggestQuery(query, limit), signal, REFERENTIENETWERK_ENDPOINT),
    fetchSparql(buildOnderwerpTermSuggestQuery(query, limit), signal).then(parseOnderwerpTermSuggestResults).catch((): TermSuggestion[] => []),
  ]);
  const suggestions = [...parseReferentienetwerkTermSuggestResults(rnDocument), ...onderwerpSuggestions];
  const unique = [...new Map(suggestions.map((suggestion) => [suggestion.uri, suggestion])).values()];
  const usage = await fetchSparql(buildTermUsageQuery(unique.map((suggestion) => suggestion.uri)), signal)
    .then(parseTermUsageResults)
    .catch(() => new Map());
  return unique
    .map((suggestion) => ({ ...suggestion, ...usage.get(suggestion.uri) }))
    .sort((left, right) => {
      const rank = (label: string) => {
        const value = label.toLocaleLowerCase("nl");
        return value === needle ? 0 : value.startsWith(needle) ? 1 : 2;
      };
      return Number(Boolean(right.usageCount)) - Number(Boolean(left.usageCount)) || rank(left.label) - rank(right.label) || left.label.localeCompare(right.label, "nl");
    })
    .slice(0, limit);
}
