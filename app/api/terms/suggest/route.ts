import { suggestTerms } from "../../../../lib/server/terms-adapter.ts";

export const runtime = "edge";

const cache = new Map<string, { expiresAt: number; suggestions: Awaited<ReturnType<typeof suggestTerms>> }>();
const SUCCESS_CACHE_CONTROL = "public, max-age=60, s-maxage=300";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return Response.json({ suggestions: [], unavailable: false }, { headers: NO_STORE });
  }
  if (query.length > 80) {
    return Response.json({ error: "Ongeldige zoekterm." }, { status: 400, headers: NO_STORE });
  }

  const key = query.toLocaleLowerCase("nl");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(
      { suggestions: cached.suggestions, unavailable: false },
      { headers: { "Cache-Control": SUCCESS_CACHE_CONTROL, "X-Doorzoeker-Cache": "HIT" } },
    );
  }

  try {
    const suggestions = await suggestTerms(query, request.signal);
    if (cache.size >= 250) cache.delete(cache.keys().next().value ?? "");
    cache.set(key, { suggestions, expiresAt: Date.now() + 300_000 });
    return Response.json(
      { suggestions, unavailable: false },
      { headers: { "Cache-Control": SUCCESS_CACHE_CONTROL, "X-Doorzoeker-Cache": "MISS" } },
    );
  } catch (error) {
    console.warn(JSON.stringify({ event: "terms.suggest.unavailable", message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ suggestions: [], unavailable: true }, { headers: NO_STORE });
  }
}
