import assert from "node:assert/strict";
import test from "node:test";
import {
  balanceBraces,
  capListLimit,
  dedupeByRm,
  extractSparql,
  fixGemeentePad,
  fixLabelFilter,
  fixProvinciePad,
  hasCount,
  injectPrefixes,
  normalizeProvincieUri,
  postprocessSparql,
  stripCodeFences,
  translateProvincieUris,
} from "../lib/vraag/postprocess.ts";

test("stripCodeFences verwijdert markdown-codeblokken rond de query", () => {
  assert.equal(stripCodeFences("```sparql\nSELECT * WHERE { ?s ?p ?o }\n```"), "SELECT * WHERE { ?s ?p ?o }");
});

test("extractSparql pakt de inhoud van een sparql-codeblok, ook met tekst eromheen", () => {
  const raw = 'De query is gevalideerd zonder fouten.\n\n```sparql\nSELECT * WHERE { ?s ?p ?o }\n```';
  assert.equal(extractSparql(raw), "SELECT * WHERE { ?s ?p ?o }");
});

test("extractSparql negeert een tekstintro zonder codeblok (MCP-toolgebruik, 28-08-2026 live geconstateerd)", () => {
  const raw = "De query is gevalideerd zonder fouten of waarschuwingen. Hier is de definitieve SPARQL-query:\n\n\nPREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT DISTINCT ?rm WHERE { ?rm a ceo:Rijksmonument }";
  assert.equal(extractSparql(raw), "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT DISTINCT ?rm WHERE { ?rm a ceo:Rijksmonument }");
});

test("extractSparql laat een kale query zonder omliggende tekst met rust", () => {
  const raw = "SELECT * WHERE { ?s ?p ?o }";
  assert.equal(extractSparql(raw), raw);
});

test("injectPrefixes voegt de vaste prefixen toe als PREFIX ceo: ontbreekt", () => {
  const result = injectPrefixes("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }");
  assert.match(result, /PREFIX ceo: </);
});

test("injectPrefixes laat een query met PREFIX ceo: met rust", () => {
  const query = "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT ?rm WHERE { ?rm a ceo:Rijksmonument }";
  assert.equal(injectPrefixes(query), query);
});

test("hasCount herkent COUNT ongeacht hoofdlettergebruik", () => {
  assert.equal(hasCount("SELECT (count(?rm) AS ?aantal) WHERE {}"), true);
  assert.equal(hasCount("SELECT ?rm WHERE {}"), false);
});

test("fixProvinciePad voegt de ontbrekende rdfs:label-stap toe", () => {
  const result = fixProvinciePad("?relatie ceo:heeftProvincie ?provincie .");
  assert.match(result, /\?relatie ceo:heeftProvincie \?provURI \. \?provURI rdfs:label \?provincie \./);
});

test("fixProvinciePad laat een query met provURI met rust", () => {
  const query = "?relatie ceo:heeftProvincie ?provURI . ?provURI rdfs:label ?provincie .";
  assert.equal(fixProvinciePad(query), query);
});

test("normalizeProvincieUri vervangt een provincie-stringfilter door een directe URI-match", () => {
  const query = [
    "SELECT ?rm WHERE {",
    "  ?rm ceo:heeftBasisregistratieRelatie ?relatie .",
    "  ?relatie ceo:heeftProvincie ?provURI .",
    '  ?provURI rdfs:label ?provincie .',
    '  FILTER(CONTAINS(LCASE(STR(?provincie)), "utrecht"))',
    "}",
  ].join("\n");
  const result = normalizeProvincieUri(query);
  assert.match(result, /ceo:heeftProvincie <http:\/\/standaarden\.overheid\.nl\/owms\/terms\/Utrecht_\(provincie\)>/);
  assert.doesNotMatch(result, /rdfs:label \?provincie/);
});

test("normalizeProvincieUri laat de query met rust bij een onbekende provincienaam", () => {
  const query = '?relatie ceo:heeftProvincie ?provURI . ?provURI rdfs:label ?provincie . FILTER(CONTAINS(LCASE(STR(?provincie)), "narnia"))';
  assert.equal(normalizeProvincieUri(query), query);
});

test("fixLabelFilter vervangt LCASE = door CONTAINS(LCASE(...))", () => {
  const result = fixLabelFilter('FILTER(LCASE(?naam) = "utrecht")');
  assert.equal(result, 'FILTER(CONTAINS(LCASE(?naam), "utrecht"))');
});

test("fixGemeentePad herschrijft het foute BRK/gemeentenaam-pad naar het juiste heeftGemeente-pad", () => {
  // Empirisch geverifieerd (28-08-2026, rce-cho MCP op RM 14948/Elst): dit
  // pad geeft de plaatsnaam terug, niet de gemeente.
  const query = "?relatie ceo:heeftBRKRelatie ?brk . ?brk ceo:gemeentenaam ?gemeente .";
  const result = fixGemeentePad(query);
  assert.match(result, /\?relatie ceo:heeftGemeente \?gemeenteUri \. \?gemeenteUri rdfs:label \?gemeente \./);
  assert.doesNotMatch(result, /heeftBRKRelatie/);
});

