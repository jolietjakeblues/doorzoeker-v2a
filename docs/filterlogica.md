# Filterlogica

Beschrijvend document, geen besluit. Vastgelegd als voorbereiding op een
gesprek over de filterlogica. Legt vast hoe het nu werkt, niet hoe het zou
moeten werken.

## Twee lagen die "filteren" heten

Doorzoeker filtert op twee plekken, met verschillende aard:

1. **Server-side, vóór resultaten binnenkomen**: de zoekroute
   (`/api/rce/search`) beperkt zélf al welke objectsoorten bevraagd worden,
   via `scope` (`core`, `heritage`, `archaeology-a`, `archaeology-b`) en via
   exacte conceptzoekopdrachten (`?concept=...&veld=...`). Dit bepaalt wélke
   records er ooit in de browser terechtkomen.
2. **Client-side, ná ontvangst**: `hooks/useFilteredResults.ts` filtert de
   al opgehaalde `baseResults` verder op basis van de UI-filters (Soort
   object, Monumentaard, Provincie, Gemeente, Functie, Gevonden via,
   Objectsoort uitsluiten, Historische aanleg, MSP). Dit bepaalt wat er
   daadwerkelijk zichtbaar wordt van wat al binnen is.

Deze twee lagen hebben geen weet van elkaar. Laag 2 kan nooit iets tonen dat
laag 1 niet heeft opgehaald.

## Wat elk client-side filter precies doet

`matchesFilters()` in `hooks/useFilteredResults.ts` is een AND van losse
voorwaarden:

| Filter | Matcht op |
| --- | --- |
| Soort object | exact `item.objectType` |
| Monumentaard | exact `item.monumentAard` |
| Provincie | exact `item.province` |
| Gemeente | exact `item.municipality` |
| Functie | `filters.functionFilter` moet voorkomen in `[item.kind, ...originalFunctionNames, ...currentFunctionNames]` — **tekstlabel**, geen concept-URI |
| Gevonden via (matchbron) | exact `item.matchSource` |
| Objectsoort uitsluiten | `statusLabel(item.objectType)` mag niet in `excludedCategories` staan (dit is een uitsluitlijst, geen insluitlijst). **Hernoemd 21-08-2026** (was "Juridische status", terecht gemeld door de eigenaar als misleidend): `statusLabel()` geeft een preciezere objectsoort-naam, geen echte RCE-juridische-status (die kent maar drie waarden: rijksmonument, voorbeschermd, geen rijksmonument - en wordt nergens in dit filter getoond) |
| Historische aanleg | alleen als `onlyGroenaanleg` aan staat: `item.groenaanleg` moet waar zijn |
| MSP | alleen als `onlyMsp` aan staat: `item.msp === true` |

Functie is het enige filter dat op tekst matcht in plaats van op een exacte
waarde — zie "Openstaande vragen".

## Hoe de aantallen achter elk filter worden berekend

Dit is de plek waar het non-triviaal wordt: **niet elk aantal gaat over
dezelfde deelverzameling.**

- **Soort object** en **Objectsoort uitsluiten**: geteld over `baseResults`
  (alles wat is opgehaald), **zonder rekening te houden met enig ander
  actief filter**. Het aantal naast "Rijksmonument" verandert dus niet als
  je ook op Provincie filtert.
- **Provincie, Gemeente, Functie, Gevonden via**: geteld over
  `objectTypeResults` (`baseResults` gefilterd op de Soort-object-radio,
  maar op verder niets) — dus wél gevoelig voor de Soort-object-keuze, maar
  niet voor bijvoorbeeld een actief Functie- of Provincie-filter
  onderling.
- **Gemeente** telt bovendien alleen binnen de gekozen Provincie (dat filter
  telt dus wél mee voor zijn eigen "kind"-facet, Gemeente).
- **Historische aanleg** en **MSP**: geteld via `matchesFilters(item, "groenaanleg" | "msp")`
  — dat is `baseResults` met alle filters toegepast **behalve** het eigen
  filter (groenaanleg negeert het groenaanleg-filter bij het tellen, MSP
  negeert het MSP-filter). Dit zijn dus wél "aantal als je dit filter zou
  aanzetten, gegeven de rest"-tellingen.

Kort gezegd: elk filter telt zijn eigen opties over een net iets andere
deelverzameling. Er is geen enkel filter dat consistent "aantal resultaten
als je dit + alle andere actieve filters toepast" laat zien.

## Bekende beperking (al vastgelegd als TD-06)

Alle aantallen hierboven gaan over `baseResults` — de records die al zijn
opgehaald voor de huidige zoekopdracht/pagina, niet over de volledige
matchset op de RCE-bron. De UI zegt dit ook expliciet ("De aantallen
hieronder gaan over de resultaten die nu zijn geladen."), maar het blijft
een makkelijk te missen aanname.

## Openstaande vragen (niet beantwoord, alleen genoteerd)

- Moet Functie overstappen op exacte concept-URI-matching (zoals
  Monumentaard dat al doet via `functionConcepts`) in plaats van
  tekstlabel-matching? Dat zou consistent zijn met hoe elders in de app al
  gedacht wordt over "label is presentatie, URI is identiteit", maar een
  functielabel kan naar meerdere concepten wijzen (zie
  `primaryFunctionConcept()`), dus niet triviaal 1-op-1.
- Moeten facet-aantallen consistent één deelverzameling gebruiken (bv.
  altijd "alle andere actieve filters toegepast, dit filter genegeerd"),
  in plaats van de huidige mix van "baseResults zonder filters" en
  "objectTypeResults met alleen Soort-object toegepast"?
- Moeten facet-aantallen ooit over de volledige matchset gaan in plaats
  van alleen geladen resultaten (TD-06), en zo ja: client-side onmogelijk
  zonder server-side aggregatie?
