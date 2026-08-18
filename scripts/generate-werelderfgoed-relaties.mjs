// Verticale slice 006: genereert data/werelderfgoed-rijksmonumenten.json.
//
// Waarom een offline script en geen live SPARQL-aanroep: de RCE CHO-graph
// modelleert geen ruimtelijke "ligt in"-relatie tussen Rijksmonument en
// Werelderfgoed (geverifieerd: een COUNT(*) over elke denkbare koppeling
// tussen die twee typen levert 0 op). De relatie is wel geometrisch te
// berekenen via GeoSPARQL (geof:sfWithin), maar een volledige polygoon-check
// tegen alle ~62.000 Rijksmonumenten duurt 14+ seconden per Werelderfgoed -
// veel te traag voor een gewone zoekopdracht of detailpagina. Werelderfgoed
// telt maar 18, zelden wijzigende instanties, dus dit eenmalig offline
// berekenen en als statisch bestand meeleveren is de juiste afweging. Zie
// docs/vertical-slices/006-werelderfgoed-ligt-in.md voor de volledige
// onderbouwing en metingen.
//
// Twee stappen per Werelderfgoed-instantie:
//   1. een SPARQL-query met een goedkope bounding-box-rechthoek als
//      geof:sfWithin-filter over alle Rijksmonumenten met geometrie - levert
//      een ruwe kandidatenlijst op (samen met elk kandidaats eigen WKT, één
//      round-trip; een bbox is een overschatting: er vallen ook punten in de
//      hoeken van de rechthoek die buiten de echte polygoon liggen);
//   2. de exacte polygoon-check, client-side in JS (parseWktRings /
//      pointInRings), niet via een tweede SPARQL-aanroep. Dat is eerst wel
//      geprobeerd (geof:sfWithin met de kandidaten in een VALUES-clausule),
//      maar de grootste Werelderfgoed-polygonen (Hollandse Waterlinies:
//      71.000+ coördinaten) lieten de SPARQL-service zelf vastlopen - eerst
//      een "Maximum call stack size exceeded" bij het parsen van zo'n lange
//      WKT-literal, en na afronden van de coördinaten alsnog een 504 Gateway
//      Timeout (de sfWithin-berekening zelf is te duur voor de service, niet
//      alleen de queryparser). Een simpele even-odd point-in-polygon-test op
//      het al opgehaalde geometriemateriaal is in JS wél triviaal snel.
//
// Gebruikt POST (query in de request-body), niet GET: sommige Werelderfgoed-
// WKT's zijn honderdduizenden tekens groot (Waddenzee) en geven met GET een
// "414 Request-URI Too Large". Dit is alleen relevant voor dit offline
// script - de bestaande live fetchSparql-aanpak in lib/server/sparql-client.ts
// blijft ongewijzigd GET gebruiken, dat is voor de veel kleinere queries
// tijdens een gewone zoekopdracht nooit een probleem.
//
// Gedraaid via: npm run generate:werelderfgoed-relaties

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const GEO = "http://www.opengis.net/ont/geosparql#";
const GEOF = "http://www.opengis.net/def/function/geosparql/";
const INSTANCES_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";
const WERELDERFGOED_GRAPH = "https://linkeddata.cultureelerfgoed.nl/graph/werelderfgoed_hvdl";
const RIJKSMONUMENT_STATUS = "https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864";
const ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";

const OUTPUT_PATH = fileURLToPath(new URL("../data/werelderfgoed-rijksmonumenten.json", import.meta.url));
const META_PATH = fileURLToPath(new URL("../data/werelderfgoed-rijksmonumenten.meta.json", import.meta.url));

async function postSparqlOnce(query) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `query=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`RCE SPARQL-service antwoordde met ${response.status}: ${body.slice(0, 500)}`, { cause: response.status });
  }
  return response.json();
}

// Zelfde herkansingsdiscipline als lib/server/sparql-client.ts's fetchSparql:
// één keer herkansen bij een transiente 5xx, een 4xx niet.
async function postSparql(query) {
  try {
    return await postSparqlOnce(query);
  } catch (error) {
    const status = error instanceof Error ? error.cause : undefined;
    if (typeof status !== "number" || status < 500) throw error;
    return postSparqlOnce(query);
  }
}

function bindingsOf(document) {
  return document?.results?.bindings ?? [];
}

// Geen spread over een coördinatenarray (Math.max(...lngs)): sommige
// Werelderfgoed-polygonen (Waddenzee, Hollandse Waterlinies) hebben veruit
// meer coördinaten dan V8's argumentenlimiet. Eén lus is O(n) zonder die
// grens - zelfde aanpak als lib/rce/geometry.ts's boundingBoxFootprint.
function boundingBoxOf(wkt) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const re = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let match;
  let count = 0;
  while ((match = re.exec(wkt))) {
    const lng = Number(match[1]);
    const lat = Number(match[2]);
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    count++;
  }
  if (count === 0) return undefined;
  return { minLng, minLat, maxLng, maxLat };
}

function bboxWktLiteral({ minLng, minLat, maxLng, maxLat }) {
  return `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
}

