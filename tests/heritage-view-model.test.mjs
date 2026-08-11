import assert from "node:assert/strict";
import test from "node:test";
import {
  linkedConcepts,
  parseUrlState,
  primaryIdentifier,
} from "../lib/heritage-view-model.ts";

const base = { objectNumber: "cho-42" };

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
      archaeologicalStyles: [
        { uri: "https://example.test/romeins", label: "Romeins" },
      ],
    }),
    [
      {
        uri: "https://example.test/woonhuis",
        label: "Woonhuis",
        field: "functie",
        group: "Functie",
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
    ],
  );
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
