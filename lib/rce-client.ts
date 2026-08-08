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