// Grote Werelderfgoed-polygonen (Hollandse Waterlinies: 71.000+ coördinaten)
// bleken de exacte polygoon-check via geof:sfWithin niet uit te voeren te
// zijn op de SPARQL-service zelf: een lange WKT-literal in de query gaf eerst
// "Maximum call stack size exceeded" (parserlimiet) en na verkorting alsnog
// een 504 Gateway Timeout (de check zelf is te duur). Daarom wordt de exacte
// stap hieronder client-side in JS gedaan met een eigen "even-odd"
// point-in-polygon-test, met de kandidaten uit fetchBboxKandidaten en hun al
// opgehaalde eigen geometrie - geen tweede SPARQL-aanroep, geen limiet op
// literal-grootte. De bbox-stap (fetchBboxKandidaten) blijft wel server-side
// SPARQL: die polygoon is maar 4 punten, dus altijd goedkoop.

// Coördinatenlijsten in WKT bevatten zelf geen haakjes, dus elke binnenste
// haakjes-groep is precies één ring (buitenring óf gat). Voor multipolygonen
// met meerdere (losstaande) delen en/of gaten geldt de "even-odd"-regel over
// ALLE ringen samen: een punt ligt binnen de geometrie als het in een oneven
// aantal ringen ligt - dat werkt correct ongeacht groepering in polygonen.
function parseWktRings(wkt) {
  const groups = wkt.match(/\(([^()]*)\)/g) ?? [];
  return groups.map((group) =>
    group
      .slice(1, -1)
      .split(",")
      .map((pair) => pair.trim().split(/\s+/).map(Number)),
  );
}

function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInRings(point, rings) {
  let inside = false;
  for (const ring of rings) {
    if (pointInRing(point, ring)) inside = !inside;
  }
  return inside;
}

