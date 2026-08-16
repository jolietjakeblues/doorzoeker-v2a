const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const ACTORENROL_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/actorenrol";
const RIJKSMONUMENT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864";

type SparqlBinding = Record<string, { value?: string } | undefined>;

export function buildMonumentAardConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftMonumentAard <${conceptUri}> ;
         ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
  }
}
LIMIT 100`;
}

export function buildStijlConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
         ceo:heeftStijlEnCultuur ?stijlNode .
    ?stijlNode ceo:formeelStandpunt true ; ceo:heeftStijlEnCultuurNaam <${conceptUri}> .
  }
}
LIMIT 100`;
}

export function buildBouwkundigeStaatConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
         ceo:heeftBouwkundigeKwaliteit ?kwaliteitNode .
    ?kwaliteitNode ceo:formeelStandpunt true ; ceo:heeftBouwkundigeStaat <${conceptUri}> .
  }
}
LIMIT 100`;
}

export function buildMonumentTypeConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
         ceo:heeftType/ceo:heeftTypeNaam <${conceptUri}> .
  }
}
LIMIT 100`;
}

export function buildVerwervingConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?locatie a ceo:Vondstlocatie ; ceo:cultuurhistorischObjectnummer ?rmnr ; ceo:heeftVerwerving <${conceptUri}> .
  }
}
LIMIT 100`;
}

// Matcht op het eigen CHO-nummer van het terrein, niet op een gekoppeld
// rijksmonumentnummer: van de ~13.000 terreinen met een waardering heeft
// slechts ~14% een ceo:ligtInObject-relatie naar een Rijksmonument. De
// oudere versie van deze query (via ligtInObject) liet de overige ~86%
// stilzwijgend 0 resultaten opleveren bij een klik op hun eigen
// waardering-label - zie searchByVerwervingConcept voor hetzelfde patroon.
// SELECT-variabele heet net als daar bewust ?rmnr, niet omdat het een
// rijksmonumentnummer is (het is het CHO-nummer van het terrein), maar
// omdat parseConceptSearchMatches() die bindingnaam verwacht.
export function buildArcheologischeWaarderingConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?terrein a ceo:ArcheologischTerrein ; ceo:cultuurhistorischObjectnummer ?rmnr ;
             ceo:heeftArcheologischeWaardering <${conceptUri}> .
  }
}
LIMIT 100`;
}

// Matcht op het eigen CHO-nummer van het grondspoor - zelfde
// heeftType/heeftTypeNaam-pad dat al wordt gebruikt om het type te tonen
// (buildGrondsporenDetailsQuery in lib/rce/archaeology.ts). SELECT-
// variabele heet ?rmnr om dezelfde reden als hierboven.
export function buildGrondspoorTypeConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?grondspoor a ceo:Grondsporen ; ceo:cultuurhistorischObjectnummer ?rmnr ;
                ceo:heeftType/ceo:heeftTypeNaam <${conceptUri}> .
  }
}
LIMIT 100`;
}

export function parseConceptSearchMatches(document: unknown): string[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.flatMap((binding) => binding.rmnr?.value ? [binding.rmnr.value] : []);
}

export function buildGebeurtenisConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
        ceo:heeftGebeurtenis ?g .
    ?g ceo:heeftGebeurtenisNaam <${conceptUri}> .
  }
}
LIMIT 100`;
}

export function buildActorConceptQuery(actorConceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT ?rmnr WHERE {
  GRAPH <${ACTORENROL_GRAPH}> {
    ?ar ceo:heeftActor <${actorConceptUri}> .
  }
  GRAPH <${INSTANCES_GRAPH}> {
    ?rm a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
        ceo:heeftGebeurtenis/ceo:heeftActorEnRol ?ar .
  }
}
LIMIT 100`;
}

export function buildFunctieConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ;
         ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> .
    { ?cho ceo:heeftOorspronkelijkeFunctie/ceo:heeftFunctieNaam <${conceptUri}> . }
    UNION
    { ?cho ceo:heeftHuidigeFunctie/ceo:heeftFunctieNaam <${conceptUri}> . }
  }
}
LIMIT 100`;
}

export type VondstenConceptField = "vondsttype" | "materiaal" | "toestand";

export function buildVondstenConceptQuery(conceptUri: string, field: VondstenConceptField) {
  const propertyPath = field === "vondsttype" ? "ceo:heeftType/ceo:heeftTypeNaam" : field === "materiaal" ? "ceo:heeftMateriaal/ceo:heeftMateriaalNaam" : "ceo:heeftToestand";
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?vondst a ceo:Vondsten ; ceo:cultuurhistorischObjectnummer ?choi ; ${propertyPath} <${conceptUri}> .
  BIND(?choi AS ?rmnr)
 }
}
LIMIT 100`;
}

export function buildArcheologischeComplexConceptQuery(conceptUri: string) {
  return `PREFIX ceo: <${CEO}>
SELECT DISTINCT ?rmnr WHERE {
 GRAPH <${INSTANCES_GRAPH}> {
  ?complex a ceo:ArcheologischComplex ; ceo:cultuurhistorischObjectnummer ?choi ; ceo:heeftType/ceo:heeftTypeNaam <${conceptUri}> .
  BIND(?choi AS ?rmnr)
 }
}
LIMIT 100`;
}
