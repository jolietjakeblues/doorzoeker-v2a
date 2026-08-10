# Verticale slice 013: Lange omschrijvingen inkorten in de resultatenkaart

## Status

Gebouwd en live geverifieerd (2026-08-10). `truncateAtWordBoundary` in
`lib/heritage-view-model.ts`, een `CardDescription`-component in
`app/HeritageResultCard.tsx` toegepast op zowel de gewone resultatenkaarten als de
"Op deze dag"-tegel (010) - het detailpaneel (`selected.description`)
blijft ongewijzigd de volledige tekst tonen. Live geverifieerd op
rijksmonument 517443 (Kaaspakhuis, 4.600 tekens omschrijving): toont
ingekort tot 309 tekens (afgekapt op een woordgrens) met "… Lees meer",
en na klikken de volledige tekst met een "Lees minder"-knop. De volledige
detailtekst blijft onaangetast. De productiebuild en server-render-smoketest
dekken de aansluiting van de component af.

Kleine UX-correctie, gesignaleerd door de gebruiker: sommige
`omschrijving`-teksten zijn erg lang, wat de resultatenlijst (niet het
detailpaneel) onoverzichtelijk maakte.

## Aanleiding

De oorspronkelijke `app/page.tsx`-weergave toonde `item.description` ongewijzigd en zonder
afkapping in elke resultatenkaart (`<p>{item.description}</p>`, geen
`overflow`/`line-clamp` in de CSS). Een lange, formele omschrijving
(sommige RCE-omschrijvingen zijn meerdere alinea's lang - zie bv. het
Etten-Leur-voorbeeld uit eerdere sessies) maakt één kaart in de
resultatenlijst dan onevenredig veel groter dan de andere, wat het
scannen van de lijst verstoort. Het detailpaneel (`selected.description`)
heeft dit probleem niet op dezelfde manier - dat is al een toegewijde
ruimte voor de volledige tekst.

## Voorgestelde aanpak

Inkorten in de kaart, niet in het detailpaneel:

1. In de resultatenkaart: als `item.description.length > 300` (arbitraire
   grens, door de gebruiker zelf voorgesteld), toon de eerste 300 tekens
   gevolgd door "…" en een "Lees meer"-knop.
2. Klikken op "Lees meer" toont de volledige tekst inline (geen
   navigatie, geen detailpaneel-opening) - een simpele lokale
   `useState`-toggle per kaart, geen globale state nodig.
3. Het detailpaneel (`selected.description`) blijft ongewijzigd: altijd de
   volledige tekst, zoals nu al het geval is - dat is precies de
   toegewijde ruimte die de gebruiker noemde als alternatief.
4. Afkappen op een woordgrens (niet midden in een woord) voor een nette
   "…" - een kleine helper-functie, geen ingewikkelde tekstverwerking.

## Data-model

Geen wijziging aan `Item` of enige adapter nodig - dit is een pure
weergavewijziging in `app/page.tsx`, met een kleine helper-functie (bv.
`truncateAtWordBoundary(text: string, max: number)`) in
`lib/heritage-view-model.ts`, naast de bestaande `displayFunctionName`.

## Scope-afbakening

- Alleen de resultatenkaart. Het detailpaneel toont altijd de volledige
  tekst, zoals nu.
- Geen serverside wijziging - de volledige tekst wordt sowieso al
  opgehaald, dit is puur een client-side weergavekeuze.
- Geen "Lees meer"-link die naar het detailpaneel springt (de gebruiker
  noemde dit als *alternatief*, niet als aanvulling) - de twee opties
  worden gecombineerd door de knop lokaal te laten uitklappen, in plaats
  van een keuze te forceren tussen "inline" of "naar detail".

## Openstaande vragen

- Exacte grens (300 tekens is een startpunt van de gebruiker) - makkelijk
  aan te passen na een eerste visuele proef.
- Moet de uitgeklapte staat onthouden blijven bij het herladen van
  resultaten (bv. na filteren)? Voorstel: nee, elke nieuwe render start
  weer ingeklapt - simpeler, en de gebruiker filtert toch vaak opnieuw.

## Acceptatiecriteria

1. Een resultatenkaart met een omschrijving langer dan 300 tekens toont
   een afgekapte versie met "…" en een "Lees meer"-knop.
2. Klikken op "Lees meer" toont de volledige tekst inline, zonder de
   pagina te verlaten of het detailpaneel te openen.
3. Kortere omschrijvingen (≤ 300 tekens) tonen ongewijzigd, zonder knop.
4. Het detailpaneel blijft de volledige tekst tonen, ongeacht lengte.
5. Typecheck/lint/test blijven groen.

## Klaar wanneer

Lange omschrijvingen in de resultatenlijst zijn ingekort met een werkende
"Lees meer"-uitklap, en het detailpaneel blijft ongewijzigd de volledige
tekst tonen.
