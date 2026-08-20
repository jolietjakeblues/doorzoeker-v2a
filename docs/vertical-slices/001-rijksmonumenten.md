# Verticale slice 001: Rijksmonumenten zoeken en bekijken

## Status

Geïmplementeerd en live, met een grotere scope dan hieronder oorspronkelijk
gepland: naast Rijksmonumenten (gebouwd/archeologisch) zijn ook Werelderfgoed,
rijksbeschermde Gezichten, Complexen (van gebouwde Rijksmonumenten) en
archeologische Onderzoeksgebieden doorzoekbaar en toonbaar geworden, plus
archeologische terreinverrijking, archeologische complexen, vondstlocaties en
aggregaten binnen Onderzoeksgebieden, een
doorklikbare complex-ledenlijst, een foto uit de RCE beeldbank en historische
tuin-/parkaanleg (groenaanleg) op de detailpagina. Dit document is bijgewerkt
om dat te weerspiegelen; de oorspronkelijke "niet in scope"-uitsluiting van
werelderfgoed/gezichten is vervallen. De actuele dekking per objectklasse en
geometrievorm staat in [`../functionele-dekking.md`](../functionele-dekking.md).

## Doel

Een gebruiker kan een rijksmonument, werelderfgoed of rijksbeschermd gezicht
vinden, de zoekresultaten verfijnen, de locatie op een kaart zien en een
betrouwbare detailpagina openen. Deze slice valideert de volledige keten van
browser tot RCE Linked Data.

## Primaire gebruikerstaak

> Als geïnteresseerde of erfgoedprofessional wil ik rijksmonumenten kunnen
> vinden op herkenbare gegevens, zodat ik snel het juiste object en de
> beschikbare context kan bekijken.

## In scope

### Zoeken

- vrije invoer voor naam, volledig adres, straat, woonplaats, postcode en
  rijksmonumentnummer;
- herkenning van een exact rijksmonumentnummer;
- browsen van de volledige collectie Werelderfgoed, Gezichten of Complexen,
  los van een zoekterm (alle drie zijn klein genoeg om in hun geheel te
  tonen);
- paginering per 25 resultaten voor tekstzoekopdrachten;
- duidelijke lege, laad- en fouttoestanden.

### Filters

- soort object: Rijksmonument, Werelderfgoed, Gezicht of Complex (dit zijn
  verschillende soorten cultuurhistorisch object, geen monumentaard-varianten
  — Werelderfgoed en Gezicht zijn gebieden waar de RCE verantwoordelijk voor
  is en die rijksmonumenten kunnen bevatten, maar zijn zelf geen aangewezen
  rijksmonument; een Complex is een samenstel van meerdere rijksmonumenten,
  zelf ook geen aparte rijksmonumentstatus);
- monumentaard: gebouwd of archeologisch (alleen van toepassing binnen
  Rijksmonument);
- provincie en gemeente/woonplaats (provincie versmalt eerst de
  gemeentelijst);
- oorspronkelijke functie;
- matchbron (via welk gegevensveld een tekstzoekopdracht raak was).

Alleen filters die betrouwbaar uit de huidige gegevens kunnen worden afgeleid,
worden getoond.

### Resultaten

- lijst met naam of functionele titel, adres, plaats, rijksmonumentnummer,
  soort object, monumentaard en oorspronkelijke functie;
- kaart met geclusterde markers, met een eigen kleur per soort object;
- wisselen tussen lijst en kaart zonder verlies van zoektoestand;
- een stabiele link naar ieder resultaat.

### Detail

- naam of titel;
- volledig adres en plaats (indien van toepassing — Werelderfgoed en
  Gezichten hebben geen adres);
- rijksmonument-, werelderfgoed- of gezichtsnummer en cultuurhistorisch
  objectnummer;
- juridische status (per soort object: Rijksmonument, Werelderfgoed of
  rijksbeschermd stads-/dorpsgezicht) en monumentaard;
- oorspronkelijke en eventuele huidige functie;
- omschrijving;
- compacte kaartweergave van de locatie, met de ruwe WKT-geometrie
  uitklapbaar beschikbaar voor wie de brondata wil verifiëren;
