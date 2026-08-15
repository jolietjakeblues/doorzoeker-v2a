# Verticale slice 012: Resultaten exporteren (CSV/GeoJSON)

## Status

Gebouwd (14 augustus 2026), exact volgens het onderstaande plan - geen
wijzigingen aan de aanpak nodig tijdens het bouwen. `lib/export.ts`
(`itemsToCsv`, `itemsToGeoJson`, `exportFileName`), twee exportknoppen in
`app/ResultsToolbar.tsx` naast de weergave-toggle, downloadlogica
(`Blob`+`URL.createObjectURL`) in `app/page.tsx`. De twee "Openstaande
vragen" hieronder zijn tijdens het bouwen beantwoord: bestandsnaam is
`doorzoeker-export-JJJJ-MM-DD.{csv,geojson}`, en de export werkt vanuit
zowel lijst- als kaartweergave zonder extra werk (dezelfde `results`).

**Update (15 augustus 2026, codereview-bevinding):** CSV-formule-injectie
verholpen - een waarde die begint met `=`, `+`, `-` of `@` krijgt nu een
voorloop-apostrof (`neutralizeFormula()` in `lib/export.ts`) zodat
spreadsheetsoftware het niet als formule uitvoert. Zie `docs/te-doen.md`
voor de nog openstaande export-punten (linked-data-identiteit in de
kolommen, geen waarschuwing in het bestand zelf bij een onvolledige
export).

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

## Getest

- `tests/export.test.mjs`: `itemsToCsv` (header, escaping van komma's/
  aanhalingstekens, ontbrekende velden als lege cel), `itemsToGeoJson`
  (Point- en Polygon-omzetting in lng/lat-volgorde, `null`-geometrie
  zonder crash bij ontbrekende WKT), `exportFileName` (voorspelbare
  per-dag bestandsnaam).
- `tests/e2e/rework.spec.ts` ("resultaten zijn te exporteren als CSV en
  GeoJSON (#34)"): klikt beide exportknoppen, leest de daadwerkelijk
  gedownloade bestanden (via Playwright's `download`-event), en
  controleert bestandsnaam, CSV-header/-inhoud en geldige GeoJSON-structuur.
