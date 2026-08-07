import type { RceMonument } from "@/lib/rce";

type SearchResponse = { results: RceMonument[] };

export async function searchRceMonuments(query: string, signal?: AbortSignal, page = 1) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const response = await fetch(`/api/rce/search?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as SearchResponse;
  return document.results;
}
