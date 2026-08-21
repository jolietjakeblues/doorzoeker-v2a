# Functionele dekking

Dit document beschrijft wat Doorzoeker werkelijk uit de RCE Linked Data haalt
en hoe dat in de interface verschijnt. Het maakt bewust onderscheid tussen
zelfstandig doorzoekbare objecten, gekoppelde gegevens en alleen tellingen.

## Zelfstandig doorzoekbare objecten

| Objectsoort | Zoeken of bekijken | Kaartweergave | Detailweergave |
| --- | --- | --- | --- |
| Rijksmonument | Vrij zoeken; gebouwd en archeologisch te filteren; het register is daarnaast per 25 records te doorbladeren | Gebouwde monumenten als marker; archeologische monumenten met Polygon/MultiPolygon als vlak | Registergegevens, functies, percelen, foto, literatuur, bouwgeschiedenis en gekoppelde gegevens |
| Werelderfgoed | Volledige kleine collectie bekijken en op naam zoeken | Polygon of MultiPolygon | Eigen nummer, naam, geometrie en officiële bron |
| Gezicht | Rijksbeschermde stads- en dorpsgezichten bekijken en op naam zoeken | Polygon of MultiPolygon | Gezichtsnummer, naam, geometrie en officiële bron |
| Complex | Complexen van gebouwde Rijksmonumenten bekijken en op naam zoeken | In de resultaten als marker van het hoofdobject; in het detail worden de geometrieën van de afzonderlijke leden samen getoond | Hoofdobject, onderdelen en doorklikbare ledenlijst |
| Archeologisch terrein | Vrij zoeken op Archis-monumentnummer, naam, plaats, omschrijving en waardering; daarnaast per 25 records te doorbladeren | Geen zelfstandig vlak: voor deze klasse bevat de publieke CHO-graph geen `heeftGeometrie/geo:asWKT` | Archis-monumentnummer, CHO-nummer, plaats, omschrijving en waardering |
| Vondstlocatie | Vrij zoeken op CHO-nummer, vondstmeldingsnummer, waarnemingsnummer, locatienaam, plaats, omschrijving en verwervingswijze; daarnaast per 25 records te doorbladeren | Geen kaartpunt: de RCE publiceert hiervoor geen coördinaten | Archis-nummers, plaats, omschrijving, verwervingswijze en maximaal 25 complexen, vondstgroepen en grondspoorgroepen per onderdeel |
| Grondspoor | Vrij zoeken op CHO-nummer, omschrijving, woonplaats en gekoppeld RN2-type; daarnaast per 25 records te doorbladeren | Geen kaartpunt: in de publieke CHO-dataset heeft geen van de 91.980 gecontroleerde records een directe `ceo:heeftGeometrie`-koppeling | Aantal grondsporen, omschrijving, type met conceptschema en bovenliggende vondstlocatie |
| Vondst | Vrij zoeken op CHO- of Archis-vondstnummer, omschrijving, woonplaats, type, materiaal en toestand; daarnaast per 25 records te doorbladeren | Geen kaartpunt: de RCE publiceert hiervoor geen coördinaten | Aantal, omschrijving, bovenliggende vondstlocatie en aanklikbare RN2-begrippen voor type, materiaal en toestand |
| Archeologisch complex | Vrij zoeken op CHO-nummer, omschrijving, woonplaats en RN2-complextype; daarnaast per 25 records te doorbladeren | Geen kaartpunt: de RCE publiceert hiervoor geen coördinaten | Aanklikbaar complextype en alle gekoppelde vondstlocaties, archeologische terreinen of onderzoeksgebieden |
| Archeologisch onderzoeksgebied | Vrij zoeken op CHO-nummer, woonplaats en onderzoeksomschrijving; daarnaast per 25 records te doorbladeren | Polygon of MultiPolygon | Onderzoeksgegevens en gekoppelde archeologische inhoud |
| Scheepswrak | Vrij zoeken op naam en scheepstype (MASS-dataset, losstaand van rce/cho met een eigen `sdo:`-vocabulaire), plus exacte MASS-nummer-lookup bij een numerieke term; geen "bekijk alles"-browsemodus (bewuste scope-keuze, zie `018-mass-scheepswrakken.md`) | Als marker (punt); de MASS-dataset publiceert geen polygoongeometrie | Naam, scheepstype, gesaneerde omschrijving met afbeeldingen, ontdekt-veld (indien aanwezig) en de vaste bronvermelding met licentie |

Een Complex heeft in Doorzoeker geen kunstmatig berekende `union`-geometrie.
De kaart tekent de beschikbare Point-, Polygon- en MultiPolygon-geometrieën
van de leden in één laag. Daardoor blijft zichtbaar uit welke objecten het
complex bestaat en gaat er geen brongeometrie verloren.

