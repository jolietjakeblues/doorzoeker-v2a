import assert from "node:assert/strict";
import test from "node:test";
import {
  CONCEPT_FIELDS,
  linkedConcepts,
  parseUrlState,
  pickVergelijkbareRijksmonumenten,
  primaryFunctionConcept,
  primaryIdentifier,
  toItem,
  typeConceptForLabel,
} from "../lib/heritage-view-model.ts";

const base = { objectNumber: "cho-42" };

const baseRecord = {
  choNumber: "10015422",
  monumentNumber: "10015422",
  registrationDate: "2000-01-01",
  street: "",
  houseNumber: "",
  postalCode: "",
  sourceUrl: "https://linkeddata.cultureelerfgoed.nl/rm:10015422",
};

test("currentFunctionNames wordt net als originalFunctionNames opgeschoond van een (code)-staart (gemeld door de eigenaar: 'Gemaal(M)', 'Kapel(K1)' bleven overal onopgeschoond staan)", () => {
  const item = toItem({
    ...baseRecord,
    originalFunctionNames: ["Boerderij(M)", "Boerderij"],
    currentFunctionNames: ["Gemaal(M)", "Kapel(K1)"],
  });
  assert.deepEqual(item.originalFunctionNames, ["Boerderij", "Boerderij"]);
  assert.deepEqual(item.currentFunctionNames, ["Gemaal", "Kapel"]);
});

test("matchedText wordt ook opgeschoond wanneer de treffer via 'huidige functie' komt, niet alleen 'oorspronkelijke functie'", () => {
  const item = toItem({
    ...baseRecord,
    matchSource: "huidige functie",
    matchedText: "Gemaal(M)",
  });
  assert.equal(item.matchedText, "Gemaal");
});

test("matchedText via andere matchbronnen (bv. woonplaats) blijft ongemoeid", () => {
  const item = toItem({
    ...baseRecord,
    matchSource: "woonplaats",
    matchedText: "Utrecht",
  });
  assert.equal(item.matchedText, "Utrecht");
});

test("een Gezicht linkt naar de RCE Linked Data-URI, niet naar het dode Archis-archiefdomein (archisarchief.cultureelerfgoed.nl gaf 403/404 op elk pad, ook de root)", () => {
  const item = toItem({
    ...baseRecord,
    monumentNature: "gezicht",
    officialUrl: "https://archisarchief.cultureelerfgoed.nl/Beschermde_Gezichten/BG1325",
  });
  assert.equal(item.sourceUrl, baseRecord.sourceUrl);
});

test("collects only linked concepts that support an exact search", () => {
  assert.deepEqual(
    linkedConcepts({
      functionConcepts: [
        { uri: "https://example.test/woonhuis", label: "Woonhuis" },
      ],
      archaeologicalValuation: "Hoge archeologische waarde",
      archaeologicalValuationConceptUri: "https://example.test/waardering",
      archaeologicalMaterials: [
        { uri: "https://example.test/messing", label: "messing" },
      ],
      stijlEnCultuurConcept: { uri: "https://example.test/streekeigen", label: "streek-eigen bouwtrant" },
      bouwkundigeStaatConcept: { uri: "https://example.test/goed", label: "goed" },
      archaeologicalAcquisition: "niet-archeologisch: graafwerk",
      archaeologicalAcquisitionConceptUri: "https://example.test/graafwerk",
      archaeologicalType: "grondverkleuring",
      archaeologicalTypeConceptUri: "https://example.test/grondverkleuring",
      typeConcepts: [
        { uri: "https://example.test/bovenkruier", label: "Bovenkruier" },
      ],
      // description heeft geen eigen concept-URI en levert dus bewust geen
      // entry op - niet elk veld op Item ondersteunt een exacte zoekopdracht.
      description: "Een lange vrije-tekst omschrijving zonder concept-URI.",
    }),
    [
      {
        uri: "https://example.test/woonhuis",
        label: "Woonhuis",
        field: "functie",
        group: "Functie",
      },
      {
        uri: "https://example.test/bovenkruier",
        label: "Bovenkruier",
        field: "monumenttype",
        group: "Type",
      },
      {
        uri: "https://example.test/waardering",
        label: "Hoge archeologische waarde",
        field: "waardering",
        group: "Waardering",
      },
      {
        uri: "https://example.test/messing",
        label: "messing",
        field: "materiaal",
        group: "Materiaal",
      },
      {
        uri: "https://example.test/streekeigen",
        label: "streek-eigen bouwtrant",
        field: "stijl",
        group: "Stijl en cultuur",
      },
      {
        uri: "https://example.test/goed",
        label: "goed",
        field: "bouwkundigestaat",
        group: "Bouwkundige staat",
      },
      {
        uri: "https://example.test/graafwerk",
        label: "niet-archeologisch: graafwerk",
        field: "verwerving",
        group: "Verwervingswijze",
      },
      {
        uri: "https://example.test/grondverkleuring",
        label: "grondverkleuring",
        field: "grondspoortype",
        group: "Type grondspoor",
      },
    ],
  );
});

