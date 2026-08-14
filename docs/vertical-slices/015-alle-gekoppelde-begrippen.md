# Verticale slice 015: "Alle gekoppelde begrippen"-overzicht

## Status

Gebouwd (14 augustus 2026). `linkedConcepts()` in `lib/heritage-view-model.ts`
bestond al maanden als geëxporteerde functie, maar werd nergens aangeroepen -
dode code, geconstateerd tijdens een codereview-ronde met de eigenaar. In
plaats van te verwijderen is de functie hier alsnog aan het werk gezet: een
nieuwe sectie op de detailpagina die *elk* concept-URI-gekoppeld veld van het
geopende record in één overzicht toont, gegroepeerd per soort begrip.

## Aanleiding

Doorzoeker koppelt inmiddels een groeiend aantal velden aan hun eigen
concept-URI uit het Referentienetwerk (functie, monumentaard, waardering,
vondsttype, materiaal, toestand, archeologisch complextype, stijl en
cultuur, bouwkundige staat, verwervingswijze), elk met een eigen doorklik
naar "alle erfgoedobjecten met dit begrip". Die doorkliks staan verspreid
door de detailpagina, precies bij het veld waar ze bij horen - functioneel
correct, maar een bezoeker die wíl weten "welke begrippen zitten er allemaal
aan dit record vast, los van waar ze op de pagina staan" moet de hele
pagina doorlezen om ze te vinden.

## Wat het doet

`linkedConcepts(item)` verzamelt alle concept-URI-gekoppelde velden van een
`Item` in één vlakke lijst (`{ uri, label, field, group }[]`), inclusief de
dit jaar toegevoegde stijl/bouwkundige-staat/verwervingswijze-velden.
`HeritageDetailDialog.tsx` toont die lijst als een nieuwe sectie "Alle
gekoppelde begrippen" (hergebruikt de bestaande `.map-object-list`-stijl),
met per begrip het label als doorklikbare `concept-link`-knop en de
groepsnaam (bv. "Functie", "Stijl en cultuur") als toelichting. Een klik
roept dezelfde `onConceptSearch(concept, field)` aan als de doorkliks
elders op de pagina - geen nieuwe zoeklogica, alleen een extra, centrale
ingang naar bestaande functionaliteit.

Bewust buiten scope gehouden: gebeurtenis-/actorconcepten
(`gebeurtenissen[].naamConceptUri`/`actoren[].actorConceptUri`). Die zijn
per-gebeurtenis-instantie data uit een apart lazy-geladen verrijkingspad
(niet een vlak veld op `Item`) en hebben al hun eigen zichtbare doorklik
onder "Bouwgeschiedenis" - meenemen in dit overzicht zou dubbelen wat
Overbodig-2 net had opgeruimd.

## Getest

- `tests/heritage-view-model.test.mjs`: `linkedConcepts()` geeft voor elk
  ondersteund veld de juiste `{ uri, label, field, group }`-entry en slaat
  een veld zonder eigen concept-URI (bv. `description`) bewust over.
- `tests/e2e/rework.spec.ts` ("'Alle gekoppelde begrippen' toont elk begrip
  gegroepeerd en is zelf ook doorklikbaar"): opent een detail met een
  functie- en een stijlconcept, controleert dat beide gegroepeerd in de
  nieuwe sectie staan, en dat een klik daarin de bijbehorende
  conceptzoekopdracht start (URL bevat `veld=stijl` + de concept-URI,
  nieuwe resultaten verschijnen).
