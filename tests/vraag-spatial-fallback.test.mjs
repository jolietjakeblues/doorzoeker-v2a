import assert from "node:assert/strict";
import test from "node:test";
import { doesIntersect, isWithin, parseWktGeometry } from "../lib/rce.ts";
import {
  analyzeOuterShape,
  applySpatialFilterLocally,
  extractSpatialFilter,
  isFallbackCandidateSetIncomplete,
  isSpatialErrorBody,
  isSpatialFailure,
  projectAllVariablesForFallback,
  restoreOuterShape,
  stripSpatialFilter,
  widenLimitForFallback,
} from "../lib/vraag/spatial-fallback.ts";

const SQUARE = parseWktGeometry("POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))");
const SQUARE_WITH_HOLE = parseWktGeometry("POLYGON((0 0, 0 10, 10 10, 10 0, 0 0), (4 4, 4 6, 6 6, 6 4, 4 4))");
const POINT_INSIDE = parseWktGeometry("POINT(5 5)");
const POINT_IN_HOLE = parseWktGeometry("POINT(5 5)");
const POINT_OUTSIDE = parseWktGeometry("POINT(20 20)");

test("isWithin: een punt binnen een polygon", () => {
  assert.equal(isWithin(POINT_INSIDE, SQUARE), true);
});

test("isWithin: een punt buiten een polygon", () => {
  assert.equal(isWithin(POINT_OUTSIDE, SQUARE), false);
});

test("isWithin: een punt in een gat telt niet als binnen (RM 14948-achtig gezicht met uitsparing)", () => {
  assert.equal(isWithin(POINT_IN_HOLE, SQUARE_WITH_HOLE), false);
});

test("isWithin: een punt in een multipolygon", () => {
  const multi = parseWktGeometry("MULTIPOLYGON(((0 0, 0 10, 10 10, 10 0, 0 0)), ((100 100, 100 110, 110 110, 110 100, 100 100)))");
  assert.equal(isWithin(POINT_INSIDE, multi), true);
  assert.equal(isWithin(parseWktGeometry("POINT(105 105)"), multi), true);
  assert.equal(isWithin(POINT_OUTSIDE, multi), false);
});

test("isWithin: een polygon-object is alleen binnen als elk hoekpunt binnen het gebied ligt", () => {
  const innerSquare = parseWktGeometry("POLYGON((2 2, 2 8, 8 8, 8 2, 2 2))");
  assert.equal(isWithin(innerSquare, SQUARE), true);
  const overlapping = parseWktGeometry("POLYGON((5 5, 5 15, 15 15, 15 5, 5 5))");
  assert.equal(isWithin(overlapping, SQUARE), false);
});

test("doesIntersect: overlappende polygonen via een gedeeld hoekpunt-in-vlak", () => {
  const overlapping = parseWktGeometry("POLYGON((5 5, 5 15, 15 15, 15 5, 5 5))");
  assert.equal(doesIntersect(overlapping, SQUARE), true);
  const farAway = parseWktGeometry("POLYGON((100 100, 100 110, 110 110, 110 100, 100 100))");
  assert.equal(doesIntersect(farAway, SQUARE), false);
});

test("extractSpatialFilter herkent sfWithin en sfIntersects", () => {
  assert.deepEqual(extractSpatialFilter("FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt))"), { relation: "sfWithin", objectVar: "rmWkt", areaVar: "gezichtWkt" });
  assert.deepEqual(extractSpatialFilter("FILTER(geof:sfIntersects(?a, ?b))"), { relation: "sfIntersects", objectVar: "a", areaVar: "b" });
  assert.equal(extractSpatialFilter("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }"), undefined);
});

test("stripSpatialFilter verwijdert alleen de ruimtelijke FILTER, de rest blijft staan", () => {
  const query = "SELECT ?rm WHERE {\n  ?rm a ceo:Rijksmonument .\n  FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt))\n}";
  const result = stripSpatialFilter(query);
  assert.doesNotMatch(result, /geof:sfWithin/);
  assert.match(result, /\?rm a ceo:Rijksmonument/);
});

