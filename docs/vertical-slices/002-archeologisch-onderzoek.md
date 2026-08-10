# Verticale slice 002: Archeologisch onderzoek als eigen laag

## Status

Gebouwd en getest (2026-08-10). ArcheologischOnderzoeksgebied is als
zelfstandige zoekbranch aangesloten op woonplaats en onderzoeksomschrijving.
De detailweergave toont rechtstreeks gekoppelde archeologische complexen,
maximaal 25 vondstlocaties en totalen van vondstlocaties, vondsten,
grondsporen en complexen via vondstlocaties. `ArcheologischTerrein` heeft
daarnaast een zelfstandige zoekingang; expliciet aan Rijksmonumenten gekoppelde
terreinen blijven daar ook als verrijking zichtbaar.
Grondsporen zijn inmiddels eveneens zelfstandig doorzoekbaar op CHO-nummer,
omschrijving, woonplaats en het gekoppelde type uit Referentienetwerk 2.
Vondsten zijn zelfstandig doorzoekbaar op nummer, omschrijving, woonplaats,
type, materiaal en toestand. De drie classificaties bewaren hun RN2-URI en
zijn als exacte zoekingang aanklikbaar; `messing` zoekt daardoor via
`heeftMateriaal/heeftMateriaalNaam`, niet als los tekstwoord.

Zie [`../functionele-dekking.md`](../functionele-dekking.md) voor het precieze
onderscheid tussen zelfstandig object, gekoppelde lijst en telling.

## Aanleiding

Doorzoeker toonde archeologie aanvankelijk uitsluitend via een
`ArcheologischTerrein` dat aan een Rijksmonument is gekoppeld
(`ligtInObject`). Dat is niet het gegevensmodel van heel Archis, maar alleen
de doorsnede tussen gewaardeerde terreinen en wettelijk beschermde
Rijksmonumenten. Onderzoek in de live data laat zien hoeveel daarbuiten valt:

| Klasse | Instanties | Gekoppeld aan Rijksmonument? |
|---|---|---|
| ArcheologischOnderzoeksgebied | 112.277 | Nee |
| Vondstlocatie | 111.577 | Soms; 40.064 liggen in een Onderzoeksgebied |
| Grondsporen | 91.974 | Nee (ligt in Vondstlocatie) |
| Vondsten | 445.298 | Nee (ligt in Vondstlocatie) |
| ArcheologischComplex | 360.330 | Ligt meestal in een Vondstlocatie en soms rechtstreeks in een Onderzoeksgebied of ArcheologischTerrein |
| ArcheologischTerrein | 13.025 | Slechts 1.812 (13,9%) heeft een `ligtInObject → Rijksmonument`, exact geverifieerd (zie hieronder) |

Het merendeel van deze Archis-objecten is dus niet aan een Rijksmonument
gekoppeld. Ze staan niet per se los: onderzoeksgebieden, vondstlocaties,
vondsten, grondsporen en archeologische complexen vormen onderling juist een
hiërarchie. Een `ArcheologischComplex` is daarbij een archeologische duiding
(zoals een nederzetting of grafveld), niet het equivalent van het gebouwde
`Complex` dat een verzameling Rijksmonumenten bijeenhoudt.

Een `ArcheologischTerrein` moet evenmin als synoniem voor Rijksmonument worden
gelezen. Het is een gewaardeerd terrein uit de archeologische gegevenslaag.
Een deel is wettelijk beschermd en gekoppeld aan een Rijksmonument; veel
terreinen zijn dat niet. De GUI toont daarom beide rollen apart. Live controle
van de volledige publieke CHO-graph leverde geen enkel `ArcheologischTerrein`
met een eigen `heeftGeometrie/geo:asWKT` op. De zelfstandige resultaten tonen
dus wel hun plaatsaanduiding, maar geen verzonnen terreinvlak.

De algemene RCE-publicatieregel noemt coördinaten voor grondsporen en
archeologische onderzoeksgebieden. In de publieke CHO Linked Data-dataset is
op 10 augustus 2026 echter voor geen van de 91.980 grondspoorrecords een
directe `ceo:heeftGeometrie`-koppeling aanwezig, ook niet in een andere named
graph. Doorzoeker toont daarom alleen geometrie die de gebruikte bron werkelijk
levert. Vondsten, vondstlocaties, archeologische complexen en archeologische
terreinen krijgen evenmin een verzonnen kaartpositie.
De zelfstandige zoekingang voor vondstlocaties is daarom een tekstuele
resultatenlaag en geen puntenlaag op de kaart. Zoeken kan op beide historische
Archis-nummers, locatienaam, woonplaats, omschrijving en verwervingswijze.
Bij openen worden maximaal 25 archeologische complexen, vondstgroepen en
grondspoorgroepen per onderdeel geladen, naast ongelimiteerde totalen.

