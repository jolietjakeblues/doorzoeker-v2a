# Verticale slice 006: Ruimtelijke "ligt in"-relatie Rijksmonument ↔ Werelderfgoed

## Status

Plan compleet, nog niet gebouwd. Opgesteld na verkenning
(`docs/reference/rce-linked-data-graphs.md`, "Ruimtelijke 'ligt
in'-relatie") die aantoonde dat er geen gemodelleerde eigenschap bestaat,
maar dat de relatie wel geometrisch te berekenen is - alleen niet live.
Alle drie de eerder openstaande vragen (bbox-optimalisatie, regeneratie-
trigger, overlap tussen gebieden) zijn op 2026-08-10 uitgezocht en
beantwoord, zie "Openstaande vragen" hieronder - inclusief een
implementatie-relevante bijvangst (sommige Werelderfgoed-geometrieën zijn
te groot voor een GET-verzoek, het script moet POST gebruiken).

## Aanleiding

README's "nog niet gebouwd"-lijst noemt expliciet: "ruimtelijke 'ligt
in'-relaties tussen monumenten en gezichten/werelderfgoed". Nu een
Rijksmonument en een Werelderfgoed volledig los van elkaar getoond worden
in Doorzoeker, terwijl bijvoorbeeld elke molen van Kinderdijk zowel een
eigen Rijksmonument-record heeft als onderdeel is van het Werelderfgoed
"Molens bij Kinderdijk-Elshout" - die samenhang is nu onzichtbaar.

## Empirisch bevestigd (2026-08-10)

1. **Geen gemodelleerde eigenschap - exhaustief uitgesloten.**
   `ligtInObject` (domein/bereik: de generieke
   `CultuurhistorischObject`-superklasse) zou in theorie Rijksmonument aan
   Werelderfgoed kunnen koppelen, maar een exacte `COUNT(*)` over de volle
   graaf levert **0** op. Een bredere check op *elke* eigenschap tussen een
   Rijksmonument en een Werelderfgoed-instantie levert ook niets op. Dit
   is geen ontbrekende query - de relatie staat simpelweg niet in de data.
2. **Geometrisch wél mogelijk.** De `rce/cho`-SPARQL-dienst ondersteunt
   GeoSPARQL; `geof:sfWithin(?rmWkt, ?gebiedWkt)` geeft correcte
   resultaten. Tegen de polygoon van Werelderfgoed "Molens bij
   Kinderdijk-Elshout" (werelderfgoednummer 818) kwamen precies de
   verwachte molens en het Wisboomgemaal terug (23 rijksmonumenten),
   geen toevallige of lege set.
3. **Te traag voor een live opzoeking.** Dezelfde `sfWithin`-check zonder
   plaatsnaam-voorfilter over de volle ~62.000 Rijksmonumenten-graaf
   duurde 14,2 seconden voor dat ene Werelderfgoed-doel. Live per
   zoekopdracht of per geopende detailpagina bevragen zou de bestaande
   enrichment-tijdsbudgetten (elke huidige verrijking: 100-400ms) met een
   veelvoud overschrijden.

## Doel

Op de detailpagina van een Rijksmonument dat binnen een Werelderfgoed-
gebied ligt, dat zichtbaar en doorklikbaar maken - zonder de bestaande
zoek- en detailprestaties te raken.

## Waarom offline/eenmalig berekenen, niet live

- Werelderfgoed telt slechts 18 instanties, en dat aantal verandert zeer
  zelden (een nieuwe UNESCO-inschrijving is nieuws, geen dagelijkse
  gebeurtenis). Rijksmonument-geometrie verandert praktisch nooit na
  registratie. De relatie zelf is dus zo goed als statisch.
- Met de bbox-geoptimaliseerde aanpak hieronder (~5-6s per Werelderfgoed
  in plaats van 14,2s) kost het eenmalig berekenen van alle 18 nog altijd
  ruwweg 1,5-2 minuten - volstrekt acceptabel voor een incidenteel,
  buiten-de-request-cyclus proces, onaanvaardbaar binnen een
  gebruikerszoekopdracht.
- Dit is dezelfde afweging als bij de bestaande aggregaat-in-plaats-van-
  lijst-aanpak voor Onderzoeksgebied-verrijking (taak #8): reken het dure
  werk één keer op de juiste plek, serveer daarna alleen het resultaat.

## Voorgestelde eerste verticale schijf

1. **Offline regeneratiescript** (Node, buiten de request-cyclus, bv.
   `scripts/generate-werelderfgoed-relaties.mjs`, gestart via een
   `npm run`-commando, niet vanuit CI). Per Werelderfgoed-instantie **twee
   losse SPARQL-aanroepen na elkaar** (geverifieerd 2026-08-10, zie
   "Openstaande vragen" hieronder voor de volledige meting):
   1. een goedkope query met een numerieke bounding-box-rechthoek
      (afgeleid uit de min/max lng/lat van de Werelderfgoed-WKT) als
      `geof:sfWithin`-filter over alle Rijksmonumenten met geometrie -
      levert een ruwe kandidatenlijst op (bv. 37 voor Kinderdijk);
   2. een tweede query, met die kandidaten in een `VALUES`-clausule, die
      de exacte (dure) polygoon-`geof:sfWithin`-check alleen op die kleine
      kandidatenset uitvoert.

   **Niet** als één samengevoegde SPARQL-query met een geneste subquery -
   dat bleek in de praktijk juist trager (de query-planner voert dan
   kennelijk geen filter-pushdown uit), dus het moet twee aparte
   round-trips vanuit het script zijn, geen SPARQL-side optimalisatie.

   **Belangrijk, ook gevonden tijdens verificatie**: de WKT van sommige
   Werelderfgoed-instanties is enorm (Waddenzee: ruim 200.000 tekens) en
   past niet in een GET-verzoek - dat gaf `414 Request-URI Too Large` of
   een verbroken verbinding. Het regeneratiescript moet de SPARQL-query's
   dus met **HTTP POST** versturen (querytekst in de request-body), niet
   als GET-querystring zoals de rest van de app nu overal doet - dit is
   alleen relevant voor dit offline script, de bestaande live
   `fetchSparql`-aanpak in `sparql-client.ts` hoeft niet te veranderen.
2. **Statisch outputbestand**, gecommit in de repo (bv.
   `data/werelderfgoed-rijksmonumenten.json`), met het datamodel hieronder.
   Geen database, geen build-time SPARQL-aanroep - gewoon een bestand dat
   met de app wordt meegeleverd en handmatig opnieuw gegenereerd wordt
   zodra daar aanleiding toe is (zie "Openstaande vragen").
3. **Runtime**: het JSON-bestand rechtstreeks importeren (klein, geen
   live kostenplaatje) en `RceMonument`/`Item` een
   `ligtInWerelderfgoed?: WerelderfgoedLidmaatschap[]`-veld geven, gevuld
   op basis van een lookup op `monumentNumber` - geen SPARQL-aanroep
   nodig, dus geen nieuwe `enrich.*`-fase in `rce-adapter.ts`.
4. **UI**: nieuwe detailrij "Onderdeel van Werelderfgoed", zelfde plek en
   stijl als de bestaande "Onderdeel van complex"-rij. Doorklikbaar via
   `executeSearch(naam)` (Werelderfgoed-namen zijn uniek en herkenbaar
   genoeg om rechtstreeks op te zoeken, zelfde soort doorklik als de
   complexledenlijst gebruikt).
5. **Tests**: het lookup-mechanisme (statisch bestand → veld op Item) unit
   testen met een kleine, ingebakken voorbeeld-JSON, niet de live
   SPARQL-query van het regeneratiescript zelf (dat is een offline
   hulpmiddel, geen onderdeel van de request-cyclus en dus buiten de
   normale testsuite - eventueel wel handmatig te verifiëren tegen het
   Kinderdijk-testgeval na het draaien).

## Scope-afbakening voor deze slice

- Alleen Werelderfgoed (18, stabiel). Geen Gezicht (472 instanties) in
  deze eerste schijf - brute-force zou onwerkbaar lang duren en een
  bounding-box-voorfilter is niet onderzocht. Apart op te pakken zodra
  deze aanpak zich bewezen heeft.
- Alleen de richting Rijksmonument → Werelderfgoed (detailrij op het
  Rijksmonument). Het omgekeerde (Werelderfgoed's eigen detailpagina toont
  zijn leden) is een mogelijke latere uitbreiding - het datamodel laat dit
  toe, maar het wordt in deze schijf niet gebouwd.
- Geen automatische regeneratie in CI/build. Handmatig proces, met een
  duidelijke, gedocumenteerde trigger.
- Geen poging om de nauwkeurigheid van puntgeometrie-op-de-grens
  systematisch te toetsen (zie "Openstaande vragen") - de Kinderdijk-
  steekproef gaf geen aanleiding tot twijfel, maar is geen uitputtende
  toets.

## Data-model

```ts
type WerelderfgoedLidmaatschap = { werelderfgoednummer: string; naam: string };
// data/werelderfgoed-rijksmonumenten.json:
type WerelderfgoedRelaties = Record<string /* rijksmonumentnummer */, WerelderfgoedLidmaatschap[]>;
```

Een array per rijksmonumentnummer, niet een los object, voor het geval een
Rijksmonument (in theorie, nog niet empirisch tegengekomen) binnen meer
dan één Werelderfgoed-gebied zou vallen.

## Openstaande vragen (uitgezocht, 2026-08-10)

- **Verlaagt een bounding-box-voorfilter de 14,2s significant? Ja,
  bevestigd.** Drie varianten rechtstreeks tegen elkaar afgezet op het
  Kinderdijk-testgeval:
  - alleen de volledige polygoon als filter: 14,2s (23 exacte treffers);
  - alleen een goedkope bbox-rechthoek als filter: 5,1s, maar met 38
    kandidaten - een bbox is een overschatting (vals-positieven bij de
    hoeken van de rechthoek), dus niet precies genoeg om als eindresultaat
    te gebruiken;
  - **bbox eerst, dan de exacte polygoon-check alleen op die kandidaten
    (twee losse round-trips): 5,1s + 0,6s ≈ 5,7s totaal, en wél de
    correcte 23 treffers.** (Een tweede, geautomatiseerde meting met een
    programmatisch - in plaats van handmatig - berekende bbox gaf 22 in
    plaats van 23; nog niet verklaard, waarschijnlijk een detail in hoe de
    bbox exact wordt afgeleid uit de WKT-coördinaten. Bij implementatie
    verdient dit een gerichte check, al verandert het de conclusie over de
    aanpak zelf niet.) Dit is de aanpak die in stap 1 hierboven is
    opgenomen. Een variant met beide filters in één samengevoegde
    SPARQL-query (subquery) bleek juist trager (21,2s) dan beide losse
    varianten apart - de query-planner voert kennelijk geen
    filter-pushdown uit, dus dit moet als twee aparte HTTP-aanroepen vanuit
    het script, niet als één geneste query.
  - Bijvangst: sommige Werelderfgoed-geometrieën zijn te groot voor een
    GET-verzoek (Waddenzee: >200.000 tekens WKT, gaf `414 Request-URI Too
    Large`) - het script moet POST gebruiken, zie stap 1.
- **Regeneratietrigger: `jaarVanInschrijving` is bruikbaar en al
  queryable.** Dit veld zit al in de Werelderfgoed-verrijking
  (`buildWerelderfgoedQuery`) maar leeft in de aparte
  `werelderfgoed_hvdl`-graph, niet in `instanties-rce` zelf. Huidige
  waarden, live opgehaald: 18 Werelderfgoed-instanties in totaal, hoogste
  `jaarVanInschrijving` = 2023. Voorstel: het regeneratiescript slaat bij
  elke run het aantal instanties en het hoogste jaartal op; een simpel
  controlescript (of gewoon het regeneratiescript zelf, elke keer opnieuw
  gedraaid) kan die twee waarden vergelijken met de vorige run en alleen
  dan melden dat regeneratie nodig is. Concreter en beter automatiseerbaar
  dan "let op UNESCO-nieuws".
- **Overlap tussen Werelderfgoed-gebieden: geen gevonden, maar niet
  volledig getoetst.** Van de 18 Werelderfgoed-instanties konden er 6
  succesvol getest worden (Schokland: 10, Kinderdijk: 22, Rietveld
  Schröderhuis: 1, Eisinga Planetarium: 0, plus 2 andere kleine gevallen) -
  daaronder **geen enkel Rijksmonument dat bij meer dan één Werelderfgoed
  hoort**. De overige 6 grote/complexe gebieden (Waddenzee, Hollandse
  Waterlinies, Neder-Germaanse Limes, 17e eeuwse Grachtengordel,
  Droogmakerij De Beemster, Koloniën van Weldadigheid) faalden op de
  hierboven genoemde GET/URL-lengte-beperking en zijn dus nog niet
  getoetst - met de POST-aanpassing uit stap 1 zou dit alsnog moeten
  lukken. **Het array-per-rijksmonumentnummer datamodel blijft staan als
  voorzorg**, ook al is overlap tot nu toe nergens aangetroffen.
- Nauwkeurigheid bij Rijksmonumenten met alleen een Point-geometrie (de
  meerderheid) vlak op de rand van een Werelderfgoed-polygoon blijft een
  theoretisch randgeval - niet tegengekomen in de geteste gevallen, maar
  ook niet systematisch getoetst.

## Acceptatiecriteria

1. Het regeneratiescript bestaat, is minstens één keer succesvol
   uitgevoerd, en het resultaat is geverifieerd tegen het
   Kinderdijk-testgeval (23 rijksmonumenten, inclusief de bekende
   molen-reeks en het Wisboomgemaal).
2. Een Rijksmonument dat in het gegenereerde bestand voorkomt toont een
   "Onderdeel van Werelderfgoed"-rij op de detailpagina, met naam en
   doorklikmogelijkheid naar dat Werelderfgoed.
3. Rijksmonumenten die nergens in voorkomen tonen geen lege rij (zelfde
   patroon als de andere optionele detailrijen).
4. Geen enkele live SPARQL-aanroep naar de dure geometrische berekening
   tijdens een gewone zoekopdracht of detailweergave - het statische
   bestand wordt gewoon met de build meegeleverd.
5. Typecheck/lint/test blijven groen; een test dekt de lookup-logica met
   een kleine voorbeeld-dataset.

## Klaar wanneer

Het regeneratiescript bestaat en is succesvol gedraaid (het meegeleverde
databestand is dus echte data, geen placeholder), en een Rijksmonument met
een bekende Werelderfgoed-lidmaatschap (bv. een Kinderdijk-molen) toont
dit zichtbaar en doorklikbaar op de detailpagina.
