# Verticale slice 016: "Ontdek een thema"

## Status

Gebouwd (14 augustus 2026), kleinste eerste stap voor #32 ("ontdekken
zonder zoekterm"), gekozen na overleg met de eigenaar uit drie opties
(thematische snelkoppelingen / "In de buurt" (slice 011) /
thesaurusverkenner).

## Aanleiding

Vóór deze slice kon een bezoeker zonder te typen al: "Op deze dag"
(slice 010), "Verras me" (slice 014), en de "Bekijk alles"-balk (browsen
per objectsoort: Rijksmonumenten, Werelderfgoed, Gezichten, Complexen,
enz.). Wat ontbrak was een ingang via thema/onderwerp - iemand die weet
dat ze geïnteresseerd zijn in bijvoorbeeld molens, maar niet weet welk
zoekwoord dat oplevert of dat "Bekijk alles" alleen op objectsoort
browst, niet op functie.

## Wat het doet

Een nieuwe navigatierij "Ontdek een thema" op de startpagina
(`app/SearchHero.tsx`, tussen "Direct zoeken" en "Bekijk alles"), met vijf
knoppen: Kerken, Molens, Kastelen, Boerderijen, Landhuizen. Elke knop roept
`onDiscoverTheme(uri, label)` aan, dat in `app/page.tsx` naar de al
bestaande `executeConceptSearch({ uri, label }, "functie")` gaat -
exact hetzelfde mechanisme als een klik op een functie-doorklik elders in
de app (bv. in "Alle gekoppelde begrippen", slice 015). Geen nieuwe
backend-laag, geen nieuwe querytypen.

## Themakeuze en live verificatie

De vijf functie-concept-URI's zijn opgezocht en live tegen de RCE
SPARQL-endpoint geverifieerd (14 augustus 2026) met het echte
`buildFunctieConceptQuery`-querypatroon (`lib/rce/concepts.ts`): een
UNION van `ceo:heeftOorspronkelijkeFunctie`/`ceo:heeftHuidigeFunctie` naar
`ceo:heeftFunctieNaam`, gefilterd op Rijksmonumenten. Bevestigde aantallen
gekoppelde Rijksmonumenten:

| Thema | Concept-URI | skos:prefLabel | Aantal |
| --- | --- | --- | --- |
| Kerken | `.../rn/2/6fa5f251-cd84-4f3a-acb7-7c219df2540f` | Kerk | 2310 |
| Molens | `.../rn/2/fea024ba-83a0-4418-afbe-3b7b4588797e` | Molen | 1126 |
| Kastelen | `.../rn/2/cd714157-2a9f-47ad-bf20-928e17aaf32b` | Kasteel | 96 |
| Boerderijen | `.../rn/2/e95cb75d-b99c-4ae9-841c-827b28e75458` | Boerderij (M) | 5484 |
| Landhuizen | `.../rn/2/1f7aa947-bb93-4bde-8204-9d82b5f9b617` | Landhuis | 452 |

**Afwijking van de oorspronkelijk bedachte vijfde term:** "Buitenplaats"
bleek geen bestaand `skos:prefLabel` te hebben in de RCE-thesaurus. De
enige kandidaat in de functienaam-scheme was de gecombineerde term
"Kasteel, buitenplaats" (460 treffers), die inhoudelijk te veel overlapt
met het Kasteel-thema. In plaats daarvan is "Landhuis" gekozen: een eigen,
niet-overlappende term (narrower onder dezelfde "Kasteel,
buitenplaats"-tak) die qua publieksbegrip het dichtst bij "buitenplaats"
komt. De knoptekst zegt daarom "Landhuizen", niet "Buitenplaatsen" - geen
claim maken die de data niet waarmaakt.

## Getest

`tests/e2e/rework.spec.ts` ("'Ontdek een thema' laat erfgoed ontdekken
zonder zoekterm (#32)"): controleert dat alle vijf knoppen zichtbaar zijn,
en dat een klik op "Kerken" de URL bijwerkt met `veld=functie` en de
Kerk-concept-URI, en de bijbehorende resultaten toont.
