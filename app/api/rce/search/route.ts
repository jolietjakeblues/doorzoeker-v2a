import { browseRceObjects, searchByActorConcept, searchByArcheologischeComplexTypeConcept, searchByArcheologischeWaarderingConcept, searchByGebeurtenisConcept, searchByMonumentAardConcept, searchByVondstenConcept, searchRceMonuments } from "../../../../lib/server/rce-adapter.ts";
import { CONCEPT_URI_PATTERN } from "../concept/route.ts";

type ConceptVeld = "monumentaard" | "waardering" | "gebeurtenis" | "actor" | "vondsttype" | "materiaal" | "toestand" | "archeologischcomplextype";

function searchByConceptField(veld: ConceptVeld, conceptUri: string, signal?: AbortSignal) {
  if (veld === "waardering") return searchByArcheologischeWaarderingConcept(conceptUri, signal);
  if (veld === "gebeurtenis") return searchByGebeurtenisConcept(conceptUri, signal);
  if (veld === "actor") return searchByActorConcept(conceptUri, signal);
  if (veld === "vondsttype" || veld === "materiaal" || veld === "toestand") return searchByVondstenConcept(conceptUri, veld, signal);
  if (veld === "archeologischcomplextype") return searchByArcheologischeComplexTypeConcept(conceptUri, signal);
  return searchByMonumentAardConcept(conceptUri, signal);
}

export const runtime = "edge";

const CACHE_SECONDS = 300;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
// Best-effort per-isolate limiter. Dit is geen globale rate limit: Cloudflare
// kan verzoeken van dezelfde client over meerdere Worker-isolates en
// locaties verspreiden, elk met hun eigen lege Map. Een gebruiker kan dus in
// werkelijkheid ruimschoots boven RATE_LIMIT/minuut komen. Voor een echte
// globale limiet is Cloudflare Rate Limiting of een Durable Object nodig.
const requests = new Map<string, { count: number; resetAt: number }>();
// Zelfde beperking: dit is een microcache per isolate, geen gedeelde cache.
// caches.default (readCache/writeCache hieronder) is de laag die dat wél is
// en blijft leidend; deze Map bespaart alleen een edge-cache-lookup binnen
// dezelfde isolate.
const responseCache = new Map<string, { body: string; expiresAt: number }>();

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function consumeRateLimit(id: string, now = Date.now()) {
  if (requests.size > 5_000) requests.clear();
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
  try {
    return typeof caches !== "undefined" && "default" in caches ? (caches as CacheStorage & { default: Cache }).default : undefined;
  } catch {
    return undefined;
  }
}

async function readCache(key: Request) {
  try {
    return await cacheStore()?.match(key);
  } catch {
    return undefined;
  }
}

