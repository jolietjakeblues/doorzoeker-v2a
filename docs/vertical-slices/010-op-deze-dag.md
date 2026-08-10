# Verticale slice 010: "Op deze dag"-widget

## Status

Gebouwd en live geverifieerd (2026-08-10). `buildOpDezeDagQuery`/
`parseOpDezeDagCandidates`/`pickOpDezeDagCandidate` in `lib/rce.ts`,
`fetchOpDezeDag` (hergebruikt de nieuwe gedeelde
`buildMonumentsFromNumbers`-helper) in `rce-adapter.ts`, nieuwe route
`GET /api/rce/op-deze-dag`, en een tegel boven het startpaneel
(`hooks/useOpDezeDag.ts`). Live geverifieerd op 10 augustus: toont
"Kaaspakhuis" (RM 517443, ingeschreven 2001-08-10) mét foto uit de
beeldbank, doorklikbaar naar het volledige record. Selectie, lege respons en
upstream-uitval zijn met regressietests afgedekt.

Opgesteld als ontdekfunctie voor de startpagina, met een belangrijke
correctie na live verificatie: de aanvankelijk voorgestelde databron
(Gebeurtenis-datering) bleek ongeschikt, een andere - al langer
gebruikte - datumbron bleek wel te werken. Bijgesteld naar één monument
met voorkeur voor een foto (in plaats van een lijst van 3-5), op verzoek
van de gebruiker.

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
   ingeschreven op precies die dag.
4. Een `FILTER` op de maand-dag-substring van
   `datumInschrijvingInMonumentenregister` over de volle
   Rijksmonumentengraaf beantwoordt snel (geen vertraging zoals bij de
   geometrische `geof:sfWithin`-queries) - stringvergelijking is
   goedkoop, geen aparte cap-strategie nodig voor de query zelf.
5. **Bijgesteld (2026-08-10): één monument met een foto, geen lijst van
   3-5.** Visueel leuker als kaart/tegel met afbeelding dan een tekstlijst.
   Live geverifieerd dat dit haalbaar is: van de 312 kandidaten op 10
   augustus hebben er **37 ook een foto** in de beeldbank
   (`graph/image-1`, gejoined op rijksmonumentnummer). Zelfs op het
   schaarsteget geval, 29 februari (alleen in schrikkeljaren), zijn er nog
   **31 kandidaten met foto** - een dag zonder enige met-foto-kandidaat is
   dus niet aannemelijk, maar de aanpak hieronder valt defensief terug op
   een kandidaat zonder foto als dat toch ooit voorkomt.

## Doel

Op de startpagina (in de huidige "start-panel"/idle-weergave, vóór een
zoekopdracht) één Rijksmonument tonen dat op de huidige kalenderdag
(ongeacht jaar) is ingeschreven in het Monumentenregister, met voorkeur
voor een monument met een foto uit de beeldbank - als kaart/tegel in
plaats van een tekstlijst, doorklikbaar naar het volledige record.

## Voorgestelde aanpak

1. Nieuwe querybouw/parse-functie in `lib/rce.ts`
   (`buildOpDezeDagQuery`/`parseOpDezeDagResults`): `FILTER` op
   `SUBSTR(STR(?datum), 6, 5)` tegen de huidige serverdatum (`MM-DD`,
   berekend in de route, niet clientside - voorkomt tijdzoneverschil
   tussen server en browser). De query joint meteen met `graph/image-1`
   (zelfde vorm als de bestaande `buildImageQuery`) zodat kandidaten mét
   foto apart herkenbaar zijn.
2. Nieuwe route `GET /api/rce/op-deze-dag`, met dezelfde
   cache/rate-limit-opzet als `/api/rce/search`, maar een langere
   `Cache-Control` (het resultaat verandert maar één keer per dag).
   Server-side kiest één kandidaat deterministisch (zie "Openstaande
   vragen") - bij voorkeur uit de met-foto-kandidaten, alleen terugvallen
   op de volledige kandidatenlijst als er toevallig geen enkele met foto
   is. Zo ziet elke bezoeker op dezelfde dag hetzelfde monument
   (belangrijk voor caching), niet iets anders per request.
3. UI: één kaart/tegel in het bestaande `start-panel` (de sectie die nu
   al "ZO WERKT HET" toont wanneer er nog geen zoekopdracht is), met de
   titel "Op deze dag ingeschreven", de foto als achtergrond (zelfde
   tegel-stijl als de resultatenkaarten met foto), naam, jaartal en een
   doorklik (`executeSearch(monumentNumber)`, zelfde patroon als de
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

- Hoe één stabiele, voor iedereen gelijke dagelijkse keuze maken uit soms
  tientallen met-foto-kandidaten, zonder een aparte precompute-stap?
  Voorstel: een deterministische sortering op bv.
  `rijksmonumentnummer modulo dag van het jaar` - simpel, geen state
  nodig, wel altijd hetzelfde monument op dezelfde dag.
- Cache-duur: tot middernacht (lokale tijd van de server) of een vaste
  24-uurs TTL? Klein verschil, niet kritiek.

## Acceptatiecriteria

1. De startpagina (idle-weergave) toont één "Op deze dag
   ingeschreven"-tegel met een Rijksmonument dat op de huidige
   kalenderdag is ingeschreven, ongeacht jaar - met foto wanneer
   beschikbaar.
2. De tegel is doorklikbaar naar het volledige record.
3. Dezelfde dag toont voor elke bezoeker hetzelfde monument (niet
   willekeurig per request).
4. Typecheck/lint/test blijven groen.

## Klaar wanneer

De startpagina toont de "Op deze dag"-tegel met één echt, doorklikbaar
Rijksmonument met foto, gebaseerd op `datumInschrijvingInMonumentenregister`
(niet op de ongeschikte Gebeurtenis-datering).
