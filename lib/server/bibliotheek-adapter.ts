import { escapeSparqlString, type LiteratureRef } from "../rce.ts";
import { fetchSparql } from "./sparql-client.ts";

// Fysiek een ander SPARQL-endpoint dan de rest van de app (rce/cho): de
// RCE-bibliotheekcatalogus (grijze literatuur: opgravingsrapporten,
// restauratieverslagen) leeft op deze aparte dienst, niet op rce/cho zelf.
// Zie docs/vertical-slices/005-bibliotheek-literatuur.md voor de
// empirische onderbouwing.
const BIBLIOTHEEK_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/bibliotheek/sparql";

// Sommige rijksmonumenten hebben tientallen gekoppelde publicaties (top
// geobserveerd: 149) - zonder cap zou de detailpagina onbruikbaar worden.
const MAX_PER_MONUMENT = 5;

type SparqlBinding = Record<string, { value?: string } | undefined>;

export function buildLiteratuurQuery(monumentNumbers: string[]) {
  const values = monumentNumbers.map((number) => `"${escapeSparqlString(number)}"`).join(" ");
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX schema: <https://schema.org/>
SELECT ?rmnr ?boek ?titel ?jaar ?sameAs ?auteurNaam WHERE {
  VALUES ?rmnr { ${values} }
  ?boek ceo:rijksmonumentnummer ?rmnr .
  OPTIONAL { ?boek schema:name ?titel . }
  OPTIONAL { ?boek schema:datePublished ?jaar . }
  OPTIONAL { ?boek schema:sameAs ?sameAs . }
  OPTIONAL { ?boek schema:author ?auteurUri . ?auteurUri schema:name ?auteurNaam . }
}`;
}

// GROUP_CONCAT in SPARQL zou de 1:N auteur-relatie en de losse sameAs-link
// per titel verliezen - groeperen (per boek, dan per monument) en cappen
// gebeurt daarom hier in JS, net als parseComplexResults/
// parseArcheologischTerreinResults dat al doen voor vergelijkbare 1:N-vorm.
export function parseLiteratuurResults(document: unknown): Map<string, LiteratureRef[]> {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  const byMonumentNumber = new Map<string, LiteratureRef[]>();
  if (!Array.isArray(bindings)) return byMonumentNumber;

  const byBook = new Map<string, { rmnr: string; ref: LiteratureRef }>();
  for (const binding of bindings) {
    const rmnr = binding.rmnr?.value;
    const uri = binding.boek?.value;
    const title = binding.titel?.value;
    if (!rmnr || !uri || !title) continue;
    const existing = byBook.get(uri);
    const authorName = binding.auteurNaam?.value;
    if (existing) {
      if (authorName && !existing.ref.authors.includes(authorName)) existing.ref.authors.push(authorName);
      continue;
    }
    byBook.set(uri, {
      rmnr,
      ref: { uri, title, year: binding.jaar?.value, authors: authorName ? [authorName] : [], sourceUrl: binding.sameAs?.value },
    });
  }

  for (const { rmnr, ref } of byBook.values()) {
    const forMonument = byMonumentNumber.get(rmnr) ?? [];
    forMonument.push(ref);
    byMonumentNumber.set(rmnr, forMonument);
  }
  for (const [rmnr, refs] of byMonumentNumber) {
    refs.sort((a, b) => (b.year ?? "").localeCompare(a.year ?? ""));
    byMonumentNumber.set(rmnr, refs.slice(0, MAX_PER_MONUMENT));
  }
  return byMonumentNumber;
}

export async function fetchLiteratuur(monumentNumbers: string[], signal?: AbortSignal): Promise<Map<string, LiteratureRef[]>> {
  if (!monumentNumbers.length) return new Map();
  const document = await fetchSparql(buildLiteratuurQuery(monumentNumbers), signal, BIBLIOTHEEK_ENDPOINT);
  return parseLiteratuurResults(document);
}
