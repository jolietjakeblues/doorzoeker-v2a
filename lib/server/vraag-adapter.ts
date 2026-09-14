// Orkestratie voor de "Stel een vraag"-assistent (/vraag): vraag -> SPARQL
// -> resultaten -> Nederlands antwoord. Zie lib/vraag/prompts.ts voor de
// herkomst van de kennisbank (ldv-talk-to-your-data-test) en
// lib/vraag/semantic-resolver.ts/answerability.ts voor de deterministische
// resolutie-/beantwoordbaarheidslaag die daar sinds 14-09-2026 vóór draait
// (poort van chat2thedata, de doorontwikkelde opvolger daarvan).
import { AnthropicTruncatedError, callClaude, type McpServerConfig } from "../vraag/anthropic-client.ts";
import { DATAMODEL_RULES, LIJST_PROMPT, TELLING_PROMPT } from "../vraag/prompts.ts";
import { dedupeByRm, hasCount, LIJST_LIMIT, postprocessSparql, translateProvincieUris, type SparqlResultsDocument, type VraagMode } from "../vraag/postprocess.ts";
import { describePropertyChoice, validateQuery } from "../vraag/semantic-validator.ts";
import { SparqlSyntaxInvalidError, validateSyntax } from "../vraag/syntax-validator.ts";
import { applySpatialFilterLocally, extractSpatialFilter, isFallbackCandidateSetIncomplete, isSpatialFailure, SpatialFallbackIncompleteError, stripSpatialFilter, widenLimitForFallback } from "../vraag/spatial-fallback.ts";
import { detectLimitation, describeLimitation, type AnswerabilityLimitationClarification } from "../vraag/answerability.ts";
import { buildSemanticContext, describeAmbiguity, resolveQuestion, type EntityAmbiguityClarification, type ResolutionResult } from "../vraag/semantic-resolver.ts";
import { fetchSparql, RCE_CHO_ENDPOINT } from "./sparql-client.ts";

export type SparqlClarification = EntityAmbiguityClarification | AnswerabilityLimitationClarification;
export type GenerateSparqlOptions = { disambiguation?: Record<string, string>; limitationChoice?: string };
export type GenerateSparqlResult = { status: "ok"; query: string; caveats: string[] } | { status: "clarification"; clarification: SparqlClarification };

// De eigenaars eigen, zelfgebouwde MCP-server (github.com/jolietjakeblues/
// rce-cho-mcp, gehost op Render) - geeft Claude tijdens het genereren
// toegang tot echte concept-/URI-resolutie (resolve_concept_label,
// ontology_search, validate_query_structured) in plaats van alleen de
// statische kennisbank hierboven. Live geverifieerd (28-08-2026): lost het
// "Utrechtse Heuvelrug"-probleem bij de bron op (directe URI-match i.p.v.
// CONTAINS-op-label). Overschrijfbaar via env voor als de eigenaar de
// server verplaatst; callClaude valt automatisch terug op alleen de
// statische kennisbank als deze server niet bereikbaar is.
const RCE_CHO_MCP_SERVERS: McpServerConfig[] = [
  { url: process.env.RCE_CHO_MCP_URL || "https://rce-cho-mcp.onrender.com/mcp", name: "rce-cho" },
];

// 1000, toen 1500 tokens bleken live (28-08-2026) soms krap voor het diep
// geneste GRAPH+UNION-functiezoekpatroon - een afgekapte respons levert een
// syntactisch onvolledige query op (zie AnthropicTruncatedError), niet iets
// wat balanceBraces kan repareren. SPARQL_MAX_TOKENS_RETRY is de marge voor
// de zeldzame keer dat zelfs 2000 niet genoeg is.
const SPARQL_MAX_TOKENS = 2000;
const SPARQL_MAX_TOKENS_RETRY = 3500;
const ANTWOORD_MAX_TOKENS = 600;
// Live geconstateerd (28-08-2026): een simpele gemeentequery (CONTAINS/LCASE
// op het gemeentelabel, zonder URI-voorfilter - vergelijkbaar met de
// bekende RCE-karakteristiek dat vrije-tekst-scans duur zijn) duurde al
// 29,6s, tegen de toenmalige 30s-limiet aan. Ruimere marge, zelfde
// redenering als archeologischeContext's verlengde timeout.
const EXECUTE_TIMEOUT_MS = 45_000;

async function generateOnce(question: string, mode: VraagMode, maxTokens: number, signal?: AbortSignal): Promise<string> {
  const system = `${DATAMODEL_RULES}\n\n${mode === "lijst" ? LIJST_PROMPT : TELLING_PROMPT}`;
  const raw = await callClaude(question, { system, maxTokens, signal, mcpServers: RCE_CHO_MCP_SERVERS });
  return postprocessSparql(raw, mode);
}

