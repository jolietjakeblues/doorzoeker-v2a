// Orkestratie voor de "Stel een vraag"-assistent (/vraag): vraag -> SPARQL
// -> resultaten -> Nederlands antwoord. Zie lib/vraag/prompts.ts voor de
// herkomst van de kennisbank (ldv-talk-to-your-data-test).
import { callClaude } from "../vraag/anthropic-client.ts";
import { DATAMODEL_RULES, LIJST_PROMPT, TELLING_PROMPT } from "../vraag/prompts.ts";
import { dedupeByRm, hasCount, postprocessSparql, translateProvincieUris, type SparqlResultsDocument, type VraagMode } from "../vraag/postprocess.ts";
import { fetchSparql, RCE_CHO_ENDPOINT } from "./sparql-client.ts";

// 1000 tokens bleek live (28-08-2026) soms krap voor het geneste
// UNION-functiezoekpatroon - ruimere marge om afkapping te voorkomen.
const SPARQL_MAX_TOKENS = 1500;
const ANTWOORD_MAX_TOKENS = 600;
// Live geconstateerd (28-08-2026): een simpele gemeentequery (CONTAINS/LCASE
// op het gemeentelabel, zonder URI-voorfilter - vergelijkbaar met de
// bekende RCE-karakteristiek dat vrije-tekst-scans duur zijn) duurde al
// 29,6s, tegen de toenmalige 30s-limiet aan. Ruimere marge, zelfde
// redenering als archeologischeContext's verlengde timeout.
const EXECUTE_TIMEOUT_MS = 45_000;

async function generateOnce(question: string, mode: VraagMode, signal?: AbortSignal): Promise<string> {
  const system = `${DATAMODEL_RULES}\n\n${mode === "lijst" ? LIJST_PROMPT : TELLING_PROMPT}`;
  const raw = await callClaude(question, { system, maxTokens: SPARQL_MAX_TOKENS, signal });
  return postprocessSparql(raw, mode);
}

export async function generateSparqlQuery(question: string, mode: VraagMode, signal?: AbortSignal): Promise<string> {
  const query = await generateOnce(question, mode, signal);
  // Zelfde correctie-aanroep als sparql_generator.py: als een lijstvraag toch
  // een COUNT opleverde, één keer opnieuw genereren met een aangescherpte
  // vraag, in plaats van de foute query te tonen.
  if (mode === "lijst" && hasCount(query)) {
    return generateOnce(`${question} (geef een lijst van individuele monumenten, geen telling)`, mode, signal);
  }
  return query;
}

export async function executeVraagQuery(query: string, signal?: AbortSignal): Promise<SparqlResultsDocument> {
  const data = (await fetchSparql(query, signal, RCE_CHO_ENDPOINT, EXECUTE_TIMEOUT_MS, "POST")) as SparqlResultsDocument;
  return dedupeByRm(translateProvincieUris(data));
}

export async function generateAntwoord(question: string, results: SparqlResultsDocument, signal?: AbortSignal): Promise<string> {
  const bindings = results.results?.bindings ?? [];
  const vars = results.head?.vars ?? [];
  const total = bindings.length;
  const sample = bindings.slice(0, 15);

  // Bewust een andere, minder mechanische prompt dan het origineel: live
  // getest (28-08-2026) leest het Python-antwoord als een opsomming ("De
  // query gaf 4 rijen terug. Voorbeelden zijn: ...") in plaats van een
  // vloeiend antwoord. Vraagt hier expliciet om lopende tekst en om
  // concrete namen/details uit de data, zonder technische termen.
  const prompt = `Vraag: "${question}"

SPARQL-resultaten (${total} rijen totaal, eerste 15 hieronder als JSON):
Kolommen: ${vars.join(", ")}
${JSON.stringify(sample, null, 1)}

Beantwoord de vraag in vloeiend, natuurlijk Nederlands, alsof je het aan een
geïnteresseerde bezoeker vertelt. Gebruik concrete namen en details uit de
data om het antwoord levendig te maken, maar verzin niets dat niet in de
data staat. Ging de vraag om een telling? Noem dan het totaal (${total})
duidelijk. Geen technische termen, geen URI's, geen opsomming van kolomnamen.
Maximaal 4 zinnen.`;

  return callClaude(prompt, { maxTokens: ANTWOORD_MAX_TOKENS, signal });
}