- kadastrale percelen, archeologische terreingegevens (Archis-monumentnummer,
  waardering) en complexverband (hoofdobject/onderdeel, met een doorklikbare
  lijst van de overige complexleden), waar van toepassing;
- een foto uit de RCE beeldbank met licentie- en bronvermelding, en
  historische tuin-/parkaanleg (groenaanleg), waar beschikbaar;
- canonieke URI en zichtbare bronvermelding: Monumentenregister, UNESCO
  Werelderfgoedlijst of RCE Kennisbank (Gezicht), plus altijd de RCE Linked
  Data-link. Een Gezicht linkte aanvankelijk naar het Archis-archief
  (`ceo:wordtGetoondOp`), maar dat hele domein
  (`archisarchief.cultureelerfgoed.nl`) bleek dood (403/404 op elk pad, ook
  de root) - vervangen door `https://kennis.cultureelerfgoed.nl/index.php/
  Gezicht/{gezichtsnummer}`, live bevestigd werkend (20 augustus 2026).

### Termen

- termsuggesties zijn gekoppeld aan een expliciet gekozen verzameling relevante
  terminologiebronnen;
- de geselecteerde term wordt als URI vastgelegd;
- een mislukte termsuggestie-aanroep blokkeert een gewone tekstzoekopdracht
  niet.

### Deelbaarheid

Zoekterm, filters, pagina, gekozen weergave en kaartvenster zijn reproduceerbaar
vanuit de URL.

## Niet in scope

- accounts, favorieten en persoonlijke lijsten;
- een vrije natuurlijke-taalassistent;
- bewerken van RCE-data;
- federatief zoeken in alle externe erfgoedcollecties;
- bibliotheek en beeldbank als zelfstandige resultaatcollecties;
- ruimtelijke "ligt in"-relaties tussen een monument en het Gezicht of
  Werelderfgoed waarbinnen het ligt (vereist lokale point-in-polygon-berekening
  in plaats van GeoSPARQL, dat op deze SPARQL-service structureel timeout);
- een algemene SPARQL-editor voor eindgebruikers.

## Applicatiecontracten

De exacte HTTP-vorm wordt tijdens de stackkeuze bepaald. De slice vereist
conceptueel de volgende backendoperaties:

- `searchMonuments(criteria)` — gepagineerde resultaten en beschikbare
  filterinformatie;
- `getMonument(uri)` — genormaliseerd detailmodel;
- `getMonumentMap(criteria, viewport)` — begrensde kaartresultaten;
- `suggestTerms(query, sources)` — genormaliseerde SKOS-suggesties.

## Acceptatiecriteria

1. Zoeken op een bestaand rijksmonumentnummer opent of vindt het juiste object.
2. Een zoekopdracht op woonplaats kan met ten minste twee beschikbare filters
   worden verfijnd.
3. Lijst- en kaartweergave representeren dezelfde actieve zoekcriteria.
4. Herladen of delen van de URL herstelt de zoektoestand.
5. Een detailpagina toont de canonieke RCE-URI en herleidbare kerngegevens.
6. Een timeout of fout van één externe voorziening geeft een begrijpelijke
   melding en veroorzaakt geen blanco applicatiepagina.
7. Onbegrensde of door de gebruiker aangeleverde SPARQL wordt niet uitgevoerd.
8. Geautomatiseerde contracttests dekken mapping van ten minste één gebouwd en
   één archeologisch monument.

## Technische spike vóór implementatie

De spike moet vaststellen:

- welke opgeslagen RCE REST-query's de zoekvelden en filters dekken;
- welke aanvullende SPARQL-query's noodzakelijk zijn;
- hoe geometrie, namen, adressen, functies en omschrijvingen betrouwbaar worden
  gemapt;
- welke Termennetwerkbronnen relevant zijn;
- gemeten responstijden en veilige pagina-/resultaatlimieten;
- of een zoekindex voor deze eerste slice noodzakelijk is.

## Klaar wanneer

De slice draait lokaal, heeft geautomatiseerde tests voor de kerncontracten en
kan met actuele RCE-data van zoekopdracht tot detailpagina worden gedemonstreerd.
