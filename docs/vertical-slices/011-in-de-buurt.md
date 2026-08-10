# Verticale slice 011: "In de buurt"-ontdekking

## Status

Plan, nog niet gebouwd. Het voorstel gebruikt pure geografische nabijheid
rond een geopend Rijksmonument, los van complex-
lidmaatschap of enige andere formele relatie.

## Aanleiding

Doorzoeker toont nu alleen relaties die expliciet in de data staan
(complex, archeologisch terrein, Werelderfgoed - zodra taak 006 gebouwd
is). Er is geen manier om te zien wat er simpelweg *dichtbij* een geopend
monument ligt, ook als daar geen enkele formele relatie voor bestaat.

## Empirisch bevestigd (2026-08-10)

1. **GeoSPARQL `geof:distance` werkt** voor punt-tot-punt-afstand (bevestigd
   met een losstaande testquery, meter als eenheid via
   `<http://www.opengis.net/def/uom/OGC/1.0/metre>`).
2. **Een live proefquery die `geof:distance` combineerde met een
   plaatsnaam-gefilterde join (via `heeftBasisregistratieRelatie/
   heeftBAGRelatie/woonplaatsnaam`) gaf onbetrouwbare resultaten**:
   dezelfde rijksmonumentnummers kwamen meermaals terug, vermoedelijk
   doordat een Rijksmonument met meerdere BAG-adressen (zie
   `007-bouwgeschiedenis.md`/de reference-doc: tot 513 adressen op één
   monument) de join vermenigvuldigt. Dit is niet verder uitgezocht of
   `geof:distance` zelf ook problemen geeft bij Polygon-geometrie (in
   plaats van Point) - de aanpak hieronder omzeilt dit probleem bewust in
   plaats van het op te lossen.
3. **Doorzoeker berekent al client-side lat/lng uit WKT** voor elk
   resultaat (`wktToLatLng`/`parseWktGeometry` in `lib/rce.ts`, gebruikt
   voor kaartweergave). Die bestaande logica is een betrouwbaardere basis
   voor een nabijheidsberekening dan een nieuwe, ongeteste
   SPARQL-afstandsfunctie op polygonen.

## Doel

Op de detailpagina van een geopend Rijksmonument een "In de buurt"-lijst
tonen: andere Rijksmonumenten (en optioneel Werelderfgoed/Gezicht) binnen
een vaste straal, gesorteerd op afstand.

## Voorgestelde aanpak

1. **Server-side alleen een goedkope bounding-box-voorfilter**, niet de
   uiteindelijke exacte afstand: bereken een kleine rechthoek (bv. ±0,01
   graad, ruwweg ~1 km) rond de lat/lng van het geopende monument, en
   filter kandidaten met `geof:sfWithin` tegen die rechthoek - zelfde
   bewezen-snelle patroon als `006-werelderfgoed-ligt-in.md` (bbox eerst,
   ~5s in plaats van 14s+ voor een volledige polygoon-vergelijking).
2. **Exacte afstand en sortering client-side**, met de al bestaande
   `wktToLatLng`-parsing en een simpele haversine-berekening in JS - geen
   afhankelijkheid van `geof:distance` op mogelijk problematische
   polygoongeometrie.
3. Nieuwe route `GET /api/rce/in-de-buurt?rmnr=<nummer>`, lazy bevraagd
   zodra de detailpagina opent (zelfde patroon als complexleden/
   onderzoeksgebied-verrijking) - niet vooraf voor de hele resultatenlijst.
4. UI: nieuwe "In de buurt"-sectie in het detailpaneel, met afstand in
   meters/kilometers en een doorklik per item.

## Scope-afbakening

- Alleen Rijksmonument-tot-Rijksmonument in de eerste schijf. Werelderfgoed/
  Gezicht/Complex/Onderzoeksgebied "in de buurt" is een latere uitbreiding.
- Vaste straal (voorstel: 500 meter), geen instelbare afstand in de UI.
- Geen kaartweergave specifiek voor deze lijst in de eerste versie - een
  eenvoudige tekstlijst met afstand volstaat, de bestaande kaartweergave
  toont het geopende monument toch al.
- Geen poging om de eerder gesignaleerde `geof:distance`-onbetrouwbaarheid
  op polygonen alsnog uit te zoeken - de gekozen aanpak (bbox server-side,
  exacte afstand client-side) heeft dat probleem niet nodig om op te
  lossen.

## Openstaande vragen

- Is 500 meter de juiste straal, of te ruim/te krap? Nog niet met
  gebruiker afgestemd - makkelijk aan te passen na een eerste proef.
- Cap op het aantal getoonde resultaten binnen de straal (voorstel: 10,
  dichtstbijzijnde eerst) - dichtbevolkte binnensteden kunnen tientallen
  rijksmonumenten binnen 500 meter hebben.
- Prestatie van de bbox-voorfilter op een willekeurig gekozen monument
  (in plaats van de 18 vaste Werelderfgoed-gebieden) is nog niet gemeten -
  de query-vorm is identiek, dus vermoedelijk vergelijkbaar (~5s), maar
  dit gebeurt hier per detailpagina-opening in plaats van eenmalig
  offline, dus de tijdsdruk is anders.

## Acceptatiecriteria

1. Een geopend Rijksmonument toont een "In de buurt"-sectie met andere
   Rijksmonumenten binnen de gekozen straal, gesorteerd op afstand.
2. Elk item toont de afstand en is doorklikbaar.
3. Geen sectie zichtbaar wanneer er niets binnen de straal ligt.
4. De bestaande zoek-/detailprestaties blijven ongewijzigd (lazy, niet
   vooraf voor de hele resultatenlijst).
5. Typecheck/lint/test blijven groen.

## Klaar wanneer

Een geopend Rijksmonument toont een werkende "In de buurt"-lijst,
gebaseerd op een goedkope server-side bbox-voorfilter en een client-side
exacte afstandsberekening op de al bestaande lat/lng-parsing.