export async function generateSparqlQuery(question: string, mode: VraagMode, signal?: AbortSignal, options?: GenerateSparqlOptions): Promise<GenerateSparqlResult> {
  // Deterministische resolutielaag, vóór elke Anthropic-aanroep (poort van
  // chat2thedata's sparql_generator.generate()). Een netwerkfout hier is
  // geen harde storing van /vraag - de vraag gaat gewoon door zonder
  // semantische context, zelfde degradatiepatroon als de MCP-terugval in
  // anthropic-client.ts.
  let resolution: ResolutionResult;
  try {
    resolution = await resolveQuestion(question, options?.disambiguation, signal);
  } catch (error) {
    console.warn(JSON.stringify({ event: "vraag.semantische-resolutie.mislukt", message: error instanceof Error ? error.message : "onbekend" }));
    resolution = { resolved: [], ambiguous: [] };
  }
  if (resolution.ambiguous.length > 0) {
    return { status: "clarification", clarification: describeAmbiguity(resolution.ambiguous) };
  }

  // Beantwoordbaarheidscheck: sommige vragen hebben geen eenduidige SPARQL-
  // vertaling omdat de brondata de relatie inconsistent modelleert (zie
  // lib/vraag/answerability.ts). Zonder gekozen deelinterpretatie: meteen
  // een verduidelijkingsvraag teruggeven, geen Anthropic-aanroep.
  let limitationCaveat: string | undefined;
  let chosenHint: string | undefined;
  const limitation = detectLimitation(question);
  if (limitation) {
    if (!options?.limitationChoice) {
      return { status: "clarification", clarification: describeLimitation(limitation) };
    }
    const chosen = limitation.partialOptions.find((option) => option.id === options.limitationChoice);
    if (chosen) {
      limitationCaveat = chosen.caveat;
      chosenHint = chosen.promptHint;
    }
  }

  const semanticContext = buildSemanticContext(resolution.resolved);
  let promptInput = semanticContext ? `${question}\n\n${semanticContext}` : question;
  if (chosenHint) promptInput = `${promptInput}\n\n${chosenHint}`;

  const toResult = (finalQuery: string): GenerateSparqlResult => {
    const propertyChoiceCaveat = describePropertyChoice(question, finalQuery);
    const caveats = [limitationCaveat, propertyChoiceCaveat].filter((caveat): caveat is string => Boolean(caveat));
    return { status: "ok", query: finalQuery, caveats };
  };

  let query: string;
  try {
    query = await generateOnce(promptInput, mode, SPARQL_MAX_TOKENS, signal);
  } catch (error) {
    // Eén herkansing met meer budget bij afkapping - de afgekapte tekst
    // wordt nooit doorgezet naar RCE, want die zou toch als 400 terugkomen.
    if (!(error instanceof AnthropicTruncatedError)) throw error;
    query = await generateOnce(promptInput, mode, SPARQL_MAX_TOKENS_RETRY, signal);
  }
  // Zelfde correctie-aanroep als sparql_generator.py: als een lijstvraag toch
  // een COUNT opleverde, één keer opnieuw genereren met een aangescherpte
  // vraag, in plaats van de foute query te tonen. Zelfde (bestaande) gedrag
  // als vóór deze wijziging: geen aparte volledigheids-/syntaxcheck op dit
  // pad.
  if (mode === "lijst" && hasCount(query)) {
    return toResult(await generateOnce(`${promptInput} (geef een lijst van individuele monumenten, geen telling)`, mode, SPARQL_MAX_TOKENS, signal));
  }
  // Gratis, deterministische volledigheidscheck (poort van
  // semantic_validator.py): vangt het geval waarin Claude een onderdeel van
  // een meerledige vraag stilzwijgend laat vallen. Bij fouten: precies één
  // corrigerende hergeneratie met de gevonden fouten erbij (op basis van
  // promptInput, niet de kale question, zodat de opgeloste semantische
  // context niet wegvalt - zelfde als sparql_generator.py's prompt_input),
  // zelfde patroon als de COUNT-correctie hierboven en de bron zijn eigen
  // "CORRIGEER DE VORIGE QUERY"-aanroep.
  const errors = [...validateQuery(question, query), ...validateSyntax(query)];
  if (errors.length > 0) {
    const correctie = `${promptInput}\n\nCORRIGEER DE VORIGE QUERY, DEZE MISTE ONDERDELEN UIT DE VRAAG:\n- ${errors.join("\n- ")}`;
    query = await generateOnce(correctie, mode, SPARQL_MAX_TOKENS, signal);
    // Gratis en deterministisch (geen extra Anthropic-aanroep) - voorkomt
    // dat een na de correctiepoging nog steeds kapotte query alsnog naar
    // het RCE-endpoint gaat, waar hij toch als 400 terug zou komen.
    const remainingSyntaxErrors = validateSyntax(query);
    if (remainingSyntaxErrors.length > 0) throw new SparqlSyntaxInvalidError(remainingSyntaxErrors[0]);
  }
  return toResult(query);
}

