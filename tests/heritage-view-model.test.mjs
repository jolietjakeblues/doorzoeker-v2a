import assert from "node:assert/strict";
import test from "node:test";
import {
  parseUrlState,
  primaryIdentifier,
} from "../lib/heritage-view-model.ts";

const base = { objectNumber: "cho-42" };

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
