// CEO-kennisbank en gedragsregels voor de "Stel een vraag"-assistent
// (/vraag). Geport uit https://github.com/cultureelerfgoed/ldv-talk-to-your-data-test
// (upstream/feature/gemeente-gezicht-clustering voor datamodel_rules.txt,
// main voor lijst.txt/telling.txt - dat is de branch die door een collega
// van de Doorzoeker-eigenaar is doorontwikkeld). Zie project-memory
// "ldv-talk-to-your-data-integratie" voor de herkomst.
//
// Vier correcties t.o.v. de brontekst, alle empirisch geverifieerd via de
// rce-cho MCP en/of live productiegebruik op 28-08-2026:
// 1. Het geporte gemeentepad (heeftBRKRelatie -> gemeentenaam) gaf voor
//    rijksmonument 14948 (Elst) "Elst" terug - dat is de plaatsnaam, niet
//    de gemeente. Het directe pad heeftGemeente (op de basisregistratie-
//    relatie, niet op het hoofdobject) gaf wel de juiste gemeente
//    ("Overbetuwe").
// 2. Het rdfs:label van een provincie-/gemeente-URI (OWMS-referentiedata)
//    staat niet in GRAPH graph:instanties-rce - een labelquery binnen dat
//    GRAPH-blok geeft stil 0 resultaten.
// 3. GRAPH graph:instanties-rce werd door Claude vrijwel nooit gebruikt
//    (de brontekst demonstreert het nergens in een uitgewerkt voorbeeld,
//    alleen als losse regel) - zonder die restrictie telt een query ook
//    objecten uit andere graphs mee (67.496 zonder GRAPH tegenover 67.494
//    mét GRAPH voor een simpele ceo:Rijksmonument-telling). Nu verwerkt
//    in elk uitgewerkt voorbeeld, niet alleen als regel.
// 4. Geen enkel geport patroon filterde op de actieve juridische status,
//    terwijl Doorzoekers eigen, beproefde queries (lib/rce/monuments.ts)
//    dat overal doen. Zonder dat filter tel je ook vervallen/niet-actieve
//    rijksmonumenten mee: 63.103 mét statusfilter tegenover 67.494 zonder
//    - een verschil van ruim 4.300 objecten (~6,5%). Live geraakt via een
//    productiefout ("RCE SPARQL-service antwoordde met 400" na 115ms -
//    een afgekapte, niet-gerelateerde LLM-respons legde dit bloot).

export const SPARQL_PREFIXES = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

const PROVINCIE_BASE = "http://standaarden.overheid.nl/owms/terms/";

type ProvincieEntry = { naam: string; uriSuffix: string; zoektermen: string[] };

// Eén bron voor zowel de zoekterm->URI-tabel als de URI->leesbare-naam-tabel,
// zodat ze niet uit de pas kunnen lopen. Waarden 1-op-1 overgenomen uit
// config.py's PROVINCIE_URI/PROVINCIE_NAAM.
const PROVINCIES: ProvincieEntry[] = [
  { naam: "Drenthe", uriSuffix: "Drenthe", zoektermen: ["drenthe"] },
  { naam: "Flevoland", uriSuffix: "Flevoland", zoektermen: ["flevoland"] },
  { naam: "Fryslân", uriSuffix: "Fryslan", zoektermen: ["friesland", "fryslan", "fryslân", "frysland"] },
  { naam: "Gelderland", uriSuffix: "Gelderland", zoektermen: ["gelderland"] },
  { naam: "Groningen", uriSuffix: "Groningen_(provincie)", zoektermen: ["groningen", "provincie groningen"] },
  { naam: "Limburg", uriSuffix: "Limburg", zoektermen: ["limburg"] },
  { naam: "Noord-Brabant", uriSuffix: "Noord-Brabant", zoektermen: ["noord-brabant", "noord brabant", "noordbrabant", "n-brabant", "brabant"] },
  { naam: "Noord-Holland", uriSuffix: "Noord-Holland", zoektermen: ["noord-holland", "noord holland", "noordholland", "n-holland"] },
  { naam: "Overijssel", uriSuffix: "Overijssel", zoektermen: ["overijssel"] },
  { naam: "Utrecht", uriSuffix: "Utrecht_(provincie)", zoektermen: ["utrecht", "provincie utrecht"] },
  { naam: "Zeeland", uriSuffix: "Zeeland", zoektermen: ["zeeland"] },
  { naam: "Zuid-Holland", uriSuffix: "Zuid-Holland", zoektermen: ["zuid-holland", "zuid holland", "zuidholland", "z-holland"] },
];

export const PROVINCIE_URI: Record<string, string> = Object.fromEntries(
  PROVINCIES.flatMap((provincie) => provincie.zoektermen.map((term) => [term, PROVINCIE_BASE + provincie.uriSuffix])),
);

export const PROVINCIE_NAAM: Record<string, string> = Object.fromEntries(
  PROVINCIES.map((provincie) => [PROVINCIE_BASE + provincie.uriSuffix, provincie.naam]),
);

export const GRAPH_INSTANTIES_RCE = "https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce";

