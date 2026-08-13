// Gedeeld door elke /api/rce/*-route: elke route herhaalde dezelfde
// startedAt/try/catch/console.error/502-structuur, met alleen het
// event-label, het foutbericht en (voor op-deze-dag/verras-me) extra
// no-store-headers als verschil. Eén helper voorkomt dat een nieuwe route
// deze structuur per ongeluk net anders opbouwt (bv. de structured-logging
// vergeet).
type RouteErrorOptions = {
  event: string;
  message?: string;
  headers?: (startedAt: number) => HeadersInit;
};

export async function withRceErrorHandling(
  options: RouteErrorOptions,
  handler: (startedAt: number) => Promise<Response>,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    return await handler(startedAt);
  } catch (error) {
    console.error(JSON.stringify({
      event: options.event,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "unknown",
    }));
    return Response.json(
      { error: options.message ?? "De RCE Linked Data-service is momenteel niet bereikbaar." },
      { status: 502, headers: options.headers?.(startedAt) },
    );
  }
}
