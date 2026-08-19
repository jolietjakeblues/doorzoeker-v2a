# Verticale slice 017: Archeologische context bij een Rijksmonument (ligt op/overlapt een Onderzoeksgebied)

## Status

Gebouwd en live geverifieerd (19 augustus 2026), na expliciete opdracht van
de eigenaar. Uitgeschreven na een verkenning naar aanleiding van een
concreet voorbeeld uit de RCE's eigen
["Zoeken door de Knowledge Graph"-story](https://linkeddata.cultureelerfgoed.nl/RCE-Knowledge-Graph/-/stories/Zoeken-door-de-Knowledge-Graph).
Alle zes openstaande vragen zijn dezelfde dag met de eigenaar doorgesproken
en beantwoord, zie "Beslissingen" hieronder; het "Gebouwd"-blok daaronder
beschrijft wat er tijdens de bouw nog bijkwam. Dezelfde dag nog uitgebreid
met een kaart die het Rijksmonument en de gevonden Onderzoeksgebieden
gezamenlijk als polygonen toont - zie "Vervolg: kaart met polygonen"
hieronder.

## Aanleiding

Rijksmonument 14948 (Elst) is een **gebouwd** rijksmonument, opgetrokken
boven een archeologische vindplaats. Op de detailpagina is dat nu
onzichtbaar - hetzelfde soort "verborgen samenhang"-probleem als slice 006
(Werelderfgoed/Gezicht), maar dan tussen een Rijksmonument en de
archeologie waar het bovenop staat.

Belangrijk om niet te verwarren met wat al bestaat: Doorzoeker toont al een
relatie tussen een **archeologisch** Rijksmonument en zijn eigen
Archeologisch Terrein (`buildArcheologischTerreinQuery`, zie slice 002).
Dat is een heel ander geval - dat Rijksmonument ís zelf archeologisch
(`heeftMonumentAard` = archeologisch) en heeft een directe, gemodelleerde
relatie naar zijn eigen terrein. Rijksmonument 14948 is daarentegen
**gebouwd** (`heeftMonumentAard` = gebouwd), en de relatie met de
archeologie eronder is nergens gemodelleerd - die moet ruimtelijk worden
afgeleid, net als bij slice 006.

## Empirisch bevestigd (19 augustus 2026)

1. **Verkeerde klasse eerder aangezien voor de hele categorie.**
   `docs/functionele-dekking.md` vermeldt terecht dat `ceo:ArcheologischTerrein`
   nul instanties met een eigen geometrie heeft. Maar de klasse die de RCE's
   eigen voorbeeldquery gebruikt is een andere: `ceo:ArcheologischOnderzoeksgebied`
   (al een eersteklas, doorzoekbare objectsoort in Doorzoeker sinds slice
   002). Die klasse heeft wél op grote schaal geometrie: **112.184
   instanties met `ceo:heeftGeometrie/geo:asWKT`**, live geteld tegen
   dezelfde `rce/cho`-endpoint die Doorzoeker al gebruikt.
2. **De relatie is geometrisch aantoonbaar en klopt inhoudelijk.** Een
   bounding-box rond rijksmonument 14948's eigen geometrie levert 5
   kandidaat-Onderzoeksgebieden op; de exacte `geof:sfOverlaps`-check
   bevestigt overlap met Onderzoeksgebied 2051204, omschreven als
   *"Gallo-Romeins Tempelcomplex 1e en 2e eeuw ... Sporen van bewoning
   Vroege en Volle Middeleeuwen"* - precies het Romeinse heiligdom bij Elst
   waar de eigenaar naar verwees.
3. **Niet elke GeoSPARQL-functienaam werkt op dit endpoint.**
   `geof:sfIntersects` en `geof:sfContains` geven allebei `"Unknown
   function"` (400). Alleen `geof:sfWithin` en `geof:sfOverlaps` zijn
   bevestigd te werken - dezelfde twee die slice 006 ook al gebruikt.
4. **Schaal maakt dit structureel anders dan slice 006.** Werelderfgoed
   (18) en Gezicht (472) waren klein genoeg om een vaste kandidatenset per
   Rijksmonument tegen te toetsen (~0,3-0,7s, dus lazy per geopend detail).
   Onderzoeksgebied telt 112.184 instanties - zelfs alléén de goedkope
   bounding-box-voorfilter (nodig omdat een naïeve full-scan tegen alle
   112.184 zonder voorfilter na 30+ seconden nog niets teruggaf) kostte
   **15,4 seconden** voor deze ene test. Ruim boven wat als "lazy bij het
   openen van een detail" acceptabel is.

## Doel

Op de detailpagina van een Rijksmonument laten zien of het overlapt met
een archeologisch Onderzoeksgebied - zonder de bestaande zoek- en
detailprestaties te raken, en zonder de gebruiker een onverklaarde
hang-pagina te geven.

## Voorgestelde aanpak: on-demand knop, niet automatisch (zoals slice 006)

Slice 006's lazy-bij-openen-patroon (fetch start automatisch zodra het
detail opent) past hier niet: bij 15+ seconden voelt een automatische,
onzichtbare aanroep aan als een kapotte pagina. Voorgestelde aanpak, in
lijn met wat de eigenaar zelf voorstelde:

