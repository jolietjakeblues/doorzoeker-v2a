import assert from "node:assert/strict";
import test from "node:test";
import { buildLiteratuurQuery, parseLiteratuurResults } from "../lib/server/bibliotheek-adapter.ts";

test("builds a batched exact-match query on rijksmonumentnummer against the separate rce/bibliotheek dataset", () => {
  const query = buildLiteratuurQuery(["18073", "36046"]);
  assert.match(query, /ceo:rijksmonumentnummer \?rmnr/);
  assert.match(query, /VALUES \?rmnr \{ "18073" "36046" \}/);
  assert.match(query, /schema:name \?titel/);
  assert.match(query, /schema:datePublished \?jaar/);
  assert.match(query, /schema:sameAs \?sameAs/);
  assert.match(query, /schema:author \?auteurUri . \?auteurUri schema:name \?auteurNaam/);
});

test("groups multiple author rows for the same book into a single reference", () => {
  // Elke rij is één (boek, auteur)-combinatie - een boek met twee auteurs
  // komt dus als twee rijen terug, niet als één rij met een lijst.
  const document = { results: { bindings: [
    { rmnr: { value: "18073" }, boek: { value: "bib:1" }, titel: { value: "De Laakmolen" }, jaar: { value: "1988" }, sameAs: { value: "https://catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131" }, auteurNaam: { value: "Ambachtsheer, H.F." } },
    { rmnr: { value: "18073" }, boek: { value: "bib:1" }, titel: { value: "De Laakmolen" }, jaar: { value: "1988" }, sameAs: { value: "https://catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131" }, auteurNaam: { value: "Stal, C.J.J." } },
  ] } };
  const byMonument = parseLiteratuurResults(document);
  assert.deepEqual(byMonument.get("18073"), [
    { uri: "bib:1", title: "De Laakmolen", year: "1988", authors: ["Ambachtsheer, H.F.", "Stal, C.J.J."], sourceUrl: "https://catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131" },
  ]);
});

test("skips rows without a title, and handles a book without any author", () => {
  const document = { results: { bindings: [
    { rmnr: { value: "1" }, boek: { value: "bib:2" } },
    { rmnr: { value: "1" }, boek: { value: "bib:3" }, titel: { value: "Zonder auteur" } },
  ] } };
  const byMonument = parseLiteratuurResults(document);
  assert.deepEqual(byMonument.get("1"), [{ uri: "bib:3", title: "Zonder auteur", year: undefined, authors: [], sourceUrl: undefined }]);
});

test("sorts a monument's publications by year descending, most recent first", () => {
  const document = { results: { bindings: [
    { rmnr: { value: "1" }, boek: { value: "bib:oud" }, titel: { value: "Oud rapport" }, jaar: { value: "1990" } },
    { rmnr: { value: "1" }, boek: { value: "bib:nieuw" }, titel: { value: "Nieuw rapport" }, jaar: { value: "2020" } },
  ] } };
  const byMonument = parseLiteratuurResults(document);
  assert.deepEqual(byMonument.get("1").map((ref) => ref.title), ["Nieuw rapport", "Oud rapport"]);
});

test("caps the number of publications per monument at 5, keeping the most recent", () => {
  // Geobserveerd uitschietergeval: één rijksmonumentnummer met 149
  // gekoppelde publicaties - zonder cap onbruikbaar op de detailpagina.
  const bindings = Array.from({ length: 10 }, (_, index) => ({
    rmnr: { value: "1" }, boek: { value: `bib:${index}` }, titel: { value: `Rapport ${index}` }, jaar: { value: String(2000 + index) },
  }));
  const byMonument = parseLiteratuurResults({ results: { bindings } });
  const titles = byMonument.get("1").map((ref) => ref.title);
  assert.equal(titles.length, 5);
  assert.deepEqual(titles, ["Rapport 9", "Rapport 8", "Rapport 7", "Rapport 6", "Rapport 5"]);
});

test("keeps monuments in separate map entries and returns an empty map for no results", () => {
  const document = { results: { bindings: [
    { rmnr: { value: "1" }, boek: { value: "bib:1" }, titel: { value: "Boek A" } },
    { rmnr: { value: "2" }, boek: { value: "bib:2" }, titel: { value: "Boek B" } },
  ] } };
  const byMonument = parseLiteratuurResults(document);
  assert.equal(byMonument.size, 2);
  assert.equal(byMonument.get("1")[0].title, "Boek A");
  assert.equal(byMonument.get("2")[0].title, "Boek B");
  assert.deepEqual(parseLiteratuurResults({ results: { bindings: [] } }), new Map());
  assert.deepEqual(parseLiteratuurResults({}), new Map());
});
