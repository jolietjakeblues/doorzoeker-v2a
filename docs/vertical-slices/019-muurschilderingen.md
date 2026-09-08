# Verticale slice 019: Muurschilderingen

## Status

Onderzoek — nog niet gepland, nog niet gebouwd. Eerst onderzoek, dan plan
(dit document), dan pas bouwen, zelfde volgorde als bij slice 018
(scheepswrakken). De empirische bevindingen hieronder komen uit een eigen
verkenner die de eigenaar deze week al bouwde bovenop dezelfde brondataset
([`muurschilderingendatabase-explorer`](https://github.com/jolietjakeblues/muurschilderingendatabase-explorer),
live op `jolietjakeblues.github.io/muurschilderingendatabase-explorer`) —
dus geen educated guess, maar cijfers uit een werkend, live geverifieerd
systeem tegen dezelfde bron.

## Aanleiding

De eigenaar vroeg: kan de linked data van de Muurschilderingendatabase aan
Doorzoeker toegevoegd worden. Net als MASS (slice 018) is dit een heel
ander soort erfgoed dan wat Doorzoeker nu toont — geen monumenten of
archeologie, maar **muurschilderingen in kerken en andere gebouwen**, met
een sterke inhoudelijke link naar het bestaande Rijksmonumenten-domein (zie
punt 5 hieronder) die MASS niet had.

## Empirisch bevestigd (via de losstaande explorer, build van 2026-09-05)

1. **Endpoint en schaal.**
   `https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/Muurschilderingen/sparql`
   — 576 gebouwen, 2.685 schilderingen, 948 iconografische onderwerpen, 217
   makers (personen/organisaties) met ≥1 gekoppelde schildering. Ruim binnen
   het bereik waarin slice 018 "geen tweefasenpatroon nodig" concludeerde
   (dat lag bij 2.587 scheepswrakken al goed; hier is de kernentiteit
   — gebouwen — zelfs kleiner, 576).
2. **Eigen vocabulaire, niet CEO — en ook niet het `sdo:`-vocabulaire van
   MASS.** Mix van schema.org (`schema:Painting`, `schema:Person`,
   `schema:Organization`), een eigen mural-ontologie
   (`https://omeka.phpetra.nl/ns/mural#`) en het Gouda Tijdmachine-
   vocabulaire (`gtm:Gebouw`). Dit wordt dus een derde, volledig eigen
   module naast `monuments.ts`/`archaeology.ts` (CEO) en
   `scheepswrakken.ts` (MASS-`sdo:`) — geen herbruikbare queryparser, wel
   herbruikbare infrastructuur (`fetchSparql`, discovery-pattern,
   ratelimiting/caching).
3. **Sterke koppeling met bestaande Rijksmonumenten-data — in
   tegenstelling tot MASS.** Een deel van de gebouwen heeft
   `ceo:rijksmonumentnummer` — een exacte, betrouwbare join-sleutel naar
   dezelfde rijksmonumentnummers die Doorzoeker al toont. In de eigen
   explorer bleek dit voor 506 van de 576 gebouwen (88%) gevuld. Dat maakt
   een `HeritageRelationSections`-achtige sectie op de bestaande
   Rijksmonument-detailpagina ("Muurschilderingen in dit gebouw: N,
   periode X–Y →") technisch goedkoop: geen aparte discoveryquery nodig,
   alleen een joinbare set nummers.
4. **Geen GeoSPARQL-geometrie.** Coördinaten komen uit een Omeka
   mapping-module (`m:feature -> m:geography-coordinates`), zonder
   expliciet lat/lon-onderscheid per triple (in de eigen explorer opgelost
   door op waardebereik te classificeren: NL breedte 50–54°, lengte
   3–7,5°). Van de 576 gebouwen missen er 66 deze eigen coördinaat; de
   eigen explorer vult dat aan via `ceo:rijksmonumentnummer` (rijksmonument-
   centroid, 36 gebouwen) en via een adres verstopt in een Reliwiki-link
   (`schema:sameAs`, PDOK-geocoded, 10 gebouwen), waarna 24 gebouwen
   alsnog zonder puntgeometrie blijven — grotendeels losse/
   ongeïdentificeerde brondata-items, geen "echte" gebouwrecords. Of
   Doorzoeker die twee fallback-stappen wil overnemen of gewoon "geen
   marker" toont zoals bij MASS ("geen wrakvorm-geometrie" — punt 4
   hierboven), is een openstaande vraag (zie hieronder).
5. **Data-kwaliteitsfouten bevestigd, niet hypothetisch.** In dezelfde
   verkenning zijn 4 gebouwen gevonden met een coördinaat honderden km
   verkeerd (in België, of aan de verkeerde kant van Nederland), een
   woonplaats-veld met de gebouwnaam i.p.v. de plaatsnaam, een sentinel-
   waarde `"0"` voor "geen datering bekend" bij 20 schilderingen, en een
   handvol schilderingen met vrije tekst in plaats van een schone
   Wikidata-URI in het onderwerp-veld. Volledige lijst met item-URL's:
   `data/gevonden-datafouten.md` in de explorer-repo — bruikbaar als
   startpunt, al zou Doorzoeker zelf moeten beslissen welke correcties het
   overneemt (zie MASS punt 9/10: legitieme brondata-eigenaardigheden
   negeren, echte fouten wel opvangen).
6. **Geen IIIF.** Geverifieerd: geen `/iiif/`-endpoints, geen
   `o-module-iiifserver`-velden in de item-/media-API. Wel een aparte
   Omeka S REST-API (`muurschilderingendatabase.nl/api/media/<id>`, geen
   SPARQL) met `o:thumbnail_urls` (square/medium/large) en
   `o:original_url` per schildering — analoog aan MASS's probleem (geen
   apart CEO-achtig beeldveld), maar hier eenvoudiger: een expliciete
   `o:primary_media`-relatie per schildering i.p.v. afbeeldingen ingebed in
   vrije-tekst-HTML. Van de 2.685 schilderingen heeft 52% (1.391) een
   foto. Media-catalogus is groot (~2.900 items) en moet gepagineerd
   opgehaald worden — geen SPARQL-eigenschap, dus een aparte REST-call per
   build/request, geen live per-klik-fetch.
