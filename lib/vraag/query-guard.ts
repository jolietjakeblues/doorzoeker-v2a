// Structurele veiligheidscontrole voor SPARQL die daadwerkelijk tegen het
// RCE-endpoint uitgevoerd gaat worden - gebruikt door zowel de generatiestap
// (lib/server/vraag-adapter.ts) als /api/vraag/uitvoeren, die een (mogelijk
// door de gebruiker bewerkte, of rechtstreeks aangeroepen) query ontvangt
// zonder dat de generatiestap ooit heeft meegekeken. Gebouwd op dezelfde
// @traqula/parser-sparql-1-2 als syntax-validator.ts: een structurele AST-
// check is betrouwbaarder dan de tekstuele regex-vangnetten in
// postprocess.ts (die zichzelf al "geen SPARQL-parser" noemen) - met name
// om een genest subquery-SERVICE/LIMIT niet aan te zien voor de buitenste
// query.
//
// Externe review (15-09-2026): een SELECT met SERVICE <https://
// example.invalid/...> en zonder LIMIT ging voorheen ongewijzigd door naar
// het RCE-endpoint via /api/vraag/uitvoeren, en een buitenste query zonder
// eigen LIMIT werd door postprocess.ts's capListLimit ten onrechte als al
// begrensd gezien zodra een GENESTE subquery toevallig een eigen (kleinere)
// LIMIT had - capListLimit's regex vindt altijd de EERSTE "LIMIT" in de
// tekst, niet per se de buitenste.
import { Parser } from "@traqula/parser-sparql-1-2";

export class UnsafeSparqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeSparqlError";
  }
}

// @traqula's eigen SparqlQuery-uniontype (QuerySelect | QueryAsk |
// QueryConstruct | QueryDescribe | Update) deelt "subType"/"datasets"/
// "where"/"solutionModifiers" niet over alle leden - een Update-query mist
// ze bijvoorbeeld. TypeScript kan zo'n union dan niet betrouwbaar
// vernauwen op een enkele runtime-check. Deze functies lezen daarom alleen
// de velden die ze nodig hebben via een minimale, losse vorm - de
// aanwezigheid wordt hieronder altijd eerst met een echte runtime-check
// bevestigd (`ast.subType === "select"`), niet aangenomen.
type ParsedSelectQuery = {
  subType?: string;
  datasets?: { clauses?: unknown[] };
  where?: unknown;
  solutionModifiers?: { limitOffset?: { limit?: number } };
};

function parseOrThrow(query: string): ParsedSelectQuery {
  try {
    return new Parser().parse(query) as ParsedSelectQuery;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UnsafeSparqlError(`Ongeldige SPARQL-syntax: ${message}`);
  }
}

// Loopt recursief door een WHERE-groep (en elke geneste group/optional/
// union/minus/subquery daarbinnen) op zoek naar een SERVICE-patroon - een
// SERVICE kan overal genest zitten, niet alleen op het bovenste niveau.
function containsServicePattern(pattern: unknown): boolean {
  if (!pattern || typeof pattern !== "object") return false;
  const node = pattern as { subType?: string; patterns?: unknown[]; where?: unknown };
  if (node.subType === "service") return true;
  if (Array.isArray(node.patterns)) {
    if (node.patterns.some((child) => containsServicePattern(child))) return true;
  }
  // Een genest subquery-patroon (subType "query") draagt zijn eigen WHERE-boom.
  if (node.where && containsServicePattern(node.where)) return true;
  return false;
}

// Staat alleen toe wat /vraag daadwerkelijk genereert en nodig heeft: een
// enkele, leesbare SELECT-query zonder federatie (SERVICE) of expliciete
// dataset-selectie (FROM/FROM NAMED - Doorzoeker scoped altijd via GRAPH
// binnen WHERE, nooit via FROM). Gooit UnsafeSparqlError, geen stille
// aanpassing - een geweigerde query hoort een duidelijke fout te geven, geen
// verrassend ander resultaat.
export function assertSafeVraagQuery(query: string): void {
  const ast = parseOrThrow(query);
  if (ast.subType !== "select") {
    throw new UnsafeSparqlError("Alleen SELECT-queries zijn toegestaan.");
  }
  if (ast.datasets?.clauses?.length) {
    throw new UnsafeSparqlError("FROM/FROM NAMED is niet toegestaan; gebruik GRAPH binnen WHERE.");
  }
  if (containsServicePattern(ast.where)) {
    throw new UnsafeSparqlError("SERVICE-federatie naar een ander endpoint is niet toegestaan.");
  }
}

// Dwingt een buitenste LIMIT af, betrouwbaar gelezen uit de AST (dus nooit
// per ongeluk een geneste subquery-LIMIT). Mechanisch toegepast met een
// EIND-verankerde regex: een buitenste LIMIT staat altijd ná de sluitende
// accolade van de buitenste WHERE, dus als laatste "LIMIT n" in de tekst -
// een geneste subquery-LIMIT staat altijd eerder, binnen die WHERE-groep,
// en kan dus nooit op het einde van de string matchen.
export function enforceOuterLimit(query: string, max: number): string {
  const ast = parseOrThrow(query);
  const current = ast.solutionModifiers?.limitOffset?.limit;
  if (typeof current === "number" && current <= max) return query;
  const trimmed = query.trimEnd();
  if (/LIMIT\s+\d+\s*$/i.test(trimmed)) {
    return trimmed.replace(/LIMIT\s+\d+\s*$/i, `LIMIT ${max}`);
  }
  return `${trimmed}\nLIMIT ${max}`;
}
