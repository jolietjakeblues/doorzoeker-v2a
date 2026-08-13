// Een lng/lat-paar per punt, in WKT-volgorde (lng eerst).
export type WktRing = Array<[number, number]>;
export type WktGeometry =
  | { kind: "point"; lat: number; lng: number }
  | { kind: "polygon"; rings: WktRing[] }
  | { kind: "multipolygon"; polygons: WktRing[][] };

function parseCoordinatePairs(text: string): WktRing {
  return [...text.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(([, lng, lat]) => [Number(lng), Number(lat)]);
}

// Splitst "(a),(b),(c)" op de komma's die buiten alle haakjes staan, zodat
// komma's binnen een ring niet worden aangezien voor scheidingen tussen
// ringen of polygonen.
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

function stripOuterParens(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;
}

function parsePolygonRings(text: string): WktRing[] {
  return splitTopLevel(text).map((ring) => parseCoordinatePairs(stripOuterParens(ring)));
}

function parseMultiPolygonPolygons(text: string): WktRing[][] {
  return splitTopLevel(text).map((polygon) => parsePolygonRings(stripOuterParens(polygon)));
}

// Doorzoeker ondersteunt bewust alleen het WKT-profiel dat de huidige RCE
// CHO-data levert: Point, Polygon en MultiPolygon, plat in lng/lat. Bij invoer
// buiten dit profiel geeft de parser undefined terug.
export function parseWktGeometry(wkt: string): WktGeometry | undefined {
  const trimmed = wkt.trim();
  const point = /^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(trimmed);
  if (point) return { kind: "point", lng: Number(point[1]), lat: Number(point[2]) };
  const multiPolygon = /^MULTIPOLYGON\s*\(([\s\S]*)\)$/i.exec(trimmed);
  if (multiPolygon) return { kind: "multipolygon", polygons: parseMultiPolygonPolygons(multiPolygon[1]) };
  const polygon = /^POLYGON\s*\(([\s\S]*)\)$/i.exec(trimmed);
  if (polygon) return { kind: "polygon", rings: parsePolygonRings(polygon[1]) };
  return undefined;
}

// Geen Math.max(...lngs)/Math.min(...lngs): met spread-argumenten crasht V8
// op een ring van voldoende omvang (RangeError: Maximum call stack size
// exceeded). Sommige Werelderfgoed-polygonen (Waddenzee, Hollandse
// Waterlinies) zijn megabytes aan WKT met veruit meer coördinaten dan die
// grens - precies het geval waarvoor deze functie bedoeld is. Eén lus zonder
// spread is O(n) en heeft geen argumentenlimiet.
function boundingBoxFootprint(ring: WktRing): number {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return (maxLng - minLng) * (maxLat - minLat);
}

// Een multipolygon kan uit ver uit elkaar liggende delen bestaan. Kies voor
// een representatief kaartpunt de ring met de grootste bounding box en middel
// alleen de coördinaten van die dominante vorm.
export function wktToLatLng(wkt: string): { lat: number; lng: number } | undefined {
  const geometry = parseWktGeometry(wkt);
  if (!geometry) return undefined;
  if (geometry.kind === "point") return { lat: geometry.lat, lng: geometry.lng };

  const rings = (geometry.kind === "polygon" ? geometry.rings : geometry.polygons.flat()).filter((ring) => ring.length > 0);
  if (!rings.length) return undefined;

  const largestRing = rings.reduce((largest, ring) => (boundingBoxFootprint(ring) > boundingBoxFootprint(largest) ? ring : largest));
  const lng = largestRing.reduce((sum, [lngValue]) => sum + lngValue, 0) / largestRing.length;
  const lat = largestRing.reduce((sum, [, latValue]) => sum + latValue, 0) / largestRing.length;
  return { lat, lng };
}
