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

// Loopt generiek, veldnaam-onafhankelijk door de VOLLEDIGE parserboom op
// zoek naar een SERVICE-knoop. Een eerdere versie liep alleen door
// pattern.patterns/pattern.where - een hercontrole (15-09-2026) vond dat
// een SERVICE binnen FILTER EXISTS (pattern.expression.args), binnen
// BIND(EXISTS{...}) en zelfs binnen een EXISTS in de SELECT-projectie
// (ast.variables, dus buiten ast.where) daardoor gemist werd. In plaats
// van opnieuw specifieke veldnamen op te sommen - waar de volgende
// AST-vorm weer een gat in kan laten - doorloopt deze versie ELK
// object-/array-veld van elke knoop. De Set-cyclusbeveiliging is puur
// defensief; de parser levert geen cyclische bomen.
function containsServicePattern(node: unknown, seen = new Set<unknown>()): boolean {
  if (!node || typeof node !== "object") return false;
  if (seen.has(node)) return false;
  seen.add(node);
  const obj = node as Record<string, unknown>;
  if (obj.subType === "service") return true;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      if (value.some((child) => containsServicePattern(child, seen))) return true;
    } else if (containsServicePattern(value, seen)) {
      return true;
    }
  }
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
  // De volledige ast, niet alleen ast.where - een SERVICE via EXISTS kan
  // ook in de SELECT-projectie zelf staan (ast.variables), buiten de
  // WHERE-boom (hercontrole 15-09-2026).
  if (containsServicePattern(ast)) {
    throw new UnsafeSparqlError("SERVICE-federatie naar een ander endpoint is niet toegestaan.");
  }
}

// Dwingt een buitenste LIMIT af, betrouwbaar gelezen uit de AST (dus nooit
// per ongeluk een geneste subquery-LIMIT). Mechanisch toegepast: bestaat er
// al een buitenste LIMIT (AST-gelezen `current`), dan is de LAATSTE
// "LIMIT n" in de tekst gegarandeerd díe buitenste (een geneste subquery-
// LIMIT staat altijd eerder, binnen de WHERE-groep) en wordt die vervangen
// - ongeacht wat er ná die LIMIT nog volgt (OFFSET, commentaar, VALUES).
// Een hercontrole (15-09-2026) vond dat de eerdere EIND-verankerde variant
// zo'n geldige, afsluitende OFFSET/commentaar niet herkende en er dan een
// TWEEDE, ongeldige LIMIT-clause achteraan plakte. Bestaat er NOG GEEN
// buitenste LIMIT, dan hoort elke "LIMIT n" die wél in de tekst voorkomt
// bij een geneste subquery - dan altijd toevoegen, nooit een bestaande
// match vervangen (anders zou juist die subquery-LIMIT ten onrechte
// overschreven worden). Het resultaat wordt hieronder structureel
// herverifieerd i.p.v. aangenomen.
export function enforceOuterLimit(query: string, max: number): string {
  const ast = parseOrThrow(query);
  const current = ast.solutionModifiers?.limitOffset?.limit;
  if (typeof current === "number" && current <= max) return query;
  const trimmed = query.trimEnd();
  let rewritten: string;
  if (typeof current === "number") {
    const matches = [...trimmed.matchAll(/LIMIT\s+\d+/gi)];
    const last = matches.at(-1);
    rewritten = last
      ? `${trimmed.slice(0, last.index)}LIMIT ${max}${trimmed.slice(last.index! + last[0].length)}`
      : `${trimmed}\nLIMIT ${max}`;
  } else {
    rewritten = `${trimmed}\nLIMIT ${max}`;
  }
  const resultAst = parseOrThrow(rewritten);
  if (resultAst.solutionModifiers?.limitOffset?.limit !== max) {
    throw new UnsafeSparqlError("Kon de resultaatlimiet niet veilig afdwingen op deze query.");
  }
  return rewritten;
}
