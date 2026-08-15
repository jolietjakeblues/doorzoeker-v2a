import { parseWktGeometry } from "./rce/geometry.ts";
import { statusLabel, type Item } from "./heritage-view-model.ts";

const CSV_COLUMNS = [
  "monumentnummer",
  "titel",
  "adres",
  "postcode",
  "plaats",
  "provincie",
  "soort object",
  "monumentaard",
  "functie",
  "registratiedatum",
  "matchbron",
] as const;

// Spreadsheetsoftware (Excel, Google Sheets) interpreteert een cel die met
// =, +, - of @ begint als formule, ook als de waarde uit brondata komt in
// plaats van vrije gebruikersinvoer. Een voorloop-apostrof dwingt platte
// tekst af zonder de zichtbare waarde te veranderen (CSV-formule-injectie).
function neutralizeFormula(text: string) {
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvField(value: string | undefined) {
  const text = neutralizeFormula(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// RFC 4180-stijl CSV van de huidige (gefilterde) resultatenlijst - puur
// client-side, geen serveraanroep nodig, de data staat al in `results`.
// Zie docs/vertical-slices/012-resultaten-exporteren.md.
export function itemsToCsv(items: Item[]) {
  const rows = items.map((item) =>
    [
      item.monumentNumber ?? item.id,
      item.title,
      item.address,
      item.postalCode,
      item.place,
      item.province,
      statusLabel(item.objectType),
      item.monumentAard ?? "",
      item.kind,
      item.registrationDate ?? "",
      item.matchSource ?? "",
    ]
      .map(csvField)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

type GeoJsonGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

function itemGeometry(item: Item): GeoJsonGeometry | null {
  const geometry = item.wkt ? parseWktGeometry(item.wkt) : undefined;
  if (!geometry) return null;
  if (geometry.kind === "point")
    return { type: "Point", coordinates: [geometry.lng, geometry.lat] };
  if (geometry.kind === "polygon")
    return { type: "Polygon", coordinates: geometry.rings };
  return { type: "MultiPolygon", coordinates: geometry.polygons };
}

// GeoJSON FeatureCollection met dezelfde velden als de CSV-export, plus de
// volledige geometrie (afgeleid uit item.wkt, niet de afgeronde
// kaart-centroid) voor wie de data in QGIS/kaartsoftware wil openen.
export function itemsToGeoJson(items: Item[]) {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      geometry: itemGeometry(item),
      properties: {
        monumentnummer: item.monumentNumber ?? item.id,
        titel: item.title,
        adres: item.address,
        postcode: item.postalCode,
        plaats: item.place,
        provincie: item.province,
        "soort object": statusLabel(item.objectType),
        monumentaard: item.monumentAard ?? "",
        functie: item.kind,
        registratiedatum: item.registrationDate ?? "",
        matchbron: item.matchSource ?? "",
      },
    })),
  };
}

// bv. "doorzoeker-export-2026-08-14.csv" - vaste, voorspelbare naam per dag,
// geen zoekterm in de bestandsnaam nodig voor deze eerste versie.
export function exportFileName(extension: "csv" | "geojson") {
  const date = new Date().toISOString().slice(0, 10);
  return `doorzoeker-export-${date}.${extension}`;
}
