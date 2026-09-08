import assert from "node:assert/strict";
import test from "node:test";
import { validateSyntax } from "../lib/vraag/syntax-validator.ts";

test("validateSyntax geeft geen fouten voor een geldige query", () => {
  const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT ?rm WHERE {
  ?rm a ceo:Rijksmonument .
}`;
  assert.deepEqual(validateSyntax(query), []);
});

test("validateSyntax vangt een niet-afgesloten URI", () => {
  const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT ?rm WHERE {
  ?rm a ceo:Rijksmonument .
  ?rm ceo:heeftGemeente <http://standaarden.overheid.nl/owms/terms/Utrecht_(gemeente) .
}`;
  const errors = validateSyntax(query);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^SPARQL-syntaxfout:/);
});

test("validateSyntax vangt een ontbrekend WHERE/GRAPH-blok", () => {
  // Vergelijkbaar met het incident dat balanceBraces (postprocess.ts)
  // afvangt, maar dan zonder ontbrekende sluithaken -- puur een missende
  // WHERE/{ vóór GRAPH, wat balanceBraces niet detecteert.
  const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX graph: <https://linkeddata.cultureelerfgoed.nl/graph/>
SELECT (COUNT(DISTINCT ?rm) AS ?aantal)
GRAPH graph:instanties-rce {
  ?rm a ceo:Rijksmonument .
}`;
  assert.equal(validateSyntax(query).length, 1);
});

test("validateSyntax vangt een dubbele vergelijkingsoperator in een FILTER", () => {
  const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?rm ?jaar WHERE {
  ?rm a ceo:Rijksmonument .
  ?rm ceo:registratiedatum ?jaar .
  FILTER(?jaar > > "2000-01-01"^^xsd:date)
}`;
  assert.equal(validateSyntax(query).length, 1);
});
