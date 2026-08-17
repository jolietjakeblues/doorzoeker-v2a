import { parseWktGeometry } from "./rce/geometry.ts";
import { primaryIdentifier, statusLabel, type Item } from "./heritage-view-model.ts";

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
  "object_uri",
  "cho_nummer",
  "primaire_identifier",
  "identifier_type",
] as const;

// Zelfde bron-URI-keuze als de "Brongegevens"-sectie in HeritageDetailDialog:
// linkedDataUrl (de CHO-linked-data-URI) heeft voorrang, sourceUrl is de
// terugval voor objectsoorten zonder eigen linked-data-pagina.
function objectUri(item: Item) {
  return item.linkedDataUrl ?? item.sourceUrl ?? "";
}

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

// Wordt in zowel de CSV- als de GeoJSON-export gebruikt zodra de export
// gebeurt terwijl er nog niet-geladen resultaten zijn (`hasMore`). Zonder dit
// bestaat de "nog niet alles geladen"-context alleen op de exportknop in de
// UI - wie het bestand loskoppelt en doorstuurt verliest die context.
const ONVOLLEDIG_MELDING =
  "Let op: dit bestand bevat niet alle resultaten van deze zoekopdracht - alleen de op het moment van exporteren al geladen selectie.";

// RFC 4180-stijl CSV van de huidige (gefilterde) resultatenlijst - puur
// client-side, geen serveraanroep nodig, de data staat al in `results`.
// Zie docs/vertical-slices/012-resultaten-exporteren.md.
export function itemsToCsv(items: Item[], hasMore = false) {
  const rows = items.map((item) => {
    const identifier = primaryIdentifier(item);
    return [
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
      objectUri(item),
      item.objectNumber,
      identifier.value,
      identifier.label,
    ]
      .map(csvField)
      .join(",");
  });
  // Eigen rij ná de data i.p.v. ervoor: een voorloopregel zou naïeve
  // "eerste rij is de header"-parsers (ook Excel/Sheets bij automatisch
  // importeren) in de war brengen. Alleen kolom 1 gevuld, de rest leeg -
  // blijft een geldige RFC 4180-rij met hetzelfde aantal kolommen.
  const footer = hasMore ? [[csvField(ONVOLLEDIG_MELDING), ...Array(CSV_COLUMNS.length - 1).fill("")].join(",")] : [];
  return [CSV_COLUMNS.join(","), ...rows, ...footer].join("\r\n");
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
export function itemsToGeoJson(items: Item[], hasMore = false) {
  return {
    type: "FeatureCollection",
    // Extra top-level lid naast type/features - staat niet in de GeoJSON-
    // kernspec maar consumenten die het niet kennen negeren onbekende
    // leden gewoon (zelfde vrijheid die bv. `bbox` gebruikt).
    ...(hasMore ? { metadata: { compleet: false, opmerking: ONVOLLEDIG_MELDING } } : {}),
    features: items.map((item) => {
      const identifier = primaryIdentifier(item);
      const uri = objectUri(item);
      return {
        type: "Feature",
        // Stabiele Feature-id (bron-URI) zodat een GeoJSON-consument
        // (QGIS, een eigen script) features kan matchen op de RCE-bron in
        // plaats van op een intern, wisselend regelnummer.
        ...(uri ? { id: uri } : {}),
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
          object_uri: uri,
          cho_nummer: item.objectNumber,
          primaire_identifier: identifier.value,
          identifier_type: identifier.label,
        },
      };
    }),
  };
}

// bv. "doorzoeker-export-2026-08-14.csv" - vaste, voorspelbare naam per dag,
// geen zoekterm in de bestandsnaam nodig voor deze eerste versie.
export function exportFileName(extension: "csv" | "geojson") {
  const date = new Date().toISOString().slice(0, 10);
  return `doorzoeker-export-${date}.${extension}`;
}
