import assert from "node:assert/strict";
import test from "node:test";
import { __resetResolverCacheForTests, buildSemanticContext, describeAmbiguity, resolveQuestion } from "../lib/vraag/semantic-resolver.ts";

function fetchFor({ gemeente = [], provincie = [], woonplaats = [] } = {}, onCall) {
  return async (input) => {
    onCall?.(String(input));
    const url = decodeURIComponent(String(input));
    if (url.includes("ceo:woonplaatsnaam")) {
      return Response.json({ head: { vars: ["naam"] }, results: { bindings: woonplaats.map((naam) => ({ naam: { type: "literal", value: naam } })) } });
    }
    if (url.includes("/terms/Gemeente>")) {
      return Response.json({
        head: { vars: ["uri", "label"] },
        results: { bindings: gemeente.map(([uri, label]) => ({ uri: { type: "uri", value: uri }, label: { type: "literal", value: label } })) },
      });
    }
    return Response.json({
      head: { vars: ["uri", "label"] },
      results: { bindings: provincie.map(([uri, label]) => ({ uri: { type: "uri", value: uri }, label: { type: "literal", value: label } })) },
    });
  };
}

function withFetchMock(context, fetchImpl) {
  const originalFetch = globalThis.fetch;
  __resetResolverCacheForTests();
  globalThis.fetch = fetchImpl;
  context.after(() => {
    globalThis.fetch = originalFetch;
    __resetResolverCacheForTests();
  });
}

const GRONINGEN_GEMEENTE_URI = "http://standaarden.overheid.nl/owms/terms/Groningen_(gemeente)";
const GRONINGEN_PROVINCIE_URI = "http://standaarden.overheid.nl/owms/terms/Groningen_(provincie)";

test("resolveQuestion kortsluit op een expliciet 'gemeente'-keyword", async (context) => {
  withFetchMock(context, fetchFor({ gemeente: [[GRONINGEN_GEMEENTE_URI, "Groningen"]], provincie: [[GRONINGEN_PROVINCIE_URI, "Groningen"]] }));
  const result = await resolveQuestion("Welke rijksmonumenten staan in de gemeente Groningen?");
  assert.equal(result.ambiguous.length, 0);
  assert.equal(result.resolved.length, 1);
  assert.equal(result.resolved[0].kind, "gemeente");
  assert.equal(result.resolved[0].uri, GRONINGEN_GEMEENTE_URI);
});

test("resolveQuestion kortsluit op een expliciet 'provincie'-keyword", async (context) => {
  withFetchMock(context, fetchFor({ gemeente: [[GRONINGEN_GEMEENTE_URI, "Groningen"]], provincie: [[GRONINGEN_PROVINCIE_URI, "Groningen"]] }));
  const result = await resolveQuestion("Welke rijksmonumenten staan in de provincie Groningen?");
  assert.equal(result.resolved[0].kind, "provincie");
  assert.equal(result.resolved[0].uri, GRONINGEN_PROVINCIE_URI);
});

test("resolveQuestion kortsluit op een expliciet 'woonplaats'-keyword", async (context) => {
  withFetchMock(context, fetchFor({ woonplaats: ["Bunnik"] }));
  const result = await resolveQuestion("Welke rijksmonumenten staan in de woonplaats Bunnik?");
  assert.equal(result.resolved.length, 1);
  assert.equal(result.resolved[0].kind, "plaats");
  assert.equal(result.resolved[0].label, "Bunnik");
  assert.equal(result.resolved[0].uri, "Bunnik");
});

