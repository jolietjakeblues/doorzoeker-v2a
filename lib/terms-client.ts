export type TermSuggestion = { uri: string; label: string; sourceUri: string; sourceName: string };

export async function fetchTermSuggestions(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/terms/suggest?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) return [];
  const document = await response.json() as { suggestions?: TermSuggestion[] };
  return document.suggestions ?? [];
}
