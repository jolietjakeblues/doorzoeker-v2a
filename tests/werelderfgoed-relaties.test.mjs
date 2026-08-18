import assert from "node:assert/strict";
import test from "node:test";
import { findWerelderfgoedLidmaatschap } from "../lib/rce/werelderfgoed-relaties.ts";

const voorbeeldRelaties = {
  "818": [{ werelderfgoednummer: "818", naam: "Molens bij Kinderdijk-Elshout" }],
  "1": [
    { werelderfgoednummer: "1349", naam: "17e eeuwse Grachtengordel van Amsterdam binnen de Singelgracht" },
    { werelderfgoednummer: "759", naam: "Hollandse Waterlinies" },
  ],
};

test("findWerelderfgoedLidmaatschap geeft de lidmaatschappen van een bekend rijksmonumentnummer terug", () => {
  assert.deepEqual(findWerelderfgoedLidmaatschap(voorbeeldRelaties, "818"), [
    { werelderfgoednummer: "818", naam: "Molens bij Kinderdijk-Elshout" },
  ]);
});

test("findWerelderfgoedLidmaatschap geeft meerdere lidmaatschappen terug wanneer een rijksmonument in meer dan één Werelderfgoed valt", () => {
  const result = findWerelderfgoedLidmaatschap(voorbeeldRelaties, "1");
  assert.equal(result?.length, 2);
});

test("findWerelderfgoedLidmaatschap geeft undefined terug voor een rijksmonumentnummer zonder relatie", () => {
  assert.equal(findWerelderfgoedLidmaatschap(voorbeeldRelaties, "999999"), undefined);
});

test("findWerelderfgoedLidmaatschap geeft undefined terug zonder monumentNumber", () => {
  assert.equal(findWerelderfgoedLidmaatschap(voorbeeldRelaties, undefined), undefined);
});
