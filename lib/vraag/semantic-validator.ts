// Deterministische, gratis volledigheidscheck ná het genereren - vangt het
// geval waarin Claude een onderdeel van een meerledige vraag (bv. gemeente
// + functie, of gemeente + gezicht) stilzwijgend laat vallen in plaats van
// te combineren, ook met de rce-cho MCP-tools aangesloten. Poort van de
// eigenaars eigen ldv-talk-2-your-data (sparql/semantic_validator.py):
// alleen validate_completeness() en de exacte-aantal-check uit
// validate_semantics() zijn overgezet - de gemeente/provincie-URI-checks
// daar horen bij die app's eigen lokale label-resolver, en zijn hier niet
// nodig omdat de rce-cho MCP die resolutie al doet (zie
// lib/server/vraag-adapter.ts).
const FUNCTIE_KEYWORDS = ["functie", "kerk", "kerkhof", "begraafplaats", "molen", "kasteel", "boerderij", "school", "fabriek", "toren", "klooster", "gemaal", "sluis"];
const FUNCTIE_PATHS = ["heeftoorspronkelijkefunctie", "heefthuidigefunctie", "heefttype"];

const GEZICHT_KEYWORDS = ["gezicht", "stadsgezicht", "dorpsgezicht"];
const SPATIAL_FUNCTIONS = ["geof:sfwithin", "geof:sfintersects"];

// Controleert of onderdelen die letterlijk in de vraag staan ook in de
// query terugkomen.
export function validateCompleteness(question: string, query: string): string[] {
  const q = question.toLowerCase();
  const lowered = query.toLowerCase();
  const errors: string[] = [];

  if (FUNCTIE_KEYWORDS.some((keyword) => q.includes(keyword)) && !FUNCTIE_PATHS.some((path) => lowered.includes(path))) {
    errors.push(
      "De vraag noemt een functie of type (bv. kerk, molen, school, of het woord 'functie'), maar de query bevat geen functie/type-patroon. Voeg ceo:heeftOorspronkelijkeFunctie, ceo:heeftHuidigeFunctie en/of ceo:heeftType toe.",
    );
  }

  if (GEZICHT_KEYWORDS.some((keyword) => q.includes(keyword))) {
    const hasGezichtClass = lowered.includes("ceo:gezicht");
    const hasSpatial = SPATIAL_FUNCTIONS.some((fn) => lowered.includes(fn));
    if (!hasGezichtClass || !hasSpatial) {
      errors.push(
        "De vraag noemt een (beschermd) gezicht, maar de query mist ceo:Gezicht en/of de ruimtelijke relatie. Voeg ceo:Gezicht toe en filter met geof:sfWithin of geof:sfIntersects op beide WKT-geometrieën.",
      );
    }
  }

  return errors;
}

const REQUESTED_LIMIT_RE = /\b(?:geef|toon|laat|noem)\b(?:\s+mij)?\s+(\d{1,3})\b/i;

export function requestedLimit(question: string): number | undefined {
  const match = REQUESTED_LIMIT_RE.exec(question);
  return match ? Number(match[1]) : undefined;
}

// Als de gebruiker expliciet om een aantal vraagt ("geef 5 rijksmonumenten"),
// moet de query diezelfde LIMIT gebruiken - vereist dat capListLimit()
// (postprocess.ts) een kleinere, bewuste LIMIT niet meer overschrijft.
export function validateExactLimit(question: string, query: string): string[] {
  const limit = requestedLimit(question);
  if (limit === undefined) return [];
  const hasExactLimit = new RegExp(`\\bLIMIT\\s+${limit}\\b`, "i").test(query);
  return hasExactLimit ? [] : [`De gebruiker vraagt exact ${limit} resultaten; gebruik LIMIT ${limit}.`];
}

export function validateQuery(question: string, query: string): string[] {
  return [...validateCompleteness(question, query), ...validateExactLimit(question, query)];
}
