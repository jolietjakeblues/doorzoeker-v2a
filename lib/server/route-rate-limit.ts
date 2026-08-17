import { consumeFixedWindow, type RateLimitEntry } from "./fixed-window-rate-limit.ts";

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Best-effort per-isolate limiter. Dit is geen globale rate limit: Cloudflare
// kan verzoeken van dezelfde client over meerdere Worker-isolates en
// locaties verspreiden, elk met hun eigen lege Map. Een gebruiker kan dus in
// werkelijkheid ruimschoots boven `limit`/minuut komen. Voor een echte
// globale limiet is Cloudflare Rate Limiting of een Durable Object nodig.
// Elke aanroeper krijgt zijn eigen Map (aparte routes delen geen budget).
export function createRateLimiter(limit: number, windowMs = 60_000, maxEntries = 5_000) {
  const requests = new Map<string, RateLimitEntry>();
  return {
    consume(request: Request, now = Date.now()) {
      return consumeFixedWindow(requests, clientId(request), { limit, maxEntries, now, windowMs });
    },
  };
}

export function rateLimitedResponse() {
  return Response.json({ error: "Te veel zoekopdrachten. Probeer het over een minuut opnieuw." }, { status: 429, headers: { "Retry-After": "60" } });
}
