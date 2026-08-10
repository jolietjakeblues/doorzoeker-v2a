import assert from "node:assert/strict";
import test from "node:test";
import { parseUrlState, primaryIdentifier } from "../lib/heritage-view-model.ts";

const base = { objectNumber: "cho-42" };

test("uses an RM prefix only for a Rijksmonument", () => {
  assert.deepEqual(primaryIdentifier({ ...base, objectType: "Rijksmonument", monumentNumber: "36046" }), { label: "RM", value: "36046" });
  assert.deepEqual(primaryIdentifier({ ...base, objectType: "Werelderfgoed", monumentNumber: "1495" }), { label: "Werelderfgoed", value: "1495" });
  assert.deepEqual(primaryIdentifier({ ...base, objectType: "Gezicht", monumentNumber: "1305" }), { label: "Gezicht", value: "1305" });
  assert.deepEqual(primaryIdentifier({ ...base, objectType: "Complex", monumentNumber: "21031" }), { label: "Complex", value: "21031" });
  assert.deepEqual(primaryIdentifier({ ...base, objectType: "Onderzoeksgebied", monumentNumber: "1234" }), { label: "Onderzoeksgebied", value: "1234" });
});

test("restores an exact concept search and generic selected object from the URL", () => {
  const state = parseUrlState("?q=Woonhuis&concept=https%3A%2F%2Fdata.cultureelerfgoed.nl%2Fterm%2Fid%2Frn%2F2%2Fabc&veld=monumentaard&object=cho-42&pagina=3");
  assert.equal(state.query, "Woonhuis");
  assert.equal(state.conceptUri, "https://data.cultureelerfgoed.nl/term/id/rn/2/abc");
  assert.equal(state.conceptField, "monumentaard");
  assert.equal(state.selectedId, "cho-42");
  assert.equal(state.page, 3);
});

test("keeps old rm links working while new links use object", () => {
  assert.equal(parseUrlState("?rm=36046").selectedId, "36046");
});
