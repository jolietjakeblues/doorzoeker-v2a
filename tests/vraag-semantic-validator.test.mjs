import assert from "node:assert/strict";
import test from "node:test";
import { requestedLimit, validateCompleteness, validateExactLimit, validateQuery } from "../lib/vraag/semantic-validator.ts";

test("validateCompleteness meldt een fout als de vraag een functie noemt maar de query geen functiepad heeft", () => {
  const errors = validateCompleteness("Welke kerken staan er in Bunnik?", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /functie of type/);
});

test("validateCompleteness is stil als de query wel een functiepad heeft", () => {
  const query = "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:heeftOorspronkelijkeFunctie ?f }";
  assert.deepEqual(validateCompleteness("Welke kerken staan er in Bunnik?", query), []);
});

test("validateCompleteness meldt een fout als de vraag een gezicht noemt maar de query ceo:Gezicht of de ruimtelijke relatie mist", () => {
  const errors = validateCompleteness("Welke rijksmonumenten liggen in het stadsgezicht van Dordrecht?", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Gezicht/);
});

test("validateCompleteness is stil als de query ceo:Gezicht en geof:sfWithin heeft", () => {
  const query = "SELECT ?rm WHERE { ?gezicht a ceo:Gezicht . FILTER(geof:sfWithin(?geom1, ?geom2)) }";
  assert.deepEqual(validateCompleteness("Welke rijksmonumenten liggen in dit stadsgezicht?", query), []);
});

test("validateCompleteness geeft geen fout als de vraag geen functie of gezicht noemt", () => {
  assert.deepEqual(validateCompleteness("Hoeveel rijksmonumenten staan er in Bunnik?", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }"), []);
});

test("requestedLimit herkent 'geef N', 'toon N', 'laat N zien' en 'noem N'", () => {
  assert.equal(requestedLimit("Geef 5 rijksmonumenten in Bunnik"), 5);
  assert.equal(requestedLimit("Toon 10 kerken"), 10);
  assert.equal(requestedLimit("Laat 3 monumenten zien"), 3);
  assert.equal(requestedLimit("Noem 7 gezichten"), 7);
});

test("requestedLimit geeft undefined als er geen expliciet aantal wordt gevraagd", () => {
  assert.equal(requestedLimit("Welke rijksmonumenten staan er in Bunnik?"), undefined);
});

test("validateExactLimit meldt een fout als de gevraagde LIMIT niet overeenkomt", () => {
  const errors = validateExactLimit("Geef 5 rijksmonumenten in Bunnik", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 200");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /LIMIT 5/);
});

test("validateExactLimit is stil als de LIMIT overeenkomt", () => {
  assert.deepEqual(validateExactLimit("Geef 5 rijksmonumenten in Bunnik", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 5"), []);
});

test("validateExactLimit is stil zonder expliciet gevraagd aantal", () => {
  assert.deepEqual(validateExactLimit("Welke rijksmonumenten staan er in Bunnik?", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 200"), []);
});

test("validateQuery combineert beide checks", () => {
  const errors = validateQuery("Geef 5 kerken in Bunnik", "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 200");
  assert.equal(errors.length, 2);
});
