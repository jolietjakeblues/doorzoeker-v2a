import assert from "node:assert/strict";
import test from "node:test";
import { exportFileName, itemsToCsv, itemsToGeoJson } from "../lib/export.ts";

const rijksmonument = {
  id: "cho-1",
  objectNumber: "10000517912",
  monumentNumber: "517912",
  title: "Woonhuis, met \"sierlijst\"",
  kind: "Woonhuis",
  address: "Dorpsstraat 1",
  postalCode: "5051AA",
  place: "Goirle",
  province: "Noord-Brabant",
  objectType: "Rijksmonument",
  monumentAard: "Gebouwd",
  registrationDate: "2002-01-01",
  matchSource: "oorspronkelijke functie",
  wkt: "POINT (5.07 51.52)",
  sourceUrl: "https://linkeddata.cultureelerfgoed.nl/rm:517912",
  linkedDataUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/10000517912",
};

const zonderGeometrie = {
  id: "cho-2",
  objectNumber: "cho-2",
  monumentNumber: "complex-12",
  title: "Complex zonder, komma in naam",
  kind: "Functie niet opgenomen",
  address: "",
  postalCode: "",
  place: "Goirle",
  province: "Noord-Brabant",
  objectType: "Complex",
};

test("itemsToCsv bouwt een header en één rij per item met de afgesproken kolommen", () => {
  const csv = itemsToCsv([rijksmonument]);
  const [header, row] = csv.split("\r\n");
  assert.equal(
    header,
    "monumentnummer,titel,adres,postcode,plaats,provincie,soort object,monumentaard,functie,registratiedatum,matchbron,object_uri,cho_nummer,primaire_identifier,identifier_type",
  );
  assert.equal(
    row,
    '517912,"Woonhuis, met ""sierlijst""",Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie,https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/10000517912,10000517912,517912,RM',
  );
});

test("itemsToCsv escapet komma's en aanhalingstekens RFC 4180-stijl, en vult ontbrekende velden als lege cel", () => {
  const csv = itemsToCsv([zonderGeometrie]);
  const [, row] = csv.split("\r\n");
  assert.equal(
    row,
    'complex-12,"Complex zonder, komma in naam",,,Goirle,Noord-Brabant,Complex van rijksmonumenten,,Functie niet opgenomen,,,,cho-2,complex-12,Complex',
  );
});

test("itemsToCsv gebruikt sourceUrl als object_uri wanneer een item geen eigen linkedDataUrl heeft", () => {
  const csv = itemsToCsv([{ ...rijksmonument, linkedDataUrl: undefined }]);
  const [, row] = csv.split("\r\n");
  assert.match(row, /,https:\/\/linkeddata\.cultureelerfgoed\.nl\/rm:517912,/);
});

test("itemsToCsv voegt geen onvolledigheidsrij toe wanneer alle resultaten geladen zijn", () => {
  const csv = itemsToCsv([rijksmonument], false);
  assert.equal(csv.split("\r\n").length, 2);
});

test("itemsToCsv voegt een leesbare onvolledigheidsrij toe wanneer hasMore=true, met evenveel kolommen als de header", () => {
  const csv = itemsToCsv([rijksmonument], true);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 3);
  const [header, , footer] = lines;
  const footerCells = footer.split(",");
  assert.equal(footerCells.length, header.split(",").length);
  assert.match(footerCells[0], /^Let op: dit bestand bevat niet alle resultaten/);
  assert.deepEqual(footerCells.slice(1), Array(footerCells.length - 1).fill(""));
});

