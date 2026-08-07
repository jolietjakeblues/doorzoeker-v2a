# Verticale slice 002: Archeologisch onderzoek als eigen laag

## Status

Plan, nog niet gebouwd. Vastgelegd na onderzoek in de CEO-ontologie naar
aanleiding van de vraag "hoe zit archeologie hier eigenlijk in" en de RCE-
specificatie "Downloaden & datagebruik - Zoeken & Vinden" (Archis-portal).

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
| ArcheologischTerrein | 13.025 | Slechts ~27% heeft een `ligtInObject → Rijksmonument` |

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