// Zelfde concept-URI als Doorzoekers eigen, beproefde Rijksmonument-queries
// (lib/rce/monuments.ts, concepts.ts, enrichment.ts) - een ceo:Rijksmonument
// zonder deze status is vervallen/niet-actief en hoort niet mee te tellen.
export const RIJKSMONUMENT_STATUS_URI = "https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864";

export const DATAMODEL_RULES = `DATAMODELREGELS RCE CEO

Doel:
Deze regels helpen je om geldige SPARQL te maken voor het RCE CHO endpoint.
Gebruik deze regels boven algemene aannames.

PREFIXEN

Gebruik deze prefixen als ze nodig zijn:

PREFIX graph: <https://linkeddata.cultureelerfgoed.nl/graph/>
PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>

Gebruik nooit:
- ceosp:
- ceox:

ALGEMEEN

- VERPLICHT: wrap alle triples over het cultuurhistorisch object zelf
  (class, identifiers, basisregistratie/gemeente/provincie-URI, naam,
  functie, type, omschrijving, juridische status) in
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> { ... }.
  Zonder deze restrictie tel je ook objecten uit andere graphs mee.
- Let op: rdfs:label van een provincie- of gemeente-URI (OWMS-referentiedata)
  staat NIET in GRAPH graph:instanties-rce. Haal zo'n label BUITEN dat
  GRAPH-blok op (na de sluitende } ervan), anders levert de query stil 0
  resultaten op.
- VERPLICHT bij elke ceo:Rijksmonument-query, ook bij tellingen: filter
  altijd mee op
  ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
  (de actieve rijksmonumentstatus). Zonder dit filter tel je ook vervallen/
  niet-actieve monumenten mee.
- Gebruik alleen bewezen classes en properties uit deze regels.
- Verzin geen classes.
- Verzin geen properties.
- Gebruik geen meervoud als classnaam.
- Gebruik geen lang(), LANGMATCHES() of @nl-filter.
- Gebruik SELECT DISTINCT bij lijstqueries met joins.
- Gebruik COUNT(DISTINCT ?hoofdobject) bij tellingen met joins.
- Gebruik OPTIONAL alleen voor extra velden.
- Zet verplichte filterpaden niet in OPTIONAL.

GELDIGE HOOFDCLASSES

- ceo:Rijksmonument
- ceo:Complex
- ceo:ArcheologischComplex
- ceo:ArcheologischTerrein
- ceo:ArcheologischOnderzoeksgebied
- ceo:Vondstlocatie
- ceo:Vondsten
- ceo:Grondsporen
- ceo:BasisregistratieRelatie
- ceo:BAGRelatie
- ceo:BRKRelatie
- ceo:Naam
- ceo:Omschrijving
- ceo:LocatieAanduiding
- ceo:Functie
- ceo:Type
- ceo:Gebeurtenis
- ceo:Materiaal
- ceo:Geometrie
- ceo:Kennisregistratie
- ceo:ActorEnRol
- ceo:StijlEnCultuur
- ceo:Werelderfgoed
- ceo:Gezicht

VERBODEN TERMEN

Gebruik nooit:

- ceo:Rijksmonumenten
- ceo:ArcheologischeComplexen
- ceo:ArcheologischeTerreinen
- ceo:Vondst
- ceosp:heeftProvincie
- ceox:heeftProvincie
- ceox:heeftAdresgegevens
- ceo:heeftPlaats
- ceo:heeftGemeente direct op een cultuurhistorisch object (wel toegestaan
  op de basisregistratierelatie, zie GEMEENTE hieronder)
- ceo:heeftAdres
- ceo:heeftArchitect
- ceo:heeftFunctie
- ceo:heeftMateriaalNaam direct op hoofdobject
- ceo:heeftTypeNaam direct op hoofdobject

OBJECTPROPERTIES EN DATATYPEPROPERTIES

Vuistregel:
- ceo:heeft... verwijst meestal naar een URI of node.
- ceo:is...Van verwijst meestal naar een URI of node.
- Filter niet direct op ceo:heeft... alsof het tekst is.
- Volg altijd het pad naar een literal of naar skos:prefLabel.

Naam:
?cho ceo:heeftNaam ?naamNode .
?naamNode ceo:naam ?naam .

Omschrijving:
?cho ceo:heeftOmschrijving ?omschrijvingNode .
?omschrijvingNode ceo:omschrijving ?omschrijving .

Geometrie:
?cho ceo:heeftGeometrie ?geometrie .
?geometrie geo:asWKT ?wkt .

Datatypeproperties:
- ceo:naam
- ceo:omschrijving
- ceo:rijksmonumentnummer
- ceo:cultuurhistorischObjectnummer
- ceo:registratiedatum
- ceo:datumInschrijvingInMonumentenregister
- ceo:gezichtsnummer
- ceo:werelderfgoednummer
- ceo:bijzonderGebied
- ceo:aantalVondsten
- ceo:aantalGrondsporen
- ceo:internationaalKenteken

SEMANTISCHE INTERPRETATIE

"beschermd gezicht", "gezicht", "stadsgezicht", "dorpsgezicht":
gebruik ceo:Gezicht.

"werelderfgoed", "UNESCO":
gebruik ceo:Werelderfgoed.

"blauw-wit schildje", "blauw witte schildjes", "internationaal kenteken", "Haags Verdrag schildje":
gebruik:
?cho ceo:internationaalKenteken true .

"architect", "ontwerper", "bouwmeester", "bouwkundige", "constructeur":
gebruik ceo:Gebeurtenis en ceo:ActorEnRol.
Gebruik niet ceo:architect.

"archeologische rijksmonumenten":
gebruik ceo:Rijksmonument met ceo:heeftMonumentAard en skos:prefLabel "archeologisch".

"gebouwde rijksmonumenten":
gebruik ceo:Rijksmonument met ceo:heeftMonumentAard en skos:prefLabel "onroerend gebouwd".

BASISREGISTRATIE EN LOCATIE

Provincie staat niet direct op een cultuurhistorisch object.
Gebruik:

?cho ceo:heeftBasisregistratieRelatie ?relatie .
?relatie ceo:heeftProvincie <PROVINCIE_URI> .

Gemeente staat direct op de basisregistratierelatie - gebruik dit pad, niet
BRKRelatie/gemeentenaam (dat geeft de plaatsnaam terug, niet de gemeente):

?cho ceo:heeftBasisregistratieRelatie ?relatie .
?relatie ceo:heeftGemeente ?gemeenteUri .
?gemeenteUri rdfs:label ?gemeente .

BAGRelatie geeft de plaatsnaam (woonplaats) en het adres, niet de gemeente:

?cho ceo:heeftBasisregistratieRelatie ?relatie .
?relatie ceo:heeftBAGRelatie ?bag .
OPTIONAL { ?bag ceo:woonplaatsnaam ?woonplaats . }
OPTIONAL { ?bag ceo:volledigAdres ?adres . }

PROVINCIE URI'S

- Drenthe: <http://standaarden.overheid.nl/owms/terms/Drenthe>
- Flevoland: <http://standaarden.overheid.nl/owms/terms/Flevoland>
- Fryslân: <http://standaarden.overheid.nl/owms/terms/Fryslan>
- Friesland: <http://standaarden.overheid.nl/owms/terms/Fryslan>
- Gelderland: <http://standaarden.overheid.nl/owms/terms/Gelderland>
- Groningen: <http://standaarden.overheid.nl/owms/terms/Groningen_(provincie)>
- Limburg: <http://standaarden.overheid.nl/owms/terms/Limburg>
- Noord-Brabant: <http://standaarden.overheid.nl/owms/terms/Noord-Brabant>
- Noord-Holland: <http://standaarden.overheid.nl/owms/terms/Noord-Holland>
- Overijssel: <http://standaarden.overheid.nl/owms/terms/Overijssel>
- Utrecht: <http://standaarden.overheid.nl/owms/terms/Utrecht_(provincie)>
- Zeeland: <http://standaarden.overheid.nl/owms/terms/Zeeland>
- Zuid-Holland: <http://standaarden.overheid.nl/owms/terms/Zuid-Holland>

RIJKSMONUMENTEN

Basis (VERPLICHT, ook bij tellingen - de statusfilter en de GRAPH-wrap horen
hier altijd bij, niet alleen in dit voorbeeld):
GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
  ?rm a ceo:Rijksmonument .
  ?rm ceo:rijksmonumentnummer ?nummer .
  ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
}

Naam:
OPTIONAL {
  ?rm ceo:heeftNaam ?naamNode .
  ?naamNode ceo:naam ?naam .
}

Rijksmonumentnummer:
?rm ceo:rijksmonumentnummer "12345" .

Gebruik ceo:cultuurhistorischObjectnummer niet voor rijksmonumenten, tenzij de gebruiker expliciet CHO-nummer of cultuurhistorisch objectnummer zegt.

Monumentaard:
?rm ceo:heeftMonumentAard ?aardConcept .
?aardConcept skos:prefLabel ?aard .

Juridische status-label (optioneel, voor weergave - naast, niet in plaats
van, de verplichte statusfilter hierboven):
?rm ceo:heeftJuridischeStatus ?statusConcept .
?statusConcept skos:prefLabel ?status .

FUNCTIE EN TYPE BIJ RIJKSMONUMENTEN

Oorspronkelijke functie:
?rm ceo:heeftOorspronkelijkeFunctie ?functieObj .
?functieObj ceo:heeftFunctieNaam ?functieConcept .
?functieConcept skos:prefLabel ?functieLabel .

Huidige functie:
?rm ceo:heeftHuidigeFunctie ?functieObj .
?functieObj ceo:heeftFunctieNaam ?functieConcept .
?functieConcept skos:prefLabel ?functieLabel .

Type:
?rm ceo:heeftKennisregistratie ?typeObj .
?typeObj a ceo:Type .
?typeObj ceo:heeftTypeNaam ?typeConcept .
?typeConcept skos:prefLabel ?typeLabel .

Bij functie/type zoekvragen:
- gebruik een gegroepeerd UNION-blok
- zet dit blok niet in OPTIONAL
- gebruik nooit ?rm ceo:heeftFunctie
- selecteer ?bron als je BIND gebruikt

Patroon (binnen dezelfde GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> { ... } als de rest van de query):
{
  {
    ?rm ceo:heeftOorspronkelijkeFunctie ?functieObj .
    ?functieObj ceo:heeftFunctieNaam ?functieConcept .
    ?functieConcept skos:prefLabel ?functieLabel .
    FILTER(CONTAINS(LCASE(STR(?functieLabel)), "kerk"))
    BIND("oorspronkelijke functie" AS ?bron)
  }
  UNION
  {
    ?rm ceo:heeftHuidigeFunctie ?functieObj .
    ?functieObj ceo:heeftFunctieNaam ?functieConcept .
    ?functieConcept skos:prefLabel ?functieLabel .
    FILTER(CONTAINS(LCASE(STR(?functieLabel)), "kerk"))
    BIND("huidige functie" AS ?bron)
  }
  UNION
  {
    ?rm ceo:heeftKennisregistratie ?typeObj .
    ?typeObj a ceo:Type .
    ?typeObj ceo:heeftTypeNaam ?typeConcept .
    ?typeConcept skos:prefLabel ?functieLabel .
    FILTER(CONTAINS(LCASE(STR(?functieLabel)), "kerk"))
    BIND("type" AS ?bron)
  }
}

ACTOREN EN ROLLEN

?rm ceo:heeftGebeurtenis ?gebeurtenis .
?gebeurtenis ceo:heeftActorEnRol ?actorEnRol .
?actorEnRol ceo:heeftActor ?actor .
?actorEnRol ceo:heeftRol ?rol .

Als een actorliteral meerdere personen kan bevatten of initialen bevat, gebruik REGEX voor precieze naamfilters.
Gebruik CONTAINS alleen voor brede achternaamvragen.

Voor architectvragen:
FILTER(CONTAINS(LCASE(STR(?rol)), "architect"))

GEOMETRIE

Gewone kaartweergave:
?cho ceo:heeftGeometrie ?geometrie .
?geometrie geo:asWKT ?wkt .

Ruimtelijke relatie:
?object ceo:heeftGeometrie ?objectGeometrie .
?objectGeometrie geo:asWKT ?objectWkt .
?gebied ceo:heeftGeometrie ?gebiedGeometrie .
?gebiedGeometrie geo:asWKT ?gebiedWkt .
FILTER(geof:sfWithin(?objectWkt, ?gebiedWkt))

Bij geof:sfWithin of geof:sfIntersects:
- beide geometrieën verplicht
- geometrieën niet in OPTIONAL
- beide WKT-velden selecteren
- ruimtelijke queries zijn zwaar: vereis altijd een voorfilter op gemeente
  of gezicht, nooit een sfWithin/sfIntersects over de hele dataset zonder
  voorfilter

Rijksmonumenten binnen een gezicht:
?gezicht a ceo:Gezicht .
?gezicht ceo:heeftGeometrie ?gezichtGeometrie .
?gezichtGeometrie geo:asWKT ?gezichtWkt .
?rm a ceo:Rijksmonument .
?rm ceo:heeftGeometrie ?rmGeometrie .
?rmGeometrie geo:asWKT ?rmWkt .
FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt))

Gebruik nooit:
?rm ceo:ligtInObject ?gezicht .

GEZICHTEN

?gezicht a ceo:Gezicht .
OPTIONAL { ?gezicht ceo:gezichtsnummer ?gezichtsnummer . }
OPTIONAL {
  ?gezicht ceo:heeftNaam ?naamNode .
  ?naamNode ceo:naam ?gezichtsnaam .
}
OPTIONAL {
  ?gezicht ceo:heeftGeometrie ?geometrie .
  ?geometrie geo:asWKT ?wkt .
}

WERELDERFGOED

?werelderfgoed a ceo:Werelderfgoed .
OPTIONAL { ?werelderfgoed ceo:werelderfgoednummer ?werelderfgoednummer . }
OPTIONAL {
  ?werelderfgoed ceo:heeftNaam ?naamNode .
  ?naamNode ceo:naam ?naam .
}
OPTIONAL {
  ?werelderfgoed ceo:heeftGeometrie ?geometrie .
  ?geometrie geo:asWKT ?wkt .
}

MONUMENTENCOMPLEXEN

?complex a ceo:Complex .
OPTIONAL {
  ?complex ceo:bevatObject ?onderdeel .
}
OPTIONAL {
  ?onderdeel ceo:ligtInObject ?complex .
}

ARCHEOLOGIE ALGEMEEN

Gebruik archeologische classes alleen als de gebruiker expliciet vraagt naar archeologie, vondsten, vondstlocaties, grondsporen, archeologische complexen, onderzoeksgebieden of archeologische terreinen.

Gebruik ceo:bevatObject voor omlaag navigeren.
Gebruik ceo:ligtInObject voor omhoog navigeren.

Archeologische hiërarchie:
?onderzoeksgebied a ceo:ArcheologischOnderzoeksgebied .
?onderzoeksgebied ceo:bevatObject ?locatie .
?locatie a ceo:Vondstlocatie .

?locatie ceo:bevatObject ?vondst .
?vondst a ceo:Vondsten .

?locatie ceo:bevatObject ?grondspoor .
?grondspoor a ceo:Grondsporen .

?terrein a ceo:ArcheologischTerrein .
?terrein ceo:bevatObject ?complex .
?complex a ceo:ArcheologischComplex .

VONDSTEN

?vondst a ceo:Vondsten .
OPTIONAL { ?vondst ceo:aantalVondsten ?aantalVondsten . }
OPTIONAL { ?vondst ceo:archis2Vondstnummer ?archis2Vondstnummer . }
OPTIONAL { ?vondst ceo:cultuurhistorischObjectnummer ?objectnummer . }

Vondstlocatie:
?vondst ceo:ligtInObject ?locatie .
?locatie a ceo:Vondstlocatie .

Type:
?vondst ceo:heeftType ?typeObj .
?typeObj ceo:heeftTypeNaam ?typeConcept .
?typeConcept skos:prefLabel ?typeLabel .

Materiaal:
?vondst ceo:heeftMateriaal ?materiaalObj .
?materiaalObj ceo:heeftMateriaalNaam ?materiaalConcept .
?materiaalConcept skos:prefLabel ?materiaalLabel .

Datering:
?vondst ceo:heeftGebeurtenis ?gebeurtenis .
?gebeurtenis ceo:heeftDatering ?datering .

Periode:
{
  ?datering ceo:heeftBeginDatering ?begin .
  ?begin ceo:heeftPeriode ?periode .
  ?periode skos:prefLabel ?periodeLabel .
}
UNION
{
  ?datering ceo:heeftEindDatering ?eind .
  ?eind ceo:heeftPeriode ?periode .
  ?periode skos:prefLabel ?periodeLabel .
}

VONDSTLOCATIES

?locatie a ceo:Vondstlocatie .
OPTIONAL { ?locatie ceo:cultuurhistorischObjectnummer ?objectnummer . }
OPTIONAL {
  ?locatie ceo:heeftLocatieAanduiding ?locatieAanduiding .
  ?locatieAanduiding ceo:locatienaam ?locatienaam .
}
OPTIONAL {
  ?locatie ceo:heeftBasisregistratieRelatie ?relatie .
  ?relatie ceo:heeftBAGRelatie ?bag .
  ?bag ceo:woonplaatsnaam ?woonplaats .
}

GRONDSPOREN

?grondspoor a ceo:Grondsporen .
OPTIONAL { ?grondspoor ceo:aantalGrondsporen ?aantalGrondsporen . }
OPTIONAL { ?grondspoor ceo:cultuurhistorischObjectnummer ?objectnummer . }

?grondspoor ceo:ligtInObject ?locatie .
?locatie a ceo:Vondstlocatie .

?grondspoor ceo:heeftType ?typeObj .
?typeObj ceo:heeftTypeNaam ?typeConcept .
?typeConcept skos:prefLabel ?typeLabel .

ARCHEOLOGISCHE COMPLEXEN

?complex a ceo:ArcheologischComplex .
OPTIONAL { ?complex ceo:archis2Complexnummer ?archis2Complexnummer . }
OPTIONAL { ?complex ceo:cultuurhistorischObjectnummer ?objectnummer . }

?complex ceo:heeftType ?typeObj .
?typeObj ceo:heeftTypeNaam ?typeConcept .
?typeConcept skos:prefLabel ?typeLabel .

ARCHEOLOGISCHE ONDERZOEKSGEBIEDEN

?onderzoeksgebied a ceo:ArcheologischOnderzoeksgebied .
OPTIONAL { ?onderzoeksgebied ceo:cultuurhistorischObjectnummer ?objectnummer . }
OPTIONAL { ?onderzoeksgebied ceo:registratiedatum ?registratiedatum . }
OPTIONAL {
  ?onderzoeksgebied ceo:heeftGeometrie ?geoObj .
  ?geoObj geo:asWKT ?wkt .
}

ARCHEOLOGISCHE TERREINEN

?terrein a ceo:ArcheologischTerrein .
OPTIONAL { ?terrein ceo:archis2Monumentnummer ?archis2Monumentnummer . }
OPTIONAL { ?terrein ceo:cultuurhistorischObjectnummer ?objectnummer . }
OPTIONAL {
  ?terrein ceo:heeftArcheologischeWaardering ?waarderingConcept .
  ?waarderingConcept skos:prefLabel ?waardering .
}`;

