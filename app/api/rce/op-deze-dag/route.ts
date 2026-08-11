import { fetchOpDezeDag } from "../../../../lib/server/rce-adapter.ts";

export const runtime = "edge";

const EMPTY_CACHE_SECONDS = 300;

export function secondsUntilNextUtcDay(now = new Date()) {
  const nextUtcDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );

  return Math.max(1, Math.ceil((nextUtcDay - now.getTime()) / 1000));
}

function cacheControlForResult(now = new Date()) {
  const sharedSeconds = secondsUntilNextUtcDay(now);
  return `public, max-age=${Math.min(3600, sharedSeconds)}, s-maxage=${sharedSeconds}`;
}

function cacheControlForEmptyResult(now = new Date()) {
  const sharedSeconds = Math.min(EMPTY_CACHE_SECONDS, secondsUntilNextUtcDay(now));
  return `public, max-age=${Math.min(60, sharedSeconds)}, s-maxage=${sharedSeconds}`;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const monument = await fetchOpDezeDag(request.signal);
    if (!monument) {
      return Response.json({ monument: null }, {
        headers: {
          "Cache-Control": cacheControlForEmptyResult(),
          "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        },
      });
    }

    return Response.json({ monument }, {
      headers: {
        "Cache-Control": cacheControlForResult(),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.op-deze-dag.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json(
      { error: "De RCE Linked Data-service is momenteel niet bereikbaar." },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        },
      },
    );
  }
}
