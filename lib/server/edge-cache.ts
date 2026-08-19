// Gedeelde toegang tot Cloudflare Workers' caches.default (de edge-gedeelde
// cache, in tegenstelling tot een in-memory Map-microcache per isolate).
// Oorspronkelijk lokaal in app/api/rce/search/route.ts, hier uitgetrokken
// zodat 017-archeologische-context-onderzoeksgebied.md's route dezelfde laag
// hergebruikt in plaats van dupliceert - zie dat plan-document voor de
// afweging om geen nieuwe cache-infrastructuur (KV/D1) toe te voegen.
export function cacheStore(): Cache | undefined {
  try {
    return typeof caches !== "undefined" && "default" in caches ? (caches as CacheStorage & { default: Cache }).default : undefined;
  } catch {
    return undefined;
  }
}

export async function readCache(key: Request) {
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

export async function writeCache(key: Request, response: Response) {
  try {
    await cacheStore()?.put(key, response);
  } catch {
    // Cache availability must never block live RCE requests.
  }
}