test("isSpatialErrorBody herkent een Virtuoso GEOS-topologiefout (live geconstateerd op Gezicht 'Schil Dordrecht')", () => {
  assert.equal(isSpatialErrorBody('{"message":"Virtuoso 22023 Error GEO22: Error in \\"GEOS silent within\\"() function: TopologyException: side location conflict"}'), true);
  assert.equal(isSpatialErrorBody("Gewone foutmelding zonder relatie tot geometrie"), false);
});

test("isSpatialFailure herkent zowel een timeout als een geometriefout in de foutbody", () => {
  const timeoutError = new Error("The operation was aborted due to timeout");
  timeoutError.name = "TimeoutError";
  assert.equal(isSpatialFailure(timeoutError), true);

  const spatialError = new Error("RCE SPARQL-service antwoordde met 500");
  Object.assign(spatialError, { body: "TopologyException: side location conflict" });
  assert.equal(isSpatialFailure(spatialError), true);

  const genericError = new Error("RCE SPARQL-service antwoordde met 503");
  Object.assign(genericError, { body: "Server tijdelijk niet beschikbaar" });
  assert.equal(isSpatialFailure(genericError), false);
});

test("isFallbackCandidateSetIncomplete signaleert wanneer het verruimde plafond geraakt is (vals-negatief-risico)", () => {
  // Live geconstateerd (28-08-2026): "rijksmonumenten binnen Gezicht X"
  // zonder gemeente-/functiefilter meldde ten onrechte 0 resultaten - de
  // vereenvoudigde query had geen eigen scoping meer, dus de eerste N
  // kandidaten (in willekeurige volgorde) bevatten toevallig geen enkel
  // treffer in het gezochte gebied, terwijl er in werkelijkheid 33 waren.
  assert.equal(isFallbackCandidateSetIncomplete(10_000, 10_000), true);
  assert.equal(isFallbackCandidateSetIncomplete(42, 10_000), false);
});

test("widenLimitForFallback verruimt een bestaande LIMIT en voegt er anders een toe", () => {
  assert.match(widenLimitForFallback("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 200", 5000), /LIMIT 5000/);
  assert.match(widenLimitForFallback("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }", 5000), /LIMIT 5000$/);
});

test("projectAllVariablesForFallback vervangt de buitenste SELECT-projectie door * (securityreview 15-09-2026: WKT-variabelen niet altijd geprojecteerd)", () => {
  const query = "PREFIX ceo: <http://x/ceo#>\nSELECT DISTINCT ?rm ?nummer WHERE {\n  ?rm a ceo:Rijksmonument .\n  ?rm ceo:heeftGeometrie/geo:asWKT ?rmWkt .\n}";
  const result = projectAllVariablesForFallback(query);
  assert.match(result, /SELECT DISTINCT \*\s*WHERE/);
  assert.doesNotMatch(result, /\?rm \?nummer WHERE/);
  assert.match(result, /PREFIX ceo:/, "PREFIX-declaraties vóór SELECT blijven staan");
  assert.match(result, /\?rm ceo:heeftGeometrie\/geo:asWKT \?rmWkt/, "de WHERE-inhoud blijft ongewijzigd");
});

test("projectAllVariablesForFallback behoudt SELECT zonder DISTINCT als zodanig", () => {
  const result = projectAllVariablesForFallback("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }");
  assert.match(result, /^SELECT \*\s*WHERE/);
});

test("projectAllVariablesForFallback laat een geneste subquery-SELECT met rust, vervangt alleen de buitenste", () => {
  const query = "SELECT ?rm ?nummer WHERE { { SELECT ?rm WHERE { ?rm a ceo:Rijksmonument } LIMIT 5 } ?rm ?p ?nummer }";
  const result = projectAllVariablesForFallback(query);
  assert.match(result, /^SELECT \*\s*WHERE/);
  assert.match(result, /SELECT \?rm WHERE \{ \?rm a ceo:Rijksmonument \}/, "de geneste subquery-SELECT blijft ongewijzigd");
});

test("projectAllVariablesForFallback laat een query zonder herkenbare WHERE met rust", () => {
  const query = "ASK { ?s ?p ?o }";
  assert.equal(projectAllVariablesForFallback(query), query);
});