test("fixGemeentePad laat een query zonder dat patroon met rust", () => {
  const query = "?relatie ceo:heeftGemeente ?gemeenteUri . ?gemeenteUri rdfs:label ?gemeente .";
  assert.equal(fixGemeentePad(query), query);
});

test("balanceBraces vult ontbrekende sluithaken aan (live geconstateerd bij het geneste UNION-functiezoekpatroon)", () => {
  const query = [
    "SELECT DISTINCT ?rm ?bron WHERE {",
    "  ?rm a ceo:Rijksmonument .",
    "  {",
    '    { ?rm ceo:heeftOorspronkelijkeFunctie ?fObj . BIND("oorspronkelijke functie" AS ?bron) }',
    "    UNION",
    '    { ?rm ceo:heeftHuidigeFunctie ?fObj . BIND("huidige functie" AS ?bron) }',
  ].join("\n");
  const result = balanceBraces(query);
  const opens = (result.match(/\{/g) ?? []).length;
  const closes = (result.match(/\}/g) ?? []).length;
  assert.equal(opens, closes);
  assert.equal(result, `${query}\n}}`);
});

test("balanceBraces laat een al gebalanceerde query met rust", () => {
  const query = "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }";
  assert.equal(balanceBraces(query), query);
});

test("capListLimit vervangt een bestaande LIMIT door het plafond", () => {
  assert.match(capListLimit("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 50000", 200), /LIMIT 200/);
});

test("capListLimit voegt een LIMIT toe als die ontbreekt", () => {
  assert.match(capListLimit("SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }", 200), /LIMIT 200$/);
});

test("capListLimit laat een kleinere, bewust gezette LIMIT met rust (bv. 'geef 5 rijksmonumenten')", () => {
  const query = "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument }\nLIMIT 5";
  assert.equal(capListLimit(query, 200), query);
});

test("postprocessSparql past alle stappen in de juiste volgorde toe voor lijstmodus", () => {
  const raw = [
    "```sparql",
    "SELECT DISTINCT ?rm ?gemeente WHERE {",
    "  ?rm a ceo:Rijksmonument .",
    "  ?rm ceo:heeftBasisregistratieRelatie ?relatie .",
    "  ?relatie ceo:heeftBRKRelatie ?brk .",
    "  ?brk ceo:gemeentenaam ?gemeente .",
    '  FILTER(LCASE(?gemeente) = "bunnik")',
    "}",
    "```",
  ].join("\n");
  const result = postprocessSparql(raw, "lijst");
  assert.doesNotMatch(result, /```/);
  assert.match(result, /PREFIX ceo:/);
  assert.match(result, /heeftGemeente/);
  assert.doesNotMatch(result, /heeftBRKRelatie/);
  assert.match(result, /CONTAINS\(LCASE\(\?gemeente\), "bunnik"\)/);
  assert.match(result, /LIMIT 200/);
});

test("postprocessSparql voegt geen LIMIT toe bij tellingmodus", () => {
  const result = postprocessSparql("SELECT (COUNT(DISTINCT ?rm) AS ?aantal) WHERE { ?rm a ceo:Rijksmonument }", "telling");
  assert.doesNotMatch(result, /LIMIT/);
});

test("dedupeByRm houdt alleen de eerste rij per monument-URI", () => {
  const data = {
    head: { vars: ["rm", "naam"] },
    results: {
      bindings: [
        { rm: { type: "uri", value: "https://example.org/rm/1" }, naam: { type: "literal", value: "Eerste" } },
        { rm: { type: "uri", value: "https://example.org/rm/1" }, naam: { type: "literal", value: "Tweede naaminstantie" } },
        { rm: { type: "uri", value: "https://example.org/rm/2" }, naam: { type: "literal", value: "Ander monument" } },
      ],
    },
  };
  const result = dedupeByRm(data);
  assert.equal(result.results.bindings.length, 2);
  assert.equal(result.results.bindings[0].naam.value, "Eerste");
});

test("dedupeByRm laat resultaten zonder ?rm-kolom met rust (bv. een telling)", () => {
  const data = { head: { vars: ["aantal"] }, results: { bindings: [{ aantal: { type: "literal", value: "42" } }] } };
  assert.deepEqual(dedupeByRm(data), data);
});

test("translateProvincieUris voegt een leesbare ?provincie-kolom toe op basis van ?provURI", () => {
  const data = {
    head: { vars: ["provURI", "aantal"] },
    results: { bindings: [{ provURI: { type: "uri", value: "http://standaarden.overheid.nl/owms/terms/Utrecht_(provincie)" }, aantal: { type: "literal", value: "10" } }] },
  };
  const result = translateProvincieUris(data);
  assert.equal(result.results.bindings[0].provincie.value, "Utrecht");
  assert.ok(result.head.vars.includes("provincie"));
});
