import type { Gebeurtenis, Groenaanleg, MonumentImage } from "./types.ts";
import { escapeSparqlString } from "./sparql.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const IMAGE_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/image-1";
const GROENAANLEG_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/groenaanleg";
const MSP_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/msp_indicatie";
// Zelfde ActorEnRol-subject-URI's als in INSTANCES_GRAPH, maar hier heeft
// heeftActor/heeftRol een echte concept-URI (namespace term/id/rn/<uuid>,
// zonder de "2") in plaats van de platte tekst-literal die INSTANCES_GRAPH
// voor diezelfde properties geeft - zie docs/vertical-slices/007-bouwgeschiedenis.md.
const ACTORENROL_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/actorenrol";
const RIJKSMONUMENT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864";
const GEBOUWD_MONUMENTAARD = "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21";

type SparqlBinding = Record<string, { value?: string }>;

// Each discovery source runs as its own SPARQL query. A single query that UNIONs
// all sources together (with a shared FILTER/ORDER BY) makes Virtuoso build
// and sort one enormous intermediate result across a 58M-triple graph, which
// reliably times out. Per-source queries are simple, fast (each source alone
// resolves in well under a second), and let us do the scoring/merge/pagination
// in JS instead of relying on the query planner to do it efficiently.
export function buildImageQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX edm: <http://www.europeana.eu/schemas/edm/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?rmnr
  (SAMPLE(STR(?depictionValue)) AS ?depiction)
  (SAMPLE(STR(?titleValue)) AS ?title)
  (SAMPLE(STR(?rightsValue)) AS ?rights)
  (SAMPLE(STR(?shownAtValue)) AS ?shownAt)
WHERE {
  GRAPH <${IMAGE_GRAPH}> {
    VALUES ?rmnr { ${values} }
    ?image ceo:rijksmonumentnummer ?rmnr .
    OPTIONAL { ?image foaf:depiction ?depictionValue . }
    OPTIONAL { ?image dc:title ?titleValue . }
    OPTIONAL { ?image dc:rights ?rightsValue . }
    OPTIONAL { ?image edm:isShownAt ?shownAtValue . }
  }
}
GROUP BY ?rmnr`;
}

export function parseImageResults(document: unknown): Map<string, MonumentImage> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonumentNumber = new Map<string, MonumentImage>();
  if (!Array.isArray(bindings)) return byMonumentNumber;
  for (const binding of bindings) {
    const monumentNumber = binding.rmnr?.value;
    const url = binding.depiction?.value;
    if (!monumentNumber || !url) continue;
    byMonumentNumber.set(monumentNumber, {
      url,
      title: binding.title?.value,
      license: binding.rights?.value,
      sourceUrl: binding.shownAt?.value,
    });
  }
  return byMonumentNumber;
}

// ceo:msp_indicatie is een "alleen-aanwezig-als-waar"-boolean (afwezigheid
// van de triple, niet een expliciete false, betekent "niet via MSP
// aangewezen") - zie docs/reference/rce-linked-data-graphs.md voor de
// uitgezochte betekenis (Monumenten Selectie Project, ±1997-2002).
export function buildMspIndicatieQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
  GRAPH <${MSP_GRAPH}> {
    VALUES ?rmnr { ${values} }
    ?rm ceo:rijksmonumentnummer ?rmnr ; ceo:msp_indicatie true .
  }
}`;
}

export function parseMspIndicatieResults(document: unknown): Set<string> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const monumentNumbers = new Set<string>();
  if (!Array.isArray(bindings)) return monumentNumbers;
  for (const binding of bindings) {
    const monumentNumber = binding.rmnr?.value;
    if (monumentNumber) monumentNumbers.add(monumentNumber);
  }
  return monumentNumbers;
}