## Archeologie

De archeologische gegevens komen uit Archis, maar vormen niet één lijst met
monumenten. Archis registreert onderzoeken én wat tijdens of buiten zo'n
onderzoek is aangetroffen. Daarnaast bevat het gewaardeerde archeologische
terreinen. Alleen het wettelijk beschermde deel daarvan heeft ook de rol van
archeologisch Rijksmonument.

De hoofdlijnen van het gepubliceerde model zijn:

```text
Onderzoeksgebied
├─ Vondstlocatie
│  ├─ Vondsten
│  ├─ Grondsporen
│  └─ ArcheologischComplex
└─ ArcheologischComplex (eerste bevinding)

ArcheologischTerrein
└─ ArcheologischComplex

Rijksmonument
└─ ArcheologischTerrein (alleen waar die relatie werkelijk is vastgelegd)
```

Een `ArcheologischComplex` is hier geen verzameling geometrieën zoals een
`Complex` van gebouwde Rijksmonumenten. Het is een inhoudelijke interpretatie
van een vindplaats of terrein, bijvoorbeeld een nederzetting of grafveld.
`Vondsten` en `Grondsporen` zijn geregistreerde inhoud onder een
vondstlocatie. Een onderzoeksgebied zegt waar onderzoek is uitgevoerd; het is
niet zelf een monument of een archeologisch waardevol terrein.

| Onderdeel | Huidige dekking |
| --- | --- |
| Archeologisch Rijksmonument | Zelfstandig Rijksmonument, filterbaar als archeologisch |
| Archeologisch terrein | Zelfstandig zoekresultaat; daarnaast blijven terreinen met een expliciete `ceo:ligtInObject`-relatie als verrijking bij het Rijksmonument zichtbaar |
| Archeologisch onderzoeksgebied | Zelfstandig doorzoekbaar object met eigen geometrie en detailweergave |
| Archeologisch complex | Zelfstandig doorzoekbaar; rechtstreeks gekoppelde complexen en complexen onder vondstlocaties blijven daarnaast binnen hun context zichtbaar |
| Vondstlocatie | Zelfstandig doorzoekbaar; daarnaast worden tot 25 aan een onderzoeksgebied gekoppelde vondstlocaties daar als context getoond |
| Vondst | Zelfstandig doorzoekbaar; blijft daarnaast als lijst en telling zichtbaar binnen de gekoppelde vondstlocatie of het onderzoeksgebied |
| Grondspoor | Zelfstandig doorzoekbaar; blijft daarnaast als lijst en telling zichtbaar binnen de gekoppelde vondstlocatie of het onderzoeksgebied |
| Complex via vondstlocatie | Als totaal vermeld, naast rechtstreeks gekoppelde archeologische complexen |

De archeologische termen voor CHO-data komen uit het Archeologisch Informatie
Systeem binnen Referentienetwerk 2. Het losse ABR-endpoint wordt niet gebruikt
voor deze interne CHO-koppelingen - dat geldt specifiek voor deze directe
veldkoppelingen (vondsttype, materiaal, ...); voor de zoekbalksuggesties
hieronder ligt dat sinds 21 augustus 2026 anders.

Dat geldt niet voor iedere eigenschap op dezelfde manier. De objecten zelf
hebben een CHO-URI, bijvoorbeeld
`cho-kennis/id/vondstlocatie/...`. Hun classificaties kunnen een concept-URI
uit Referentienetwerk 2 hebben:

| Gegeven | RN2-schema in de live data |
| --- | --- |
| Archeologisch complextype | Archeologisch Informatie Systeem |
| Vondsttype | Archeologisch Informatie Systeem |
| Materiaal van een vondst | Archeologisch Informatie Systeem |
| Stijl en cultuur van een vondst | Archeologisch Informatie Systeem |
| Verwervingswijze, bijvoorbeeld booronderzoek | Onder meer Archeologisch Informatie Systeem; een concept kan in meer dan één schema staan |
| Toestand van een vondst, bijvoorbeeld fragment | Cultuurhistorische Object Informatie |
| Archeologische waardering van een terrein | Cultuurhistorische Object Informatie |

Een `rn/2`-URI is dus niet automatisch een AIS-term. Doorzoeker moet de
`skos:inScheme`-relatie bewaren en tonen wanneer de herkomst van het begrip
relevant is. `Grondsporen` heeft naast het eigen aantalveld een
`heeftType/heeftTypeNaam`-koppeling naar Referentienetwerk 2; de gecontroleerde
typen behoren tot het Archeologisch Informatie Systeem.

## Geometrie

De WKT-parser en kaart ondersteunen het profiel dat in de gebruikte CHO-data
voorkomt:

- `Point` als marker;
- `Polygon`, inclusief meerdere ringen en gaten;
- `MultiPolygon`, met behoud van de afzonderlijke polygonen en ringen.

