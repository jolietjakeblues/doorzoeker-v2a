// Lokale terugval voor ruimtelijke SPARQL-joins (geof:sfWithin/sfIntersects),
// poort van de eigenaars eigen ldv-talk-2-your-data (sparql/spatial.py +
// sparql/executor.py, Shapely-gebaseerd) naar TypeScript. Zie
// lib/rce/geometry.ts voor de punt-in-polygon-predicaten en
// lib/server/vraag-adapter.ts voor de aankoppeling.
//
// Waarom: geof:sfWithin/sfIntersects op het RCE Virtuoso-endpoint kan falen
// met een TopologyException (ongeldige/zelf-overlappende polygonen - live
// geconstateerd 28-08-2026 op het Gezicht "19e-eeuwse Schil Dordrecht") of
// een timeout. Bij zo'n fout herhaalt Doorzoeker de query zonder de
// ruimtelijke FILTER en berekent de relatie hier lokaal; rijen met
// ontbrekende of onherstelbare geometrie worden overgeslagen in plaats van
// de hele aanvraag te laten mislukken.
import { doesIntersect, isWithin, parseWktGeometry } from "../rce/geometry.ts";
import type { SparqlBinding, SparqlResultsDocument } from "./postprocess.ts";

export type SpatialRelation = "sfWithin" | "sfIntersects";
export type SpatialFilter = { relation: SpatialRelation; objectVar: string; areaVar: string };

const SPATIAL_FILTER_RE = /FILTER\s*\(\s*geof:(sfWithin|sfIntersects)\s*\(\s*\?(\w+)\s*,\s*\?(\w+)\s*\)\s*\)\s*\.?/i;

export function extractSpatialFilter(query: string): SpatialFilter | undefined {
  const match = SPATIAL_FILTER_RE.exec(query);
  if (!match) return undefined;
  const relation = match[1].toLowerCase() === "sfwithin" ? "sfWithin" : "sfIntersects";
  return { relation, objectVar: match[2], areaVar: match[3] };
}

export function stripSpatialFilter(query: string): string {
  return query.replace(SPATIAL_FILTER_RE, "");
}

// Foutmeldingen die op een probleem met de ruimtelijke berekening zelf
// wijzen (ongeldige geometrie, JTS/GEOS-topologiefout), niet op een fout in
// de query - bij zo'n fout is de lokale terugval zinvol. Zelfde
// signaalwoorden als de Python-bron.
const SPATIAL_ERROR_MARKERS = ["topologyexception", "jts", "invalid geometry", "geos"];

export function isSpatialErrorBody(body: string): boolean {
  const lower = body.toLowerCase();
  return SPATIAL_ERROR_MARKERS.some((marker) => lower.includes(marker));
}

// Een timeout op een ruimtelijke query wordt altijd als reden voor de
// terugval behandeld (zelfde keuze als de Python-bron) - geof:sfWithin/
// sfIntersects is meestal de duurste stap in zo'n query, dus een timeout
// duidt vrijwel altijd op diezelfde berekening, ook zonder een expliciete
// TopologyException-foutmelding.
export function isSpatialFailure(error: unknown): boolean {
  if (error instanceof Error && (error.name === "TimeoutError" || /aborted due to timeout/i.test(error.message))) return true;
  const body = (error as { body?: unknown })?.body;
  return typeof body === "string" && isSpatialErrorBody(body);
}

// Bij de lokale terugval vervalt de servergefilterde scoping - de LIMIT van
// de oorspronkelijke query zou dan willekeurige (niet per se relevante)
// rijen kunnen afkappen vóórdat de ruimtelijke test lokaal is toegepast.
// Verruim de LIMIT op de vereenvoudigde query tot Virtuoso's eigen
// maximum (10.000 rijen - zelfde plafond als de rijkere ldv-talk-2-your-
// data-branch hanteert); de aanroeper knipt het resultaat na de lokale
// filtering terug naar het normale plafond (zie LIJST_LIMIT in
// postprocess.ts) én controleert of dit plafond geraakt is (zie
// isFallbackCandidateSetIncomplete hieronder) - anders kan een query
// zonder eigen scoping-filter (bv. "rijksmonumenten binnen gezicht X",
// zonder gemeente- of functiefilter erbij) een vals-negatief "0
// resultaten" opleveren omdat de eerste N kandidaten toevallig geen van
// alle in het gezochte gebied liggen. Live geconstateerd (28-08-2026):
// zonder deze check meldde Doorzoeker ten onrechte 0 rijksmonumenten in
// het Gezicht "19e-eeuwse Schil Dordrecht", terwijl er in werkelijkheid
// 33 zijn (bevestigd via een gemeente-voorgefilterde geof:sfWithin op
// hetzelfde endpoint, die wél probleemloos werkte).
export const FALLBACK_CANDIDATE_LIMIT = 10_000;

export function widenLimitForFallback(query: string, max = FALLBACK_CANDIDATE_LIMIT): string {
  if (/\bLIMIT\s+\d+/i.test(query)) return query.replace(/\bLIMIT\s+\d+/i, `LIMIT ${max}`);
  return `${query.trimEnd()}\nLIMIT ${max}`;
}

// Gooid als de vereenvoudigde (ruimtelijke-filter-loze) query exact het
// verruimde plafond aan rijen teruggaf - een teken dat er mogelijk meer
// kandidaten bestonden dan opgehaald, en dat het resultaat van de lokale
// ruimtelijke filtering dus onvolledig of vals-negatief kan zijn. Zonder
// deze check zou zo'n onvolledig resultaat stilzwijgend als definitief
// antwoord getoond worden.
export class SpatialFallbackIncompleteError extends Error {}

export function isFallbackCandidateSetIncomplete(rawBindingCount: number, limit: number = FALLBACK_CANDIDATE_LIMIT): boolean {
  return rawBindingCount >= limit;
}

// Filtert bindings lokaal op de ruimtelijke relatie. Rijen met ontbrekende,
// onleesbare of onherstelbaar ongeldige geometrie worden overgeslagen
// (geteld, niet gelogd per rij) in plaats van de hele aanvraag te laten
// mislukken.
export function applySpatialFilterLocally(data: SparqlResultsDocument, filter: SpatialFilter): { data: SparqlResultsDocument; skipped: number } {
  const bindings = data.results?.bindings ?? [];
  const kept: SparqlBinding[] = [];
  let skipped = 0;

  for (const row of bindings) {
    const objectWkt = row[filter.objectVar]?.value;
    const areaWkt = row[filter.areaVar]?.value;
    if (!objectWkt || !areaWkt) {
      skipped += 1;
      continue;
    }
    const objectGeometry = parseWktGeometry(objectWkt);
    const areaGeometry = parseWktGeometry(areaWkt);
    if (!objectGeometry || !areaGeometry) {
      skipped += 1;
      continue;
    }
    const matches = filter.relation === "sfWithin" ? isWithin(objectGeometry, areaGeometry) : doesIntersect(objectGeometry, areaGeometry);
    if (matches) kept.push(row);
  }

  if (data.results) data.results.bindings = kept;
  return { data, skipped };
}