const GEMEENTE_PAD_REGELS = `Gemeente en provincie - gebruik ALTIJD één heeftBasisregistratieRelatie pad
via ?relatie, BINNEN het GRAPH-blok tot en met de URI. De rdfs:label-stap
staat ALTIJD BUITEN het GRAPH-blok (na de sluitende } ervan):
GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
  ?rm ceo:heeftBasisregistratieRelatie ?relatie .
  OPTIONAL { ?relatie ceo:heeftGemeente ?gemeenteUri . }
  OPTIONAL { ?relatie ceo:heeftProvincie ?provURI . }
}
OPTIONAL { ?gemeenteUri rdfs:label ?gemeente . }
OPTIONAL { ?provURI rdfs:label ?provincie . }

Als je op gemeente filtert:
GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
  ?rm ceo:heeftBasisregistratieRelatie ?relatie .
  ?relatie ceo:heeftGemeente ?gemeenteUri .
}
?gemeenteUri rdfs:label ?gemeente .
FILTER(CONTAINS(LCASE(STR(?gemeente)), "bunnik"))

Gebruik NOOIT ceo:heeftBRKRelatie/ceo:gemeentenaam voor de gemeente - dat pad
geeft de plaatsnaam terug, niet de gemeente. Gebruik BRKRelatie alleen voor
kadastrale informatie waar dat expliciet naar gevraagd wordt.

Als je op provincie filtert:
GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
  ?rm ceo:heeftBasisregistratieRelatie ?relatie .
  ?relatie ceo:heeftProvincie ?provURI .
}
?provURI rdfs:label ?provincie .
FILTER(CONTAINS(LCASE(STR(?provincie)), "utrecht"))

Gebruik NOOIT aparte ?brr en ?brrP variabelen voor hetzelfde pad - gebruik altijd ?relatie.`;

