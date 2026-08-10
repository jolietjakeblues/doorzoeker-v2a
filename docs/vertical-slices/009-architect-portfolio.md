# Verticale slice 009: Architect-portfolio

## Status

Gebouwd en live geverifieerd (2026-08-10). `useSearchState` onthoudt nu
`activeConceptVeld` naast `activeConceptUri`; `app/page.tsx` toont bij
`veld === "actor"` een portfolio-koptekst in plaats van de generieke
"N resultaten voor..."-tekst, met de rol(len) afgeleid uit de al
aanwezige `gebeurtenissen`-data - geen nieuwe route, geen extra
SPARQL-aanroep. Live geverifieerd: klikken op architect "Bedaux, Jos" bij
rijksmonument 517912 toont de koptekst "Bedaux, Jos ; Noord-Brabant — 4
rijksmonumenten (architect / bouwkundige / constructeur)". 115/115 tests,
typecheck, lint groen.

Vervolg op taak #10/007: een actor-klik is nu al een exacte
zoekopdracht, maar leverde alleen de gewone resultatenlijst op - zonder
dat de actor zelf ooit het onderwerp van de pagina werd.

## Aanleiding

Sinds slice 007 is een actor (architect/aannemer) een klikbare identiteit.
Een klik voert nu een gewone conceptzoekopdracht uit (`veld=actor`) en
toont een standaard resultatenlijst - dezelfde weergave als elke andere
zoekopdracht, zonder dat "dit gaat over deze architect" zichtbaar wordt.

## Doel

Wanneer een actor wordt aangeklikt, een lichte "portfolio"-framing tonen
boven de resultatenlijst: naam van de actor, aantal gevonden
rijksmonumenten, en (indien aanwezig) een overzicht van de rollen waarin
deze actor voorkomt (architect op het ene monument, aannemer op een
ander) - zonder een volledig nieuwe route/pagina te bouwen.

## Waarom geen aparte route

- Doorzoeker heeft nu precies één weergavepatroon (zoekresultaten +
  detailpaneel), consistent voor elk "soort object". Een aparte
  `/architect/<uri>`-route zou een tweede navigatiepatroon introduceren
  en de bestaande URL-staat-synchronisatie (`useSearchState`) verdubbelen
  voor maar één specifiek geval.
- De bestaande conceptzoekopdracht (`executeConceptSearch`, `veld=actor`)
  doet al het zware werk (opzoeken, resultaten tonen, URL bijwerken). Een
  portfolio-framing is een kop boven diezelfde resultatenlijst, geen
  nieuwe databron of route.

## Voorgestelde aanpak

1. `executeConceptSearch` (in `useSearchState.ts`) onthoudt, naast de
   bestaande `active`-tekst, ook het `veld` van de laatst uitgevoerde
   conceptzoekopdracht (nu alleen `activeConceptUri` bijgehouden, niet het
   veld zelf) - klein datamodel-uitbreiding.
2. In `app/page.tsx`: wanneer `veld === "actor"` en er resultaten zijn,
   toon een korte kopregel boven de resultatenlijst (in plaats van de
   gewone "N resultaten voor…"-tekst): naam van de actor, aantal
   rijksmonumenten, en de gevonden rol(len) - afgeleid door over de
   getoonde resultaten heen te kijken welke `gebeurtenissen[].actoren[]`
   matchen op de aangeklikte `actorConceptUri`.
3. Geen extra SPARQL-aanroep nodig: de rol-informatie zit al in de
   `gebeurtenissen`-data die toch al bij elk resultaat wordt meegestuurd.

## Scope-afbakening

- Geen eigen URL/route voor een actor - blijft een gewone
  conceptzoekopdracht met een verrijkte kopregel.
- Geen biografische data (geboortejaar, Wikipedia-koppeling, ...) - dat
  zou een heel andere, nog niet onderzochte databron vereisen.
- Geen kaartweergave specifiek voor "alle werken van deze actor" in de
  eerste versie - de bestaande kaartweergave (toggle lijst/kaart) werkt
  al op de resultatenlijst, dus dit komt gratis mee zonder extra werk.

## Openstaande vragen

- Wat te tonen wanneer dezelfde actor met verschillende rollen voorkomt
  binnen dezelfde resultatenset (bv. twee keer architect, één keer
  aannemer) - alle rollen los tonen, of gededupliceerd?
- Cap op 25 resultaten geldt al voor concept-zoekopdrachten (zelfde als
  monumentaard/waardering/gebeurtenis) - een actor met meer dan 25 werken
  zou dus een onvolledig portfolio tonen. Niet opgelost in deze schijf
  (zelfde bestaande beperking als elke andere conceptzoekopdracht).

## Acceptatiecriteria

1. Klikken op een actor toont een herkenbare kopregel met de naam van de
   actor en het aantal gevonden rijksmonumenten, in plaats van de
   generieke "N resultaten voor…"-tekst.
2. De rol(len) van de actor worden zichtbaar, afgeleid uit de al
   aanwezige data.
3. Typecheck/lint/test blijven groen.

## Klaar wanneer

Een actor-klik toont een herkenbare portfolio-kopregel boven de gewone
resultatenlijst, zonder nieuwe route of extra SPARQL-aanroep.
