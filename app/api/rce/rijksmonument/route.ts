import { fetchRijksmonumentByNummer } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, NO_STORE, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

const rateLimiter = createRateLimiter(30);

// Exacte, klasse-gebonden lookup op ceo:rijksmonumentnummer (zie
// fetchRijksmonumentByNummer) - geen fan-out naar andere objectsoorten
// zoals /api/rce/search doet voor een kale numerieke zoekopdracht.
export async function GET(request: Request) {
  return withRceErrorHandling(
    { event: "rce.rijksmonument.error", headers: (startedAt) => ({ "Cache-Control": NO_STORE, "Server-Timing": `rce;dur=${Date.now() - startedAt}` }) },
    async (startedAt) => {
      const url = new URL(request.url);
      const nummer = (url.searchParams.get("nummer") ?? "").trim();
      if (!/^\d{1,6}$/.test(nummer)) {
        return Response.json({ error: "Ongeldig rijksmonumentnummer." }, { status: 400 });
      }
      if (!rateLimiter.consume(request)) {
        return rateLimitedResponse();
      }

      const monument = await fetchRijksmonumentByNummer(nummer, request.signal);
      return Response.json({ monument: monument ?? null }, {
        headers: {
          "Cache-Control": monument ? sharedCacheControl(CACHE_POLICY.searchResults) : NO_STORE,
          "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        },
      });
    },
  );
}
