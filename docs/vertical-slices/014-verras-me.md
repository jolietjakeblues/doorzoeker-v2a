# Verticale slice 014: "Verras me"-knop

## Status

Gebouwd (11 augustus 2026). `pickRandomCandidate` in `lib/rce/enrichment.ts`,
`fetchVerrasMe` (hergebruikt `buildOpDezeDagQuery`,
`parseOpDezeDagCandidates` en `buildMonumentsFromNumbers`) in
`rce-adapter.ts`, nieuwe route `GET /api/rce/verras-me`, en een knop met
resultaatkaart in het startpaneel (`hooks/useVerrasMe.ts`, `StartContent`).
Unit- en contracttests dekken `pickRandomCandidate`, een succesvolle
respons, een lege respons en een upstream-fout.

## Aanleiding

Naast "Op deze dag" (verticale slice 010, één vast monument per kalenderdag)
was er behoefte aan een ontdekfunctie die de gebruiker zelf kan herhalen:
een knop die op klik een ander, willekeurig gebouwd Rijksmonument met foto
toont.

## Aanpak

`buildOpDezeDagQuery` selecteert al gebouwde Rijksmonumenten met een
gekoppelde beeldbankafbeelding, gefilterd op een maand-dag-substring van
`datumInschrijvingInMonumentenregister`. "Op deze dag" gebruikt daarvoor de
huidige kalenderdag en kiest deterministisch (dagindex modulo poolgrootte),
zodat elke bezoeker op dezelfde dag hetzelfde monument ziet. "Verras me"
hergebruikt exact dezelfde query en hetzelfde kandidatenmodel, maar:

- kiest per aanroep een willekeurige maand-dag (niet de huidige dag);
- kiest willekeurig uit de kandidatenpool (nieuwe functie
  `pickRandomCandidate`, naast de bestaande `pickOpDezeDagCandidate`);
- cachet de respons niet (`Cache-Control: no-store`) - elke aanroep moet
  een andere uitkomst kunnen geven;
- wordt op klik aangeroepen vanuit de UI, niet automatisch bij het laden van
  de pagina.

Niet elke willekeurige maand-dag heeft kandidaten; net als bij "Op deze dag"
probeert de route daarom tot zeven keer een andere willekeurige maand-dag
voordat hij `monument: null` teruggeeft.

## Scope-afbakening

- Alleen gebouwde Rijksmonumenten met een gekoppelde beeldbankafbeelding,
  dezelfde beperking als "Op deze dag" - geen archeologische objecten,
  Werelderfgoed, Gezichten of Complexen in deze eerste versie.
- Geen serverside rate limiting: dezelfde overweging als `/api/rce/op-deze-dag`
  in `docs/security-en-stabilisatie-review.md` (exacte, begrensde query,
  geen gebruikersinvoer in de SPARQL-tekst).
- Geen geschiedenis van eerder getoonde monumenten binnen één sessie; een
  volgende klik kan (zelden) hetzelfde monument opnieuw treffen.

## Acceptatiecriteria

1. De "Verras me"-knop in het startpaneel toont op klik één gebouwd
   Rijksmonument met foto, doorklikbaar naar het volledige record.
2. Twee opeenvolgende klikken kunnen verschillende monumenten opleveren.
3. De respons wordt niet gedeeld gecachet.
4. Typecheck/lint/test blijven groen.

## Klaar wanneer

De "Verras me"-knop staat in het startpaneel naast "Op deze dag" en toont op
klik een willekeurig gebouwd Rijksmonument met foto.
