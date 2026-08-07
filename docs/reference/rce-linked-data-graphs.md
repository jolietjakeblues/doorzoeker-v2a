# RCE Linked Data: verkende graphs

Naast `graph/instanties-rce` (de graph die Doorzoeker als primaire bron
gebruikt) bestaan er op
`https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql` meer named
graphs met relevante data. Onderzocht op 2026-08-07.

## `graph/image-1` (en `graph/image`) — beeldbank/foto's

**Geïntegreerd (2026-08-07).** ~91.834 `edm:ProvidedCHO`-records, gekoppeld aan
Rijksmonumenten via `edm:aggregatedCHO`. Per afbeelding:

- `foaf:depiction` — kant-en-klare thumbnail-URL (`images.memorix.nl/rce/thumb/640x480/{id}.jpg`)
- `dc:title` / `dc:description` — titel en beschrijving
- `dc:rights` — licentie-URI (Creative Commons), nodig voor correcte bronvermelding
- `edm:isShownAt` — link naar de RCE Beeldbank- of Wikimedia Commons-detailpagina
- `ceo:rijksmonumentnummer` — join-sleutel, direct bruikbaar

Gebouwd als verrijking (`lib/rce.ts`: `buildImageQuery`/`parseImageResults`) op
bestaande resultaten, niet als aparte doorzoekbare collectie — dat blijft
buiten scope, zie de "Niet in scope"-lijst in
[`001-rijksmonumenten.md`](../vertical-slices/001-rijksmonumenten.md). De
kaarttegel en detailpagina tonen de foto als achtergrond met een letter-badge
erover (M/A/W/G/C) en verplichte licentie-/bronvermelding.

## `graph/groenaanleg` — historische tuinen en parken

**Geïntegreerd (2026-08-07).** 1.403 Rijksmonumenten met tuin-/parkaanleg-
specifieke data:

- `heeftAanlegGeometrie` — een *aparte* geometrie voor de aanleg, los van de
  geometrie van het gebouw zelf (nog niet gebruikt — Doorzoeker toont alleen
  `heeftTypeAanleg`/`heeftCategorieGroenaanleg` als tekst, geen aparte kaartlaag)
- `heeftCategorieGroenaanleg` / `heeftCategorieGroenaanlegLegenda` — classificatie
- `heeftTypeAanleg` — type aanleg
- eigen thesaurus van 87 termen
- ook `foaf:depiction` (afbeelding) en `isOnderdeelVanComplex`

Overlapt met de bestaande Complex-feature: bijvoorbeeld rijksmonument/65314
("Rijnoord") is zowel complex-onderdeel als groenaanleg-record — live geverifieerd
op de detailpagina. Gebouwd als verrijking op de bestaande Rijksmonument-
detailweergave (`buildGroenaanlegQuery`/`parseGroenaanlegResults` in
`lib/rce.ts`), niet als apart "soort object".

## `graph/msp_indicatie` — betekenis onbekend

Eén boolean `ceo:msp_indicatie` op 13.988 Rijksmonumenten (gekoppeld via
`rijksmonumentnummer`). Niet gedocumenteerd in de CEO-ontologie; elke
steekproefwaarde was `true` (geen `false` gezien). **Eerst uitzoeken wat MSP
betekent voordat hier iets mee gebouwd wordt** — niet gokken.

## `rce/bibliotheek` — apart SPARQL-dataset

`https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/bibliotheek/sparql`
is geen graph binnen `rce/cho`, maar een volledig los dataset. Globale
klassentelling: 233.835 `schema:Person`, 87.955 `schema:Organization`,
`Source`/`SourceHolder`-klassen, ABR/artefact-classificatieconcepten. Lijkt
een autoriteitenbestand (wie meldde een vondst, welk archief beheert
bronmateriaal) eerder dan een publicatiebibliotheek. Vereist een eigen
adapter volgens het patroon uit [ADR-0002](../adr/0002-hybride-gegevensarchitectuur.md)
en verdere verkenning.