De inhoudelijke concepten worden niet als platte labels teruggegeven. Type,
materiaal, stijl/cultuur en toestand bewaren hun RN2-URI plus alle gevonden
`skos:inScheme`-relaties. Daardoor blijft bijvoorbeeld zichtbaar dat
`aardewerk` uit Archeologisch Informatie Systeem komt en `fragment` uit
Cultuurhistorische Object Informatie.

**Belangrijke afbakening:** dit is een andere databron dan de RCE Archis
"Zoeken & Vinden"-portal (ingelogd, quota van 300 meldingen/export, verbod
op geautomatiseerde toegang zonder schriftelijke RCE-toestemming). Doorzoeker
praat met de open, publieke CEO Linked Data SPARQL-dienst - dezelfde die nu
al voor Rijksmonumenten/Werelderfgoed/Gezicht wordt gebruikt. Geen
toestemmings- of quotavraagstuk, wel een heel andere ordegrootte data.

## Doel

Een gebruiker kan archeologisch onderzoek (onderzoeksgebieden en wat daarin
is aangetroffen) vinden en op de kaart zien, ook wanneer dat onderzoek geen
enkele relatie heeft met een aangewezen Rijksmonument.

## Waarom niet hetzelfde patroon als Rijksmonumenten

De bestaande vrije-tekst-discovery (6 parallelle SPARQL-branches over de
volledige 1,2M-Rijksmonumentengraaf) bestaat omdat één gecombineerde query op
die schaal al timede op Virtuoso. Deze vijf klassen zijn groter (tot 445K
instanties) én hebben geen vrije-tekstveld zoals `naam` om op te matchen -
het zijn vooral geometrie, classificatie en datering. Dezelfde aanpak
toepassen zou trager zijn én weinig zinvolle treffers geven.

Ook "browse alles" (zoals bij Werelderfgoed [18] en Gezicht [472]) werkt hier
niet: bij 112.277+ records is er geen "volledige collectie in één keer tonen"
mogelijk zonder de applicatie en de RCE-service te overbelasten.

## Voorgestelde aanpak

1. **Locatie-/gemeentegedreven, niet vrije tekst.** Een zoekopdracht op
   plaatsnaam/gemeente (zoals nu al voor Rijksmonumenten werkt) filtert het
   aantal onderzoeksgebieden tot een behapbare set, vergelijkbaar met hoe een
   plaatsnaam nu al Rijksmonumenten vindt.
