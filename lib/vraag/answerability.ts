// Poort van chat2thedata's sparql/answerability.py: herkent vragen die geen
// eenduidige SPARQL-vertaling hebben omdat de onderliggende data de relatie
// inconsistent modelleert. In plaats van een foute aanname te doen of een
// nep-keuze tussen gelijkwaardige opties te geven (zoals
// semantic-resolver.ts doet bij een echte entiteits-tie), legt de app hier
// de beperking uit en biedt ze expliciet gelabelde, onvolledige
// deelinterpretaties aan.
//
// Eerste en enige tot nu toe geregistreerde geval: "welke rijksmonumenten
// liggen bij een begraafplaats". Empirisch geverifieerd tegen het live RCE
// CHO-endpoint (chat2thedata, 2026-09-07): rijksmonumentstatus van
// begraafplaats-gerelateerde objecten is inherent inconsistent gemodelleerd.
// Geen van de twee mogelijke lezingen (directe functie, complex-onderdeel)
// dekt "alle rijksmonumenten bij een begraafplaats" correct:
// - functienaam-varianten met "begraaf" zijn zelf al niet één term
//   (Begraafplaats, Begraafplaatshek, Begraafplaatsaula, Kloosterbegraafplaats
//   (H)/(F), Dierenbegraafplaats, Begraafplaats en -onderdelen).
// - complexen met een begraafplaats-functie-object bevatten ook een wilde mix
//   van andere objecttypen (Grafmonument, Kapel, Poortgebouw, Toegangshek,
//   Baarhuisje, Kerk, Grafzerk, Calvarieberg, Opslaggebouw) - haalt dus ruis
//   op en mist evengoed rijksmonumenten buiten dat complex.

export type PartialOption = { id: string; label: string; caveat: string; promptHint: string };
export type AnswerabilityLimitation = { explanation: string; partialOptions: PartialOption[] };
export type AnswerabilityLimitationClarification = {
  type: "answerability_limitation";
  message: string;
  options: { id: string; label: string; caveat: string }[];
};

const BEGRAAFPLAATS_TERMS = ["begraafplaats", "kerkhof"];
const NABIJHEID_TERMEN = ["bij ", "nabij", "in de buurt van", "rondom", "rond de", "rond een"];

// Triggert alleen op een begraafplaats/kerkhof-term SAMEN MET een
// nabijheidsvoorzetsel. "Welke rijksmonumenten zijn een begraafplaats" (geen
// voorzetsel) is wel eenduidig beantwoordbaar via het bestaande functiepad
// en volgt het normale, snelle pad.
export function detectLimitation(question: string): AnswerabilityLimitation | undefined {
  const q = question.toLowerCase();

  if (!BEGRAAFPLAATS_TERMS.some((term) => q.includes(term))) return undefined;
  if (!NABIJHEID_TERMEN.some((term) => q.includes(term))) return undefined;

  return {
    explanation:
      'Rijksmonumenten "bij" een begraafplaats zijn niet eenduidig te bepalen: sommige objecten (grafmonumenten, hekken, kapellen) delen alleen een complex met een begraafplaats zonder zelf die functie te hebben, en niet alles wat bij een begraafplaats hoort staat als los rijksmonument geregistreerd. Een van de onderstaande deelinterpretaties kan wel, maar dekt niet alles.',
    partialOptions: [
      {
        id: "functie_begraafplaats",
        label: "Rijksmonumenten met functie begraafplaats",
        caveat:
          "Toont alleen rijksmonumenten die zelf als begraafplaats/kerkhof geregistreerd staan — niet losse grafmonumenten, hekken of kapellen die er los naast staan.",
        promptHint:
          'Beantwoord dit als: rijksmonumenten waarvan de oorspronkelijke of huidige functie een begraafplaats-variant is (bijvoorbeeld Begraafplaats, Begraafplaatshek, Begraafplaatsaula, Kloosterbegraafplaats) via ceo:heeftOorspronkelijkeFunctie / ceo:heeftHuidigeFunctie -> ceo:heeftFunctieNaam -> skos:prefLabel met FILTER(CONTAINS(LCASE(?fNaam), "begraaf")).',
      },
      {
        id: "complex_onderdeel",
        label: "Rijksmonumenten in hetzelfde complex als een begraafplaats",
        caveat:
          "Kan ook onderdelen opleveren die inhoudelijk weinig met een begraafplaats te maken hebben (bijvoorbeeld een opslaggebouw in hetzelfde complex), en mist rijksmonumenten die wel bij een begraafplaats horen maar niet in hetzelfde complex geregistreerd staan.",
        promptHint:
          "Beantwoord dit als: rijksmonumenten die via ceo:isOnderdeelVanComplex hetzelfde ceo:Complex delen als een ander rijksmonument met een begraafplaats-functienaam (zelfde CONTAINS-check als hierboven). Gebruik ceo:Complex, niet ceo:ArcheologischComplex.",
      },
    ],
  };
}

// Zet een gedetecteerde beperking om in een JSON-serialiseerbare kaart.
export function describeLimitation(limitation: AnswerabilityLimitation): AnswerabilityLimitationClarification {
  return {
    type: "answerability_limitation",
    message: limitation.explanation,
    options: limitation.partialOptions.map((option) => ({ id: option.id, label: option.label, caveat: option.caveat })),
  };
}
