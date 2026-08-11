# Consolidatieplan

Status: in uitvoering. De pure geometriefuncties staan in
`lib/rce/geometry.ts`. De thesaurusfuncties staan in `lib/rce/terms.ts` en de
exacte conceptfuncties in `lib/rce/concepts.ts`. Gedeelde SPARQL-escaping staat
in `lib/rce/sparql.ts`. Alle archeologische query's, parsers en relatietypes
staan in `lib/rce/archaeology.ts`. Rijksmonumenten, werelderfgoed, gezichten,
gebouwde complexen en BRK-percelen staan in `lib/rce/monuments.ts`. De
publieke exports blijven via `lib/rce.ts` beschikbaar.

## Doel

Verklein de wijzigingsoppervlakte van `lib/rce.ts`, `app/page.tsx` en
`useSearchState` zonder de bestaande domeingrenzen of het huidige gedrag te
veranderen.

## Voorgestelde grenzen voor `lib/rce.ts`

| Module | Verantwoordelijkheid | Mag afhankelijk zijn van |
| --- | --- | --- |
| `lib/rce/types.ts` | Gedeelde bron- en resultaattypes | Geen querymodules |
| `lib/rce/sparql.ts` | Escaping en gedeelde queryfragmenten | Types en constanten |
| `lib/rce/geometry.ts` | WKT-parsing en representatieve punten | Geometrietypes |
| `lib/rce/monuments.ts` | Rijksmonumenten, gezichten, werelderfgoed en gebouwde complexen | Types, SPARQL en geometrie |
| `lib/rce/archaeology.ts` | Terreinen, onderzoeken, vondstlocaties, vondsten, grondsporen en archeologische complexen | Types, SPARQL en geometrie |
| `lib/rce/concepts.ts` | Conceptquery's en exacte conceptmatches | Types en SPARQL |
| `lib/rce/terms.ts` | RN2-, CHT- en ABR-suggesties en gebruiksmetingen | Types en SPARQL |
| `lib/rce/enrichment.ts` | Foto, literatuur, groenaanleg, MSP en gebeurtenissen | Types en SPARQL |

Splits querybouw en parser voor hetzelfde domein niet direct over veel
submappen. Eerst domeingrenzen aanbrengen. Daarna pas beoordelen of een tweede
splitsing werkelijk helpt.

## Voorgestelde grenzen voor `app/page.tsx`

| Component | Verantwoordelijkheid |
| --- | --- |
| `ResultsToolbar` | Resultaattitel, aantal, view-switch en mobiele filterknop |
| `SearchFilters` | Objecttype, locatie, functie, matchbron, status en kenmerken |
| `SearchResults` | Laden, leegte, lijst, kaart en verder laden |
| `StartContent` | Op deze dag, uitleg en directe ingangen |
| `HeritageDetailDialog` | Dialoogcontainer, focus en sluiten |
| Typespecifieke detailsecties | Alleen velden en relaties voor hun eigen objectsoort |

`page.tsx` blijft de orkestratielaag. State hoeft niet over nieuwe componenten
te worden verspreid als props en callbacks voldoende zijn.

## Voorgestelde grenzen voor `useSearchState`

- `useSearchUrlState`: lezen, schrijven en `popstate`;
- `useSearchRequest`: abort, sequence-id en remote lifecycle;
- `useSearchFilters`: lokale filtering en facetafleiding;
- `useSearchState`: dunne orkestratie van de drie delen.

## Veilige volgorde voor een latere uitvoering

1. Voeg karakterisatietests toe rond exports en URL-herstel.
2. Verplaats pure geometriefuncties zonder gedragswijziging. Afgerond.
3. Verplaats thesaurus- en conceptfuncties. Afgerond.
4. Verplaats archeologie. Afgerond.
5. Verplaats gebouwd erfgoed. Afgerond.
6. Splits presentatiedelen uit `page.tsx`. In uitvoering: `ResultsToolbar`,
   `StartContent` en `SearchResults` zijn verplaatst.
7. Splits hooks pas nadat componentgrenzen stabiel zijn.
8. Draai na iedere stap typecheck, lint, unittests en Playwright.

## Niet doen

- Geen generiek erfgoedobject maken dat betekenisvolle verschillen verbergt.
- Geen querygedrag veranderen tijdens een mechanische verplaatsing.
- Geen nieuwe productfunctie combineren met deze refactor.
- Geen massale hernoeming zonder afzonderlijke reden.
