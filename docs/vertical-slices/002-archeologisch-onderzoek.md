# Verticale slice 002: Archeologisch onderzoek als eigen laag

## Status

In uitvoering (2026-08-08). Vastgelegd na onderzoek in de CEO-ontologie naar
aanleiding van de vraag "hoe zit archeologie hier eigenlijk in" en de RCE-
specificatie "Downloaden & datagebruik - Zoeken & Vinden" (Archis-portal).

**Update 2026-08-08 - de voorgestelde aanpak hieronder is deels achterhaald.**
Verder onderzoek in de live data laat zien dat `ArcheologischOnderzoeksgebied`
wél een vrij-tekstveld heeft (`ceo:heeftOmschrijving/ceo:omschrijving`, een
prozaomschrijving van de onderzoeksaanleiding), naast `woonplaatsnaam` via
`ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie` (géén gemeente/
provincie - die relatie loopt via `heeftBRKRelatie`, die dit type niet heeft).
Een `CONTAINS`-filter op beide velden over de volle 112K-graaf is empirisch
getest en presteert prima (geen Virtuoso-timeout, zelfs op algemene termen).
Dat betekent dat dit gewoon als twee extra discovery-branches in de
bestaande vrije-tekstzoekbalk kan meedraaien - zie "Herziene aanpak"
onderaan dit document in plaats van punt 1 en 5 hieronder.

## Aanleiding

Doorzoeker toont archeologie nu uitsluitend via `ArcheologischTerrein`,
gekoppeld aan een Rijksmonument (`ligtInObject`). Onderzoek in de live data
laat zien dat dit de allerkleinste, wettelijk beschermde punt van de ijsberg
is:

| Klasse | Instanties | Gekoppeld aan Rijksmonument? |
|---|---|---|
| ArcheologischOnderzoeksgebied | 112.277 | Nee |
| Vondstlocatie | 111.577 | Nee (ligt in Onderzoeksgebied) |
| Grondsporen | 91.974 | Nee (ligt in Vondstlocatie) |
| Vondsten | 445.298 | Nee (ligt in Vondstlocatie) |
| ArcheologischComplex | 360.330 | Soms (ligt in Vondstlocatie óf Onderzoeksgebied) |
| ArcheologischTerrein | 13.025 | Slechts 1.812 (13,9%) heeft een `ligtInObject → Rijksmonument`, exact geverifieerd (zie hieronder) |

De bulk van het Nederlandse archeologische onderzoek (~700.000 objecten)
staat dus volledig los van enig monument en is nu onzichtbaar in Doorzoeker.

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
| Rijksmonument | ArcheologischTerrein | 1.812 |
| ArcheologischOnderzoeksgebied | Vondstlocatie | 40.064 |
| ArcheologischOnderzoeksgebied | ArcheologischComplex | 9.394 |
| ArcheologischTerrein | ArcheologischComplex | 18.548 |
| Vondstlocatie | ArcheologischComplex | 332.347 |
| Vondstlocatie | Grondsporen | 91.978 |
| Vondstlocatie | Vondsten | 445.300 |

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
