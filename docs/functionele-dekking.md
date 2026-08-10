# Functionele dekking

Dit document beschrijft wat Doorzoeker werkelijk uit de RCE Linked Data haalt
en hoe dat in de interface verschijnt. Het maakt bewust onderscheid tussen
zelfstandig doorzoekbare objecten, gekoppelde gegevens en alleen tellingen.

## Zelfstandig doorzoekbare objecten

| Objectsoort | Zoeken of bekijken | Kaartweergave | Detailweergave |
| --- | --- | --- | --- |
| Rijksmonument | Vrij zoeken; gebouwd en archeologisch te filteren | Gebouwde monumenten als marker; archeologische monumenten met Polygon/MultiPolygon als vlak | Registergegevens, functies, percelen, foto, literatuur, bouwgeschiedenis en gekoppelde gegevens |
| Werelderfgoed | Volledige kleine collectie bekijken en op naam zoeken | Polygon of MultiPolygon | Eigen nummer, naam, geometrie en officiële bron |
| Gezicht | Rijksbeschermde stads- en dorpsgezichten bekijken en op naam zoeken | Polygon of MultiPolygon | Gezichtsnummer, naam, geometrie en officiële bron |
| Complex | Complexen van gebouwde Rijksmonumenten bekijken en op naam zoeken | In de resultaten als marker van het hoofdobject; in het detail worden de geometrieën van de afzonderlijke leden samen getoond | Hoofdobject, onderdelen en doorklikbare ledenlijst |
| Archeologisch onderzoeksgebied | Vrij zoeken op woonplaats en onderzoeksomschrijving | Polygon of MultiPolygon | Onderzoeksgegevens en gekoppelde archeologische inhoud |

Een Complex heeft in Doorzoeker geen kunstmatig berekende `union`-geometrie.
De kaart tekent de beschikbare Point-, Polygon- en MultiPolygon-geometrieën
van de leden in één laag. Daardoor blijft zichtbaar uit welke objecten het
complex bestaat en gaat er geen brongeometrie verloren.

## Archeologie

Archeologie bestaat in de data uit verschillende klassen. Doorzoeker behandelt
ze daarom niet alsof het één lijst met archeologische monumenten is.

| Onderdeel | Huidige dekking |
| --- | --- |
| Archeologisch Rijksmonument | Zelfstandig Rijksmonument, filterbaar als archeologisch |
| Archeologisch terrein | Gekoppelde verrijking bij een Rijksmonument via `ceo:ligtInObject`; Archis-monumentnummer en waardering worden getoond |
| Archeologisch onderzoeksgebied | Zelfstandig doorzoekbaar object met eigen geometrie en detailweergave |
| Archeologisch complex | Als gekoppelde lijst binnen een onderzoeksgebied; type en bron-URI worden getoond |
| Vondstlocatie | Tot 25 gekoppelde vondstlocaties per onderzoeksgebied worden met naam of CHO-nummer en bron-URI getoond |
| Vondst | Geen zelfstandige resultatenlijst; Doorzoeker toont het totale aantal gekoppelde vondsten binnen het onderzoeksgebied |
| Grondspoor | Geen zelfstandige resultatenlijst; Doorzoeker toont het totale aantal gekoppelde grondsporen binnen het onderzoeksgebied |
| Complex via vondstlocatie | Als totaal vermeld, naast rechtstreeks gekoppelde archeologische complexen |

De archeologische termen voor CHO-data komen uit het Archeologisch Informatie
Systeem binnen Referentienetwerk 2. Het losse ABR-endpoint wordt niet gebruikt
voor deze interne CHO-koppelingen.

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

## Begrippen en zoeken

De algemene CHO-zoekbalk zoekt tekst in de werkelijk aangesloten velden. De
woordsuggesties komen alleen uit vier relevante schema's van
Referentienetwerk 2:

- Archeologisch Informatie Systeem;
- Cultuurhistorische Object Informatie;
- Kennisregistratie;
- Monumenten Registratie Systeem.

Een suggestie is een tekstvoorstel en wordt als zodanig aangeduid. Alleen
velden waarvoor een gecontroleerde route bestaat — monumentaard,
archeologische waardering, gebeurtenistype en actor — kunnen exact op een
concept-URI worden doorzocht. Bibliotheek en Beeldbank gebruiken CHT in hun
eigen brondata; dat maakt CHT niet automatisch een algemene CHO-zoekindex.

## Bewuste grenzen

- Vondsten en grondsporen zijn nog geen zelfstandig doorzoekbare collecties.
- Er is nog geen ruimtelijke `ligt in`-relatie tussen Rijksmonumenten en
  Werelderfgoed of Gezichten; de bron bevat daarvoor geen directe relatie.
- De afzonderlijke geometrie van een historische groenaanleg is nog geen
  aparte kaartlaag.
- Geplande functies staan alleen in de verticale slice met status `Plan` en
  worden niet als bestaande functionaliteit beschreven.
