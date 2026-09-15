export function escapeSparqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

// Bovengrens tegen een pathologisch lange invoer met veel losse woorden -
// elk extra woord voegt een eigen CONTAINS-clausule toe aan de query.
const MAX_SEARCH_TERMS = 6;

// Bouwt een AND van CONTAINS-clausules voor élk los woord in de zoekterm,
// zodat bv. "kerk toren" matcht op tekst waar beide woorden ergens
// voorkomen, niet per se naast elkaar (multi-term vrije-tekstzoeken).
// Geeft alleen de booleaanse expressie terug, geen FILTER()-wrapper, zodat
// aanroepers 'm kunnen combineren met eigen OR-takken (zie
// buildComplexenQuery in lib/rce/monuments.ts).
export function buildContainsClause(matchVar: string, term: string): string {
  const words = term.trim().split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
  if (words.length === 0) return "true";
  return words.map((word) => `CONTAINS(LCASE(STR(${matchVar})), LCASE("${escapeSparqlString(word)}"))`).join(" && ");
}