// Live geconstateerd (28-08-2026, "kerken in de 19e-eeuwse Schil
// Dordrecht"): geof:sfWithin/sfIntersects kan op RCE's Virtuoso-endpoint
// vastlopen op een TopologyException in de brongeometrie zelf (bevestigd
// via de rce-cho MCP, ook zonder functiefilter) - geen queryfout, dus geen
// betere prompt lost dit op. Poort van de eigenaars eigen
// ldv-talk-2-your-data (sparql/spatial.py/executor.py): bij zo'n fout (of
// een timeout) wordt de query herhaald zonder de ruimtelijke FILTER en
// lokaal opnieuw berekend (lib/vraag/spatial-fallback.ts).
export async function executeVraagQuery(query: string, signal?: AbortSignal): Promise<SparqlResultsDocument> {
  const spatialFilter = extractSpatialFilter(query);
  try {
    const data = (await fetchSparql(query, signal, RCE_CHO_ENDPOINT, EXECUTE_TIMEOUT_MS, "POST")) as SparqlResultsDocument;
    return dedupeByRm(translateProvincieUris(data));
  } catch (error) {
    if (!spatialFilter || !isSpatialFailure(error)) throw error;
    console.info(JSON.stringify({ event: "vraag.ruimtelijke-terugval", relation: spatialFilter.relation, message: error instanceof Error ? error.message : "onbekend" }));

    const simplifiedQuery = widenLimitForFallback(stripSpatialFilter(query));
    const rawData = (await fetchSparql(simplifiedQuery, signal, RCE_CHO_ENDPOINT, EXECUTE_TIMEOUT_MS, "POST")) as SparqlResultsDocument;
    const rawCount = rawData.results?.bindings?.length ?? 0;
    if (isFallbackCandidateSetIncomplete(rawCount)) {
      // De vereenvoudigde query had geen eigen scoping meer (bv. geen
      // gemeente- of functiefilter naast de ruimtelijke relatie) en raakte
      // het verruimde plafond - er kunnen dus kandidaten buiten de
      // opgehaalde set gemist zijn. Een "0 resultaten" (of elk ander
      // aantal) zou hier vals-negatief kunnen zijn, dus liever een
      // eerlijke foutmelding dan een mogelijk onvolledig antwoord.
      throw new SpatialFallbackIncompleteError(
        "De ruimtelijke vergelijking had geen eigen afbakening (zoals een gemeente of functie) naast het gebied zelf, en de kandidatenset werd te groot om volledig te doorzoeken. Probeer de vraag specifieker te maken, bijvoorbeeld met één gemeente of functie erbij.",
      );
    }
    const { data, skipped } = applySpatialFilterLocally(rawData, spatialFilter);
    if (skipped) console.info(JSON.stringify({ event: "vraag.ruimtelijke-terugval.overgeslagen", skipped }));
    // De vereenvoudigde query had een verruimde LIMIT (widenLimitForFallback)
    // om na de lokale filtering nog genoeg relevante rijen over te houden -
    // knip het eindresultaat terug naar het normale plafond.
    if (data.results?.bindings) data.results.bindings = data.results.bindings.slice(0, LIJST_LIMIT);
    return dedupeByRm(translateProvincieUris(data));
  }
}

export async function generateAntwoord(question: string, results: SparqlResultsDocument, caveats: string[] = [], signal?: AbortSignal): Promise<string> {
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

  const answer = await callClaude(prompt, { maxTokens: ANTWOORD_MAX_TOKENS, signal });
  // Kanttekeningen (bv. een gekozen deelinterpretatie uit
  // lib/vraag/answerability.ts, of een toelichting op een vaag
  // "soort/aard/type"-property-pad) NA de Claude-aanroep toevoegen, niet in
  // de prompt gevouwen - garandeert dat de gecureerde tekst letterlijk blijft
  // staan i.p.v. geparafraseerd of weggelaten te worden. Poort van
  // chat2thedata's answer_generator.generate()'s caveats-parameter.
  return caveats.reduce((text, caveat) => `${text}\n\nLet op: ${caveat}`, answer);
}