test("typeConceptForLabel matcht op het exacte typelabel en levert undefined zonder match", () => {
  const item = {
    typeConcepts: [
      { uri: "https://example.test/bovenkruier", label: "Bovenkruier" },
      { uri: "https://example.test/stellingmolen", label: "Stellingmolen" },
    ],
  };
  assert.deepEqual(typeConceptForLabel(item, "Stellingmolen"), {
    uri: "https://example.test/stellingmolen",
    label: "Stellingmolen",
  });
  assert.equal(typeConceptForLabel(item, "Onbekend type"), undefined);
  assert.equal(typeConceptForLabel({}, "Bovenkruier"), undefined);
});

test("pickVergelijkbareRijksmonumenten excludes the opened monument itself and caps the list", () => {
  const candidates = ["36046", "36047", "36048", "36049", "36050", "36051"].map((monumentNumber) => ({
    id: monumentNumber,
    monumentNumber,
  }));
  assert.deepEqual(
    pickVergelijkbareRijksmonumenten(candidates, "36046").map((item) => item.monumentNumber),
    ["36047", "36048", "36049", "36050", "36051"],
  );
});

test("pickVergelijkbareRijksmonumenten respects a custom limit", () => {
  const candidates = ["36046", "36047", "36048"].map((monumentNumber) => ({
    id: monumentNumber,
    monumentNumber,
  }));
  assert.deepEqual(
    pickVergelijkbareRijksmonumenten(candidates, "36046", 1).map((item) => item.monumentNumber),
    ["36047"],
  );
});

test("pickVergelijkbareRijksmonumenten keeps every candidate when the excluded number is absent", () => {
  const candidates = ["36047", "36048"].map((monumentNumber) => ({
    id: monumentNumber,
    monumentNumber,
  }));
  assert.deepEqual(
    pickVergelijkbareRijksmonumenten(candidates, undefined).map((item) => item.monumentNumber),
    ["36047", "36048"],
  );
});

test("primaryFunctionConcept matches the concept whose cleaned label equals item.kind", () => {
  assert.deepEqual(
    primaryFunctionConcept({
      kind: "Woonhuis",
      functionConcepts: [
        { uri: "https://example.test/museum", label: "Museum" },
        { uri: "https://example.test/woonhuis", label: "Woonhuis(K)" },
      ],
    }),
    { uri: "https://example.test/woonhuis", label: "Woonhuis(K)" },
  );
});

test("primaryFunctionConcept falls back to the first concept when no label matches", () => {
  assert.deepEqual(
    primaryFunctionConcept({
      kind: "Kerk",
      functionConcepts: [{ uri: "https://example.test/museum", label: "Museum" }],
    }),
    { uri: "https://example.test/museum", label: "Museum" },
  );
});

test("primaryFunctionConcept returns undefined without any functionConcepts", () => {
  assert.equal(primaryFunctionConcept({ kind: "Kerk", functionConcepts: undefined }), undefined);
});

