# Verticale slice 006: Ruimtelijke "ligt in"-relatie Rijksmonument ↔ Werelderfgoed/Gezicht

## Status

Gebouwd (2026-08-18), als live, lazy per-Rijksmonument SPARQL-check - niet
als het offline-precomputatiescript dat hieronder oorspronkelijk was
uitgewerkt en ook eerst gebouwd is (zie "Hoe dit plan is bijgesteld"). Dekt
zowel Werelderfgoed als Gezicht, dus breder dan het oorspronkelijke plan.

## Aanleiding

README's "nog niet gebouwd"-lijst noemt expliciet: "ruimtelijke 'ligt
in'-relaties tussen monumenten en gezichten/werelderfgoed". Nu een
Rijksmonument en een Werelderfgoed volledig los van elkaar getoond worden
in Doorzoeker, terwijl bijvoorbeeld elke molen van Kinderdijk zowel een
eigen Rijksmonument-record heeft als onderdeel is van het Werelderfgoed
"Molens bij Kinderdijk-Elshout" - die samenhang is nu onzichtbaar.

## Empirisch bevestigd (2026-08-10, hertoetst 2026-08-18)

1. **Geen gemodelleerde eigenschap - exhaustief uitgesloten.**
   `ligtInObject` (domein/bereik: de generieke
   `CultuurhistorischObject`-superklasse) zou in theorie Rijksmonument aan
   Werelderfgoed of Gezicht kunnen koppelen, maar een exacte `COUNT(*)`
   over de volle graaf levert **0** op. Een bredere check op *elke*
   eigenschap tussen een Rijksmonument en een Werelderfgoed-instantie
   levert ook niets op. Dit is geen ontbrekende query - de relatie staat
   simpelweg niet in de data.
2. **Geometrisch wél mogelijk.** De `rce/cho`-SPARQL-dienst ondersteunt
   GeoSPARQL; `geof:sfWithin(?rmWkt, ?gebiedWkt)` geeft correcte
   resultaten in beide richtingen (zie punt 3).
3. **De richting van de query bepaalt of het snel genoeg is voor live
   gebruik - een cruciaal inzicht dat het oorspronkelijke plan miste.**
   - Eén Werelderfgoed-gebied tegen **alle** ~62.000 Rijksmonumenten
     (`?rm ?gebied` als vaste waarde, `?rm` los): 14,2 seconden. Veel te
     traag voor live gebruik in welke vorm dan ook.
   - Eén Rijksmonument tegen de kleine, vaste kandidatenset (18
     Werelderfgoed, 472 rijksbeschermde Gezichten; `?rm` als vaste waarde,
     het gebied los): **~0,3-0,7 seconden**, empirisch herhaald gemeten.
     Dat past ruim binnen het bestaande budget voor een lazy, per-geopend-
     detail-aanvraag (dezelfde soort aanroep als complexleden of
     vergelijkbare rijksmonumenten - zie `hooks/useSelectedDetailEnrichment.ts`).
   - **Batchen van die tweede vorm schaalt niet lineair-goedkoop.** Alle 25
     geladen zoekresultaten in één `VALUES`-query tegelijk tegen Gezicht +
     Werelderfgoed toetsen kostte **9,7 seconden** - ver boven het budget
     van de bestaande batch-enrichments (elke huidige verrijking:
     100-400ms). Vandaar dat dit *niet* als achtste `enrich.*`-fase in
     `rce-adapter.ts` gedaan wordt, maar puur lazy per geopend
     Rijksmonument.
   - **Een combinerende `UNION`-query (Gezicht + Werelderfgoed in één
     aanroep) faalt stil op dit endpoint.** Empirisch getest: twee losse,
     los prima werkende `geof:sfWithin`-patronen samengevoegd met `UNION`
     - zelfs met volledig losse variabelenamen per tak, dus geen
     bindingsconflict - gaven een lege resultatenset terug. Vermoedelijk
     een eigenaardigheid in hoe deze SPARQL-service de custom GeoSPARQL-
     functie binnen een `UNION`-tak evalueert, geen fout in de query zelf.
     Daarom: twee losse aanroepen (Gezicht, Werelderfgoed), parallel via
     `Promise.all`, zie `lib/server/rce-adapter.ts`'s `fetchLigtIn`.

