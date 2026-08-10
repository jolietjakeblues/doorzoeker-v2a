# Verticale slice 012: Resultaten exporteren (CSV/GeoJSON)

## Status

Plan, nog niet gebouwd. Out-of-the-box idee van de gebruiker: voor de
daadwerkelijke gebruikersgroep (onderzoekers, lokale historici) is "neem
mijn gefilterde zoekresultaat mee" waarschijnlijk waardevoller dan nog een
UI-feature - dit is een pure frontend-functie, geen nieuwe databron nodig.

## Aanleiding

Alle huidige (gefilterde) resultaten staan al client-side in het
geheugen (`useSearchState`'s `results`). Er is geen manier om dat resultaat
mee te nemen buiten de browser om (bv. voor een spreadsheet-analyse of
importeren in QGIS).

## Doel

Een knop "Exporteer resultaten" die de huidige, gefilterde resultatenlijst
downloadt als CSV (tabulaire velden) of GeoJSON (voor wie de geometrie
wil, bv. in QGIS/kaartsoftware).

## Voorgestelde aanpak

1. Twee kleine, pure functies in een nieuw `lib/export.ts`:
   `itemsToCsv(items: Item[])` en `itemsToGeoJson(items: Item[])` - geen
   serveraanroep nodig, de data staat al client-side.
2. CSV-kolommen: monumentnummer, titel, adres, postcode, plaats,
   provincie, soort object, monumentaard, functie, registratiedatum,
   matchbron. Waarden met komma's/aanhalingstekens correct escapen
   (RFC 4180-stijl).
3. GeoJSON: een `FeatureCollection`, geometrie afgeleid uit `item.wkt`
   (hergebruik van de bestaande `parseWktGeometry`, nu ook in de
   omgekeerde richting - van het al geparste `WktGeometry`-type naar een
   GeoJSON-geometrieobject), properties met dezelfde velden als de
   CSV-kolommen.
4. UI: knop naast de bestaande weergave-toggle (lijst/kaart) in de
   toolbar, met een kleine keuze CSV/GeoJSON (bv. twee losse
   knoppen of een dropdown). Download via een `Blob`+`URL.createObjectURL`
   in de browser, geen serverroute nodig.
5. Tests: unit tests voor `itemsToCsv`/`itemsToGeoJson` (escaping,
   ontbrekende velden, geometrie-omzetting) - geen live/route-tests nodig
   aangezien er geen serveraanroep bij komt kijken.

## Scope-afbakening

- Exporteert alleen wat al geladen is (de huidige pagina/gefilterde set),
  niet een export van de volledige onderliggende RCE-dataset - dat zou
  een aparte, veel grotere server-side exportfunctie vereisen.
- Geen configureerbare kolomselectie in de eerste versie - een vaste,
  zinvolle kolomset.
- Geen Excel-specifiek formaat (.xlsx) - platte CSV is voldoende en
  simpeler, en opent net zo goed in Excel.

## Openstaande vragen

- Bestandsnaam-conventie voor de download (bv.
  `doorzoeker-export-2026-08-10.csv`) - klein detail, makkelijk te
  kiezen tijdens de bouw.
- Moet de export ook werken vanuit de kaartweergave (dezelfde
  onderliggende `results`, dus in principe ja zonder extra werk) - te
  bevestigen tijdens het bouwen.

## Acceptatiecriteria

1. Een knop in de toolbar exporteert de huidige, gefilterde
   resultatenlijst als CSV met de afgesproken kolommen.
2. Dezelfde knop (of een tweede) exporteert als GeoJSON met correcte
   geometrie voor resultaten die geometrie hebben.
3. Resultaten zonder geometrie krijgen in de GeoJSON-export een `null`-
   geometrie, geen crash.
4. Typecheck/lint/test blijven groen.

## Klaar wanneer

De toolbar heeft een werkende exportknop die de huidige resultatenlijst
als geldig CSV- en GeoJSON-bestand downloadt, zonder nieuwe serveraanroep.