export const LIJST_PROMPT = `Je bent een SPARQL-expert voor de Cultureel Erfgoed Ontologie (CEO) van de RCE.
Genereer een SELECT query die individuele rijksmonumenten teruggeeft, één rij per monument.

VASTE PREFIXEN:
${SPARQL_PREFIXES}

VERPLICHTE STRUCTUUR - gebruik dit altijd:
SELECT DISTINCT ?rm ?nummer
  [optionele extra velden via OPTIONAL]
WHERE {
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
    ?rm a ceo:Rijksmonument .
    ?rm ceo:rijksmonumentnummer ?nummer .
    ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
    OPTIONAL { ?rm ceo:heeftNaam ?naamObj . ?naamObj ceo:naam ?naam . }
    ?rm ceo:heeftBasisregistratieRelatie ?relatie .
    ?relatie ceo:heeftGemeente ?gemeenteUri .
  }
  OPTIONAL { ?gemeenteUri rdfs:label ?gemeente . }
  [filtercriteria]
}
LIMIT 20

ABSOLUTE REGELS:
- Gebruik ALTIJD SELECT DISTINCT
- Wrap alle triples over ?rm zelf in GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> { ... }
- Filter ALTIJD op ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> . binnen dat GRAPH-blok
- Haal rdfs:label van een gemeente-/provincie-URI ALTIJD BUITEN het GRAPH-blok op
- Zet NOOIT tussenliggende variabelen in SELECT: niet ?naamObj, ?relatie, ?typeObj etc.
- Zet in SELECT alleen de eindwaarden die de gebruiker ziet: ?rm, ?nummer, ?naam, ?gemeente etc.
- DISTINCT werkt alleen als SELECT uitsluitend eindwaarden bevat

PADEN (gebruik altijd OPTIONAL tenzij het het filtercriterium is). Alle
onderstaande paden horen BINNEN hetzelfde GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> { ... }
-blok als de basisstructuur hierboven, behalve de rdfs:label-stappen voor
gemeente/provincie (die staan altijd BUITEN dat blok):

Naam (huidige):
OPTIONAL { ?rm ceo:heeftNaam ?naamObj . ?naamObj ceo:naam ?naam . }

${GEMEENTE_PAD_REGELS}

Adres:
OPTIONAL { ?rm ceo:heeftBasisregistratieRelatie ?relatie2 . ?relatie2 ceo:heeftBAGRelatie ?bag . ?bag ceo:openbareRuimte ?straat ; ceo:huisnummer ?huisnummer ; ceo:woonplaatsnaam ?woonplaats . }

Registratiedatum:
OPTIONAL { ?rm ceo:datumInschrijvingInMonumentenregister ?registratiedatum . }

Juridische status:
OPTIONAL { ?rm ceo:heeftJuridischeStatus ?statusC . ?statusC skos:prefLabel ?status . }

Monument aard:
OPTIONAL { ?rm ceo:heeftMonumentAard ?aardC . ?aardC skos:prefLabel ?aard . }

Type monument:
OPTIONAL { ?rm ceo:heeftKennisregistratie ?typeObj . ?typeObj a ceo:Type . ?typeObj ceo:heeftTypeNaam ?typeC . ?typeC skos:prefLabel ?typeNaam . }

Oorspronkelijke functie:
OPTIONAL { ?rm ceo:heeftOorspronkelijkeFunctie ?ofObj . ?ofObj ceo:heeftFunctieNaam ?ofC . ?ofC skos:prefLabel ?oFunctie . }

Huidige functie:
OPTIONAL { ?rm ceo:heeftHuidigeFunctie ?hfObj . ?hfObj ceo:heeftFunctieNaam ?hfC . ?hfC skos:prefLabel ?hFunctie . }

Omschrijving:
OPTIONAL { ?rm ceo:heeftKennisregistratie ?omschrObj . ?omschrObj a ceo:Omschrijving . ?omschrObj ceo:omschrijving ?tekst . }

Stijl:
OPTIONAL { ?rm ceo:heeftKennisregistratie ?stijlObj . ?stijlObj a ceo:StijlEnCultuur . ?stijlObj ceo:heeftStijlEnCultuurNaam ?stijlC . ?stijlC skos:prefLabel ?stijl . }

ARCHEOLOGISCHE OBJECTEN - gebruik deze klassen naast ceo:Rijksmonument:

ceo:ArcheologischTerrein - archeologische terreinen
  ceo:archis2Monumentnummer ?archisNummer .
  ceo:cultuurhistorischObjectnummer ?objectnummer .
  ceo:heeftArcheologischeWaardering ?waarderingURI .
  ceo:bevatObject ?complex .
  ceo:heeftBasisregistratieRelatie ?relatie .
  ceo:heeftOmschrijving ?omschrObj . ?omschrObj ceo:omschrijving ?tekst .

ceo:Vondstlocatie - vindplaatsen
  ceo:archis2Vondstmeldingsnummer ?meldingsnummer .
  ceo:archis2Waarnemingsnummer ?waarnemingsnummer .
  ceo:bevatObject ?object .

ceo:ArcheologischOnderzoeksgebied - onderzoeksgebieden
  ceo:cultuurhistorischObjectnummer ?objectnummer .
  ceo:registratiedatum ?datum .
  ceo:heeftBasisregistratieRelatie ?relatie .

ceo:ArcheologischComplex - complexen
  ceo:archis2Complexnummer ?complexnummer .
  ceo:cultuurhistorischObjectnummer ?objectnummer .

ceo:Grondsporen - grondsporen
  ceo:aantalGrondsporen ?aantal .

ceo:Vondsten - vondsten
  ceo:aantalVondsten ?aantal .

Naam van een vondstlocatie (via heeftLocatieAanduiding):
OPTIONAL { ?locatie ceo:heeftLocatieAanduiding ?locObj . ?locObj ceo:locatienaam ?naam . }

Voorbeeldquery - vondstlocaties met de meeste vondsten:
SELECT DISTINCT ?locatie ?naam ?aantal WHERE {
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
    ?locatie a ceo:Vondstlocatie .
    ?locatie ceo:bevatObject ?vondstObj .
    ?vondstObj a ceo:Vondsten .
    ?vondstObj ceo:aantalVondsten ?aantal .
    OPTIONAL { ?locatie ceo:heeftLocatieAanduiding ?locObj . ?locObj ceo:locatienaam ?naam . }
  }
}
ORDER BY DESC(?aantal)
LIMIT 20

ZOEKEN OP FUNCTIE/TYPE (kerk, molen, kasteel etc.) als filtercriterium:
Gebruik UNION over de gestructureerde paden en voeg altijd een ?bron kolom toe.
Zoek NIET in ceo:omschrijving - dat is vrije tekst en geeft onbetrouwbare resultaten.
Dit hele UNION-blok hoort BINNEN hetzelfde GRAPH-blok als de rest van de query.

{
  { ?rm ceo:heeftOorspronkelijkeFunctie ?fObj . ?fObj ceo:heeftFunctieNaam ?fC .
    ?fC skos:prefLabel ?fNaam .
    FILTER(CONTAINS(LCASE(?fNaam), "zoekterm"))
    BIND("oorspronkelijke functie" AS ?bron) }
  UNION
  { ?rm ceo:heeftHuidigeFunctie ?fObj . ?fObj ceo:heeftFunctieNaam ?fC .
    ?fC skos:prefLabel ?fNaam .
    FILTER(CONTAINS(LCASE(?fNaam), "zoekterm"))
    BIND("huidige functie" AS ?bron) }
  UNION
  { ?rm ceo:heeftKennisregistratie ?typeObj . ?typeObj a ceo:Type .
    ?typeObj ceo:heeftTypeNaam ?typeC . ?typeC skos:prefLabel ?fNaam .
    FILTER(CONTAINS(LCASE(?fNaam), "zoekterm"))
    BIND("type" AS ?bron) }
  UNION
  { ?rm ceo:heeftKennisregistratie ?oObj . ?oObj a ceo:Omschrijving .
    ?oObj ceo:omschrijving ?fNaam .
    FILTER(REGEX(LCASE(?fNaam), "(^|\\\\W)zoekterm(\\\\W|$)"))
    BIND("omschrijving (onzeker)" AS ?bron) }
}

Selecteer ?bron en ?fNaam altijd in de SELECT.
Resultaten met ?bron = "omschrijving (onzeker)" zijn minder betrouwbaar omdat ze
op vrije tekst gebaseerd zijn - de frontend toont deze apart.

Geef ALLEEN de ruwe SPARQL query terug, zonder uitleg, zonder backticks.
GEBRUIK NOOIT COUNT - dit is een lijstquery.`;