// Representatief punt van een rijksmonument-geometrie: het centroïde
// (gemiddelde) van de buitenring. Voor gebouwvoetafdrukken - klein en vrijwel
// altijd (bijna-)convex - ligt dat vrijwel zeker binnen de eigen contour. Dit
// past bij de al elders in dit script geaccepteerde randonnauwkeurigheid
// (zie het plan-document over het Kinderdijk 22-vs-23-verschil): een
// "ligt in"-check op gebouwniveau hoeft niet op de millimeter exact te zijn.
function centroidOf(ring) {
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

async function fetchWerelderfgoedInstanties() {
  const query = `PREFIX ceo: <${CEO}>
PREFIX geo: <${GEO}>
SELECT ?cho ?wenr (SAMPLE(STR(?naamValue)) AS ?naam) (SAMPLE(STR(?wktValue)) AS ?wkt) (SAMPLE(STR(?jaarValue)) AS ?jaar) WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Werelderfgoed ; ceo:werelderfgoednummer ?wenr .
    OPTIONAL { ?cho ceo:heeftNaam/ceo:naam ?naamValue . }
    OPTIONAL { ?cho ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  }
  GRAPH <${WERELDERFGOED_GRAPH}> {
    OPTIONAL { ?cho ceo:jaarVanInschrijving ?jaarValue . }
  }
} GROUP BY ?cho ?wenr`;
  const document = await postSparql(query);
  return bindingsOf(document).map((binding) => ({
    werelderfgoednummer: binding.wenr?.value ?? "",
    naam: binding.naam?.value ?? "",
    wkt: binding.wkt?.value,
    jaar: binding.jaar?.value ? Number(binding.jaar.value) : undefined,
  }));
}

async function fetchBboxKandidaten(bboxLiteral) {
  const query = `PREFIX ceo: <${CEO}>
PREFIX geo: <${GEO}>
PREFIX geof: <${GEOF}>
SELECT ?rmnr (SAMPLE(STR(?wktValue)) AS ?wkt) WHERE {
  GRAPH <${INSTANCES_GRAPH}> {
    ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ;
         ceo:heeftJuridischeStatus <${RIJKSMONUMENT_STATUS}> ;
         ceo:heeftGeometrie/geo:asWKT ?wktValue .
    FILTER(geof:sfWithin(?wktValue, "${bboxLiteral}"^^geo:wktLiteral))
  }
} GROUP BY ?rmnr`;
  const document = await postSparql(query);
  return bindingsOf(document)
    .map((binding) => ({ rmnr: binding.rmnr?.value, wkt: binding.wkt?.value }))
    .filter((candidate) => /^\d+$/.test(candidate.rmnr ?? "") && candidate.wkt);
}

function findExacteMatches(kandidaten, wereldergoedWkt) {
  if (kandidaten.length === 0) return [];
  const wereldergoedRings = parseWktRings(wereldergoedWkt);
  const matches = [];
  for (const kandidaat of kandidaten) {
    const eigenRings = parseWktRings(kandidaat.wkt);
    if (eigenRings.length === 0) continue;
    const punt = centroidOf(eigenRings[0]);
    if (pointInRings(punt, wereldergoedRings)) matches.push(kandidaat.rmnr);
  }
  return matches;
}

async function main() {
  console.log("Werelderfgoed-instanties ophalen...");
  const instanties = await fetchWerelderfgoedInstanties();
  console.log(`${instanties.length} Werelderfgoed-instanties gevonden.`);

  const relaties = {};
  let maxJaar;

  for (const instantie of instanties) {
    if (instantie.jaar !== undefined && (maxJaar === undefined || instantie.jaar > maxJaar)) maxJaar = instantie.jaar;

    if (!instantie.wkt) {
      console.warn(`  ${instantie.naam} (${instantie.werelderfgoednummer}): geen geometrie, overgeslagen.`);
      continue;
    }
    const bbox = boundingBoxOf(instantie.wkt);
    if (!bbox) {
      console.warn(`  ${instantie.naam} (${instantie.werelderfgoednummer}): geometrie zonder herkenbare coördinaten, overgeslagen.`);
      continue;
    }

    const startedAt = Date.now();
    const kandidaten = await fetchBboxKandidaten(bboxWktLiteral(bbox));
    const exact = findExacteMatches(kandidaten, instantie.wkt);
    const duurMs = Date.now() - startedAt;
    console.log(
      `  ${instantie.naam} (${instantie.werelderfgoednummer}): ${kandidaten.length} kandidaten -> ${exact.length} exacte treffers (${duurMs}ms).`,
    );

    for (const rmnr of exact) {
      const lidmaatschap = { werelderfgoednummer: instantie.werelderfgoednummer, naam: instantie.naam };
      if (!relaties[rmnr]) relaties[rmnr] = [];
      // Sommige Werelderfgoederen hebben twee CHO-instanties met hetzelfde
      // werelderfgoednummer (bijv. een kernzone- en een bufferzone-geometrie,
      // zoals bij de Hollandse Waterlinies). Eén rijksmonument dat binnen
      // beide geometrieën valt, hoort maar één keer in de lijst te staan.
      const algToegevoegd = relaties[rmnr].some((bestaand) => bestaand.werelderfgoednummer === lidmaatschap.werelderfgoednummer);
      if (!algToegevoegd) relaties[rmnr].push(lidmaatschap);
    }
  }

  const rijksmonumentenMetRelatie = Object.keys(relaties).length;
  console.log(`\nKlaar: ${rijksmonumentenMetRelatie} rijksmonumenten met een Werelderfgoed-relatie.`);

  // Sorteer alleen de top-level rmnr-sleutels voor een stabiele diff tussen
  // runs; JSON.stringify's tweede argument als array is een property-
  // whitelist over ALLE niveaus, niet een sorteeroptie - die zou hier per
  // ongeluk ook de geneste werelderfgoednummer/naam-velden wegfilteren.
  const gesorteerd = Object.fromEntries(Object.keys(relaties).sort().map((rmnr) => [rmnr, relaties[rmnr]]));
  await writeFile(OUTPUT_PATH, `${JSON.stringify(gesorteerd, null, 2)}\n`, "utf-8");
  console.log(`Weggeschreven naar ${OUTPUT_PATH}`);

  // Regeneratietrigger (zie "Openstaande vragen" in het plan): bij een
  // volgende run kan het aantal instanties en het hoogste jaarVanInschrijving
  // vergeleken worden met deze meta om te zien of regeneratie nodig is -
  // concreter dan "let op UNESCO-nieuws". Losse bestand, niet in het
  // runtime-geïmporteerde databestand zelf, want dat moet exact het
  // WerelderfgoedRelaties-datamodel blijven (Record<rmnr, lidmaatschap[]>).
  await writeFile(
    META_PATH,
    `${JSON.stringify(
      {
        gegenereerdOp: new Date().toISOString(),
        werelderfgoedAantal: instanties.length,
        hoogsteJaarVanInschrijving: maxJaar,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  console.log(`Metadata weggeschreven naar ${META_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