test("itemsToGeoJson zet WKT om naar een Point-geometrie met dezelfde properties als de CSV-kolommen", () => {
  const geojson = itemsToGeoJson([rijksmonument]);
  assert.equal(geojson.type, "FeatureCollection");
  assert.equal(geojson.metadata, undefined);
  assert.equal(geojson.features.length, 1);
  const [feature] = geojson.features;
  assert.equal(feature.type, "Feature");
  assert.equal(feature.id, "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/10000517912");
  assert.deepEqual(feature.geometry, { type: "Point", coordinates: [5.07, 51.52] });
  assert.deepEqual(feature.properties, {
    monumentnummer: "517912",
    titel: "Woonhuis, met \"sierlijst\"",
    adres: "Dorpsstraat 1",
    postcode: "5051AA",
    plaats: "Goirle",
    provincie: "Noord-Brabant",
    "soort object": "Rijksmonument",
    monumentaard: "Gebouwd",
    functie: "Woonhuis",
    registratiedatum: "2002-01-01",
    matchbron: "oorspronkelijke functie",
    object_uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/10000517912",
    cho_nummer: "10000517912",
    primaire_identifier: "517912",
    identifier_type: "RM",
  });
});

test("itemsToGeoJson laat de Feature-id weg wanneer een item geen enkele bron-URI heeft", () => {
  const geojson = itemsToGeoJson([zonderGeometrie]);
  assert.equal("id" in geojson.features[0], false);
});

test("itemsToGeoJson zet top-level metadata.compleet=false wanneer hasMore=true, en niets wanneer hasMore=false", () => {
  assert.equal(itemsToGeoJson([rijksmonument], false).metadata, undefined);
  const onvolledig = itemsToGeoJson([rijksmonument], true);
  assert.equal(onvolledig.metadata.compleet, false);
  assert.match(onvolledig.metadata.opmerking, /niet alle resultaten/);
});

test("itemsToGeoJson geeft een null-geometrie voor een item zonder WKT, geen crash", () => {
  const geojson = itemsToGeoJson([zonderGeometrie]);
  assert.equal(geojson.features[0].geometry, null);
});

test("itemsToGeoJson zet een polygon-WKT om naar Polygon-coördinaten in lng/lat-volgorde", () => {
  const terrein = {
    ...zonderGeometrie,
    wkt: "POLYGON ((5.0 51.0, 5.1 51.0, 5.1 51.1, 5.0 51.1, 5.0 51.0))",
  };
  const geojson = itemsToGeoJson([terrein]);
  assert.deepEqual(geojson.features[0].geometry, {
    type: "Polygon",
    coordinates: [
      [
        [5.0, 51.0],
        [5.1, 51.0],
        [5.1, 51.1],
        [5.0, 51.1],
        [5.0, 51.0],
      ],
    ],
  });
});

test("itemsToCsv neutraliseert waarden die spreadsheetsoftware als formule zou interpreteren", () => {
  const gevaarlijk = [
    { ...rijksmonument, id: "cho-formule-1", title: "=HYPERLINK(\"https://evil.test\")" },
    { ...rijksmonument, id: "cho-formule-2", title: "+SUM(1,1)" },
    { ...rijksmonument, id: "cho-formule-3", title: "-2+3" },
    { ...rijksmonument, id: "cho-formule-4", title: "@command" },
    { ...rijksmonument, id: "cho-formule-5", title: "Gewoon een titel met een - erin" },
  ];
  const rows = itemsToCsv(gevaarlijk).split("\r\n").slice(1);
  const staart = "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/10000517912,10000517912,517912,RM";
  assert.equal(rows[0], `517912,"'=HYPERLINK(""https://evil.test"")",Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie,${staart}`);
  assert.equal(rows[1], `517912,"'+SUM(1,1)",Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie,${staart}`);
  assert.equal(rows[2], `517912,'-2+3,Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie,${staart}`);
  assert.equal(rows[3], `517912,'@command,Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie,${staart}`);
  // Een liggend streepje verderop in de tekst (niet aan het begin) blijft
  // onaangeroerd - alleen een leidend =, +, - of @ is gevaarlijk.
  assert.equal(rows[4], `517912,Gewoon een titel met een - erin,Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie,${staart}`);
});

test("exportFileName geeft een voorspelbare, per-dag bestandsnaam met de juiste extensie", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(exportFileName("csv"), `doorzoeker-export-${today}.csv`);
  assert.equal(exportFileName("geojson"), `doorzoeker-export-${today}.geojson`);
});
