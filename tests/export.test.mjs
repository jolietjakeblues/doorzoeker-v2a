import assert from "node:assert/strict";
import test from "node:test";
import { exportFileName, itemsToCsv, itemsToGeoJson } from "../lib/export.ts";

const rijksmonument = {
  id: "cho-1",
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
};

const zonderGeometrie = {
  id: "cho-2",
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
    "monumentnummer,titel,adres,postcode,plaats,provincie,soort object,monumentaard,functie,registratiedatum,matchbron",
  );
  assert.equal(
    row,
    '517912,"Woonhuis, met ""sierlijst""",Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie',
  );
});

test("itemsToCsv escapet komma's en aanhalingstekens RFC 4180-stijl, en vult ontbrekende velden als lege cel", () => {
  const csv = itemsToCsv([zonderGeometrie]);
  const [, row] = csv.split("\r\n");
  assert.equal(
    row,
    'complex-12,"Complex zonder, komma in naam",,,Goirle,Noord-Brabant,Complex van rijksmonumenten,,Functie niet opgenomen,,',
  );
});

test("itemsToGeoJson zet WKT om naar een Point-geometrie met dezelfde properties als de CSV-kolommen", () => {
  const geojson = itemsToGeoJson([rijksmonument]);
  assert.equal(geojson.type, "FeatureCollection");
  assert.equal(geojson.features.length, 1);
  const [feature] = geojson.features;
  assert.equal(feature.type, "Feature");
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
  });
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
  assert.equal(rows[0], '517912,"\'=HYPERLINK(""https://evil.test"")",Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie');
  assert.equal(rows[1], '517912,"\'+SUM(1,1)",Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie');
  assert.equal(rows[2], "517912,'-2+3,Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie");
  assert.equal(rows[3], "517912,'@command,Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie");
  // Een liggend streepje verderop in de tekst (niet aan het begin) blijft
  // onaangeroerd - alleen een leidend =, +, - of @ is gevaarlijk.
  assert.equal(rows[4], "517912,Gewoon een titel met een - erin,Dorpsstraat 1,5051AA,Goirle,Noord-Brabant,Rijksmonument,Gebouwd,Woonhuis,2002-01-01,oorspronkelijke functie");
});

test("exportFileName geeft een voorspelbare, per-dag bestandsnaam met de juiste extensie", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(exportFileName("csv"), `doorzoeker-export-${today}.csv`);
  assert.equal(exportFileName("geojson"), `doorzoeker-export-${today}.geojson`);
});
