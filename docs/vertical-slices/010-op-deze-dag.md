# Verticale slice 010: "Op deze dag"-widget

## Status

Plan, nog niet gebouwd. Out-of-the-box idee van de gebruiker, met een
belangrijke correctie na live verificatie: de aanvankelijk voorgestelde
databron (Gebeurtenis-datering) bleek ongeschikt, een andere - al
langer gebruikte - datumbron blijkt wel te werken.

## Aanleiding

Een roterend "op [datum] gebeurde dit"-blokje op de startpagina, om de
~62.000 Rijksmonumenten laagdrempeliger te maken dan alleen een
zoekbalk.

## Empirisch bevestigd (2026-08-10) - een aanname weerlegd

1. **`heeftGebeurtenis`'s begin-/einddatering is ongeschikt.** Alle 21.292
   gecontroleerde `heeftBeginDatering`-waarden hebben exact "01-01" als
   maand-dag - dit is een precisie-conventie (jaarnauwkeurig, dag/maand op
   een vaste placeholder), geen echte bouwdatum. Een "op deze dag"-widget
   op basis van dit veld zou op 1 januari een enorme lijst tonen en op
   elke andere dag niets - onbruikbaar.
2. **`ceo:datumInschrijvingInMonumentenregister`** (de datum van
   inschrijving in het Monumentenregister, al gebruikt door Doorzoeker als
   `registrationDate`/"Ingeschreven ...") heeft wél een echte, gespreide
   maand-dag-verdeling (bv. 30 juni: 1.329 keer, 2 mei: 1.153 keer, over
   alle jaren heen) - dit is de juiste databron.
3. Voor vandaag (10 augustus, over alle jaren): **312 Rijksmonumenten**
   ingeschreven op precies die dag - ruim voldoende voor een dagelijks
   roterende selectie.
4. Een `FILTER` op de maand-dag-substring van
   `datumInschrijvingInMonumentenregister` over de volle
   Rijksmonumentengraaf beantwoordt snel (geen vertraging zoals bij de
   geometrische `geof:sfWithin`-queries) - stringvergelijking is
   goedkoop, geen aparte cap-strategie nodig voor de query zelf.

## Doel

Op de startpagina (in de huidige "start-panel"/idle-weergave, vóór een
zoekopdracht) een klein blok tonen: 3-5 Rijksmonumenten die op de huidige
kalenderdag (ongeacht jaar) zijn ingeschreven in het Monumentenregister,
elk doorklikbaar naar het volledige record.

## Voorgestelde aanpak

1. Nieuwe querybouw/parse-functie in `lib/rce.ts`
   (`buildOpDezeDagQuery`/`parseOpDezeDagResults`): `FILTER` op
   `SUBSTR(STR(?datum), 6, 5)` tegen de huidige serverdatum (`MM-DD`,
   berekend in de route, niet clientside - voorkomt tijdzoneverschil
   tussen server en browser).
2. Nieuwe route `GET /api/rce/op-deze-dag`, met dezelfde
   cache/rate-limit-opzet als `/api/rce/search`, maar een langere
   `Cache-Control` (de resultaten veranderen maar één keer per dag).
   Server-side een klein, willekeurig sample nemen (bv. 5 van de mogelijk
   honderden treffers) in plaats van de volledige lijst - `LIMIT` met een
   `RAND()`-achtige aanpak, of gewoon de eerste N en dagelijks een andere
   volgorde via een simpele op-de-dag-gebaseerde seed, zodat alle
   gebruikers dezelfde dag hetzelfde blokje zien (belangrijk voor caching)
   in plaats van bij elke request iets anders.
3. UI: klein blok in het bestaande `start-panel` (de sectie die nu al
   "ZO WERKT HET" toont wanneer er nog geen zoekopdracht is), met de
   titel "Op deze dag ingeschreven" en de 3-5 monumenten met naam, jaartal
   en een doorklik (`executeSearch(monumentNumber)`, zelfde patroon als de
   complexledenlijst).

## Scope-afbakening

- Alleen Rijksmonument (heeft als enige een
  `datumInschrijvingInMonumentenregister`-achtig veld dat al gebruikt
  wordt). Werelderfgoed/Gezicht hebben eigen inschrijvingsvelden
  (`jaarVanInschrijving` etc.) - niet meegenomen in deze eerste schijf.
- Geen gebruikersinstelling om een andere datum te kiezen ("wat gebeurde
  er op mijn verjaardag") - puur de huidige dag, uit te breiden later.
- Geen serverside cronjob/precompute - een gewone, gecachete
  request-tijd-query volstaat gezien de lage kosten (stringvergelijking,
  geen geometrie).

## Openstaande vragen

- Hoe een stabiele, voor iedereen gelijke dagelijkse selectie kiezen uit
  soms honderden kandidaten, zonder een aparte precompute-stap? Voorstel:
  een deterministische sortering op bv. `rijksmonumentnummer modulo dag
  van het jaar` - simpel, geen state nodig, wel altijd dezelfde 5 op
  dezelfde dag.
- Cache-duur: tot middernacht (lokale tijd van de server) of een vaste
  24-uurs TTL? Klein verschil, niet kritiek.

## Acceptatiecriteria

1. De startpagina (idle-weergave) toont een "Op deze dag
   ingeschreven"-blokje met 3-5 Rijksmonumenten die op de huidige
   kalenderdag zijn ingeschreven, ongeacht jaar.
2. Elk item is doorklikbaar naar het volledige record.
3. Dezelfde dag toont voor elke bezoeker dezelfde selectie (niet willekeurig
   per request).
4. Typecheck/lint/test blijven groen.

## Klaar wanneer

De startpagina toont het "Op deze dag"-blokje met echte, doorklikbare
Rijksmonumenten, gebaseerd op `datumInschrijvingInMonumentenregister` (niet
op de ongeschikte Gebeurtenis-datering).
