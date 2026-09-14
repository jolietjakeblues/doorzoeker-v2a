import assert from "node:assert/strict";
import test from "node:test";
import { describeLimitation, detectLimitation } from "../lib/vraag/answerability.ts";

test("detectLimitation triggert op een begraafplaats-term samen met een nabijheidsvoorzetsel", () => {
  const limitation = detectLimitation("Welke rijksmonumenten liggen bij een begraafplaats?");
  assert.ok(limitation);
  assert.equal(limitation.partialOptions.length, 2);
  assert.equal(limitation.partialOptions[0].id, "functie_begraafplaats");
  assert.equal(limitation.partialOptions[1].id, "complex_onderdeel");
});

test("detectLimitation triggert ook op 'kerkhof' en andere nabijheidsvoorzetsels", () => {
  assert.ok(detectLimitation("Welke rijksmonumenten liggen nabij een kerkhof?"));
  assert.ok(detectLimitation("Welke rijksmonumenten liggen rondom een begraafplaats?"));
  assert.ok(detectLimitation("Welke rijksmonumenten liggen in de buurt van een begraafplaats?"));
});

test("detectLimitation is stil zonder nabijheidsvoorzetsel (eenduidig via het functiepad)", () => {
  assert.equal(detectLimitation("Welke rijksmonumenten zijn een begraafplaats?"), undefined);
});

test("detectLimitation is stil zonder begraafplaats/kerkhof-term", () => {
  assert.equal(detectLimitation("Welke rijksmonumenten liggen bij een kerk?"), undefined);
});

test("describeLimitation zet een beperking om in een JSON-serialiseerbare kaart", () => {
  const limitation = detectLimitation("rijksmonumenten bij een begraafplaats");
  const clarification = describeLimitation(limitation);
  assert.equal(clarification.type, "answerability_limitation");
  assert.equal(clarification.message, limitation.explanation);
  assert.deepEqual(
    clarification.options,
    limitation.partialOptions.map((option) => ({ id: option.id, label: option.label, caveat: option.caveat })),
  );
});
