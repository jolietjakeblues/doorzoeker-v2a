import { suggestTerms } from "../../../../lib/server/terms-adapter.ts";
import { capMapSize, pruneExpiredEntries } from "../../../../lib/server/expiring-map.ts";
import { CACHE_POLICY, NO_STORE, sharedCacheControl } from "../../../../lib/server/http-cache.ts";

export const runtime = "edge";

const cache = new Map<string, { expiresAt: number; suggestions: Awaited<ReturnType<typeof suggestTerms>> }>();
const SUCCESS_CACHE_CONTROL = sharedCacheControl(CACHE_POLICY.termSuggestions);
const NO_STORE_HEADERS = { "Cache-Control": NO_STORE };

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return Response.json({ suggestions: [], unavailable: false }, { headers: NO_STORE_HEADERS });
  }
  if (query.length > 80) {
    return Response.json({ error: "Ongeldige zoekterm." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const now = Date.now();
  pruneExpiredEntries(cache, now);
  const key = query.toLocaleLowerCase("nl");
  const cached = cache.get(key);
  if (cached) {
    return Response.json(
      { suggestions: cached.suggestions, unavailable: false },
      { headers: { "Cache-Control": SUCCESS_CACHE_CONTROL, "X-Doorzoeker-Cache": "HIT" } },
    );
  }

  try {
    const suggestions = await suggestTerms(query, request.signal);
    capMapSize(cache, 250);
    cache.set(key, { suggestions, expiresAt: now + 300_000 });
    return Response.json(
      { suggestions, unavailable: false },
      { headers: { "Cache-Control": SUCCESS_CACHE_CONTROL, "X-Doorzoeker-Cache": "MISS" } },
    );
  } catch (error) {
    console.warn(JSON.stringify({ event: "terms.suggest.unavailable", message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ suggestions: [], unavailable: true }, { headers: NO_STORE_HEADERS });
  }
}