test("resolveQuestion herkent een echte gemeente/provincie-naamsbotsing zonder keyword", async (context) => {
  withFetchMock(context, fetchFor({ gemeente: [[GRONINGEN_GEMEENTE_URI, "Groningen"]], provincie: [[GRONINGEN_PROVINCIE_URI, "Groningen"]] }));
  const result = await resolveQuestion("Welke rijksmonumenten staan er in Groningen?");
  assert.equal(result.resolved.length, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.equal(result.ambiguous[0].label, "Groningen");
  assert.equal(result.ambiguous[0].candidates.length, 2);
});

test("resolveQuestion lost de tie op met een disambiguation-override", async (context) => {
  withFetchMock(context, fetchFor({ gemeente: [[GRONINGEN_GEMEENTE_URI, "Groningen"]], provincie: [[GRONINGEN_PROVINCIE_URI, "Groningen"]] }));
  const result = await resolveQuestion("Welke rijksmonumenten staan er in Groningen?", { Groningen: "provincie" });
  assert.equal(result.ambiguous.length, 0);
  assert.equal(result.resolved[0].kind, "provincie");
  assert.equal(result.resolved[0].uri, GRONINGEN_PROVINCIE_URI);
});

test("resolveQuestion herkent 'woonplaats' als keyword, maar 'vindplaats' triggert geen valse 'plaats'-match", async (context) => {
  withFetchMock(context, fetchFor({}));
  const result = await resolveQuestion("Wat is de vindplaats van dit object?");
  assert.equal(result.resolved.length, 0);
  assert.equal(result.ambiguous.length, 0);
});

test("resolveQuestion hergebruikt de cache binnen de TTL (geen herhaalde fetch)", async (context) => {
  let calls = 0;
  withFetchMock(context, fetchFor({ gemeente: [[GRONINGEN_GEMEENTE_URI, "Groningen"]] }, () => { calls += 1; }));
  await resolveQuestion("Welke rijksmonumenten staan in de gemeente Groningen?");
  const callsAfterFirst = calls;
  await resolveQuestion("Welke rijksmonumenten staan in de gemeente Groningen?");
  assert.equal(calls, callsAfterFirst, "de tweede aanroep had de cache moeten gebruiken, geen nieuwe fetch");
});

test("buildSemanticContext formatteert een gemeente-/provincie-/plaatsterm", () => {
  const context = buildSemanticContext([
    { kind: "gemeente", label: "Overbetuwe", uri: "http://standaarden.overheid.nl/owms/terms/Overbetuwe" },
  ]);
  assert.match(context, /OPGELOSTE BEGRIPPEN/);
  assert.match(context, /gemeente "Overbetuwe" = <http:\/\/standaarden\.overheid\.nl\/owms\/terms\/Overbetuwe>; gebruik via ceo:heeftBasisregistratieRelatie en ceo:heeftGemeente\./);
});

test("buildSemanticContext formatteert een plaats (woonplaats) zonder resolvebare URI", () => {
  const context = buildSemanticContext([{ kind: "plaats", label: "Bunnik", uri: "Bunnik" }]);
  assert.match(context, /plaats \(woonplaats\) "Bunnik"; gebruik via ceo:heeftBasisregistratieRelatie -> ceo:heeftBAGRelatie -> ceo:woonplaatsnaam, EXACTE match "Bunnik"/);
});

test("buildSemanticContext geeft een lege string terug zonder opgeloste termen", () => {
  assert.equal(buildSemanticContext([]), "");
});

test("describeAmbiguity zet de eerste ambiguïteit om in een verduidelijkingsvraag", () => {
  const clarification = describeAmbiguity([
    {
      label: "Groningen",
      candidates: [
        { kind: "gemeente", label: "Groningen", uri: GRONINGEN_GEMEENTE_URI },
        { kind: "provincie", label: "Groningen", uri: GRONINGEN_PROVINCIE_URI },
      ],
    },
  ]);
  assert.equal(clarification.type, "entity_ambiguity");
  assert.match(clarification.message, /"Groningen" kan meerdere dingen zijn/);
  assert.deepEqual(clarification.options, [
    { id: "gemeente", label: "Gemeente Groningen", termLabel: "Groningen" },
    { id: "provincie", label: "Provincie Groningen", termLabel: "Groningen" },
  ]);
});
