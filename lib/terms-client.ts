import type { TermSuggestion } from "@/lib/rce";

export type { TermSuggestion };

export async function fetchTermSuggestions(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/terms/suggest?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) return [];
  const document = await response.json() as { suggestions?: TermSuggestion[] };
  return document.suggestions ?? [];
}
