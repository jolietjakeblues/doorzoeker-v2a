// Controleert of gegenereerde SPARQL daadwerkelijk geldige grammatica is.
//
// Noch postprocess.ts's fixes (balanceBraces zegt het zelf al: "geen
// SPARQL-parser, maar voldoende voor dit foutpatroon"), noch de rce-cho
// MCP's validate_query_structured-tool controleren daadwerkelijke SPARQL-
// grammatica - beide checken alleen een vaste lijst al-bekende
// foutpatronen. Empirisch geverifieerd (07-09-2026, tegen dezelfde drie
// gevallen als de Python-poort in chat2thedata/talk2thegraph): een echte
// parser vangt een niet-afgesloten URI, een ontbrekend WHERE/GRAPH-blok en
// een dubbele vergelijkingsoperator in een FILTER. sparqljs (het voor de
// hand liggende package) is inmiddels gedeprecieerd door de eigen auteur
// ten gunste van Traqula (onderdeel van het actief onderhouden
// Comunica-project) - vandaar @traqula/parser-sparql-1-2 hier.
import { Parser } from "@traqula/parser-sparql-1-2";

export class SparqlSyntaxInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SparqlSyntaxInvalidError";
  }
}

export function validateSyntax(query: string): string[] {
  try {
    new Parser().parse(query);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`SPARQL-syntaxfout: ${message}`];
  }
}