## Hoe dit plan is bijgesteld

Het oorspronkelijk uitgewerkte plan (zie git-historie van dit bestand) ging
uit van een offline regeneratiescript: bereken alle Rijksmonument↔
Werelderfgoed-relaties één keer, schrijf ze naar een statisch, gecommit
JSON-bestand, importeer dat bestand runtime. Dat plan is voor Werelderfgoed
ook daadwerkelijk gebouwd (`scripts/generate-werelderfgoed-relaties.mjs`,
10.933 gevonden relaties) en werkte technisch - maar bracht drie
problemen aan het licht die zwaarder wogen dan de winst:

1. **Staleness zonder goede trigger.** De enige praktische
   regeneratietrigger (nieuwe Werelderfgoed-instantie of gewijzigd
   `jaarVanInschrijving`) signaleert niets als de RCE een *nieuw
   rijksmonument binnen een bestaand Werelderfgoed-gebied* aanwijst - het
   meest voorkomende soort wijziging. Het statische bestand zou dus
   stilzwijgend verouderen zonder dat iets dat meldt.
2. **Het bestand (~1,4MB) lekte per ongeluk naar de clientbundel** doordat
   de lookup in `heritage-view-model.ts`'s `toItem()` zat, die ook
   client-side draait (bv. `hooks/useVerrasMe.ts`). Wel te repareren door
   de lookup naar de server-only enrichmentpipeline te verplaatsen, maar
   het liet zien hoe makkelijk zoiets misgaat.
3. **De aanname "Rijksmonument tegen alle Werelderfgoed tegelijk is te
   traag, dus moet offline" bleek onvolledig.** Die aanname klopt voor de
   richting die het plan toetste (één Werelderfgoed tegen alle
   Rijksmonumenten), maar niet voor de *andere* richting (één
   Rijksmonument tegen alle Werelderfgoed/Gezicht) - en dat is precies de
   richting die de UI nodig heeft (één geopend detail, niet een hele
   resultatenlijst). Die richting is ruim snel genoeg voor een gewone
   lazy live-aanroep, zoals hierboven bij "Empirisch bevestigd" staat.

Op basis daarvan is het hele offline-traject (script, statisch bestand,
batch-enrichment) verwijderd en vervangen door de live, lazy aanpak
hieronder. Bijkomend voordeel: Gezicht kon zo vrijwel gratis mee, wat in
het oorspronkelijke plan nog expliciet buiten scope was gehouden vanwege
een aanname over kosten die dus niet meer klopte voor deze aanpak.

## Doel

Op de detailpagina van een Rijksmonument dat binnen een Werelderfgoed- of
Gezicht-gebied ligt, dat zichtbaar en doorklikbaar maken - zonder de
bestaande zoek- en detailprestaties te raken.

## Gebouwde aanpak

1. **Twee query-builders** in `lib/rce/monuments.ts`:
   `buildGezichtLidmaatschapQuery(monumentNumber)` en
   `buildWerelderfgoedLidmaatschapQuery(monumentNumber)`. Elk fixeert het
   rijksmonumentnummer als stringliteral (geëscaped via
   `escapeSparqlString`, en op API-niveau al gevalideerd tegen een strikt
   numeriek patroon) en toetst `geof:sfWithin` tegen de kleine, vaste
   kandidatenset van het betreffende type. Geen bounding-box-voorfilter
   nodig - de kandidatenset is al klein genoeg zonder.
2. **`fetchLigtIn(monumentNumber, signal)`** in `lib/server/rce-adapter.ts`
   draait beide queries parallel via `Promise.all` en retourneert
   `{ gezicht: GezichtLidmaatschap[], werelderfgoed: WerelderfgoedLidmaatschap[] }`.
3. **`/api/rce/ligt-in`** (nieuwe route): valideert het rijksmonumentnummer
   tegen `/^\d{1,6}$/`, rate-limit (zelfde discipline als de andere
   lazy-detail-routes: elke aanroep triggert live SPARQL-verkeer richting
   RCE), roept `fetchLigtIn` aan.
