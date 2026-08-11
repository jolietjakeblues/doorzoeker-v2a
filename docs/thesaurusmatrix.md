# Thesaurusmatrix en navigatiefasen

Datum: 11 augustus 2026.

Status: analyse, nog niet uitvoeren.

## Huidige conceptvelden

| Conceptveld | Bron of schema | Exact zoeken | Tekstfallback | URL-herstel | Huidige toegang |
| --- | --- | --- | --- | --- | --- |
| `functie` | RN2, onder meer Monumenten Registratie Systeem | Ja | Ja bij suggestie zonder gemeten koppeling | Ja | Suggestie en record |
| `monumentaard` | RN2 | Ja | Ja bij niet gekoppelde suggestie | Ja | Record en detail |
| `waardering` | RN2, Cultuurhistorische Object Informatie | Ja | Niet als exact veld vanuit algemene suggestie | Ja | Archeologisch terrein |
| `gebeurtenis` | RN2 | Ja | Nee | Ja | Bouwgeschiedenis |
| `actor` | Actorenrolgraph en RN-term-URI | Ja | Nee | Ja | Bouwgeschiedenis en portfolio |
| `vondsttype` | RN2, Archeologisch Informatie Systeem | Ja | Ja bij niet gekoppelde suggestie | Ja | Vondst |
| `materiaal` | RN2, Archeologisch Informatie Systeem | Ja | Ja bij niet gekoppelde suggestie | Ja | Vondst |
| `toestand` | RN2, Cultuurhistorische Object Informatie | Ja | Ja bij niet gekoppelde suggestie | Ja | Vondst |
| `archeologischcomplextype` | RN2, Archeologisch Informatie Systeem | Ja | Ja bij niet gekoppelde suggestie | Ja | Archeologisch complex |

De algemene suggestiedienst gebruikt alleen vier CHO-relevante RN2-schema's:

- Archeologisch Informatie Systeem;
- Cultuurhistorische Object Informatie;
- Kennisregistratie;
- Monumenten Registratie Systeem.

CHT en ABR blijven relevante bronthesauri, maar zijn niet automatisch een
exacte algemene CHO-index. Zonder aangetoonde koppeling zoekt de interface
expliciet op tekst.

## Ontbrekend algemeen contract

Een navigeerbare conceptwaarde heeft minimaal nodig:

- URI;
- voorkeurslabel;
- conceptschema met URI en label;
- semantisch veld;
- ondersteunde zoekactie;
- herkomstobject;
- zichtbare fallback wanneer exact zoeken niet mogelijk is.

Dit contract bestaat nu verspreid over types, resultmapping, querydispatch,
URL-state en componentprops.

## Navigatiefasen

### Fase 1: breadcrumb met bredere begrippen

- Toon het huidige concept en `skos:broader`.
- Maak alleen bredere begrippen klikbaar wanneer een geldige zoekroute bekend is.
- Gebruik de bestaande `resolveConcept`-respons.
- Voeg geen volledige boom toe.

Dit is de kleinste functionele stap.

### Fase 2: bredere en nauwere begrippen

- Breid de concept-API uit met `skos:narrower` en eventueel `skos:related`.
- Toon relaties met hun type en conceptschema.
- Laad relaties pas bij openen van het conceptgedeelte.
- Behoud URI en pad in de URL.

### Fase 3: volledige structuurweergave

- Voeg een afzonderlijke weergave “in structuur” toe.
- Laad alleen wortels en geopende niveaus.
- Ondersteun deep-linking naar een conceptpad.
- Hergebruik het interactiepatroon uit v1:
  `ThesaurusController.js`, `NodeHandler.js` en de `itempath`-lookup.
- Neem de oude AngularJS-code niet over.

## Term tegenover bronrecord

Een toekomstig visueel patroon moet minimaal tonen:

| Type | Identiteit | Actie | Visuele aanduiding |
| --- | --- | --- | --- |
| Thesaurusterm | Concept-URI | Exact zoeken of conceptnavigatie | Label “Begrip” plus conceptschema |
| Bronrecord | CHO- of bron-URI | Detail openen | Label met objectsoort |
| Tekstfallback | Alleen tekst zolang geen koppeling bewezen is | Gewoon tekstzoeken | Expliciet “zoekt op tekst” |

Kleur mag dit onderscheid ondersteunen, maar mag niet de enige aanduiding zijn.