test("applySpatialFilterLocally houdt alleen rijen die daadwerkelijk binnen het gebied liggen", () => {
  const data = {
    head: { vars: ["rm", "rmWkt", "gezichtWkt"] },
    results: {
      bindings: [
        { rm: { type: "uri", value: "https://example.org/rm/1" }, rmWkt: { type: "literal", value: "POINT(5 5)" }, gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" } },
        { rm: { type: "uri", value: "https://example.org/rm/2" }, rmWkt: { type: "literal", value: "POINT(20 20)" }, gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" } },
      ],
    },
  };
  const { data: filtered, skipped } = applySpatialFilterLocally(data, { relation: "sfWithin", objectVar: "rmWkt", areaVar: "gezichtWkt" });
  assert.equal(filtered.results.bindings.length, 1);
  assert.equal(filtered.results.bindings[0].rm.value, "https://example.org/rm/1");
  assert.equal(skipped, 0);
});

test("applySpatialFilterLocally slaat rijen met ontbrekende of onleesbare geometrie over, in plaats van te crashen", () => {
  const data = {
    head: { vars: ["rm", "rmWkt", "gezichtWkt"] },
    results: {
      bindings: [
        { rm: { type: "uri", value: "https://example.org/rm/1" }, gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" } },
        { rm: { type: "uri", value: "https://example.org/rm/2" }, rmWkt: { type: "literal", value: "niet-parseerbare-tekst" }, gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" } },
      ],
    },
  };
  const { data: filtered, skipped } = applySpatialFilterLocally(data, { relation: "sfWithin", objectVar: "rmWkt", areaVar: "gezichtWkt" });
  assert.equal(filtered.results.bindings.length, 0);
  assert.equal(skipped, 2);
});

// Hercontrole (15-09-2026): analyzeOuterShape/restoreOuterShape herstellen
// de oorspronkelijke telling/projectie/limiet ná een ruimtelijke terugval
// (die de SELECT tijdelijk naar * vervangt om de WKT-variabelen te pakken,
// zie projectAllVariablesForFallback hierboven).

test("analyzeOuterShape herkent een platte lijstprojectie met DISTINCT en LIMIT", () => {
  const shape = analyzeOuterShape("SELECT DISTINCT ?rm ?naam WHERE { ?rm a <http://x/Rijksmonument> } LIMIT 5");
  assert.deepEqual(shape, { kind: "list", variables: ["rm", "naam"], distinct: true, limit: 5 });
});

test("analyzeOuterShape herkent COUNT(DISTINCT ?rm) AS ?aantal", () => {
  const shape = analyzeOuterShape("SELECT (COUNT(DISTINCT ?rm) AS ?aantal) WHERE { ?rm a <http://x/Rijksmonument> }");
  assert.deepEqual(shape, { kind: "count", alias: "aantal", distinct: true, variable: "rm" });
});

test("analyzeOuterShape herkent COUNT(?rm) AS ?aantal zonder DISTINCT", () => {
  const shape = analyzeOuterShape("SELECT (COUNT(?rm) AS ?aantal) WHERE { ?rm a <http://x/Rijksmonument> }");
  assert.deepEqual(shape, { kind: "count", alias: "aantal", distinct: false, variable: "rm" });
});

test("analyzeOuterShape herkent COUNT(*) AS ?aantal", () => {
  const shape = analyzeOuterShape("SELECT (COUNT(*) AS ?aantal) WHERE { ?rm a <http://x/Rijksmonument> }");
  assert.deepEqual(shape, { kind: "count", alias: "aantal", distinct: false, variable: undefined });
});

test("analyzeOuterShape herkent SELECT *", () => {
  assert.deepEqual(analyzeOuterShape("SELECT * WHERE { ?rm a <http://x/Rijksmonument> }"), { kind: "wildcard" });
});

test("analyzeOuterShape geeft 'unsupported' voor een GEGROEPEERDE telling (GROUP BY)", () => {
  const shape = analyzeOuterShape("SELECT ?gemeente (COUNT(DISTINCT ?rm) AS ?aantal) WHERE { ?rm a <http://x/Rijksmonument> } GROUP BY ?gemeente");
  assert.equal(shape.kind, "unsupported");
});

test("analyzeOuterShape geeft 'unsupported' voor een niet-COUNT-aggregaat", () => {
  const shape = analyzeOuterShape("SELECT (SUM(?x) AS ?totaal) WHERE { ?rm <http://x/waarde> ?x }");
  assert.equal(shape.kind, "unsupported");
});

test("analyzeOuterShape geeft 'unsupported' voor een berekende BIND-projectiekolom", () => {
  const shape = analyzeOuterShape("SELECT (STR(?rm) AS ?label) WHERE { ?rm a <http://x/Rijksmonument> }");
  assert.equal(shape.kind, "unsupported");
});

test("restoreOuterShape (list): behoudt alleen de oorspronkelijk geprojecteerde kolommen, dedupliceert en knipt op de oorspronkelijke limiet", () => {
  const data = {
    head: { vars: ["rm", "naam", "rmWkt"] },
    results: {
      bindings: [
        { rm: { type: "uri", value: "urn:rm:1" }, naam: { type: "literal", value: "A" }, rmWkt: { type: "literal", value: "POINT(1 1)" } },
        { rm: { type: "uri", value: "urn:rm:1" }, naam: { type: "literal", value: "A" }, rmWkt: { type: "literal", value: "POINT(1 1)" } },
        { rm: { type: "uri", value: "urn:rm:2" }, naam: { type: "literal", value: "B" }, rmWkt: { type: "literal", value: "POINT(2 2)" } },
        { rm: { type: "uri", value: "urn:rm:3" }, naam: { type: "literal", value: "C" }, rmWkt: { type: "literal", value: "POINT(3 3)" } },
      ],
    },
  };
  const shape = { kind: "list", variables: ["rm", "naam"], distinct: true, limit: 2 };
  const result = restoreOuterShape(data, shape, 200);
  assert.deepEqual(result.head.vars, ["rm", "naam"]);
  assert.equal(result.results.bindings.length, 2);
  for (const row of result.results.bindings) {
    assert.deepEqual(Object.keys(row).sort(), ["naam", "rm"]);
  }
  assert.equal(result.results.bindings[0].rm.value, "urn:rm:1");
  assert.equal(result.results.bindings[1].rm.value, "urn:rm:2");
});

test("restoreOuterShape (count, distinct): telt distincte waarden van de opgetelde variabele", () => {
  const data = {
    head: { vars: ["rm"] },
    results: {
      bindings: [
        { rm: { type: "uri", value: "urn:rm:1" } },
        { rm: { type: "uri", value: "urn:rm:1" } },
        { rm: { type: "uri", value: "urn:rm:2" } },
      ],
    },
  };
  const shape = { kind: "count", alias: "aantal", distinct: true, variable: "rm" };
  const result = restoreOuterShape(data, shape, 200);
  assert.deepEqual(result.head.vars, ["aantal"]);
  assert.equal(result.results.bindings.length, 1);
  assert.equal(result.results.bindings[0].aantal.value, "2");
});

test("restoreOuterShape (count, niet-distinct): telt alle gebonden rijen", () => {
  const data = {
    head: { vars: ["rm"] },
    results: {
      bindings: [
        { rm: { type: "uri", value: "urn:rm:1" } },
        { rm: { type: "uri", value: "urn:rm:1" } },
        { rm: { type: "uri", value: "urn:rm:2" } },
      ],
    },
  };
  const shape = { kind: "count", alias: "aantal", distinct: false, variable: "rm" };
  const result = restoreOuterShape(data, shape, 200);
  assert.equal(result.results.bindings[0].aantal.value, "3");
});

test("restoreOuterShape (count, COUNT(*)): telt alle rijen ongeacht een specifieke variabele", () => {
  const data = { head: { vars: ["rm"] }, results: { bindings: [{ rm: { type: "uri", value: "urn:rm:1" } }, { rm: { type: "uri", value: "urn:rm:2" } }] } };
  const shape = { kind: "count", alias: "aantal", distinct: false, variable: undefined };
  const result = restoreOuterShape(data, shape, 200);
  assert.equal(result.results.bindings[0].aantal.value, "2");
});

test("restoreOuterShape (wildcard): laat de rijen ongewijzigd, knipt alleen op het plafond", () => {
  const data = {
    head: { vars: ["rm", "rmWkt"] },
    results: { bindings: [{ rm: { type: "uri", value: "urn:rm:1" }, rmWkt: { type: "literal", value: "POINT(1 1)" } }] },
  };
  const result = restoreOuterShape(data, { kind: "wildcard" }, 200);
  assert.deepEqual(result, data);
});
