# Verticale slice 001: Rijksmonumenten zoeken en bekijken

## Doel

Een gebruiker kan een rijksmonument vinden, de zoekresultaten verfijnen, de
locatie op een kaart zien en een betrouwbare detailpagina openen. Deze slice
valideert de volledige keten van browser tot RCE Linked Data.

## Primaire gebruikerstaak

> Als geïnteresseerde of erfgoedprofessional wil ik rijksmonumenten kunnen
> vinden op herkenbare gegevens, zodat ik snel het juiste object en de
> beschikbare context kan bekijken.

## In scope

### Zoeken

- vrije invoer voor naam, volledig adres, straat, woonplaats, postcode en
  rijksmonumentnummer;
- herkenning van een exact rijksmonumentnummer;
- paginering;
- duidelijke lege, laad- en fouttoestanden.

### Filters

- provincie en gemeente;
- juridische status;
- monumentaard: gebouwd of archeologisch;
- oorspronkelijke functie.

Alleen filters die betrouwbaar uit de huidige gegevens kunnen worden afgeleid,
worden getoond.

### Resultaten

- lijst met naam of functionele titel, adres, plaats, rijksmonumentnummer,
  monumentaard en oorspronkelijke functie;
- kaart met geclusterde markers;
- wisselen tussen lijst en kaart zonder verlies van zoektoestand;
- een stabiele link naar ieder resultaat.

### Detail

- naam of titel;
- volledig adres en plaats;
- rijksmonumentnummer en cultuurhistorisch objectnummer;
- juridische status en monumentaard;
- oorspronkelijke en eventuele huidige functie;
- omschrijving;
- geometrie of kaartpositie;
- canonieke URI en zichtbare bronvermelding RCE.

### Termen

- termsuggesties zijn gekoppeld aan een expliciet gekozen verzameling relevante
  terminologiebronnen;
- de geselecteerde term wordt als URI vastgelegd;
- een mislukte Termennetwerk-aanroep blokkeert een gewone tekstzoekopdracht
  niet.

### Deelbaarheid

Zoekterm, filters, pagina, gekozen weergave en kaartvenster zijn reproduceerbaar
vanuit de URL.

## Niet in scope

- accounts, favorieten en persoonlijke lijsten;
- een vrije natuurlijke-taalassistent;
- bewerken van RCE-data;
- federatief zoeken in alle externe erfgoedcollecties;
- werelderfgoed, beschermde gezichten, bibliotheek en beeldbank als zelfstandige
  resultaatcollecties;
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