test("uses an RM prefix only for a Rijksmonument", () => {
  assert.deepEqual(
    primaryIdentifier({
      ...base,
      objectType: "Rijksmonument",
      monumentNumber: "36046",
    }),
    { label: "RM", value: "36046" },
  );
  assert.deepEqual(
    primaryIdentifier({
      ...base,
      objectType: "Werelderfgoed",
      monumentNumber: "1495",
    }),
    { label: "Werelderfgoed", value: "1495" },
  );
  assert.deepEqual(
    primaryIdentifier({
      ...base,
      objectType: "Gezicht",
      monumentNumber: "1305",
    }),
    { label: "Gezicht", value: "1305" },
  );
  assert.deepEqual(
    primaryIdentifier({
      ...base,
      objectType: "Complex",
      monumentNumber: "21031",
    }),
    { label: "Complex", value: "21031" },
  );
  assert.deepEqual(
    primaryIdentifier({
      ...base,
      objectType: "Onderzoeksgebied",
      monumentNumber: "1234",
    }),
    { label: "Onderzoeksgebied", value: "1234" },
  );
  assert.deepEqual(
    primaryIdentifier({
      ...base,
      objectType: "Archeologisch terrein",
      monumentNumber: "3958",
    }),
    { label: "Archis", value: "3958" },
  );
  assert.deepEqual(
    primaryIdentifier({ ...base, objectType: "Vondstlocatie", monumentNumber: "102482" }),
    { label: "Archis", value: "102482" },
  );
  assert.deepEqual(
    primaryIdentifier({ ...base, objectType: "Grondspoor", monumentNumber: "10000135" }),
    { label: "CHO", value: "10000135" },
  );
  assert.deepEqual(
    primaryIdentifier({ ...base, objectType: "Vondst", monumentNumber: "10015422", objectNumber: "10015422" }),
    { label: "CHO", value: "10015422" },
  );
  assert.deepEqual(
    primaryIdentifier({ ...base, objectType: "Archeologisch complex", monumentNumber: "10015403", objectNumber: "10015403" }),
    { label: "CHO", value: "10015403" },
  );
});

test("restores an exact concept search and generic selected object from the URL", () => {
  const state = parseUrlState(
    "?q=Woonhuis&concept=https%3A%2F%2Fdata.cultureelerfgoed.nl%2Fterm%2Fid%2Frn%2F2%2Fabc&veld=monumentaard&object=cho-42&pagina=3",
  );
  assert.equal(state.query, "Woonhuis");
  assert.equal(
    state.conceptUri,
    "https://data.cultureelerfgoed.nl/term/id/rn/2/abc",
  );
  assert.equal(state.conceptField, "monumentaard");
  assert.equal(state.selectedId, "cho-42");
  assert.equal(state.page, 3);
});

test("restores conceptField voor alle 14 velden na page reload (TD-05 bugfix 17-08-2026: de losse 9-voudige allowlist herkende stijl, bouwkundigestaat, verwerving, grondspoortype en monumenttype niet - een gedeelde link met die velden herstelde niet)", () => {
  assert.equal(CONCEPT_FIELDS.length, 14);
  for (const veld of CONCEPT_FIELDS) {
    const state = parseUrlState(`?concept=https%3A%2F%2Fdata.cultureelerfgoed.nl%2Fterm%2Fid%2Frn%2F2%2Fabc&veld=${veld}`);
    assert.equal(state.conceptField, veld, `veld=${veld} had moeten herstellen`);
  }
  assert.equal(parseUrlState("?veld=onbekend").conceptField, undefined);
});

test("keeps old rm links working while new links use object", () => {
  assert.equal(parseUrlState("?rm=36046").selectedId, "36046");
});

test("restores a collection browse from the URL", () => {
  const state = parseUrlState(
    "?q=Rijksmonumenten&browse=rijksmonument&soort=Rijksmonument",
  );
  assert.equal(state.query, "Rijksmonumenten");
  assert.equal(state.browseKind, "rijksmonument");
  assert.equal(state.objectType, "Rijksmonument");
});

test("restores a valid map position and ignores invalid coordinates", () => {
  assert.deepEqual(
    parseUrlState("?view=map&lat=51.52001&lng=5.07002&zoom=13").mapViewport,
    { lat: 51.52001, lng: 5.07002, zoom: 13 },
  );
  assert.equal(
    parseUrlState("?view=map&lat=999&lng=5.07&zoom=13").mapViewport,
    undefined,
  );
});

test("restores the canonical identity of a selected thesaurus term", () => {
  const state = parseUrlState(
    "?q=Kerk&begrip=https%3A%2F%2Fexample.test%2Fterm%2Fkerk&begripbron=https%3A%2F%2Fexample.test%2Fcht&begripbronnaam=CHT",
  );
  assert.deepEqual(state.selectedTerm, {
    uri: "https://example.test/term/kerk",
    label: "Kerk",
    sourceUri: "https://example.test/cht",
    sourceName: "CHT",
  });
});
