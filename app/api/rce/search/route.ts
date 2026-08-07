import { searchRceMonuments } from "../../../../lib/server/rce-adapter.ts";

export const runtime = "edge";

const CACHE_SECONDS = 300;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const requests = new Map<string, { count: number; resetAt: number }>();

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function consumeRateLimit(id: string, now = Date.now()) {
  const current = requests.get(id);
  if (!current || current.resetAt <= now) {
    requests.set(id, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function cacheStore(): Cache | undefined {
  return typeof caches !== "undefined" && "default" in caches
    ? (caches as CacheStorage & { default: Cache }).default
    : undefined;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const page = Number(url.searchParams.get("page") ?? "1");
  if (!query || query.length > 120 || !Number.isInteger(page) || page < 1 || page > 20) {
    return Response.json({ error: "Ongeldige zoekopdracht." }, { status: 400 });
  }
  if (!consumeRateLimit(clientId(request))) {
    return Response.json({ error: "Te veel zoekopdrachten. Probeer het over een minuut opnieuw." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const cache = cacheStore();
  const cacheKey = new Request(`${url.origin}/api/rce/search?q=${encodeURIComponent(query.toLocaleLowerCase("nl"))}&page=${page}`);
  const cached = await cache?.match(cacheKey);
  if (cached) return new Response(cached.body, cached);

  try {
    const results = await searchRceMonuments(query, request.signal, page);
    const response = Response.json({ results }, {
      headers: {
        "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        "X-Doorzoeker-Cache": "MISS",
      },
    });
    await cache?.put(cacheKey, response.clone());
    console.info(JSON.stringify({ event: "rce.search", durationMs: Date.now() - startedAt, queryLength: query.length, resultCount: results.length }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.search.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "De RCE Linked Data-service is momenteel niet bereikbaar." }, { status: 502 });
  }
}