1. **Een knop op de Rijksmonument-detailpagina, alleen bij gebouwde
   Rijksmonumenten** (`heeftMonumentAard` = gebouwd - zie "Beslissingen"),
   met labeltekst **"Zoek archeologische context"** en een ondertitel/
   tooltip die de wachttijd vooraf noemt (bv. "Dit doorzoekt 112.000+
   archeologische onderzoeksgebieden en kan tot ~20 seconden duren.").
   Gewoon Nederlands en letterlijk, geen woordspeling als knoplabel zelf
   (de eigenaar opperde "Deep seek"/"deep dive" als sfeeraanduiding, niet
   als letterlijk te gebruiken tekst - zie "Beslissingen").
2. **Pas bij klikken** een aanroep naar een nieuwe route (bv.
   `/api/rce/archeologische-context`), die zelf het bekende tweefasenpatroon
   uitvoert (bbox-voorfilter, dan exacte `geof:sfOverlaps`-check op de
   kleine kandidatenset - zelfde ontwerp als de eerder gebouwde-en-weer-
   verwijderde Werelderfgoed-offlinevariant, zie de git-historie van
   `docs/vertical-slices/006-werelderfgoed-ligt-in.md` voor dat patroon in
   detail).
3. **Duidelijke laadstatus tijdens het wachten** - niet alleen een spinner:
   een korte, concrete tekst die uitlegt wát er gebeurt (bv. "Doorzoekt
   112.000+ archeologische onderzoeksgebieden..."), zodat 15+ seconden niet
   aanvoelt als een hangende pagina. Zelfde soort transparantie als de
   bestaande `error: true`-onderscheiding bij de andere lazy-verrijkingen
   (zie `hooks/useSelectedDetailEnrichment.ts`) - een falende of trage
   aanroep moet zichtbaar anders zijn dan "niets gevonden".
4. **Resultaat cachen na de eerste berekening**, zodat niemand twee keer
   voor dezelfde rijksmonumentnummer betaalt. Hergebruikt `caches.default`
   (Cloudflare Workers Cache API, `readCache`/`writeCache`/`cacheStore` in
   `app/api/rce/search/route.ts`) - geen nieuwe infrastructuur, zie
   "Beslissingen". Lange `s-maxage` (bv. een maand), want een
   rijksmonument-locatie en de archeologie eronder veranderen vrijwel
   nooit.
5. **Eigen, strengere rate limiter** op de nieuwe route dan de bestaande
   30/min (`createRateLimiter`) - **5-10 per minuut per client**, zie
   "Beslissingen". Een knop die een dure 112.000-instanties-scan triggert
   per klik is een aantrekkelijker misbruikvector dan de bestaande
   lazy-detailroutes.

**Bewust niet gekozen: een volledige offline batchprecomputatie voor alle
Rijksmonumenten** (zoals slice 006's eerste, later verworpen aanpak).
Rekensom: als de bbox-stap alleen al ~15s kost per Rijksmonument, zou een
naïeve batch over alle ~62.000 Rijksmonumenten met geometrie in de buurt
van 250+ uur seriële rekentijd kosten - een compleet andere orde van
grootte dan Werelderfgoed's ~2 minuten voor 18 gebieden. Op-aanvraag +
cachen-na-eerste-keer is voor dit schaalverschil de praktischere
middenweg: alleen berekend voor Rijksmonumenten die daadwerkelijk bekeken
wórden, met dezelfde staleness-afweging als slice 006 al maakte (de
onderliggende geometrie verandert vrijwel nooit).

## Data-model

```ts
type ArcheologischeContext = {
  onderzoeksgebiedUri: string;
  choNummer: string;
  omschrijving?: string;
  wkt: string;
};
// GET /api/rce/archeologische-context?rijksmonumentnummer=...
type ArcheologischeContextResponse = { gebieden: ArcheologischeContext[] };
```

Array, niet een los object - een Rijksmonument kan in theorie meerdere
overlappende Onderzoeksgebieden hebben (bij Elst waren dat er al twee van
de vijf kandidaten binnen de bbox).

`wkt` is toegevoegd tijdens het kaart-vervolg (zie hieronder): de
exacte-overlap-query haalt `?ogWkt` toch al op om `geof:sfOverlaps` zelf
te kunnen toetsen, dus meegeven in de SELECT kost geen extra round-trip -
alleen een groter antwoord.

## Scope-afbakening voor deze slice

- Alleen Rijksmonument → Onderzoeksgebied (niet de omgekeerde richting,
  niet andere objectsoorten).
- Alleen `ArcheologischOnderzoeksgebied`, niet `ArcheologischTerrein` (die
  laatste heeft geen geometrie, zie "Empirisch bevestigd").
- Geen poging om dit automatisch/lazy te laten lopen zoals slice 006 - de
  schaal laat dat niet toe zonder een fundamenteel ander
  precomputatiemodel (zie "Voorgestelde aanpak").
- Alleen gebouwde Rijksmonumenten tonen de knop, geen archeologische (zie
  "Beslissingen").
- Geen poging om dit te bouwen vóór er een expliciete opdracht daartoe is
  - eerst alleen dit plan, op verzoek van de eigenaar.

## Beslissingen (19 augustus 2026, na overleg met de eigenaar)

Alle zes eerder openstaande vragen zijn dezelfde dag beantwoord:

1. **Knoptekst: "Zoek archeologische context", gewoon Nederlands en
   letterlijk.** "Deep seek"/"deep dive" was bedoeld als sfeer/inspiratie
   voor het idee (letterlijk "diep zoeken"), niet als daadwerkelijk over
   te nemen knoptekst - bevestigd door de eigenaar. Afgewogen tegen de
   botsing met het gelijknamige AI-bedrijf en de wens om de rest van de
   app consequent Nederlands en direct te houden.
2. **Cachelaag: `caches.default` hergebruiken, geen nieuwe
   infrastructuur.** Pas heroverwegen (bv. een duurzamere laag) als in de
   praktijk blijkt dat de edge-cache te vaak leeg is - niet vooraf op
   aanname bouwen.
3. **Bbox-voorfilter versnellen via woonplaats/gemeente: niet nu
   onderzoeken.** Pas de moeite waard als beslissing 4 laat zien dat
   15s+ typisch is voor veel locaties, niet alleen dit ene Elst-geval.
4. **Typische duur voor een "gemiddeld" Rijksmonument: gemeten tijdens de
   bouw.** Rijksmonument 14948 (Elst) koud (eerste keer, geen enkele cache
   warm): **~21,5 seconden** end-to-end - grotendeels de bbox-voorfilterstap
   (zelfde orde van grootte als de eerder gemeten 15,4s). Een tweede,
   identieke aanvraag kort daarna: **~1,2 seconden** - niet via
   Doorzoekers eigen `caches.default` (die was op dat moment nog niet
   gevuld door een geslaagde aanroep), maar vermoedelijk doordat de RCE-
   SPARQL-dienst zelf de identieke bbox-query al had gecachet. Bevestigt
   de ~20s-waarschuwingstekst uit beslissing 1 voor een koude aanvraag;
   beslissing 3 (bbox-optimalisatie) blijft daarmee terecht ongebouwd voor
   nu - één meting is geen trend, maar geeft geen aanleiding om er nu al
   in te investeren.
5. **Knop alleen bij gebouwde Rijksmonumenten, niet bij archeologische.**
   Een archeologisch Rijksmonument heeft al zijn eigen terrein-relatie
   (slice 002) - nog een "ligt dit ook op archeologie"-knop zou daar
   overbodig/verwarrend zijn. Bij een gebouwd monument voegt het wél iets
   toe dat niet voor de hand ligt (zoals bij Elst).
6. **Rate-limit: 5-10 per minuut per client, strenger dan de bestaande
   30/min.** Dit is 15+ seconden RCE-belasting per klik, niet de
   sub-seconde van de andere lazy-routes - een aantrekkelijkere
   misbruikvector, in combinatie met de caching uit beslissing 2 (herhaalde
   aanvragen voor hetzelfde monument raken RCE dan sowieso niet opnieuw).

## Gebouwd - wat er tijdens de bouw nog bijkwam

- **Nieuwe bug gevonden en opgelost: 414 Request-URI Too Large op de
  exacte-overlap-query.** Live tegengekomen bij Rijksmonument 14948 zelf.
  De exacte-overlap-query embedt het volledige Rijksmonument-WKT (de
  kerk-plattegrond) plús alle bbox-kandidaten in een `VALUES`-clausule -
  samen soms te lang voor een GET-URL. Exact dezelfde les als het
  oorspronkelijke, inmiddels verwijderde Werelderfgoed-offlinescript.
  Opgelost door `lib/server/sparql-client.ts`'s `fetchSparql` een
  optionele `method: "POST"` te geven (bestaande GET-aanroepers
  ongewijzigd) en alleen deze ene query via POST te sturen.
- **`readCache`/`writeCache`/`cacheStore` uitgetrokken naar
  `lib/server/edge-cache.ts`**, zodat deze route dezelfde `caches.default`-
  laag hergebruikt in plaats van dupliceert (was voorheen lokaal in
  `app/api/rce/search/route.ts`).
- **`fetchSparql` kreeg ook een optionele `timeoutMs`**, want de bestaande
  standaardtimeout (20s) lag te dicht op de gemeten 15,4s van de
  bbox-stap. De bbox-query gebruikt nu 40s, de exacte-overlap-query 30s.

## Vervolg: kaart met polygonen (19 augustus 2026)

Na oplevering van de knop+lijst-versie stelde de eigenaar voor om, ná de
klik, ook een kaart te tonen met het Rijksmonument en de gevonden
Onderzoeksgebieden samen als polygonen - "alsof na de knop een nieuwe
slow-load is met een nieuw kaartblad". Afgestemd in gesprek (niet eerst
gedocumenteerd) voordat er iets gebouwd werd; beslissingen:

1. **Eigen, nieuwe laag** op de bestaande `HeritageMap`, niet de kaart
   bovenaan de detailpagina hergebruiken - die toont alleen het
   Rijksmonument zelf.
2. **Bestaande Doorzoeker-kleuren hergebruiken**, geen nieuwe kleur
   verzinnen: `markerColor()` in `app/HeritageMap.tsx` kreeg een
   `Onderzoeksgebied`-tak (`#6b4226`, bruin) naast de al bestaande vaste
   kleuren per objectsoort.
3. **`forceArea` hergebruiken** (bestond al voor complexleden op hun eigen
   detailkaart) om het Rijksmonument zelf als polygoon te tonen in plaats
   van als punt, zodat de "gebouwd bovenop"-relatie visueel klopt.
4. **`wkt` in de API-respons**, zonder extra round-trip (zie
   "Data-model" hierboven) - de geometrie werd server-side toch al
   opgehaald voor de `geof:sfOverlaps`-toets.
5. **Kaart als aanvulling op de bestaande doorklikbare tekstlijst**, niet
   als vervanging - beide blijven zichtbaar.

Gebouwd: `boundingBoxWktLiteral`/`wktToLatLng` (`lib/rce/geometry.ts`)
hergebruikt om per Onderzoeksgebied een representatief kaartpunt en de
volledige polygoonvorm te leveren; `HeritageDetailDialog.tsx` rendert een
tweede, compacte `HeritageMap` met het Rijksmonument (`forceArea`, blauw)
en elk gevonden Onderzoeksgebied (bruin) als eigen item.

**Bug gevonden tijdens live verificatie: geen crash in de nieuwe code
zelf, maar een ontbrekende defensieve check op data die van buiten komt.**
`ArcheologischeContext.wkt` is een verplicht TS-veld, maar het is data die
over het netwerk binnenkomt (en, zoals hier gebeurde, uit een browser-
cache van vóór dit veld bestond kan stammen - `Cache-Control: max-age=3600`
op deze route betekent dat de browser een oud antwoord tot een uur kan
hergebruiken zonder de server opnieuw te raken). Toen `gebied.wkt`
`undefined` bleek, crashte `wktToLatLng` → `parseWktGeometry` op
`wkt.trim()`. Opgelost met een expliciete guard vóór die aanroep in
`HeritageDetailDialog.tsx` (`if (!gebied.wkt) return [];`) - dezelfde
grenscontrole-discipline als hierboven al gold voor user input, nu ook
toegepast op een eigen API-respons omdat die de grens van het netwerk
oversteekt. Live geverifieerd met een cache-vrije aanroep
(`fetch(url, { cache: "no-store" })`) dat de server zelf altijd een
geldige `wkt` teruggeeft; de guard vangt alleen de theoretische
oud-cache-situatie op.

Live geverifieerd voor Rijksmonument 14948 (Elst): de kaart toont het
Rijksmonument (blauw, als polygoon dankzij `forceArea`) samen met beide
gevonden Onderzoeksgebieden (bruin), naast de al bestaande doorklikbare
tekstlijst. Volledige checksuite (typecheck/lint/229 unit tests/59 e2e-
tests, inclusief twee bijgewerkte/nieuwe e2e-assertions voor de kaart)
groen.

**Tweede bug gevonden, direct na oplevering: de kaart rendert als een
smalle verticale streep.** Live gemeld door de eigenaar met een
screenshot. Oorzaak: de kaart+lijst stonden binnen een `<dt>/<dd>`-veldrij
van de bestaande definitielijst (`.detail-copy dl div`, CSS
`grid-template-columns: 1fr 1.25fr`) - een layout die prima werkt voor
korte tekstwaarden, maar de kaart perste in de 1.25fr-waardekolom in
plaats van de volle dialoogbreedte te geven. Opgelost door de kaart+lijst
te verplaatsen naar een eigen `.map-object-list`-blok ná de `</dl>` -
hetzelfde patroon dat "Literatuur" en "Bouwgeschiedenis" al gebruiken voor
content die niet in een dt/dd-rij past. De knop/waarschuwing/laadstatus
blijven een gewone dt/dd-rij (die tekst past daar prima); alleen het
kaart+lijst-resultaat verhuisde. Live herverifieerd: beide kaarten
(bovenaan en de nieuwe) renderen nu op gelijke breedte (~425×220px),
polygonen en aria-labels ongewijzigd correct.

## Acceptatiecriteria

1. Een knop ("Zoek archeologische context"), alleen zichtbaar bij
   gebouwde Rijksmonumenten, met zichtbare waarschuwing over de verwachte
   wachttijd, triggert pas bij klikken een aanroep.
2. Tijdens het wachten een concrete, geruststellende laadstatus - geen
   kale spinner zonder uitleg.
3. Rijksmonument 14948 (Elst) toont na de klik het overlappende
   Onderzoeksgebied (Gallo-Romeins Tempelcomplex), doorklikbaar.
4. Een tweede bezoek aan hetzelfde Rijksmonument profiteert van caching
   via `caches.default` - niet opnieuw 15+ seconden wachten voor hetzelfde
   antwoord.
5. Een eigen rate limiter (5-10/min per client) voorkomt misbruik van deze
   duurdere route.
6. Typecheck/lint/test blijven groen; unit tests dekken de query-builders
   en parsers met een kleine voorbeeld-respons (net als bij slice 006/
   Werelderfgoed en Gezicht); de gemeten typische duur (beslissing 4) is
   vastgelegd in dit document zodra bekend.

## Klaar wanneer

Gehaald: alle zes beslissingen liggen vast, de knop is gebouwd en live
geverifieerd tegen rijksmonument 14948 (Elst) - beide gevonden
Onderzoeksgebieden (waaronder het Gallo-Romeinse tempelcomplex) tonen
correct en zijn doorklikbaar, met een gemeten koude duur van ~21,5
seconden die de waarschuwingstekst bevestigt.
