/** Cloudflare Worker entry point. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

// Voegt basisbeveiligingsheaders toe aan elk pagina-/API-antwoord. Het
// image-optimizer-pad (/_vinext/image) zet zijn eigen CSP/nosniff al zelf
// (zie vinext/server/image-optimization.js) en blijft hier dus buiten -
// deze headers overschrijven anders per ongeluk een bewuste, striktere
// keuze van die handler.
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  // Geen includeSubDomains: dit domein/de workers.dev-host kan subdomeinen
  // hebben die niet door deze Worker worden bediend en (nog) geen HTTPS
  // ondersteunen - HSTS mag dat niet meeslepen.
  headers.set("Strict-Transport-Security", "max-age=31536000");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Verdedigingslaag naast (niet in plaats van) een eventuele "Always Use
    // HTTPS"-instelling op de Cloudflare-zone zelf: live geverifieerd dat
    // deze Worker een platte-HTTP-verzoek anders gewoon met 200 beantwoordt
    // in plaats van door te sturen (securityassessment 17-08-2026). Alleen
    // op een echte host - lokale dev (`vinext dev`) en de rendered-html-test
    // draaien zelf bewust over http://localhost, zonder TLS-laag.
    const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (url.protocol === "http:" && !isLocalHost) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
};

export default worker;