Gebiedsobjecten worden als vlak getekend. Punten worden geclusterd wanneer ze
op het huidige zoomniveau dicht bij elkaar liggen. Voor lijstweergave en het
centreren van de kaart wordt waar nodig een representatief punt uit de
geometrie afgeleid; dat vervangt de oorspronkelijke geometrie niet.

De RCE publiceert niet voor ieder archeologisch object coördinaten. Doorzoeker
houdt daarom de volgende grens aan:

| Coördinaten gepubliceerd | Geen coördinaten gepubliceerd |
| --- | --- |
| Gebouwde Rijksmonumenten | Vondsten |
| Archeologische Rijksmonumenten | Vondstlocaties |
| Complexen van Rijksmonumenten | Archeologische complexen |
| Archeologische onderzoeksgebieden | Archeologische terreinen |
| | Grondsporen |

`heeftGeometrie` in de ontologie betekent dus niet dat iedere klasse of ieder
record een geometrie in de publieke data heeft. Doorzoeker maakt geen
coördinaten op basis van een plaatsnaam en neemt ook niet de geometrie van een
gekoppeld object over alsof die bij het bronobject zelf hoort.

## Begrippen en zoeken

De algemene CHO-zoekbalk zoekt tekst in de werkelijk aangesloten velden. De
woordsuggesties komen sinds 21 augustus 2026 uit twee bronnen. Ten eerste twee
CHO-relevante schema's van Referentienetwerk 2:

- Archeologisch Informatie Systeem;
- Monumenten Registratie Systeem.

(Cultuurhistorische Object Informatie en Kennisregistratie leverden geen
bruikbare CHO-suggesties op en zijn eruit gehaald.) De suggestiedienst
controleert in CHO of zo'n RN2-concept werkelijk als functie, monumentaard,
vondsttype, materiaal, toestand of archeologisch complextype is gekoppeld.
Bij zo'n term toont de GUI het gemeten aantal objecten en zoekt een klik
exact op de concept-URI. Zonder aangetoonde koppeling staat er expliciet
`zoekt op tekst`. Zo wekt een bruikbaar thesauruswoord geen onterechte indruk
dat alle CHO-objecten ermee zijn geclassificeerd. Archeologische waardering,
verwervingswijze, gebeurtenistype, actor, stijl en cultuur, bouwkundige
staat, het type van een grondspoor en het type van een Rijksmonument
(bv. "Bovenkruier") zijn daarnaast vanuit records exact doorzoekbaar; het
detailpaneel verzamelt al deze en de eerdergenoemde begrippen ook in één
gegroepeerd "Alle gekoppelde begrippen"-overzicht.

Ten tweede CHT- en ABR-begrippen die daadwerkelijk aan een formele
Rijksmonument-omschrijving gekoppeld zijn via `ceox:heeftOmschrijvingOnderwerp`
(de archiefdagen- en OmschrijvingenOnderwerp-graphs samen, niet de volledige
thesaurus - dat zou duizenden termen zonder zoekresultaat suggereren). Zo'n
suggestie toont zijn bron (Cultuurhistorische Thesaurus of Archeologisch
Basisregister) en zoekt, net als een niet-gekoppelde RN2-term, op tekst.
Dezelfde koppeling levert op de Rijksmonument-detailpagina het veld
"Onderwerp (uit omschrijving)" op, met per concept zijn herkomstthesaurus
(CHT, ABR of RN) naast het label. Bibliotheek en Beeldbank gebruiken CHT
daarnaast in hun eigen brondata, los van deze CHO-koppeling.

## Bewuste grenzen

- De publieke CHO-graph bevat nul `ArcheologischTerrein`-instanties met een
  eigen `ceo:heeftGeometrie/geo:asWKT`. Doorzoeker verzint daarom geen vorm of
  coördinaat. Een gekoppeld Rijksmonument kan wel zijn eigen geometrie hebben,
  maar die is niet automatisch de geometrie van het terrein.
- De ruimtelijke `ligt in`-relatie tussen een Rijksmonument en Werelderfgoed/
  Gezicht (de bron bevat daarvoor geen directe relatie, alleen geometrie) is
  live berekend zodra een Rijksmonument-detail geopend wordt, niet vooraf
  voor de hele resultatenlijst en niet in de omgekeerde richting (een
  Werelderfgoed- of Gezicht-detail toont niet zijn eigen leden) - zie
  [006-werelderfgoed-ligt-in.md](vertical-slices/006-werelderfgoed-ligt-in.md).
- De afzonderlijke geometrie van een historische groenaanleg is nog geen
  aparte kaartlaag.
- Geplande functies staan alleen in de verticale slice met status `Plan` en
  worden niet als bestaande functionaliteit beschreven.