7. **Makers (personen/organisaties) — een entiteitstype dat Doorzoeker nog
   niet heeft.** 217 makers via `dcterms:creator` op `schema:Painting`,
   waarvan 210 bij naam bekend met geboorte-/sterftedatum en doorklik naar
   RKD/Wikidata (bv. Charles Eyck, Richard Roland Holst). Dit lijkt op
   Doorzoekers bestaande "actor"-concept (architect/aannemer, zie slice
   009) maar is fundamenteel anders: een actor bij Doorzoeker is een
   RCE-thesaurusconcept binnen dezelfde CEO-graph; een maker hier is een
   losstaande RDF-entiteit (`schema:Person`/`Organization`) in de
   Muurschilderingen-dataset zelf, met een eigen URI, eigen velden
   (`schema:birthDate`, `schema:sameAs` naar RKD) — geen concept-URI-klik
   binnen bestaande infrastructuur, een echt nieuw datamodel-stuk.
8. **Geen expliciete licentie gevonden — in tegenstelling tot MASS.** Geen
   `license`/`rights`-predicaat in de RDF, `license: null` in de
   datasetmetadata op TriplyDB, geen licentievermelding in de voettekst van
   muurschilderingendatabase.nl. Belangrijker: de dataset is samengesteld
   uit meerdere bronnen/partners (RKD, Radboud Universiteit, Stichting
   Groninger Kerken, diverse publicaties met eigen fotografie-credits, bv.
   "fotografie: Sjaan van der Jagt" bij één van de bronpublicaties) — zelfs
   als er een algemene RCE-LOD-licentie voor de metadata geldt, is dat voor
   de **afbeeldingen specifiek** niet aan te nemen. Anders dan bij MASS is
   dit (nog) geen groen licht met een vaste bronregel, maar een echte
   blokkerende open vraag voor beeldmateriaal.
9. **Chronologisch bereik is breed en verrassend.** 29% van de
   schilderingen is 20e-eeuws (piek in het interbellum, 1920–1944), niet
   overwegend middeleeuws zoals de naam "muurschildering" doet vermoeden —
   relevant voor hoe een eventueel periode-facet wordt ingericht (geen
   aanname "dit is middeleeuws erfgoed" in de UI-framing).

## Doel

Muurschilderingen als nieuwe, doorzoekbare en doorbladerbare
erfgoedcategorie toevoegen aan Doorzoeker, met (a) een eigen
kaartmarker/detail zoals scheepswrakken, én (b) een zichtbare koppeling
terug naar de bestaande Rijksmonument-detailpagina waar een
rijksmonumentnummer bekend is — dat laatste is precies het soort
verrijking die Doorzoeker bij archeologische terreinen al doet en dat MASS
niet kon bieden.

## Voorgestelde aanpak (concept, nog niet akkoord)

1. Nieuwe module `lib/rce/muurschilderingen.ts`, analoog aan
   `scheepswrakken.ts`: eigen discoveryquery's (gebouwnaam, plaats,
   makernaam), eigen detailquery, eigen parser, eigen `ENDPOINT`-constante.
2. Nieuw objecttype "Gebouw met muurschildering(en)" door de stack heen:
   eigen kleur/icoon op de kaart, eigen filter in "Soort object" (beslissing
   1 hieronder).
3. Omeka-media-REST-call (thumbnails/origineel) **niet** in deze eerste
   bouwstap — pas bouwen zodra de licentievraag hieronder is opgelost.
4. Rijksmonument-koppeling: op de bestaande Rijksmonument-detailpagina een
   sectie "Muurschilderingen in dit gebouw" tonen wanneer
   `ceo:rijksmonumentnummer` matcht — vergelijkbaar met hoe archeologische
   terreinen al aan Rijksmonumenten gekoppeld worden getoond.