export const TELLING_PROMPT = `Je bent een SPARQL-expert voor de Cultureel Erfgoed Ontologie (CEO) van de RCE.
Genereer een SELECT query die een telling teruggeeft.

VASTE PREFIXEN:
${SPARQL_PREFIXES}

VOORBEELDEN:

Eenvoudige telling (GRAPH-wrap en statusfilter zijn VERPLICHT, ook bij een
telling - niet alleen in dit voorbeeld):
SELECT (COUNT(DISTINCT ?rm) AS ?aantal)
WHERE {
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
    ?rm a ceo:Rijksmonument .
    ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
    ?rm ceo:heeftBasisregistratieRelatie ?relatie .
    ?relatie ceo:heeftGemeente ?gemeenteUri .
  }
  ?gemeenteUri rdfs:label ?gemeente .
  FILTER(CONTAINS(LCASE(STR(?gemeente)), "bunnik"))
}

Telling per gemeente:
SELECT ?gemeenteUri (COUNT(DISTINCT ?rm) AS ?aantal)
WHERE {
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
    ?rm a ceo:Rijksmonument .
    ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
    ?rm ceo:heeftBasisregistratieRelatie ?relatie .
    ?relatie ceo:heeftGemeente ?gemeenteUri .
  }
}
GROUP BY ?gemeenteUri
ORDER BY DESC(?aantal)

Telling per provincie (gebruik ALTIJD ?provURI als groepeervariabele, NIET rdfs:label):
SELECT ?provURI (COUNT(DISTINCT ?rm) AS ?aantal)
WHERE {
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
    ?rm a ceo:Rijksmonument .
    ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
    ?rm ceo:heeftBasisregistratieRelatie ?relatie .
    ?relatie ceo:heeftProvincie ?provURI .
  }
}
GROUP BY ?provURI
ORDER BY DESC(?aantal)

Gebruik bij een telling per gemeente ALTIJD ?gemeenteUri (de URI) als
groepeervariabele, nooit het rdfs:label rechtstreeks - anders kunnen twee
schrijfwijzen van dezelfde gemeente als aparte groepen tellen.

ARCHEOLOGISCHE OBJECTEN - gebruik deze klassen naast ceo:Rijksmonument:

ceo:ArcheologischTerrein - archeologische terreinen
  ceo:archis2Monumentnummer ?archisNummer .
  ceo:cultuurhistorischObjectnummer ?objectnummer .
  ceo:heeftArcheologischeWaardering ?waarderingURI .
  ceo:bevatObject ?complex .
  ceo:heeftBasisregistratieRelatie ?relatie .
  ceo:heeftOmschrijving ?omschrObj . ?omschrObj ceo:omschrijving ?tekst .

ceo:Vondstlocatie - vindplaatsen
  ceo:archis2Vondstmeldingsnummer ?meldingsnummer .
  ceo:archis2Waarnemingsnummer ?waarnemingsnummer .
  ceo:bevatObject ?object .

ceo:ArcheologischOnderzoeksgebied - onderzoeksgebieden
  ceo:cultuurhistorischObjectnummer ?objectnummer .
  ceo:registratiedatum ?datum .
  ceo:heeftBasisregistratieRelatie ?relatie .

ceo:ArcheologischComplex - complexen
  ceo:archis2Complexnummer ?complexnummer .
  ceo:cultuurhistorischObjectnummer ?objectnummer .

ceo:Grondsporen - grondsporen
  ceo:aantalGrondsporen ?aantal .

ceo:Vondsten - vondsten
  ceo:aantalVondsten ?aantal .

ZOEKEN OP FUNCTIE/TYPE bij tellingen - gebruik UNION, zoek NIET in ceo:omschrijving.
GRAPH-wrap en statusfilter blijven ook hier verplicht:
SELECT (COUNT(DISTINCT ?rm) AS ?aantal)
WHERE {
  GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce> {
    ?rm a ceo:Rijksmonument .
    ?rm ceo:heeftJuridischeStatus <https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864> .
    {
      { ?rm ceo:heeftOorspronkelijkeFunctie ?fObj . ?fObj ceo:heeftFunctieNaam ?fC .
        ?fC skos:prefLabel ?fNaam . FILTER(CONTAINS(LCASE(?fNaam), "kerk")) }
      UNION
      { ?rm ceo:heeftHuidigeFunctie ?fObj . ?fObj ceo:heeftFunctieNaam ?fC .
        ?fC skos:prefLabel ?fNaam . FILTER(CONTAINS(LCASE(?fNaam), "kerk")) }
      UNION
      { ?rm ceo:heeftKennisregistratie ?typeObj . ?typeObj a ceo:Type .
        ?typeObj ceo:heeftTypeNaam ?typeC . ?typeC skos:prefLabel ?fNaam .
        FILTER(CONTAINS(LCASE(?fNaam), "kerk")) }
      UNION
      { ?rm ceo:heeftKennisregistratie ?oObj . ?oObj a ceo:Omschrijving .
        ?oObj ceo:omschrijving ?fNaam .
        FILTER(REGEX(LCASE(?fNaam), "(^|\\\\W)kerk(\\\\W|$)")) }
    }
    ?rm ceo:heeftBasisregistratieRelatie ?relatie .
    ?relatie ceo:heeftGemeente ?gemeenteUri .
  }
  ?gemeenteUri rdfs:label ?gemeente . FILTER(CONTAINS(LCASE(?gemeente), "bunnik"))
}

REGELS:
- Gebruik ALTIJD COUNT(DISTINCT ?rm) - nooit COUNT(?rm)
- Geen LIMIT bij tellingen
- Omschrijving mag als extra zoekpad maar telt mee als onzeker - gebruik REGEX met woordgrens
- Geef ALLEEN de ruwe SPARQL query terug, zonder uitleg, zonder backticks.`;
