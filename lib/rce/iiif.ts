// RCE's beeldhost images.memorix.nl (Picturae's Memorix Maior) heeft naast
// de vaste-maat thumbnails die MonumentImage.url al levert ook een volledige
// IIIF Image API 2.0 (level2) aan staan, rechtstreeks afgeleid van dezelfde
// identifier. Live geverifieerd (02-09-2026): .../iiif/<id>/info.json geeft
// tot 5000x5000px, tegels van 256x256, ondersteunt region/size/rotation -
// precies wat een deep-zoom viewer (OpenSeadragon) nodig heeft. Geen aparte
// resolutie-stap of extra RCE-aanvraag nodig, de bestaande depictie-URL
// bevat alles.
const MEMORIX_IMAGE_URL = /^https:\/\/images\.memorix\.nl\/([^/]+)\/thumb\/[^/]+\/([^/.]+)\.\w+$/i;

export type IiifImageSource = { base: string; infoUrl: string };

// Geeft undefined voor de ~0,13% niet-Memorix-afbeeldingen (rechtstreekse
// Wikimedia Commons-thumbnails, empirisch gemeten via de rce-cho MCP) -
// die vallen terug op de bestaande, niet-zoombare weergave.
export function iiifSourceForImage(url: string): IiifImageSource | undefined {
  const match = MEMORIX_IMAGE_URL.exec(url);
  if (!match) return undefined;
  const [, tenant, identifier] = match;
  const base = `https://images.memorix.nl/${tenant}/iiif/${identifier}`;
  return { base, infoUrl: `${base}/info.json` };
}
