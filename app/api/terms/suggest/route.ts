import { suggestTerms } from "../../../../lib/server/terms-adapter.ts";

export const runtime = "edge";

const cache = new Map<string, { expiresAt: number; suggestions: Awaited<ReturnType<typeof suggestTerms>> }>();

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return Response.json({ suggestions: [], unavailable: false });
  if (query.length > 80) return Response.json({ error: "Ongeldige zoekterm." }, { status: 400 });

  const key = query.toLocaleLowerCase("nl");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Response.json({ suggestions: cached.suggestions, unavailable: false }, { headers: { "X-Doorzoeker-Cache": "HIT" } });

  try {
    const suggestions = await suggestTerms(query, request.signal);
    if (cache.size >= 250) cache.delete(cache.keys().next().value ?? "");
    cache.set(key, { suggestions, expiresAt: Date.now() + 300_000 });
    return Response.json({ suggestions, unavailable: false }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300", "X-Doorzoeker-Cache": "MISS" } });
  } catch (error) {
    console.warn(JSON.stringify({ event: "terms.suggest.unavailable", message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ suggestions: [], unavailable: true });
  }
}
