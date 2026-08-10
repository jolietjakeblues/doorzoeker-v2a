# Verticale slice 008: "Vergelijkbare rijksmonumenten"-aanbeveling

## Status

Plan, nog niet gebouwd. Het idee ontstond naar aanleiding van de bestaande
conceptnavigatie: monumentaard, waardering, gebeurtenistype
en actor zijn nu allemaal losse, klikbare concept-URI's - maar nooit
gecombineerd. Dit plan combineert ze tot een aanbeveling.

## Aanleiding

Elke concept-URI die deze sessie klikbaar is gemaakt (monumentaard,
archeologische waardering, gebeurtenistype, actor) is een aparte,
één-op-één zoekopdracht. Een Rijksmonument-detailpagina zou in plaats
daarvan "vergelijkbare rijksmonumenten" kunnen tonen: monumenten die op
*meerdere* van deze dimensies tegelijk overeenkomen, met een hogere score
naarmate er meer dimensies overlappen.

## Empirisch bevestigd (2026-08-10) - en een belangrijke nuance

1. Monumentaard is op vrijwel elk Rijksmonument aanwezig (heel de
   basispopulatie) - als scoringsdimensie draagt dit dus nauwelijks bij
   aan onderscheidend vermogen. Twee willekeurige Rijksmonumenten delen al
   gauw dezelfde monumentaard zonder dat dat iets betekent.
2. Actor (architect/aannemer) en archeologische waardering blijken in de
   praktijk **niet te overlappen**: een architect werkt aan gebouwde
   monumenten, waardering geldt voor archeologische terreinen - in een
   gerichte steekproef kwam de combinatie 0 keer voor. Dat is op zich
   logisch (twee losse domeinen), maar betekent wel dat niet elke
   combinatie van dimensies zinvol is.
3. **Nog niet volledig uitgezocht**: welke *paren* van dimensies wél
   voldoende gezamenlijk voorkomen om een goede aanbeveling te leveren
   (bv. actor + gebeurtenistype, of type + functie). Dit plan stelt daarom
   een eerste, bewust beperkte scoringsopzet voor en behandelt de exacte
   gewichten als iets om tijdens de bouw verder te verifiëren, niet als
   vooraf vastgesteld.

## Doel

Op de detailpagina van een Rijksmonument een "Vergelijkbare
rijksmonumenten"-lijst tonen: andere Rijksmonumenten die op minstens één,
bij voorkeur meerdere, van de klikbare dimensies overeenkomen, gesorteerd
op aantal overeenkomende dimensies.

## Voorgestelde aanpak

1. Voor het geopende Rijksmonument zijn de relevante concept-URI's al in
   het `Item` aanwezig (via bestaande enrichment):
   `monumentAardConcept.uri`, `archaeologicalSites[].waarderingConceptUri`,
   `gebeurtenissen[].naamConceptUri`, `gebeurtenissen[].actoren[].actorConceptUri`.
2. Nieuwe, aparte lazy-endpoint (`/api/rce/vergelijkbaar?rmnr=<nummer>`),
   pas bevraagd zodra de detailpagina daadwerkelijk open is - zelfde
   lazy-patroon als complexleden/onderzoeksgebied-verrijking, niet
   vooraf voor de hele resultatenlijst.
3. De query voert per beschikbare dimensie een aparte, kleine
   `VALUES`-lookup uit (dezelfde vorm als de bestaande
   `buildMonumentAardConceptQuery`/`buildActorConceptQuery`, maar
   `LIMIT`-begrensd) en telt in JS hoe vaak elk kandidaat-rijksmonument
   terugkomt over de dimensies heen - geen ingewikkelde
   gewogen-SPARQL-score, gewoon een simpele tel-en-sorteer in de adapter,
   consistent met hoe deze sessie steeds gekozen heeft voor JS-side
   verwerking boven complexe SPARQL-aggregatie.
4. Alleen dimensies die het geopende monument daadwerkelijk heeft worden
   meegenomen (geen "vergelijkbaar" tonen op basis van een lege dimensie).
   Monumentaard telt bewust licht mee (of wordt als tiebreaker gebruikt in
   plaats van als hoofdscore) omdat het te weinig onderscheidt - zie
   "Empirisch bevestigd".
5. UI: nieuwe sectie "Vergelijkbare rijksmonumenten" onderaan het
   detailpaneel, elk item toont welke dimensie(s) overeenkomen (bv. "zelfde
   architect, zelfde gebeurtenistype"), doorklikbaar naar dat monument.

## Scope-afbakening

- Alleen Rijksmonument-op-Rijksmonument vergelijking, geen vergelijking
  met/tussen Werelderfgoed/Gezicht/Complex/Onderzoeksgebied.
- Geen configureerbare gewichten in de UI - een vaste, eenvoudige
  telling, later bij te stellen op basis van gebruikersfeedback.
- Geen "waarom is dit een aanbeveling" met een uitgebreide uitleg per
  dimensiepaar in de eerste versie - alleen welke dimensies matchen.

## Openstaande vragen

- Welke dimensieparen leveren in de praktijk de meest zinvolle (niet
  toevallige) aanbevelingen op? Nog te verifiëren tijdens de bouw met
  echte voorbeelden.
- Cap op het aantal getoonde aanbevelingen (voorstel: 5), en wat te tonen
  als er geen enkele match is (sectie gewoon weglaten, net als de andere
  optionele detailrijen).
- Performance van 3-4 losse concept-lookups per detailpagina-opening -
  nog niet gemeten, waarschijnlijk vergelijkbaar met de bestaande
  concept-zoekopdrachten (goedkoop, exacte URI-match, `LIMIT`-begrensd).

## Acceptatiecriteria

1. Een Rijksmonument-detailpagina met minstens één klikbare dimensie
   toont een "Vergelijkbare rijksmonumenten"-sectie zodra er matches zijn.
2. Monumenten die op meerdere dimensies overeenkomen staan hoger dan
   monumenten met maar één overeenkomst.
3. Geen sectie zichtbaar wanneer er geen matches zijn.
4. Typecheck/lint/test blijven groen.

## Klaar wanneer

Een geopend Rijksmonument met minstens één klikbare dimensie toont een
gesorteerde lijst vergelijkbare rijksmonumenten, elk met zichtbare reden
("zelfde architect", "zelfde gebeurtenistype", ...), lazy geladen zodra de
detailpagina opent.
