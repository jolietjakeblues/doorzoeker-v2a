# Verticale slice 017: Archeologische context bij een Rijksmonument (ligt op/overlapt een Onderzoeksgebied)

## Status

Plan, niet gebouwd. Uitgeschreven na een verkenning met de eigenaar
(19 augustus 2026), aanleiding: een concreet voorbeeld uit de RCE's eigen
["Zoeken door de Knowledge Graph"-story](https://linkeddata.cultureelerfgoed.nl/RCE-Knowledge-Graph/-/stories/Zoeken-door-de-Knowledge-Graph).
Nadrukkelijk **niet** bouwen voordat dit document is doorgesproken - de
eigenaar vroeg expliciet om alleen een plan.

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

1. **Een knop op de Rijksmonument-detailpagina**, bv. "Archeologische
   context bekijken" of - voorstel van de eigenaar - "Deep seek" (letterlijk
   bedoeld: dieper/verder zoeken, niet een verwijzing naar het AI-bedrijf
   met dezelfde naam), met een zichtbare waarschuwing dat dit tot enkele
   tientallen seconden kan duren (exacte tekst nog te bepalen, zie
   "Openstaande vragen").
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
   voor dezelfde rijksmonumentnummer betaalt. De app heeft al een
   herbruikbare laag hiervoor: `caches.default` (Cloudflare Workers Cache
   API, `readCache`/`writeCache`/`cacheStore` in
   `app/api/rce/search/route.ts`) plus een in-memory per-isolate `Map` als
   microcache. Voor deze route is een lange `s-maxage` gerechtvaardigd
   (een rijksmonument-locatie en de archeologie eronder veranderen
   vrijwel nooit) - zie "Openstaande vragen" voor de vraag of
   `caches.default` (best-effort, kan verdwijnen) duurzaam genoeg is of dat
   dit een steviger laag verdient.
5. **Eigen, strikte rate limiter** op de nieuwe route (zelfde discipline
   als de andere routes, `createRateLimiter`) - een knop die een dure
   112.000-instanties-scan triggert per klik is een aantrekkelijker
   misbruikvector dan de bestaande lazy-detailroutes.

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

## Data-model (voorstel, nog niet vastgesteld)

```ts
type ArcheologischeContext = {
  onderzoeksgebiedUri: string;
  choNummer: string;
  omschrijving?: string;
};
// GET /api/rce/archeologische-context?rijksmonumentnummer=...
type ArcheologischeContextResponse = { gebieden: ArcheologischeContext[] };
```

Array, niet een los object - een Rijksmonument kan in theorie meerdere
overlappende Onderzoeksgebieden hebben (bij Elst waren dat er al twee van
de vijf kandidaten binnen de bbox).

## Scope-afbakening voor deze slice

- Alleen Rijksmonument → Onderzoeksgebied (niet de omgekeerde richting,
  niet andere objectsoorten).
- Alleen `ArcheologischOnderzoeksgebied`, niet `ArcheologischTerrein` (die
  laatste heeft geen geometrie, zie "Empirisch bevestigd").
- Geen poging om dit automatisch/lazy te laten lopen zoals slice 006 - de
  schaal laat dat niet toe zonder een fundamenteel ander
  precomputatiemodel (zie "Voorgestelde aanpak").
- Geen poging om dit te bouwen vóór dit plan is doorgesproken en akkoord
  is - expliciete opdracht van de eigenaar.

## Openstaande vragen

- **Exacte knoptekst en waarschuwingstekst.** Nog te bepalen samen met de
  eigenaar - de gebruiker moet vooraf weten dat dit kan duren, zonder
  overdreven alarmerend te klinken. "Deep seek" is een leuke, letterlijke
  vondst (diep zoeken), maar botst qua spelling met het bekende
  AI-bedrijf DeepSeek - overwegen of dat verwarrend is voor een bezoeker
  die de naam ergens anders al kent, of dat de context (een knop op een
  erfgoedsite, geen AI-functie) dat voldoende wegneemt.
- **Is `caches.default` duurzaam genoeg, of is een steviger cachelaag
  nodig?** Cloudflare's Cache API is best-effort per edge-node (kan
  verdwijnen bij geheugendruk of tussen deployments); er is nu geen
  KV/D1-binding in dit project. Voor een resultaat dat vrijwel nooit
  verandert en 15+ seconden kost om te berekenen, is de vraag of
  "meestal snel, af en toe opnieuw 15s" acceptabel is, of dat dit een
  duurzamere opslag rechtvaardigt (nieuwe infrastructuurkeuze, buiten de
  huidige architectuur).
- **Kan de bbox-voorfilter zelf sneller, bv. door eerst op
  woonplaats/gemeente te filteren voordat de geometrische toets
  draait?** Niet onderzocht. Zou de 15,4s mogelijk verlagen, maar
  `ArcheologischOnderzoeksgebied` heeft niet per se een makkelijk
  bevraagbaar plaatsnaamveld - moet eerst uitgezocht worden of zo'n
  voorfilter (a) bestaat in de data en (b) daadwerkelijk sneller is dan de
  geometrische bbox-toets zelf.
- **Hoe lang duurt de aanroep werkelijk voor een "gemiddeld" Rijksmonument
  (niet alleen dit ene Elst-voorbeeld)?** Alleen deze ene meting is
  gedaan. Dichtbevolkte gebieden met veel Onderzoeksgebieden in de buurt
  zouden trager kunnen zijn dan een afgelegen locatie.
- **Toon de knop bij elk Rijksmonument, of alleen bij "gebouwd"?** Een
  archeologisch Rijksmonument heeft al zijn eigen terrein-koppeling (zie
  "Aanleiding") - is een extra "ligt dit ook nog ergens anders op
  archeologie"-check daar nuttig, of overbodig/verwarrend naast de
  bestaande relatie?
- **Rate-limit-budget**: hoe streng moet de limiter zijn gezien de
  aanroepkosten (zowel tijd als serverbelasting bij RCE) veel hoger liggen
  dan bij de bestaande lazy-detailroutes?

## Acceptatiecriteria (voorstel, nog niet vastgesteld)

1. Een knop op de Rijksmonument-detailpagina, met zichtbare waarschuwing
   over de verwachte wachttijd, triggert pas bij klikken een aanroep.
2. Tijdens het wachten een concrete, geruststellende laadstatus - geen
   kale spinner zonder uitleg.
3. Rijksmonument 14948 (Elst) toont na de klik het overlappende
   Onderzoeksgebied (Gallo-Romeins Tempelcomplex), doorklikbaar.
4. Een tweede bezoek aan hetzelfde Rijksmonument profiteert van caching -
   niet opnieuw 15+ seconden wachten voor hetzelfde antwoord.
5. Een eigen, strikte rate limiter voorkomt misbruik van deze duurdere
   route.
6. Typecheck/lint/test blijven groen; unit tests dekken de query-builders
   en parsers met een kleine voorbeeld-respons (net als bij slice 006/
   Werelderfgoed en Gezicht).

## Klaar wanneer

Dit plan is doorgesproken met de eigenaar en er is een concreet akkoord
over: de knop-en-waarschuwing-aanpak, de cachestrategie (of het antwoord
op de open vraag daarover), en welke Rijksmonumenten de knop tonen.
**Niet eerder bouwen dan dat akkoord er is.**
