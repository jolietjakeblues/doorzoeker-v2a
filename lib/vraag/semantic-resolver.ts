// Poort van chat2thedata's sparql/semantic_resolver.py: resolveert
// gemeente/provincie/woonplaats-labels uit de vraag naar gezaghebbende
// OWMS-URI's (of, voor woonplaats, de exacte bevestigde schrijfwijze) via
// live SPARQL tegen het RCE CHO-endpoint - vóór de Claude-aanroep, zodat een
// naam die zowel gemeente als provincie kan zijn (bv. "Utrecht", "Groningen")
// een expliciete verduidelijkingsvraag oplevert in plaats van een stille
// gok. Zie lib/server/vraag-adapter.ts voor de orkestratie.
import { capMapSize, pruneExpiredEntries } from "../server/expiring-map.ts";
import { fetchSparql, RCE_CHO_ENDPOINT } from "../server/sparql-client.ts";

export type ResolvedTermKind = "gemeente" | "provincie" | "plaats";
export type ResolvedTerm = { kind: ResolvedTermKind; label: string; uri: string };
export type AmbiguousTerm = { label: string; candidates: ResolvedTerm[] };
export type ResolutionResult = { resolved: ResolvedTerm[]; ambiguous: AmbiguousTerm[] };

export type EntityAmbiguityClarification = {
  type: "entity_ambiguity";
  message: string;
  options: { id: string; label: string; termLabel: string }[];
};

const OWMS_GEMEENTE_CLASS = "http://standaarden.overheid.nl/owms/terms/Gemeente";
const OWMS_PROVINCIE_CLASS = "http://standaarden.overheid.nl/owms/terms/Provincie";

type TermPair = [label: string, uri: string];
type SparqlBindingRow = Record<string, { value: string } | undefined>;

// Gemeente-/provincie-/woonplaatslijsten veranderen nauwelijks (611 gemeenten,
// 5.431 woonplaatsen op 14-09-2026, live geteld tegen het RCE CHO-endpoint) -
// een lange TTL is hier bewust, niet een omissie. Zelfde Map+TTL-patroon als
// app/api/terms/suggest/route.ts (via lib/server/expiring-map.ts), hier
// module-scope omdat deze module door meerdere routes gebruikt kan worden,
// niet gebonden aan één request-handler.
const TERM_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const termCache = new Map<string, { expiresAt: number; terms: TermPair[] }>();
const inFlight = new Map<string, Promise<TermPair[]>>();

// Alleen voor tests: leegt de module-scope cache zodat opeenvolgende tests
// niet toevallig elkaars gemockte SPARQL-respons hergebruiken.
export function __resetResolverCacheForTests(): void {
  termCache.clear();
  inFlight.clear();
}

