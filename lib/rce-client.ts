import type { ArcheologischeContext, ComplexMember, GezichtLidmaatschap, OnderzoeksgebiedAggregaten, OnderzoeksgebiedComplex, OnderzoeksgebiedVondstlocatie, RceMonument, VondstlocatieInhoud, WerelderfgoedLidmaatschap } from "@/lib/rce";
import type { ConceptField } from "@/lib/heritage-view-model";

export type SearchResponse = { results: RceMonument[]; page?: number; pageSize?: number; hasMore?: boolean; failedCategories?: string[] };
// Welke "Soort object"-categorieën (SearchFilters.tsx) in elke scope zitten -
// alleen gebruikt als een hele scope-aanroep hieronder afwijst (bv. een
// netwerkfout, geen 200), want dan levert de server zelf geen
// failedCategories mee. Bij een gewone 200 met een deels mislukte categorie
// (het gebruikelijke geval, zie de "schoener"/Scheepswrak-melding 21-08-2026)
// noemt de server de categorie al zelf preciezer.
const SCOPE_CATEGORIES: Record<string, string[]> = {
  core: ["Rijksmonument"],
  heritage: ["Werelderfgoed", "Gezicht", "Complex"],
  "archaeology-a": ["Onderzoeksgebied", "Archeologisch terrein", "Vondstlocatie"],
  "archaeology-b": ["Grondspoor", "Vondst", "Archeologisch complex", "Scheepswrak"],
};
export type BrowseKind = "rijksmonument" | "archeologischterrein" | "onderzoeksgebied" | "vondstlocatie" | "archeologischcomplex" | "vondsten" | "grondsporen" | "werelderfgoed" | "gezicht" | "complex";
type ComplexMembersResponse = { members: ComplexMember[] };
type LigtInResponse = { gezicht: GezichtLidmaatschap[]; werelderfgoed: WerelderfgoedLidmaatschap[] };
type ArcheologischeContextResponse = { gebieden: ArcheologischeContext[] };
type OnderzoeksgebiedVerrijkingResponse = OnderzoeksgebiedAggregaten & { complexen: OnderzoeksgebiedComplex[]; vondstlocaties: OnderzoeksgebiedVondstlocatie[] };
type OpDezeDagResponse = { monument: RceMonument | null };
type VerrasMeResponse = { monument: RceMonument | null };

export async function searchRceMonuments(query: string, signal?: AbortSignal, page = 1) {
  const requestScope = async (scope: string) => {
    const params = new URLSearchParams({ q: query, page: String(page), scope });
    const response = await fetch(`/api/rce/search?${params}`, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`, { cause: response.status });
    return await response.json() as SearchResponse;
  };
  const includeOtherScopes =
    page === 1 && !/^\d{1,6}$/.test(query.trim()) && !/^\d{4}\s?[A-Za-z]{2}$/.test(query.trim());
  const scopes = includeOtherScopes
    ? (["core", "heritage", "archaeology-a", "archaeology-b"] as const)
    : (["core"] as const);
  // Alle scopes tegelijk starten, niet core eerst afwachten en pas dán de
  // rest - een trage of gefaalde core-scope blokkeerde eerder het zelfs
  // maar aánvragen van de andere drie, ook als die zelfstandig hadden
  // kunnen slagen (P1, externe review 22-08-2026).
  const settled = await Promise.allSettled(scopes.map((scope) => requestScope(scope)));
  const byId = new Map<string, RceMonument>();
  const failedCategories = new Set<string>();
  let core: SearchResponse | undefined;
  settled.forEach((result, index) => {
    const scope = scopes[index];
    if (result.status === "fulfilled") {
      if (scope === "core") core = result.value;
      for (const item of result.value.results)
        byId.set(item.sourceUrl || `${item.monumentNature}:${item.monumentNumber}`, item);
      for (const category of result.value.failedCategories ?? []) failedCategories.add(category);
    } else {
      for (const category of SCOPE_CATEGORIES[scope]) failedCategories.add(category);
    }
  });
  // Alleen als werkelijk élke scope faalde is er niets te tonen - dan de
  // eerste fout alsnog doorgeven, zodat de bestaande timeout/error-
  // afhandeling in useSearchState ongewijzigd blijft werken.
  if (byId.size === 0 && settled.every((result) => result.status === "rejected"))
    throw (settled[0] as PromiseRejectedResult).reason;
  return {
    results: [...byId.values()],
    hasMore: core?.hasMore ?? false,
    page: core?.page ?? page,
    failedCategories: [...failedCategories],
  };
}

// Exact zoeken op een concept-URI uit het Referentienetwerk in plaats van
// een tekstzoekopdracht - zie docs/vertical-slices/004-referentienetwerk-concepten.md.
// `veld` bepaalt via welke eigenschap gezocht wordt; de aanroeper weet dit
// al op basis van welk label is aangeklikt.
async function searchByConcept(conceptUri: string, veld: ConceptField, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/search?concept=${encodeURIComponent(conceptUri)}&veld=${veld}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`, { cause: response.status });
  const document = await response.json() as SearchResponse;
  return document.results;
}

export async function searchByMonumentAardConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "monumentaard", signal);
}

export async function searchByArcheologischeWaarderingConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "waardering", signal);
}

export async function searchByStijlConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "stijl", signal);
}

export async function searchByBouwkundigeStaatConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "bouwkundigestaat", signal);
}

export async function searchByVerwervingConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "verwerving", signal);
}

export async function searchByGrondspoorTypeConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "grondspoortype", signal);
}

export async function searchByMonumentTypeConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "monumenttype", signal);
}

export async function searchByGebeurtenisConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "gebeurtenis", signal);
}

export async function searchByActorConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "actor", signal);
}

// Bekijk de volledige collectie Werelderfgoed, Gezichten of Complexen, los
// van een zoekterm - anders zijn deze typen alleen vindbaar als hun naam
// toevallig met de ingetypte tekst matcht.
export async function browseRceObjects(kind: BrowseKind, signal?: AbortSignal, page = 1) {
  const response = await fetch(`/api/rce/search?browse=${kind}&page=${page}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as SearchResponse;
  return { results: document.results, hasMore: document.hasMore ?? false, page: document.page ?? page };
}

export async function searchByFunctieConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "functie", signal);
}

// Complexleden worden pas opgehaald zodra een gebruiker een complex opent -
// niet vooraf voor elk complex in een resultatenlijst, dat zou de gewone
// zoekopdracht onnodig zwaar maken.
export async function fetchComplexMembers(complexUri: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/complex-members?complex=${encodeURIComponent(complexUri)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as ComplexMembersResponse;
  return document.members;
}

// Zelfde lazy-aanpak als complexleden: pas opgehaald zodra een gebruiker een
// Rijksmonument daadwerkelijk opent - zie docs/vertical-slices/006-werelderfgoed-ligt-in.md.
export async function fetchLigtIn(monumentNumber: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/ligt-in?rijksmonumentnummer=${encodeURIComponent(monumentNumber)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  return await response.json() as LigtInResponse;
}

// Zelfde lazy-aanpak als fetchLigtIn hierboven - zie de toelichting bij
// buildOmschrijvingOnderwerpQuery (lib/rce/monuments.ts) voor waarom dit niet
// meer in de gewone zoekresultaten zit.
export async function fetchOmschrijvingOnderwerp(choUri: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/omschrijving-onderwerp?cho=${encodeURIComponent(choUri)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as { concepten: { uri: string; label: string; bron: string }[] };
  return document.concepten;
}

// In tegenstelling tot fetchLigtIn hierboven NIET lazy-bij-openen: dit kan
// 15+ seconden duren (112.184 ArcheologischOnderzoeksgebied-instanties, geen
// kleine vaste kandidatenset), dus wordt alleen aangeroepen op een expliciete
// knopklik van de gebruiker - zie docs/vertical-slices/017-archeologische-context-onderzoeksgebied.md.
export async function fetchArcheologischeContext(monumentNumber: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/archeologische-context?rijksmonumentnummer=${encodeURIComponent(monumentNumber)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as ArcheologischeContextResponse;
  return document.gebieden;
}

// Zelfde lazy-aanpak als complexleden: pas opgehaald zodra een gebruiker een
// Onderzoeksgebied daadwerkelijk opent.
export async function fetchOnderzoeksgebiedVerrijking(gebiedUri: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/onderzoeksgebied-verrijking?gebied=${encodeURIComponent(gebiedUri)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  return await response.json() as OnderzoeksgebiedVerrijkingResponse;
}

export async function searchByVondstTypeConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "vondsttype", signal);
}

export async function searchByMateriaalConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "materiaal", signal);
}

export async function searchByToestandConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "toestand", signal);
}

export async function searchByArcheologischComplexTypeConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "archeologischcomplextype", signal);
}

export async function fetchVondstlocatieInhoud(locatieUri: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/vondstlocatie-inhoud?locatie=${encodeURIComponent(locatieUri)}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  return await response.json() as VondstlocatieInhoud;
}

// Eén keer per pagina-load opgehaald (idle-startpaneel), niet onderdeel
// van een zoekopdracht - zie docs/vertical-slices/010-op-deze-dag.md.
export async function fetchOpDezeDag(signal?: AbortSignal) {
  const response = await fetch("/api/rce/op-deze-dag", {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as OpDezeDagResponse;
  return document.monument;
}

// Op klik aangeroepen (geen idle-load, geen cache) - zie
// docs/vertical-slices/014-verras-me.md.
export async function fetchVerrasMe(signal?: AbortSignal) {
  const response = await fetch("/api/rce/verras-me", {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as VerrasMeResponse;
  return document.monument;
}
