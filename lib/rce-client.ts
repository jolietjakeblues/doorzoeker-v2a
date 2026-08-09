import type { ComplexMember, OnderzoeksgebiedAggregaten, OnderzoeksgebiedComplex, OnderzoeksgebiedVondstlocatie, RceMonument } from "@/lib/rce";

type SearchResponse = { results: RceMonument[] };
type ComplexMembersResponse = { members: ComplexMember[] };
type OnderzoeksgebiedVerrijkingResponse = OnderzoeksgebiedAggregaten & { complexen: OnderzoeksgebiedComplex[]; vondstlocaties: OnderzoeksgebiedVondstlocatie[] };

export async function searchRceMonuments(query: string, signal?: AbortSignal, page = 1) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const response = await fetch(`/api/rce/search?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as SearchResponse;
  return document.results;
}

// Exact zoeken op een concept-URI uit het Referentienetwerk in plaats van
// een tekstzoekopdracht - zie docs/vertical-slices/004-referentienetwerk-concepten.md.
// `veld` bepaalt via welke eigenschap gezocht wordt; de aanroeper weet dit
// al op basis van welk label is aangeklikt.
async function searchByConcept(conceptUri: string, veld: "monumentaard" | "waardering", signal?: AbortSignal) {
  const response = await fetch(`/api/rce/search?concept=${encodeURIComponent(conceptUri)}&veld=${veld}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as SearchResponse;
  return document.results;
}

export async function searchByMonumentAardConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "monumentaard", signal);
}

export async function searchByArcheologischeWaarderingConcept(conceptUri: string, signal?: AbortSignal) {
  return searchByConcept(conceptUri, "waardering", signal);
}

// Bekijk de volledige collectie Werelderfgoed, Gezichten of Complexen, los
// van een zoekterm - anders zijn deze typen alleen vindbaar als hun naam
// toevallig met de ingetypte tekst matcht.
export async function browseRceObjects(kind: "werelderfgoed" | "gezicht" | "complex", signal?: AbortSignal) {
  const response = await fetch(`/api/rce/search?browse=${kind}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  const document = await response.json() as SearchResponse;
  return document.results;
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
// Onderzoeksgebied daadwerkelijk opent.
export async function fetchOnderzoeksgebiedVerrijking(gebiedUri: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rce/onderzoeksgebied-verrijking?gebied=${encodeURIComponent(gebiedUri)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Doorzoeker-API antwoordde met ${response.status}`);
  return await response.json() as OnderzoeksgebiedVerrijkingResponse;
}