2. **ArcheologischOnderzoeksgebied als top-level resultaat**, niet elke
   Vondstlocatie/Grondsporen/Vondst apart - dat zou de resultatenlijst
   overspoelen. Deze krijgt een eigen `objectType` (bijv. "Archeologisch
   onderzoek") naast Rijksmonument/Werelderfgoed/Gezicht.
3. **Vondstlocatie, Grondsporen, Vondsten, ArcheologischComplex als
   detailverrijking**, lazy geladen zodra een onderzoeksgebied wordt
   geopend - dezelfde aanpak als de bestaande archeologische-terrein- en
   complexverrijking op Rijksmonumenten (niet vooraf voor de hele lijst
   ophalen).
4. **Kaartweergave als polygoon/multipolygoon**, via het bestaande
   `isAreaType`/`parseWktGeometry`-mechanisme dat al voor Werelderfgoed,
   Gezicht en archeologische Rijksmonumenten wordt gebruikt.
5. **Geen "Bekijk alles"-knop.** In plaats daarvan is een plaats- of
   gemeentenaam verplicht om te kunnen zoeken, zoals bij reguliere
   Rijksmonument-zoekopdrachten.

## Openstaande vragen (bewust nog niet besloten)

- Op welke velden is een onderzoeksgebied nu concreet te vinden zonder een
  `naam`-achtig tekstveld? Vermoedelijk gemeente/provincie en eventueel
  `indicatieArcheologischeMonumentenKaartWaardig` als filter, niet trefwoord.
- Prestatie bij dichtbevolkte gemeenten: kan alsnog honderden
  onderzoeksgebieden per gemeente opleveren. Raakt de al bestaande, bewust
  uitgestelde paginering-vraag (zie README, "Nog niet gebouwd").
- Relatie tot de bestaande ArcheologischTerrein-koppeling wanneer een
  onderzoeksgebied toevallig óók een Rijksmonument-relatie heeft (zeldzaam):
  voorlopig behandelen als volledig aparte laag, geen samenvoeging.

## Niet in scope (voor deze slice)

- Directe koppeling tussen deze laag en de Archis "Zoeken & Vinden"-portal
  (login, downloads, meldingen indienen).
- Ruimtelijke "ligt in"-relaties tussen een onderzoeksgebied en een Gezicht
  of Werelderfgoed (zelfde deferral als eerder vastgesteld voor
  Rijksmonumenten).

## Herziene aanpak (2026-08-08, vervangt punt 1 en 5 hierboven)

Empirisch bevestigd: `ArcheologischOnderzoeksgebied` heeft een echt
vrij-tekstveld (`omschrijving`) naast `woonplaatsnaam`, en een
`CONTAINS`-filter op beide presteert prima over de volle 112K-graaf (geen
timeout, ook niet op generieke termen - LIMIT 100 begrenst hoe dan ook).
Daarom geen aparte, locatie-verplichte zoekflow: twee extra
discovery-branches (`woonplaats`, `omschrijving`) draaien mee in de
bestaande vrije-tekstzoekbalk, exact volgens het patroon van
`DISCOVERY_SOURCES`/`mergeDiscoveryMatches` dat al voor Rijksmonumenten
bestaat. Nieuw "soort object": **Onderzoeksgebied**. Punt 2, 3 en 4
(top-level resultaat, lazy detailverrijking, polygoon op de kaart) blijven
ongewijzigd staan.

Eerste bouwstap (gebouwd 2026-08-08): zoeken, tonen als polygoon, detailpagina
met omschrijving/woonplaats/registratiedatum. Stap 3 - de lazy
Vondstlocatie/Grondsporen/Vondsten/ArcheologischComplex-verrijking op de
detailpagina - eveneens gebouwd (2026-08-08), na eerst de relatiestructuur
hieronder empirisch te hebben uitgezocht. Live geverifieerd inclusief het
grootste geobserveerde geval (onderzoeksgebied 2015593: 2.191 vondstlocaties,
7.750 vondsten, 3.458 complexen - antwoordt in 1,4s dankzij de
aggregaat-in-plaats-van-lijst-aanpak) en een leeg geval (geen gekoppeld
onderzoek). Endpoint: `/api/rce/onderzoeksgebied-verrijking?gebied=<uri>`,
zelfde lazy-op-detailpaneel-open-patroon als de Complex-ledenlijst.

### Exacte relatiestructuur tussen de klassen (2026-08-08, empirisch geverifieerd)

Alle `bevatObject`/`ligtInObject`-paren tussen CHO-klassen, opgevraagd over de
volle graaf (`ligtInObject` is de inverse van `bevatObject`, beide kanten
komen daarom met identieke aantallen terug):

| Ouder (`bevatObject`) | Kind | Aantal |
|---|---|---|
| Rijksmonument | ArcheologischTerrein | 3.665 |
| ArcheologischOnderzoeksgebied | Vondstlocatie | 40.066 |
| ArcheologischOnderzoeksgebied | ArcheologischComplex | 9.398 |
| ArcheologischTerrein | ArcheologischComplex | 18.548 |
| Vondstlocatie | ArcheologischComplex | 332.347 |
| Vondstlocatie | Grondsporen | 91.980 |
| Vondstlocatie | Vondsten | 445.320 |

Twee gevolgen voor stap 3 (de lazy detailverrijking, taak #8):

1. **ArcheologischComplex heeft drie mogelijke ouders**, niet één vast pad:
   rechtstreeks onder Onderzoeksgebied (9.394), onder Terrein (18.548), of -
   verreweg het vaakst - onder Vondstlocatie (332.347). Samen 360.289, vrijwel
   het volledige totaal van 360.330. Een detailquery voor een geopend
   Onderzoeksgebied moet dus alle drie de paden bevragen (rechtstreeks én via
   elke Vondstlocatie eronder), niet alleen de directe relatie.
2. **Gat uitgezocht en verklaard (2026-08-08):** van de 111.579
   Vondstlocatie-instanties hebben er maar 40.064 (36%) een `ligtInObject`
   - en die wijst *altijd* naar een ArcheologischOnderzoeksgebied (geen
   ander doeltype ooit gezien). De overige 71.515 hebben helemaal geen
   `ligtInObject`-triple; dit is geen verkeerd predicaat of alternatief pad,
   empirisch uitgesloten. Wel hebben al deze 71.515 "wees"-Vondstlocaties
   hun eigen `heeftBasisregistratieRelatie/heeftBAGRelatie/woonplaatsnaam`
   (geverifieerd: exact 71.515 van de 71.515, dus 100%) - precies hetzelfde
   locatiemechanisme als ArcheologischOnderzoeksgebied zelf gebruikt. Het
   zijn dus geen kapotte of onvolledige records, ze hangen simpelweg vaak
   niet aan een Onderzoeksgebied vast terwijl ze zelfstandig prima
   plaatsbaar zijn. Gevolg: **niet blokkerend voor stap 3** (die begint
   vanuit een geopend Onderzoeksgebied en toont uitsluitend wat daar
   daadwerkelijk aan hangt - dat is een correcte, volledige weergave van
   wat dat specifieke Onderzoeksgebied bevat). Wel relevant zodra er ooit
   een omgekeerde ingang komt ("doorzoek Vondstlocaties direct, los van een
   Onderzoeksgebied") - dan is woonplaats-discovery (zelfde patroon als
   Onderzoeksgebied) het aangewezen mechanisme, niet de ligtInObject-keten.
