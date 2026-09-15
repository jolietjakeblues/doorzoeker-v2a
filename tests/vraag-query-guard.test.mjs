import assert from "node:assert/strict";
import test from "node:test";
import { Parser } from "@traqula/parser-sparql-1-2";
import { assertSafeVraagQuery, enforceOuterLimit, UnsafeSparqlError } from "../lib/vraag/query-guard.ts";

test("assertSafeVraagQuery accepteert een gewone SELECT-query", () => {
  assert.doesNotThrow(() => assertSafeVraagQuery("SELECT ?s WHERE { ?s ?p ?o }"));
});

test("assertSafeVraagQuery weigert een SERVICE-federatie (securityreview 15-09-2026)", () => {
  assert.throws(
    () => assertSafeVraagQuery("SELECT ?s WHERE { SERVICE <https://example.invalid/sparql> { ?s ?p ?o } }"),
    UnsafeSparqlError,
  );
});

test("assertSafeVraagQuery weigert SERVICE ook als het genest zit in een UNION", () => {
  assert.throws(
    () => assertSafeVraagQuery("SELECT ?s WHERE { { SERVICE <https://example.invalid/sparql> { ?s ?p ?o } } UNION { ?s ?p ?o } }"),
    UnsafeSparqlError,
  );
});

test("assertSafeVraagQuery weigert SERVICE ook als het genest zit in een subquery", () => {
  assert.throws(
    () => assertSafeVraagQuery("SELECT ?s WHERE { { SELECT ?s WHERE { SERVICE <https://example.invalid/sparql> { ?s ?p ?o } } } }"),
    UnsafeSparqlError,
  );
});

test("assertSafeVraagQuery weigert ASK/CONSTRUCT/DESCRIBE - alleen SELECT is toegestaan", () => {
  assert.throws(() => assertSafeVraagQuery("ASK { ?s ?p ?o }"), UnsafeSparqlError);
  assert.throws(() => assertSafeVraagQuery("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }"), UnsafeSparqlError);
  assert.throws(() => assertSafeVraagQuery("DESCRIBE ?s WHERE { ?s ?p ?o }"), UnsafeSparqlError);
});

test("assertSafeVraagQuery weigert FROM/FROM NAMED (Doorzoeker scoped altijd via GRAPH binnen WHERE)", () => {
  assert.throws(() => assertSafeVraagQuery("SELECT ?s FROM <http://example.org/g> WHERE { ?s ?p ?o }"), UnsafeSparqlError);
});

test("assertSafeVraagQuery weigert syntactisch ongeldige SPARQL", () => {
  assert.throws(() => assertSafeVraagQuery("SELECT ?s WHERE { ?s ?p ?o"), UnsafeSparqlError);
});

test("enforceOuterLimit voegt een buitenste LIMIT toe als die ontbreekt, ook met een kleinere geneste subquery-LIMIT ervoor (securityreview 15-09-2026)", () => {
  // Exacte reproductie uit de externe review: capListLimit's "eerste LIMIT
  // in de tekst"-regex zag de subquery-LIMIT 5 aan voor een al-begrensde
  // buitenste query.
  const query = "SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 5 } ?s ?p2 ?o2 }";
  const result = enforceOuterLimit(query, 200);
  assert.match(result, /LIMIT 200\s*$/);
  assert.match(result, /LIMIT 5\b/, "de subquery-LIMIT 5 moet ongemoeid blijven staan");
});

test("enforceOuterLimit verlaagt een te grote buitenste LIMIT", () => {
  const result = enforceOuterLimit("SELECT ?s WHERE { ?s ?p ?o }\nLIMIT 5000", 200);
  assert.match(result, /LIMIT 200\s*$/);
  assert.doesNotMatch(result, /5000/);
});

test("enforceOuterLimit laat een al kleine buitenste LIMIT met rust", () => {
  const query = "SELECT ?s WHERE { ?s ?p ?o }\nLIMIT 50";
  assert.equal(enforceOuterLimit(query, 200), query);
});

test("enforceOuterLimit voegt een LIMIT toe als er helemaal geen LIMIT is", () => {
  const result = enforceOuterLimit("SELECT ?s WHERE { ?s ?p ?o }", 200);
  assert.match(result, /LIMIT 200\s*$/);
});

test("assertSafeVraagQuery weigert SERVICE genest in FILTER EXISTS (hercontrole 15-09-2026)", () => {
  const query = "SELECT ?s WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <https://example.invalid/sparql> { ?a ?b ?c } } }";
  assert.throws(() => assertSafeVraagQuery(query), UnsafeSparqlError);
});

test("assertSafeVraagQuery weigert SERVICE genest in FILTER NOT EXISTS", () => {
  const query = "SELECT ?s WHERE { ?s ?p ?o FILTER NOT EXISTS { SERVICE <https://example.invalid/sparql> { ?a ?b ?c } } }";
  assert.throws(() => assertSafeVraagQuery(query), UnsafeSparqlError);
});

test("assertSafeVraagQuery weigert SERVICE genest in BIND(EXISTS{...})", () => {
  const query = "SELECT ?s WHERE { ?s ?p ?o BIND(EXISTS { SERVICE <https://example.invalid/sparql> { ?a ?b ?c } } AS ?hit) }";
  assert.throws(() => assertSafeVraagQuery(query), UnsafeSparqlError);
});

test("assertSafeVraagQuery weigert SERVICE genest in een EXISTS in de SELECT-projectie", () => {
  const query = "SELECT ?s (EXISTS { SERVICE <https://example.invalid/sparql> { ?a ?b ?c } } AS ?hit) WHERE { ?s ?p ?o }";
  assert.throws(() => assertSafeVraagQuery(query), UnsafeSparqlError);
});

test("enforceOuterLimit behoudt een afsluitende OFFSET bij het verlagen van een te grote buitenste LIMIT (hercontrole 15-09-2026)", () => {
  const result = enforceOuterLimit("SELECT ?s WHERE { ?s ?p ?o } LIMIT 500 OFFSET 10", 200);
  assert.match(result, /LIMIT 200 OFFSET 10\s*$/);
  assert.doesNotMatch(result, /LIMIT 500/);
  assert.doesNotThrow(() => new Parser().parse(result));
});

test("enforceOuterLimit behoudt commentaar ná een te grote buitenste LIMIT", () => {
  const result = enforceOuterLimit("SELECT ?s WHERE { ?s ?p ?o } LIMIT 500 # comment", 200);
  assert.doesNotMatch(result, /LIMIT 500/);
  assert.match(result, /LIMIT 200/);
  assert.match(result, /# comment/);
  assert.doesNotThrow(() => new Parser().parse(result));
});
