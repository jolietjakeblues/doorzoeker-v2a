# Verticale slice 003: Contextuele hulp bij het zoeken

## Status

Gebouwd (2026-08-08). Vastgelegd naar aanleiding van de opmerking "misschien
moeten we ook wat help pagina's en context help toevoegen, voor als een
user gaat zoeken." Alle zes hints uit dit document staan live: bij Soort
object, Monumentaard, Gevonden via, Juridische status en Kenmerken als
`<details className="hint">` direct na de `<legend>`, en bij CHO-nummer op
de detailpagina als `<details className="hint-inline">`. Tekst gecheckt met
de humanizer-skill zodat het niet als AI-marketingtekst klinkt. Live
geverifieerd: alle vijf fieldset-hints aanwezig, openen/sluiten werkt, en
`<summary>` is (zoals verwacht van native HTML) gewoon met het toetsenbord
te focussen en te bedienen.

## Aanleiding

Een nieuwe of incidentele gebruiker van Doorzoeker kent het RCE-jargon niet
vanzelf:

- welke velden doorzoekbaar zijn (niet alleen plaats/naam, ook
  monumentnummer, oorspronkelijke functie, monumentaard en woorden uit de
  formele omschrijving);
- dat Rijksmonument, Werelderfgoed, Gezicht, Complex en Onderzoeksgebied
  geen varianten van hetzelfde zijn, maar vijf verschillende soorten
  cultuurhistorisch object (deze uitleg staat al uitgebreid in
  codecommentaar en de vertical-slice-documenten, maar nergens zichtbaar
  vóór de gebruiker);
- wat "matchbron" betekent (via welk gegevensveld een zoekterm raak was);
- wat de twee nieuwste "Kenmerken"-filters betekenen: Historische aanleg
  (groenaanleg) en Monumenten Selectie Project (MSP) - beide pure
  RCE-terminologie, zonder toelichting onbegrijpelijk voor een leek.

## Doel

Op het moment van twijfel, ter plekke, in één of twee zinnen uitleg kunnen
krijgen - zonder de pagina te verlaten of een aparte handleiding te moeten
zoeken.

## Waarom geen aparte Help-pagina

- Een `/help`-route wordt in de praktijk niet bezocht voordat iemand vastloopt,
  en dan is de drempel om ernaartoe te navigeren al te hoog.
- Losse hulptekst raakt onopgemerkt uit sync met wat er werkelijk op het
  scherm staat zodra een filter of veld verandert (zoals nu al met de
  README gebeurde met het Termennetwerk).
- Voor een tool met een handjevol gebruikers is een volledige onboardingflow
  buiten proportie.

## Voorgestelde aanpak: uitklapbare hints, in-place

Geen hover-only tooltips (niet bruikbaar met toetsenbord of touch, en dus
niet consistent met de bestaande toegankelijkheidsinzet van deze app - zie
de bestaande kaarttoegankelijkheid en de zojuist toegevoegde
combobox-toetsenbordnavigatie). In plaats daarvan: `<details>`/`<summary>`-
disclosures, standaard HTML, geen JavaScript-afhankelijkheid, altijd
bereikbaar via toetsenbord en schermlezer.

Concreet, per plek:

1. **Fieldset "Soort object"** - een `<details><summary>Wat betekent dit?</summary>`
   direct onder de `<legend>`, met de bestaande uitleg uit de codecommentaar
   herschreven voor een gebruiker (geen monumentaard-varianten, maar vijf
   losse soorten object).
2. **Fieldset "Monumentaard"** - korte toelichting: alleen van toepassing
   binnen Rijksmonument, wat "archeologisch" hier concreet betekent.
3. **Fieldset "Juridische status"** - wat de status per soort object
   inhoudt (rijksmonument vs. werelderfgoed vs. rijksbeschermd gezicht vs.
   complex vs. onderzoeksgebied - dit zijn geen equivalente statussen).
4. **Fieldset "Kenmerken"** - de twee filters krijgen allebei een eigen
   korte uitleg: groenaanleg (historische tuin-/parkaanleg) en MSP
   (Monumenten Selectie Project, ±1997-2002, zie
   `docs/reference/rce-linked-data-graphs.md`).
5. **Resultaatlijst - "Gevonden via" / matchbron** - een korte uitleg bij de
   eerste keer dat matchbron-informatie getoond wordt.
6. **Detailpagina - CHO-nummer** - een regel uitleg dat dit RCE's eigen
   basisidentificatienummer is, los van het rijksmonument-, complex- of
   werelderfgoednummer.

Het bestaande "ZO WERKT HET"-paneel (`start-panel`) blijft zoals het is -
dat legt uit *hoe* je zoekt, deze hints leggen uit *wat de resultaten
betekenen* zodra je ze ziet. Twee aparte, elkaar aanvullende dingen.

## Scope-afbakening

- Geen gebruikersaccounts of een "niet meer tonen"-voorkeur - te zwaar voor
  de kleine gebruikersgroep, en `<details>` kost sowieso maar één klik om
  weer dicht te klappen.
- Geen aparte `/help`-route.
- Geen hover-only tooltips.
- Nederlands alleen, geen i18n - consistent met de rest van de applicatie.
- Geen wijziging aan de bestaande filterlogica of -state - dit is puur
  presentationeel, `<details>` heeft geen React-state nodig.

## Niet in scope

- Interactieve rondleiding of onboardingwizard bij eerste bezoek.
- Video- of animatie-uitleg.
- Contextuele AI-chat of een zoekassistent.

## Acceptatiecriteria

1. Een gebruiker die voor het eerst zoekt, kan zonder de pagina te
   verlaten uitleg krijgen bij elk jargon-filter (Soort object,
   Monumentaard, Juridische status, Kenmerken) en bij matchbron en
   CHO-nummer.
2. Elke hint is met alleen het toetsenbord te openen en te sluiten.
3. Geen enkele hint staat op een aparte pagina of vereist een aparte
   aanvraag naar de server.
4. Geen nieuwe dependencies, geen nieuwe React-state voor het simpelweg
   open/dicht klappen van een hint (`<details>` regelt dat zelf).

## Klaar wanneer

Alle zes genoemde plekken hebben een uitklapbare hint, de bestaande
teststrategie (typecheck/lint/test) blijft groen, en handmatige verificatie
in de browser bevestigt dat elke hint met Tab + Enter/Spatie bereikbaar en
bedienbaar is.
