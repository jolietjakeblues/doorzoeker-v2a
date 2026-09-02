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

// Bounding-box-rechthoek rond een WKT-geometrie, met optionele marge in
// graden - gebruikt als goedkope GeoSPARQL-voorfilter (017-archeologische-
// context-onderzoeksgebied.md) voordat een dure exacte overlap-toets op een
// kleine kandidatenset draait. Zelfde no-spread-lus-discipline als
// boundingBoxFootprint hierboven: een enkele geometrie kan duizenden punten
// hebben.
export function boundingBoxWktLiteral(wkt: string, paddingDegrees = 0): string | undefined {
  const geometry = parseWktGeometry(wkt);
  if (!geometry) return undefined;
  const points: WktRing =
    geometry.kind === "point" ? [[geometry.lng, geometry.lat]] : geometry.kind === "polygon" ? geometry.rings.flat() : geometry.polygons.flat(2);
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLng)) return undefined;
  minLng -= paddingDegrees;
  maxLng += paddingDegrees;
  minLat -= paddingDegrees;
  maxLat += paddingDegrees;
  return `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
}

// Ray-casting (even-odd rule) - standaardalgoritme voor punt-in-veelhoek,
// zonder externe geometriebibliotheek. Gebruikt door isWithin/doesIntersect
// hieronder (lib/vraag/spatial-fallback.ts) als lokale vervanger voor RCE's
// geof:sfWithin/sfIntersects wanneer die op het endpoint een
// TopologyException geven (poort van ldv-talk-2-your-data's Shapely-
// gebaseerde fallback, zie project-memory).
function isPointInRing(point: readonly [number, number], ring: WktRing): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// rings[0] is de buitenring, rings[1..] zijn gaten (het gangbare WKT-Polygon-
// profiel) - een punt telt alleen mee als het binnen de buitenring ligt én
// buiten elk gat.
function isPointInPolygonRings(point: readonly [number, number], rings: WktRing[]): boolean {
  if (rings.length === 0 || !isPointInRing(point, rings[0])) return false;
  return !rings.slice(1).some((hole) => isPointInRing(point, hole));
}

function isPointInGeometry(point: readonly [number, number], geometry: WktGeometry): boolean {
  if (geometry.kind === "point") return false;
  if (geometry.kind === "polygon") return isPointInPolygonRings(point, geometry.rings);
  return geometry.polygons.some((rings) => isPointInPolygonRings(point, rings));
}

function verticesOf(geometry: WktGeometry): WktRing {
  if (geometry.kind === "point") return [[geometry.lng, geometry.lat]];
  if (geometry.kind === "polygon") return geometry.rings.flat();
  return geometry.polygons.flat(2);
}

// Benadering voor object-geometrieën die zelf een (multi)polygon zijn (bv.
// een rijksmonument met een eigen vlak i.p.v. een punt): "binnen" betekent
// hier "elk hoekpunt van het object ligt binnen het gebied" - geen volledige
// topologische within-toets (die zou ook randgevallen zonder
// hoekpuntoverlap moeten afvangen), maar in de praktijk ruim voldoende voor
// Doorzoekers eenvoudige RCE-geometrieën, en nooit erger dan de fout die
// deze fallback juist probeert op te vangen.
export function isWithin(object: WktGeometry, area: WktGeometry): boolean {
  if (object.kind === "point") return isPointInGeometry([object.lng, object.lat], area);
  const vertices = verticesOf(object);
  return vertices.length > 0 && vertices.every((point) => isPointInGeometry(point, area));
}

export function doesIntersect(object: WktGeometry, area: WktGeometry): boolean {
  if (object.kind === "point") return isPointInGeometry([object.lng, object.lat], area);
  // Benadering: een hoekpunt van de een binnen de ander is voldoende bewijs
  // van overlap; mist het randgeval van twee vlakken die alleen via
  // kruisende randen overlappen zonder dat een hoekpunt binnen het andere
  // vlak valt - zeldzaam bij Doorzoekers eenvoudige RCE-geometrieën.
  return verticesOf(object).some((point) => isPointInGeometry(point, area)) || verticesOf(area).some((point) => isPointInGeometry(point, object));
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
