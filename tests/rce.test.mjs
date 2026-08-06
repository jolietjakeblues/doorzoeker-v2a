import assert from "node:assert/strict";
import test from "node:test";
import { parseRceMonuments } from "../lib/rce.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const graph = [
  { "@id": "bag:1", [`${CEO}openbareRuimte`]: [{ "@value": "Brigittenstraat" }], [`${CEO}huisnummer`]: [{ "@value": "18" }], [`${CEO}postcode`]: [{ "@value": "3512KM" }] },
  { "@id": "basis:1", [`${CEO}heeftBAGRelatie`]: [{ "@id": "bag:1" }] },
  { "@id": "rm:38342", "@type": [`${CEO}Rijksmonument`], [`${CEO}rijksmonumentnummer`]: [{ "@value": "https://monumentenregister.cultureelerfgoed.nl/monumenten/36046" }], [`${CEO}cultuurhistorischObjectnummer`]: [{ "@value": "38342" }], [`${CEO}datumInschrijvingInMonumentenregister`]: [{ "@value": "1967-06-20" }], [`${CEO}heeftBasisregistratieRelatie`]: [{ "@id": "basis:1" }] },
];

test("parses an official RCE JSON-LD graph", () => {
  assert.deepEqual(parseRceMonuments(graph), [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "Brigittenstraat", houseNumber: "18", postalCode: "3512KM", sourceUrl: "rm:38342" }]);
});