// Groenaanleg (historische tuinen en parken) is een eigen graph bovenop
// gewone Rijksmonument-records - dezelfde CHO-URI, extra eigenschappen. Geen
// aparte geometrie tonen (heeftAanlegGeometrie) in deze eerste stap, alleen
// de classificatie als tekstuele verrijking.
export function buildGroenaanlegQuery(choUris: string[]) {
  const values = choUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?rm
  (SAMPLE(STR(?typeLabel)) AS ?type)
  (SAMPLE(STR(?categorieLabel)) AS ?categorie)
WHERE {
  GRAPH <${GROENAANLEG_GRAPH}> {
    VALUES ?rm { ${values} }
    OPTIONAL { ?rm ceo:heeftTypeAanleg/skos:prefLabel ?typeLabel . }
    OPTIONAL { ?rm ceo:heeftCategorieGroenaanleg/skos:prefLabel ?categorieLabel . }
  }
}
GROUP BY ?rm`;
}

export function parseGroenaanlegResults(document: unknown): Map<string, Groenaanleg> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, Groenaanleg>();
  if (!Array.isArray(bindings)) return byMonument;
  for (const binding of bindings) {
    const monumentUri = binding.rm?.value;
    const typeAanleg = binding.type?.value;
    const categorie = binding.categorie?.value;
    if (!monumentUri || (!typeAanleg && !categorie)) continue;
    byMonument.set(monumentUri, { typeAanleg, categorie });
  }
  return byMonument;
}

// Bouwgeschiedenis (taak: docs/vertical-slices/007-bouwgeschiedenis.md).
// De actorenrol-join staat bewust GENEST binnen dezelfde OPTIONAL die ?ar
// bindt: een aparte, niet-geneste OPTIONAL met een (soms) ongebonden ?ar
// laat de query-engine matchen tegen alle ~9.900 ActorEnRol-triples in de
// actorenrol-graph tegelijk - een kruisproduct-explosie die live is
// aangetoond (11+ miljoen tekens resultaat op één monument) voordat deze
// vorm empirisch is vastgesteld als de juiste.
export function buildGebeurtenissenQuery(choUris: string[]) {
  const values = choUris.map((uri) => `<${uri}>`).join(" ");
  return `PREFIX ceo: <${CEO}>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?rm ?g ?naamUri ?naamLabel ?beginDatum ?eindDatum ?ar ?actorNaam ?actorRol ?actorConceptUri WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    VALUES ?rm { ${values} }
    ?rm ceo:heeftGebeurtenis ?g .
    OPTIONAL { ?g ceo:heeftGebeurtenisNaam ?naamUri . ?naamUri skos:prefLabel ?naamLabel . }
    OPTIONAL { ?g ceo:heeftDatering/ceo:heeftBeginDatering/ceo:datum ?beginDatum . }
    OPTIONAL { ?g ceo:heeftDatering/ceo:heeftEindDatering/ceo:datum ?eindDatum . }
    OPTIONAL {
      ?g ceo:heeftActorEnRol ?ar .
      OPTIONAL { ?ar ceo:heeftActor ?actorNaam . }
      OPTIONAL { ?ar ceo:heeftRol ?actorRol . }
      OPTIONAL { GRAPH <${ACTORENROL_GRAPH}> { ?ar ceo:heeftActor ?actorConceptUri . } }
    }
  }
}`;
}

export function parseGebeurtenissenResults(document: unknown): Map<string, Gebeurtenis[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonument = new Map<string, Gebeurtenis[]>();
  if (!Array.isArray(bindings)) return byMonument;

  const byEvent = new Map<string, { rm: string; gebeurtenis: Gebeurtenis }>();
  for (const binding of bindings) {
    const rm = binding.rm?.value;
    const eventUri = binding.g?.value;
    const naam = binding.naamLabel?.value;
    if (!rm || !eventUri || !naam) continue;
    const existing = byEvent.get(eventUri);
    const gebeurtenis = existing?.gebeurtenis ?? {
      naam,
      naamConceptUri: binding.naamUri?.value,
      beginDatum: binding.beginDatum?.value,
      eindDatum: binding.eindDatum?.value,
      actoren: [],
    };
    if (!existing) byEvent.set(eventUri, { rm, gebeurtenis });
    const actorNaam = binding.actorNaam?.value;
    if (actorNaam && !gebeurtenis.actoren.some((actor) => actor.naam === actorNaam)) {
      gebeurtenis.actoren.push({ naam: actorNaam, rol: binding.actorRol?.value, actorConceptUri: binding.actorConceptUri?.value });
    }
  }

  for (const { rm, gebeurtenis } of byEvent.values()) {
    const forMonument = byMonument.get(rm) ?? [];
    forMonument.push(gebeurtenis);
    byMonument.set(rm, forMonument);
  }
  const MAX_PER_MONUMENT = 10;
  for (const [rm, events] of byMonument) {
    events.sort((a, b) => (a.beginDatum ?? "9999").localeCompare(b.beginDatum ?? "9999"));
    byMonument.set(rm, events.slice(0, MAX_PER_MONUMENT));
  }
  return byMonument;
}

// "Op deze dag"-widget (docs/vertical-slices/010-op-deze-dag.md). Live
// geverifieerd: heeftBeginDatering/heeftEindDatering (Gebeurtenis) is
// ONGESCHIKT voor dit doel (dag/maand staat vrijwel altijd vast op "01-01",
// een jaarnauwkeurige precisie-conventie, geen echte datum).
// datumInschrijvingInMonumentenregister (al gebruikt als registrationDate)
// heeft wél een echte, gespreide dag-verdeling. Alleen gebouwde
// Rijksmonumenten met minstens één gekoppelde beeldbankafbeelding komen in
// aanmerking. DISTINCT voorkomt dubbele kandidaten bij meerdere afbeeldingen.
export function buildOpDezeDagQuery(maandDag: string) {
  return `PREFIX ceo: <${CEO}>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
        ceo:heeftMonumentAard <${GEBOUWD_MONUMENTAARD}> ;
        ceo:rijksmonumentnummer ?rmnr ;
        ceo:datumInschrijvingInMonumentenregister ?ins .
    FILTER(SUBSTR(STR(?ins), 6, 5) = "${escapeSparqlString(maandDag)}")
  }
  GRAPH <${IMAGE_GRAPH}> {
    ?image ceo:rijksmonumentnummer ?rmnr ; foaf:depiction ?depiction .
  }
}`;
}

export type OpDezeDagCandidate = { monumentNumber: string };

export function parseOpDezeDagCandidates(document: unknown): OpDezeDagCandidate[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => binding.rmnr?.value ? [{ monumentNumber: binding.rmnr.value }] : []);
}

// De query levert uitsluitend gebouwde Rijksmonumenten met afbeelding.
// Sorteren en dedupliceren maakt de dagelijkse keuze onafhankelijk van de
// bindingvolgorde van de SPARQL-dienst.
export function pickOpDezeDagCandidate(candidates: OpDezeDagCandidate[], dayOfYear: number): string | undefined {
  if (!candidates.length) return undefined;
  const pool = [...new Set(candidates.map((candidate) => candidate.monumentNumber))]
    .sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
  return pool[dayOfYear % pool.length];
}

// "Verras me" (docs/vertical-slices/014-verras-me.md): hergebruikt dezelfde
// kandidatenquery als "Op deze dag", maar met een willekeurige maand-dag in
// plaats van de huidige kalenderdag, en een willekeurige in plaats van
// deterministische keuze uit de kandidatenpool - elke aanroep moet een ander
// monument kunnen opleveren, niet hetzelfde per dag.
export function pickRandomCandidate(candidates: OpDezeDagCandidate[]): string | undefined {
  if (!candidates.length) return undefined;
  const pool = [...new Set(candidates.map((candidate) => candidate.monumentNumber))];
  return pool[Math.floor(Math.random() * pool.length)];
}