4. **`hooks/useSelectedDetailEnrichment.ts`**: nieuwe `ligtIn`-state,
   opgehaald zodra een gebruiker een Rijksmonument-detail opent - exact
   hetzelfde lazy-patroon als complexleden en vergelijkbare
   rijksmonumenten, niet vooraf voor de hele resultatenlijst.
5. **UI** (`app/HeritageDetailDialog.tsx`): twee nieuwe detailrijen,
   "Onderdeel van Werelderfgoed" en "Ligt in Rijksbeschermd gezicht",
   zelfde plek en stijl als de bestaande "Onderdeel van complex"-rij.
   Doorklikbaar via `onSearch(naam)` (namen zijn uniek en herkenbaar
   genoeg om rechtstreeks op te zoeken, zelfde soort doorklik als de
   complexledenlijst gebruikt).

## Scope-afbakening voor deze slice

- Beide richtingen van het "gebied" - Werelderfgoed én Gezicht - zitten
  erin (in tegenstelling tot het oorspronkelijke plan, dat alleen
  Werelderfgoed deed).
- Alleen de richting Rijksmonument → gebied (detailrij op het
  Rijksmonument). Het omgekeerde (een Werelderfgoed- of Gezicht-detail
  toont zijn leden) is een mogelijke latere uitbreiding, niet in deze
  schijf gebouwd.
- Geen poging om de nauwkeurigheid van puntgeometrie-op-de-grens
  systematisch te toetsen - de Kinderdijk-steekproef gaf geen aanleiding
  tot twijfel, maar is geen uitputtende toets.

## Data-model

```ts
type GezichtLidmaatschap = { gezichtsnummer: string; naam: string };
type WerelderfgoedLidmaatschap = { werelderfgoednummer: string; naam: string };
// GET /api/rce/ligt-in?rijksmonumentnummer=...
type LigtInResponse = { gezicht: GezichtLidmaatschap[]; werelderfgoed: WerelderfgoedLidmaatschap[] };
```

Arrays, niet losse objecten: een Rijksmonument zou in theorie (nog niet
empirisch tegengekomen) binnen meer dan één gebied van hetzelfde type
kunnen vallen.

## Openstaande vragen

- **Betrouwbaarheid van de live aanroep bij een trage of onbereikbare RCE-
  dienst.** De route gebruikt dezelfde foutafhandeling
  (`withRceErrorHandling`) en dezelfde rate-limiter-discipline als de
  overige lazy-detail-routes; de UI toont een nette foutmelding via het
  bestaande `error: true`-patroon in plaats van stil niets te tonen. Niet
  apart belast-getest.
- Nauwkeurigheid bij Rijksmonumenten met alleen een Point-geometrie (de
  meerderheid) vlak op de rand van een Werelderfgoed- of Gezicht-polygoon
  blijft een theoretisch randgeval - niet tegengekomen in de geteste
  gevallen, maar ook niet systematisch getoetst.

## Acceptatiecriteria

1. Een Rijksmonument dat binnen een Werelderfgoed- en/of Gezicht-gebied
   ligt (geverifieerd tegen het Kinderdijk-testgeval: Wisboomgemaal, RM
   516161, valt zowel binnen Werelderfgoed 818 "Molens bij
   Kinderdijk-Elshout" als Gezicht 1489 "Kinderdijk - Elshout") toont dit
   bij het openen van het detail, met naam en doorklikmogelijkheid.
2. Rijksmonumenten zonder zo'n relatie tonen geen lege rij (zelfde patroon
   als de andere optionele detailrijen).
3. Geen live SPARQL-aanroep naar deze check tijdens een gewone
   zoekopdracht - alleen bij het daadwerkelijk openen van een
   Rijksmonument-detail.
4. Typecheck/lint/test blijven groen; unit tests dekken de query-builders
   en parsers met een kleine, ingebakken voorbeeld-respons.

## Klaar wanneer

Een geopend Rijksmonument met een bekende Werelderfgoed- en/of
Gezicht-lidmaatschap (bv. de Kinderdijk-molens of het Wisboomgemaal) toont
dit zichtbaar en doorklikbaar op de detailpagina, live opgehaald zonder
vertraging van de zoekresultatenlijst zelf.