async function loadCached(key: string, loader: () => Promise<TermPair[]>): Promise<TermPair[]> {
  const now = Date.now();
  pruneExpiredEntries(termCache, now);
  const cached = termCache.get(key);
  if (cached) return cached.terms;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = loader()
    .then((terms) => {
      capMapSize(termCache, 8);
      termCache.set(key, { terms, expiresAt: now + TERM_CACHE_TTL_MS });
      return terms;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

async function loadOwmsTerms(classUri: string, signal?: AbortSignal): Promise<TermPair[]> {
  return loadCached(classUri, async () => {
    const query = `PREFIX graph: <https://linkeddata.cultureelerfgoed.nl/graph/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?uri ?label
WHERE {
  GRAPH graph:owms {
    ?uri a <${classUri}> ;
         skos:prefLabel ?label .
  }
}`;
    const document = (await fetchSparql(query, signal, RCE_CHO_ENDPOINT)) as { results?: { bindings?: SparqlBindingRow[] } };
    const bindings = document.results?.bindings ?? [];
    return bindings
      .filter((row) => row.label?.value && row.uri?.value)
      .map((row): TermPair => [row.label!.value, row.uri!.value]);
  });
}

async function loadWoonplaatsTerms(signal?: AbortSignal): Promise<TermPair[]> {
  // Anders dan gemeente/provincie heeft een woonplaatsnaam geen eigen
  // resolvebare SKOS-concept-URI in OWMS - het is een kale string-property.
  // Geeft daarom (naam, naam)-paren terug zodat findLongest() ongewijzigd
  // herbruikbaar is; het "uri"-veld draagt hier de exacte, bevestigde
  // canonieke schrijfwijze, geen resolvebare URI.
  return loadCached("woonplaats", async () => {
    const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX graph: <https://linkeddata.cultureelerfgoed.nl/graph/>
SELECT DISTINCT ?naam WHERE {
  GRAPH graph:instanties-rce {
    ?bag ceo:woonplaatsnaam ?naam .
  }
}`;
    const document = (await fetchSparql(query, signal, RCE_CHO_ENDPOINT)) as { results?: { bindings?: SparqlBindingRow[] } };
    const bindings = document.results?.bindings ?? [];
    return bindings.filter((row) => row.naam?.value).map((row): TermPair => [row.naam!.value, row.naam!.value]);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalise(value: string): string {
  const stripped = value.normalize("NFKD").replace(/\p{M}/gu, "");
  const collapsedPunctuation = stripped.toLowerCase().replace(/[^\w-]+/g, " ");
  return collapsedPunctuation.replace(/\s+/g, " ").trim();
}

function findLongest(question: string, terms: TermPair[]): TermPair | undefined {
  const normalisedQuestion = normalise(question);
  let best: TermPair | undefined;
  let bestLength = -1;
  for (const term of terms) {
    const normalisedLabel = normalise(term[0]);
    const pattern = new RegExp(`(?<!\\w)${escapeRegExp(normalisedLabel)}(?!\\w)`);
    if (!pattern.test(normalisedQuestion)) continue;
    if (normalisedLabel.length > bestLength) {
      best = term;
      bestLength = normalisedLabel.length;
    }
  }
  return best;
}

// Resolveer een plaatslabel naar een gemeentelijke, provinciale of
// woonplaats-waarde.
//
// Bij een expliciet "gemeente"/"provincie"/"woonplaats" in de vraag is er
// niets dubbelzinnigs en wordt die keuze direct gebruikt (bewust NIET kaal
// "plaats": dat komt als substring voor in gangbare woorden - vindplaats,
// standplaats, geboorteplaats - en zou op de genormaliseerde vraagtekst ten
// onrechte matchen). Matcht een naam zonder zo'n keyword op zowel de
// gemeente- als de provincievocabulaire (bv. "Utrecht", "Groningen"), dan is
// dat een echte tie die de resultatenset verandert: die wordt teruggegeven
// als `ambiguous` in plaats van stilzwijgend opgelost, tenzij
// `disambiguation` al een keuze voor dat label bevat (genormaliseerd label
// -> "gemeente"/"provincie"/"plaats").
export async function resolveQuestion(question: string, disambiguation?: Record<string, string>, signal?: AbortSignal): Promise<ResolutionResult> {
  const q = normalise(question);

  const [gemeenteTerms, provincieTerms, woonplaatsTerms] = await Promise.all([
    loadOwmsTerms(OWMS_GEMEENTE_CLASS, signal),
    loadOwmsTerms(OWMS_PROVINCIE_CLASS, signal),
    loadWoonplaatsTerms(signal),
  ]);

  const matches: Record<ResolvedTermKind, TermPair | undefined> = {
    gemeente: findLongest(question, gemeenteTerms),
    provincie: findLongest(question, provincieTerms),
    plaats: findLongest(question, woonplaatsTerms),
  };

  let kind: ResolvedTermKind;
  if (q.includes("provincie")) {
    kind = "provincie";
  } else if (q.includes("gemeente")) {
    kind = "gemeente";
  } else if (q.includes("woonplaats")) {
    kind = "plaats";
  } else {
    const available = (Object.entries(matches) as [ResolvedTermKind, TermPair | undefined][]).filter((entry): entry is [ResolvedTermKind, TermPair] => Boolean(entry[1]));
    if (available.length === 0) return { resolved: [], ambiguous: [] };

    if (available.length > 1) {
      const label = available[0][1][0];
      const normalisedDisambiguation = new Map(Object.entries(disambiguation ?? {}).map(([key, value]) => [normalise(key), value]));
      const override = normalisedDisambiguation.get(normalise(label));
      const availableByKind = new Map(available);
      if (override && availableByKind.has(override as ResolvedTermKind)) {
        const chosenKind = override as ResolvedTermKind;
        const match = availableByKind.get(chosenKind)!;
        return { resolved: [{ kind: chosenKind, label: match[0], uri: match[1] }], ambiguous: [] };
      }

      const candidates = available.map(([candidateKind, match]) => ({ kind: candidateKind, label: match[0], uri: match[1] }));
      return { resolved: [], ambiguous: [{ label, candidates }] };
    }

    kind = available[0][0];
  }

  const match = matches[kind];
  if (!match) return { resolved: [], ambiguous: [] };
  return { resolved: [{ kind, label: match[0], uri: match[1] }], ambiguous: [] };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Zet de eerste onopgeloste ambiguïteit om in een JSON-serialiseerbare vraag.
export function describeAmbiguity(ambiguous: AmbiguousTerm[]): EntityAmbiguityClarification {
  const term = ambiguous[0];
  return {
    type: "entity_ambiguity",
    message: `"${term.label}" kan meerdere dingen zijn. Deze geven mogelijk verschillende resultaten.`,
    options: term.candidates.map((candidate) => ({
      id: candidate.kind,
      label: `${capitalize(candidate.kind)} ${candidate.label}`,
      termLabel: term.label,
    })),
  };
}

export function buildSemanticContext(terms: ResolvedTerm[]): string {
  if (terms.length === 0) return "";
  const lines = ["OPGELOSTE BEGRIPPEN. DEZE URI'S/WAARDEN ZIJN VERPLICHT:"];
  for (const term of terms) {
    if (term.kind === "plaats") {
      lines.push(
        `- plaats (woonplaats) "${term.label}"; gebruik via ceo:heeftBasisregistratieRelatie -> ceo:heeftBAGRelatie -> ceo:woonplaatsnaam, EXACTE match "${term.label}" (geen CONTAINS/LCASE).`,
      );
      continue;
    }
    const propertyName = term.kind === "gemeente" ? "ceo:heeftGemeente" : "ceo:heeftProvincie";
    lines.push(`- ${term.kind} "${term.label}" = <${term.uri}>; gebruik via ceo:heeftBasisregistratieRelatie en ${propertyName}.`);
  }
  lines.push("Gebruik geen labeltekst, BRK/gemeentenaam of vrije CONTAINS-matching op woonplaatsnaam als vervanging voor de hierboven opgegeven URI's/exacte waarden.");
  return lines.join("\n");
}
