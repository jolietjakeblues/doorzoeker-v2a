import { fetchVerrasMe } from "../../../../lib/server/rce-adapter.ts";
import { NO_STORE } from "../../../../lib/server/http-cache.ts";

export const runtime = "edge";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const monument = await fetchVerrasMe(request.signal);
    return Response.json({ monument: monument ?? null }, {
      headers: {
        "Cache-Control": NO_STORE,
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.verras-me.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json(
      { error: "De RCE Linked Data-service is momenteel niet bereikbaar." },
      {
        status: 502,
        headers: {
          "Cache-Control": NO_STORE,
          "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
        },
      },
    );
  }
}
