import assert from "node:assert/strict";
import test from "node:test";
import { doesIntersect, isWithin, parseWktGeometry } from "../lib/rce.ts";
import {
  applySpatialFilterLocally,
  extractSpatialFilter,
  isFallbackCandidateSetIncomplete,
  isSpatialErrorBody,
  isSpatialFailure,
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