5. Makers: minimaal als tekstveld in het schildering-detail (naam +
   RKD/Wikidata-link waar aanwezig). Of dit een eigen klikbare/
   doorzoekbare entiteit wordt (zoals de architect-portfolio uit slice
   009, maar dan op een nieuw datamodel) is een aparte vervolgvraag, niet
   per se scope van de eerste bouwstap.
6. Periodefilter: gezien punt 9 hierboven, geen "middeleeuws erfgoed"-
   framing; als er een periodefacet komt, dekt die het volledige bereik.

## Data-model (voorstel, spiegelt het Scheepswrak-model uit slice 018)

```ts
type MuurschilderingGebouw = {
  uri: string;
  id: string;
  naam: string;
  plaats?: string;
  rijksmonumentnummer?: string;   // exacte join-sleutel naar bestaande Rijksmonumenten-data
  huidigeFunctie?: string;
  lat?: number;                    // ontbreekt bij ~11% van de gebouwen (zie punt 4)
  lng?: number;
  schilderingen: Muurschildering[];
};

type Muurschildering = {
  uri: string;
  titel?: string;
  beschrijving?: string;
  datering?: { van?: number; tot?: number; tekst?: string };
  locatieomschrijving?: string;    // plek in het gebouw, bv. "koor, nr. 7 op plattegrond"
  onderwerpen: { uri: string; label?: string }[];  // Wikidata-iconografie
  makers: { naam: string; sameAs?: string[] }[];
  afbeelding?: { thumbnail?: string; origineel?: string };
};
```

## Scope-afbakening (voorstel)

- Eerste bouwstap: zoeken + detail + kaartmarker + Rijksmonument-koppeling.
  Geen aparte, doorzoekbare "makers"-entiteit (punt 5 hierboven) — dat is
  een reële vervolgstap, geen dagtaak samen met de rest.
- Geen afbeeldingen in de eerste bouwstap (zie "Nog open: licentie" hieronder)
  — alleen tekst/metadata, met een doorklik naar de bronpagina voor wie de
  foto wil zien.
- Coördinaat-fallbackketen (rijksmonument-centroid, Reliwiki+PDOK) wordt
  overgenomen (beslissing 2 hieronder) — 552/576 gebouwen krijgen zo een
  marker, i.p.v. alleen de 510/576 met een eigen brongeometrie.
- De 4 bevestigde coördinaatfouten (punt 5) worden hoe dan ook niet
  klakkeloos overgenomen, ongeacht of de fallbackketen wordt gebouwd.

## Beslissingen (8 september 2026, na overleg met de eigenaar)

1. **Primair object: het gebouw**, met schilderingen als onderdeel van het
   detail — sluit aan bij hoe de brondata en Rijksmonumenten al
   gestructureerd zijn.
2. **Coördinaat-fallbackketen overnemen**: rijksmonument-centroid +
   Reliwiki/PDOK-geocoding dupliceren zoals in de eigen explorer, zodat
   552/576 i.p.v. 510/576 gebouwen een kaartmarker krijgen.
3. **Makers: eerst alleen tekst** in het schildering-detail (naam +
   RKD/Wikidata-link waar aanwezig), geen aparte doorzoekbare entiteit in
   deze slice.

## Nog open: licentie/afbeeldingen (blokkerend voor beeldmateriaal)

Geen groen licht zoals bij MASS. Voorlopig advies: de eerste bouwstap
toont **geen afbeeldingen**, alleen tekst/metadata met een doorklik naar de
bronpagina op muurschilderingendatabase.nl voor wie de foto wil zien — pas
alsnog thumbnails/originelen tonen zodra RCE een licentie voor het
beeldmateriaal bevestigt. Metadata (titels, datering, iconografie, makers)
kan als "RCE Linked Open Data" wel getoond worden, consistent met hoe
Doorzoeker de rest van de CEO-data al behandelt.

## Acceptatiecriteria (concept, aan te scherpen zodra de open vragen beantwoord zijn)

1. Muurschilderingen/gebouwen zijn doorzoekbaar op naam/plaats, net als de
   andere objectsoorten.
2. Een detail toont: gebouw, plaats, schilderingen (titel, datering,
   locatie-in-gebouw, onderwerp, maker als tekst), en waar een
   rijksmonumentnummer bekend is een link naar dat rijksmonument. Geen
   afbeeldingen in deze slice (zie licentievraag) — wel een doorklik naar de
   bronpagina.
3. Vanaf een Rijksmonument-detailpagina is zichtbaar of er
   muurschilderingen aan gekoppeld zijn.
4. Geen crash bij gebouwen zonder coördinaat, zonder foto, of zonder
   bekende maker — dit zijn geen uitzonderingsgevallen maar de norm (zie
   punt 4/6/9).
5. Typecheck/lint/tests blijven groen; nieuwe unit tests dekken de
   query-builders en parser met representatieve voorbeelden, inclusief een
   gebouw zonder coördinaat en een schildering zonder foto.
6. Live geverifieerd tegen minstens één bekend gebouw met een
   rijksmonumentkoppeling (bv. de Grote Kerk van Gouda) vóór opleveren.
