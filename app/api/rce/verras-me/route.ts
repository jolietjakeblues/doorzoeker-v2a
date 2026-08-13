import { fetchVerrasMe } from "../../../../lib/server/rce-adapter.ts";
import { NO_STORE } from "../../../../lib/server/http-cache.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

export async function GET(request: Request) {
  return withRceErrorHandling(
    {
      event: "rce.verras-me.error",
      headers: (startedAt) => ({ "Cache-Control": NO_STORE, "Server-Timing": `rce;dur=${Date.now() - startedAt}` }),
    },
    async (startedAt) => {
      const monument = await fetchVerrasMe(request.signal);
      return Response.json({ monument: monument ?? null }, {
        headers: {
          "Cache-Control": NO_STORE,
          "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        },
      });
    },
  );
}
