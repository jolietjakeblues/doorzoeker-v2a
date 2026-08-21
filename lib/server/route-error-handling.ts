// Gedeeld door elke /api/rce/*-route: elke route herhaalde dezelfde
// startedAt/try/catch/console.error/502-structuur, met alleen het
// event-label, het foutbericht en (voor op-deze-dag/verras-me) extra
// no-store-headers als verschil. Eén helper voorkomt dat een nieuwe route
// deze structuur per ongeluk net anders opbouwt (bv. de structured-logging
// vergeet).
type RouteErrorOptions = {
  event: string;
  message?: string;
  timeoutMessage?: string;
  headers?: (startedAt: number) => HeadersInit;
};

// AbortSignal.timeout() (zie requestSignal in sparql-client.ts) verwerpt met
// een TimeoutError-DOMException; live geraakt 21-08-2026 toen een breed
// RN2-begrip (functie "Kerken", 2310 gekoppelde rijksmonumenten) de
// standaard 20s-timeout raakte terwijl de RCE-bron zelf gewoon bereikbaar
// was, alleen tijdelijk trager dan normaal. "Niet bereikbaar" suggereert dan
// ten onrechte een storing; een eigen timeoutbericht + 504 (in plaats van
// 502) is eerlijker en nodigt uit tot opnieuw proberen.
function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || /aborted due to timeout/i.test(error.message));
}

export async function withRceErrorHandling(
  options: RouteErrorOptions,
  handler: (startedAt: number) => Promise<Response>,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    return await handler(startedAt);
  } catch (error) {
    const timeout = isTimeoutError(error);
    console.error(JSON.stringify({
      event: options.event,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "unknown",
      timeout,
    }));
    return Response.json(
      {
        error: timeout
          ? options.timeoutMessage ?? "Deze zoekopdracht duurt op dit moment ongewoon lang bij de RCE-bron. Probeer het over een paar seconden opnieuw."
          : options.message ?? "De RCE Linked Data-service is momenteel niet bereikbaar.",
      },
      { status: timeout ? 504 : 502, headers: options.headers?.(startedAt) },
    );
  }
}