async function writeCache(key: Request, response: Response) {
  try {
    await cacheStore()?.put(key, response);
  } catch {
    // Cache availability must never block live RCE searches.
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const browseParam = url.searchParams.get("browse");
    // "Browsen" (alle Werelderfgoed, Gezichten of Complexen tonen) is geen
    // tekstzoekopdracht: q mag hier leeg zijn.
    const browse = browseParam === "rijksmonument" || browseParam === "archeologischterrein" || browseParam === "onderzoeksgebied" || browseParam === "vondstlocatie" || browseParam === "archeologischcomplex" || browseParam === "vondsten" || browseParam === "grondsporen" || browseParam === "werelderfgoed" || browseParam === "gezicht" || browseParam === "complex" ? browseParam : undefined;
    // Conceptzoekopdracht: exacte match op een concept-URI uit het
    // Referentienetwerk in plaats van tekstzoeken. `veld` bepaalt via welk
    // eigenschap gezocht wordt - de aanroeper (UI) weet dit al op basis van
    // welk label is aangeklikt, dus geen giswerk of dubbele round-trip nodig.
    // Ontbreekt `veld`, dan blijft het gedrag van vóór fase 2 in stand
    // (monumentaard).
    const conceptParam = url.searchParams.get("concept");
    const veldParam = url.searchParams.get("veld");
    const veld: ConceptVeld = veldParam === "waardering" || veldParam === "gebeurtenis" || veldParam === "actor" || veldParam === "vondsttype" || veldParam === "materiaal" || veldParam === "toestand" || veldParam === "archeologischcomplextype" ? veldParam : "monumentaard";
    if (conceptParam && !CONCEPT_URI_PATTERN.test(conceptParam)) {
      return Response.json({ error: "Ongeldige concept-URI." }, { status: 400 });
    }
    const page = Number(url.searchParams.get("page") ?? "1");
    if ((!browse && !conceptParam && (!query || query.length > 120)) || !Number.isInteger(page) || page < 1 || page > 20) {
      return Response.json({ error: "Ongeldige zoekopdracht." }, { status: 400 });
    }
    if (!consumeRateLimit(clientId(request))) {
      return Response.json({ error: "Te veel zoekopdrachten. Probeer het over een minuut opnieuw." }, { status: 429, headers: { "Retry-After": "60" } });
    }

    const cacheKey = new Request(browse
      ? `${url.origin}/api/rce/search?browse=${browse}&page=${page}`
      : conceptParam
        ? `${url.origin}/api/rce/search?concept=${encodeURIComponent(conceptParam)}&veld=${veld}`
        : `${url.origin}/api/rce/search?q=${encodeURIComponent(query.toLocaleLowerCase("nl"))}&page=${page}`);
    const memoryCached = responseCache.get(cacheKey.url);
    if (memoryCached && memoryCached.expiresAt > Date.now()) {
      return new Response(memoryCached.body, {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`, "X-Doorzoeker-Cache": "HIT" },
      });
    }
    if (memoryCached) responseCache.delete(cacheKey.url);
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    const results = browse
      ? await browseRceObjects(browse, request.signal, page)
      : conceptParam
        ? await searchByConceptField(veld, conceptParam, request.signal)
        : await searchRceMonuments(query, request.signal, page);
    const isPagedTextSearch = !browse && !conceptParam && !/^\d{4,6}$/.test(query) && !/^\d{4}\s?[A-Za-z]{2}$/.test(query);
    const isPagedBrowse = browse === "rijksmonument" || browse === "archeologischterrein" || browse === "onderzoeksgebied" || browse === "vondstlocatie" || browse === "archeologischcomplex" || browse === "vondsten" || browse === "grondsporen";
    const pageSize = 25;
    const collectionNatures = new Set(["werelderfgoed", "gezicht", "complex", "archeologischonderzoeksgebied", "archeologischterrein", "vondstlocatie", "grondsporen", "vondsten", "archeologischcomplex"]);
    const pagedResultCount = results.filter((result) => !collectionNatures.has(result.monumentNature ?? "")).length;
    const body = JSON.stringify({
      results,
      page: isPagedTextSearch || isPagedBrowse ? page : 1,
      pageSize,
      hasMore: isPagedBrowse ? results.length >= pageSize : isPagedTextSearch && pagedResultCount >= pageSize,
    });
    const response = new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        "X-Doorzoeker-Cache": "MISS",
      },
    });
    if (responseCache.size >= 500) responseCache.delete(responseCache.keys().next().value ?? "");
    responseCache.set(cacheKey.url, { body, expiresAt: Date.now() + CACHE_SECONDS * 1000 });
    const cachedResponse = response.clone();
    cachedResponse.headers.set("X-Doorzoeker-Cache", "HIT");
    await writeCache(cacheKey, cachedResponse);
    console.info(JSON.stringify({ event: "rce.search", durationMs: Date.now() - startedAt, queryLength: query.length, browse, concept: conceptParam ? veld : undefined, resultCount: results.length }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.search.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "De RCE Linked Data-service is momenteel niet bereikbaar." }, { status: 502 });
  }
}
