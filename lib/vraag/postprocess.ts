// Nabewerking van een door Claude gegenereerde SPARQL-query, poort van
// ldv-talk-to-your-data-test's sparql/postprocess.py (zie prompts.ts voor
// de herkomst en de gemeentepad-correctie).
//
// Twee bewuste afwijkingen t.o.v. de Python-bron:
// - `capListLimit` vervangt `remove_limit`: een lijstquery zonder ENIGE
//   LIMIT is een onnodig risico (kan tienduizenden rijen teruggeven via een
//   publieke, kostengevoelige route). Een vaste bovengrens is veiliger.
// - `fixGemeentePad` is nieuw: een vangnet voor als Claude toch het foute,
//   uit de brontekst overgenomen BRK/gemeentenaam-pad genereert ondanks de
//   gecorrigeerde prompt.
import { PROVINCIE_NAAM, PROVINCIE_URI, SPARQL_PREFIXES } from "./prompts.ts";

export type VraagMode = "lijst" | "telling";

export const LIJST_LIMIT = 200;

export function stripCodeFences(query: string): string {
  return query.replace(/```sparql/g, "").replace(/```/g, "").trim();
}

// Live geconstateerd (28-08-2026, met de rce-cho MCP-tools aangesloten):
// na een validate_query_structured-toolaanroep meldt Claude soms eerst in
// gewone tekst dat de query gevalideerd is ("De query is gevalideerd
// zonder fouten...") vóór de eigenlijke SPARQL, zonder ```sparql-codeblok -
// ondanks de instructie om alleen de ruwe query terug te geven. stripCodeFences
// laat zo'n inleidende zin dan gewoon staan. Zoekt daarom, als er geen
// codeblok is, naar het eerste SPARQL-sleutelwoord en negeert alles ervoor.
export function extractSparql(raw: string): string {
  const fenced = raw.match(/```(?:sparql)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const match = raw.match(/\b(PREFIX|SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i);
  if (match && typeof match.index === "number") return raw.slice(match.index).trim();
  return raw.trim();
}

export function injectPrefixes(query: string): string {
  if (!query.includes("PREFIX ceo:")) return `${SPARQL_PREFIXES}\n\n${query}`;
  if (!query.includes("PREFIX rdfs:") && query.includes("rdfs:")) {
    return `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n${query}`;
  }
  return query;
}

export function hasCount(query: string): boolean {
  return /\bCOUNT\b/i.test(query);
}

// Als Claude ceo:heeftProvincie zonder de verplichte rdfs:label-stap
// genereert, voegt dit die stap alsnog toe zodat normalizeProvincieUri
// (of, als de zoekterm onbekend is, de query zelf) iets bruikbaars heeft.
export function fixProvinciePad(query: string): string {
  if (!query.includes("heeftProvincie")) return query;
  if (query.includes("provURI") || query.includes("rdfs:label")) return query;
  return query.replace(
    /(\?\w+)\s+ceo:heeftProvincie\s+(\?\w+)\s*\./,
    (_match, subject: string, object: string) => `${subject} ceo:heeftProvincie ?provURI . ?provURI rdfs:label ${object} .`,
  );
}

// Vervangt een string-gebaseerd provinciefilter door een directe URI-match:
// van "?provURI rdfs:label ?provincie . FILTER(CONTAINS(LCASE(...), "utrecht"))"
// naar "ceo:heeftProvincie <...Utrecht_(provincie)>".
export function normalizeProvincieUri(query: string): string {
  if (!query.includes("heeftProvincie")) return query;

  const match = query.match(/FILTER[^"]*"([^"]+)"/i);
  if (!match) return query;

  const context = query.slice(Math.max(0, (match.index ?? 0) - 100), (match.index ?? 0) + match[0].length + 10).toLowerCase();
  if (!context.includes("provinci") && !context.includes("provlabel")) return query;

  const zoekterm = match[1].toLowerCase().trim();
  const uri = PROVINCIE_URI[zoekterm];
  if (!uri) return query;

  const withoutLabelLines = query
    .split("\n")
    .filter((line) => !(line.includes("rdfs:label") && /provinci/i.test(line)))
    .filter((line) => !(line.includes("FILTER") && /provinci/i.test(line)))
    .join("\n");
  return withoutLabelLines.replace(/ceo:heeftProvincie\s+\?\w+\s*\./, `ceo:heeftProvincie <${uri}> .`);
}

// FILTER(LCASE(?x) = "waarde") faalt stil op taalgelabelde strings - vervang
// door CONTAINS, wat wel werkt ongeacht taaltag.
export function fixLabelFilter(query: string): string {
  return query.replace(
    /FILTER\s*\(\s*LCASE\s*\((\?\w+)\)\s*=\s*("[\w\s]+")\s*\)/gi,
    (_match, variable: string, literal: string) => `FILTER(CONTAINS(LCASE(${variable}), ${literal}))`,
  );
}

// Vangnet: herschrijft het foute, uit de Python-bron overgenomen
// gemeentepad (heeftBRKRelatie -> gemeentenaam, geeft de plaatsnaam terug)
// naar het geverifieerd juiste pad (heeftGemeente -> rdfs:label).
export function fixGemeentePad(query: string): string {
  if (!query.includes("heeftBRKRelatie") || !query.includes("gemeentenaam")) return query;
  return query
    .replace(/(\?\w+)\s+ceo:heeftBRKRelatie\s+(\?\w+)\s*\.\s*\2\s+ceo:gemeentenaam\s+(\?\w+)\s*\./g, (_match, relatie: string, _brk: string, gemeente: string) => `${relatie} ceo:heeftGemeente ${gemeente}Uri . ${gemeente}Uri rdfs:label ${gemeente} .`);
}

// Zet een eventuele bestaande LIMIT om naar LIJST_LIMIT, of voegt die toe als
// er nog geen LIMIT is - nooit een ongelimiteerde lijstquery op een publieke
// route.
export function capListLimit(query: string, max: number = LIJST_LIMIT): string {
  if (/\bLIMIT\s+\d+/i.test(query)) {
    return query.replace(/\bLIMIT\s+\d+/i, `LIMIT ${max}`);
  }
  return `${query.trimEnd()}\nLIMIT ${max}`;
}

// Vangnet: live geconstateerd (28-08-2026) dat Claude bij een diep geneste
// UNION-groep (het functie/type-zoekpatroon) soms de laatste 1-2 sluithaken
// vergeet - de query eindigde na de laatste UNION-branch zonder de
// groeperende `{` en de WHERE-`{` te sluiten, wat de RCE-service terecht
// met 400 afwees. Telt simpelweg { vs } (geen SPARQL-parser, maar
// voldoende voor dit foutpatroon) en vult ontbrekende sluithaken aan vóór
// een eventuele LIMIT wordt toegevoegd - anders komt LIMIT binnen een
// onafgesloten blok te staan.
export function balanceBraces(query: string): string {
  const opens = (query.match(/\{/g) ?? []).length;
  const closes = (query.match(/\}/g) ?? []).length;
  if (opens <= closes) return query;
  return `${query.trimEnd()}\n${"}".repeat(opens - closes)}`;
}

export function postprocessSparql(rawQuery: string, mode: VraagMode): string {
  let query = extractSparql(rawQuery);
  query = injectPrefixes(query);
  query = fixGemeentePad(query);
  query = fixProvinciePad(query);
  query = normalizeProvincieUri(query);
  query = fixLabelFilter(query);
  query = balanceBraces(query);
  if (mode === "lijst") query = capListLimit(query);
  return query;
}

export type SparqlBinding = Record<string, { type: string; value: string }>;
export type SparqlResultsDocument = { head?: { vars?: string[] }; results?: { bindings?: SparqlBinding[] } };

// Voegt een leesbare ?provincie-kolom toe op basis van ?provURI, voor de
// GROUP-BY-op-URI-tellingen die telling.txt voorschrijft (groeperen op het
// label zelf zou spellingvarianten uit elkaar kunnen trekken).
export function translateProvincieUris(data: SparqlResultsDocument): SparqlResultsDocument {
  const bindings = data.results?.bindings ?? [];
  for (const row of bindings) {
    const uri = row.provURI?.value;
    if (!uri) continue;
    const naam = PROVINCIE_NAAM[uri] ?? uri.split("/").pop() ?? uri;
    row.provincie = { type: "literal", value: naam };
  }
  const vars = data.head?.vars;
  if (vars?.includes("provURI") && !vars.includes("provincie")) {
    vars.splice(vars.indexOf("provURI"), 0, "provincie");
  }
  return data;
}

// Dedupliceert op ?rm: meerdere kadastrale percelen of naam-instanties per
// monument geven anders dubbele rijen (poort van executor.py's _deduplicate).
export function dedupeByRm(data: SparqlResultsDocument): SparqlResultsDocument {
  const vars = data.head?.vars ?? [];
  const bindings = data.results?.bindings;
  if (!vars.includes("rm") || !bindings) return data;

  const seen = new Set<string>();
  const deduped: SparqlBinding[] = [];
  for (const row of bindings) {
    const rmValue = row.rm?.value;
    if (!rmValue || !seen.has(rmValue)) {
      if (rmValue) seen.add(rmValue);
      deduped.push(row);
    }
  }
  if (data.results) data.results.bindings = deduped;
  return data;
}
