import { fetchOpDezeDag } from "../../../../lib/server/rce-adapter.ts";
import { NO_STORE, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

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
  return sharedCacheControl({ browserSeconds: Math.min(3600, sharedSeconds), sharedSeconds });
}

function cacheControlForEmptyResult(now = new Date()) {
  const sharedSeconds = Math.min(EMPTY_CACHE_SECONDS, secondsUntilNextUtcDay(now));
  return sharedCacheControl({ browserSeconds: Math.min(60, sharedSeconds), sharedSeconds });
}

export async function GET(request: Request) {
  return withRceErrorHandling(
    {
      event: "rce.op-deze-dag.error",
      headers: (startedAt) => ({ "Cache-Control": NO_STORE, "Server-Timing": `rce;dur=${Date.now() - startedAt}` }),
    },
    async (startedAt) => {
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
    },
  );
}
