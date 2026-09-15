import assert from "node:assert/strict";
import test from "node:test";
import { buildContainsClause, escapeSparqlString } from "../lib/rce/sparql.ts";

test("escapeSparqlString escapes backslashes, double quotes and collapses newlines", () => {
  assert.equal(escapeSparqlString('a\\b"c'), 'a\\\\b\\"c');
  assert.equal(escapeSparqlString("a\nb\r\nc"), "a b c");
});

test("buildContainsClause builds a single CONTAINS clause for a single-word term", () => {
  assert.equal(buildContainsClause("?match", "kerk"), 'CONTAINS(LCASE(STR(?match)), LCASE("kerk"))');
});

test("buildContainsClause AND's a CONTAINS clause per word for a multi-word term (multi-term vrije-tekstzoeken)", () => {
  assert.equal(
    buildContainsClause("?match", "kerk toren"),
    'CONTAINS(LCASE(STR(?match)), LCASE("kerk")) && CONTAINS(LCASE(STR(?match)), LCASE("toren"))',
  );
});

test("buildContainsClause ignores extra whitespace between words", () => {
  assert.equal(
    buildContainsClause("?match", "  kerk   toren  "),
    'CONTAINS(LCASE(STR(?match)), LCASE("kerk")) && CONTAINS(LCASE(STR(?match)), LCASE("toren"))',
  );
});

test("buildContainsClause returns 'true' for an empty term (no filtering)", () => {
  assert.equal(buildContainsClause("?match", ""), "true");
  assert.equal(buildContainsClause("?match", "   "), "true");
});

test("buildContainsClause caps at MAX_SEARCH_TERMS words, tegen een pathologisch lange invoer", () => {
  const term = Array.from({ length: 20 }, (_, i) => `woord${i}`).join(" ");
  const clause = buildContainsClause("?match", term);
  const clauseCount = clause.split(" && ").length;
  assert.equal(clauseCount, 6);
  assert.match(clause, /woord0/);
  assert.doesNotMatch(clause, /woord6/);
});

test("buildContainsClause escapes each word individually", () => {
  const clause = buildContainsClause("?match", 'kerk" toren');
  assert.match(clause, /LCASE\("kerk\\""\)/);
  assert.match(clause, /LCASE\("toren"\)/);
});
