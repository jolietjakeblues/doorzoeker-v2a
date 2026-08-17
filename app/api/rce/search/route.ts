import { browseRceObjects, searchByActorConcept, searchByArcheologischeComplexTypeConcept, searchByArcheologischeWaarderingConcept, searchByBouwkundigeStaatConcept, searchByFunctieConcept, searchByGebeurtenisConcept, searchByGrondspoorTypeConcept, searchByMonumentAardConcept, searchByMonumentTypeConcept, searchByStijlConcept, searchByVerwervingConcept, searchByVondstenConcept, searchRceMonuments, type SearchPartialFailure } from "../../../../lib/server/rce-adapter.ts";
import { OBJECT_KIND } from "../../../../lib/rce.ts";
import { CONCEPT_URI_PATTERN } from "../concept/route.ts";
import { capMapSize, pruneExpiredEntries } from "../../../../lib/server/expiring-map.ts";
import { consumeFixedWindow, type RateLimitEntry } from "../../../../lib/server/fixed-window-rate-limit.ts";
import { CACHE_POLICY, NO_STORE, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

type ConceptVeld = "functie" | "monumentaard" | "waardering" | "gebeurtenis" | "actor" | "vondsttype" | "materiaal" | "toestand" | "archeologischcomplextype" | "stijl" | "bouwkundigestaat" | "verwerving" | "grondspoortype" | "monumenttype";

function searchByConceptField(veld: ConceptVeld, conceptUri: string, signal?: AbortSignal) {
  if (veld === "functie") return searchByFunctieConcept(conceptUri, signal);
  if (veld === "waardering") return searchByArcheologischeWaarderingConcept(conceptUri, signal);
  if (veld === "gebeurtenis") return searchByGebeurtenisConcept(conceptUri, signal);
  if (veld === "actor") return searchByActorConcept(conceptUri, signal);
  if (veld === "vondsttype" || veld === "materiaal" || veld === "toestand") return searchByVondstenConcept(conceptUri, veld, signal);
  if (veld === "archeologischcomplextype") return searchByArcheologischeComplexTypeConcept(conceptUri, signal);
  if (veld === "stijl") return searchByStijlConcept(conceptUri, signal);
  if (veld === "bouwkundigestaat") return searchByBouwkundigeStaatConcept(conceptUri, signal);
  if (veld === "verwerving") return searchByVerwervingConcept(conceptUri, signal);
  if (veld === "grondspoortype") return searchByGrondspoorTypeConcept(conceptUri, signal);
  if (veld === "monumenttype") return searchByMonumentTypeConcept(conceptUri, signal);
  return searchByMonumentAardConcept(conceptUri, signal);
}

export const runtime = "edge";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
// Best-effort per-isolate limiter. Dit is geen globale rate limit: Cloudflare
// kan verzoeken van dezelfde client over meerdere Worker-isolates en
// locaties verspreiden, elk met hun eigen lege Map. Een gebruiker kan dus in
// werkelijkheid ruimschoots boven RATE_LIMIT/minuut komen. Voor een echte
// globale limiet is Cloudflare Rate Limiting of een Durable Object nodig.
const requests = new Map<string, RateLimitEntry>();
// Zelfde beperking: dit is een microcache per isolate, geen gedeelde cache.
// caches.default (readCache/writeCache hieronder) is de laag die dat wél is
// en blijft leidend; deze Map bespaart alleen een edge-cache-lookup binnen
// dezelfde isolate.
const responseCache = new Map<string, { body: string; expiresAt: number }>();

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function consumeRateLimit(id: string, now = Date.now()) {
  return consumeFixedWindow(requests, id, {
    limit: RATE_LIMIT,
    maxEntries: 5_000,
    now,
    windowMs: RATE_WINDOW_MS,
  });
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
    const cached = await cacheStore()?.match(key);
    if (!cached) return undefined;
    // Responses uit Cloudflare Cache API hebben immutable headers. Vinext
    // voegt na de route nog eigen headers toe; geef het daarom een nieuwe
    // Response met een vrij te wijzigen Headers-object.
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: new Headers(cached.headers),
    });
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
  return withRceErrorHandling({ event: "rce.search.error" }, async (startedAt) => {
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
    const veld: ConceptVeld = veldParam === "functie" || veldParam === "waardering" || veldParam === "gebeurtenis" || veldParam === "actor" || veldParam === "vondsttype" || veldParam === "materiaal" || veldParam === "toestand" || veldParam === "archeologischcomplextype" || veldParam === "stijl" || veldParam === "bouwkundigestaat" || veldParam === "verwerving" || veldParam === "grondspoortype" || veldParam === "monumenttype" ? veldParam : "monumentaard";
    if (conceptParam && !CONCEPT_URI_PATTERN.test(conceptParam)) {
      return Response.json({ error: "Ongeldige concept-URI." }, { status: 400 });
    }
    const page = Number(url.searchParams.get("page") ?? "1");
    const scopeParam = url.searchParams.get("scope");
    const scope = scopeParam === "core" || scopeParam === "heritage" || scopeParam === "archaeology-a" || scopeParam === "archaeology-b" ? scopeParam : "all";
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
        : `${url.origin}/api/rce/search?q=${encodeURIComponent(query.toLocaleLowerCase("nl"))}&page=${page}&scope=${scope}`);
    const now = Date.now();
    pruneExpiredEntries(responseCache, now);
    const memoryCached = responseCache.get(cacheKey.url);
    if (memoryCached) {
      return new Response(memoryCached.body, {
        headers: { "Content-Type": "application/json", "Cache-Control": sharedCacheControl(CACHE_POLICY.searchResults), "X-Doorzoeker-Cache": "HIT" },
      });
    }
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    // Een tekstzoekopdracht splitst in losse categorieën (Rijksmonument,
    // Vondstlocatie, Onderzoeksgebied, ...) die elk apart kunnen falen op een
    // trage of tijdelijk onbereikbare RCE-SPARQL-tak. searchRceMonuments vangt
    // zo'n falen intern op en valt terug op een lege lijst voor die categorie
    // (zie optionalSearch in rce-adapter.ts), zodat één hapering niet de hele
    // zoekopdracht laat mislukken. Zonder de tracker hieronder zou zo'n
    // onvolledig resultaat - bv. "0 resultaten" terwijl het object alleen in
    // de gefaalde categorie zat - hierna alsnog 5 minuten lang gecachet en
    // aan alle bezoekers geserveerd worden, alsof het een geldig antwoord was.
    const partialFailure: SearchPartialFailure = { partial: false };
    const results = browse
      ? await browseRceObjects(browse, request.signal, page)
      : conceptParam
        ? await searchByConceptField(veld, conceptParam, request.signal)
        : await searchRceMonuments(query, request.signal, page, scope, partialFailure);
    const isPagedTextSearch = !browse && !conceptParam && !/^\d{1,6}$/.test(query) && !/^\d{4}\s?[A-Za-z]{2}$/.test(query);
    const isPagedBrowse = browse === "rijksmonument" || browse === "archeologischterrein" || browse === "onderzoeksgebied" || browse === "vondstlocatie" || browse === "archeologischcomplex" || browse === "vondsten" || browse === "grondsporen";
    const pageSize = 25;
    const collectionNatures = new Set<string>(Object.values(OBJECT_KIND));
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
        "Cache-Control": partialFailure.partial ? NO_STORE : sharedCacheControl(CACHE_POLICY.searchResults),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        "X-Doorzoeker-Cache": partialFailure.partial ? "SKIP" : "MISS",
      },
    });
    if (!partialFailure.partial) {
      capMapSize(responseCache, 500);
      responseCache.set(cacheKey.url, { body, expiresAt: now + CACHE_POLICY.searchResults.sharedSeconds * 1000 });
      const cachedResponse = response.clone();
      cachedResponse.headers.set("X-Doorzoeker-Cache", "HIT");
      await writeCache(cacheKey, cachedResponse);
    }
    console.info(JSON.stringify({ event: "rce.search", durationMs: Date.now() - startedAt, queryLength: query.length, browse, concept: conceptParam ? veld : undefined, resultCount: results.length, partial: partialFailure.partial }));
    return response;
  });
}
