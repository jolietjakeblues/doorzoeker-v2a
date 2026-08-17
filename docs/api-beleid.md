# Beleid publieke API-routes

Datum: 11 augustus 2026. Bijgewerkt 17 augustus 2026: het limiterbesluit voor
vier routes is herzien na `docs/security-assessment-2026-08-17.md` (zie
onder de tabel).

## Doel

Leg per publieke route vast hoeveel werk een verzoek veroorzaakt, hoe lang het
antwoord wordt gecachet en of limitering nodig is. Hiermee blijft het beleid
controleerbaar wanneer routes of databronnen veranderen.

## Routebeleid

| Route | Kosten per cachemiss | Cachebeleid | Limiterbesluit |
| --- | --- | --- | --- |
| `/api/rce/search` | Meerdere parallelle zoek- en verrijkingsquery's | Browser 60 seconden, gedeeld 300 seconden | Lokale best-effortlimiet van 30 geldige verzoeken per minuut behouden |
| `/api/rce/concept` | Eén Referentienetwerk-query | Browser 300 seconden, gedeeld 3.600 seconden | 30/minuut, best effort per isolate (herzien 17-08-2026) |
| `/api/rce/complex-members` | Eén begrensde detailquery | Browser 60 seconden, gedeeld 300 seconden | 30/minuut, best effort per isolate (herzien 17-08-2026) |
| `/api/rce/onderzoeksgebied-verrijking` | Drie begrensde detailquery's | Browser 60 seconden, gedeeld 300 seconden | 30/minuut, best effort per isolate (herzien 17-08-2026) |
| `/api/rce/vondstlocatie-inhoud` | Minstens 5 parallelle deelquery's (3 inhoudsklassen, telling, concept-resolutie) | Browser 60 seconden, gedeeld 300 seconden | 30/minuut, best effort per isolate (herzien 17-08-2026) |
| `/api/rce/op-deze-dag` | Eén of meer datumquery's plus verrijking | Succes tot volgende UTC-dag, leeg maximaal 300 seconden | Geen limiter; geen gebruikersinvoer en één gedeeld dagresultaat |
| `/api/terms/suggest` | Thesaurusquery plus gebruiksmeting | Browser 60 seconden, gedeeld 300 seconden | Geen limiter zolang verkeersmetingen geen misbruik of bronbelasting tonen |

Ongeldige invoer bereikt de RCE-bron niet. Upstreamfouten en niet-zoekbare
invoer krijgen `no-store` waar de route bewust leeg of met een fout antwoordt.

**Herziening 17 augustus 2026:** het oorspronkelijke besluit voor deze drie
routes ("exacte URI-validatie, begrensde query's en gedeelde caches beperken
al zonder extra platformstate") ging ervan uit dat "begrensd" gelijk stond
aan "goedkoop". `docs/security-assessment-2026-08-17.md` heeft dat
losgekoppeld: exacte URI-validatie begrenst alleen de *vorm* van de invoer,
niet hoe vaak een geldig-ogend (niet per se bestaand) nummer wordt
opgevraagd, en elke aanroep triggert 1-5+ parallelle SPARQL-aanroepen tegen
RCE. Dat is dus wél een amplificatierisico, ook zonder misbruik-signalen uit
observability - de trigger hier was een gerichte assessment, niet een
gemeten incident. Dit blijft de bestaande lokale best-effortlimiter (zie
hieronder), geen Cloudflare Rate Limiting-binding - dat platformbesluit
staat nog steeds.

## Besluit over Cloudflare Rate Limiting

Nu geen Rate Limiting-binding toevoegen.

Redenen:

1. De binding handhaaft tellers per Cloudflare-locatie. Dit is geen wereldwijde
   limiet voor één gebruiker.
2. Doorzoeker heeft geen account, API-sleutel of gebruikers-ID als stabiele
   sleutel. Alleen een IP-adres is beschikbaar. Cloudflare raadt dat af omdat
   meerdere geldige gebruikers één IP-adres kunnen delen.
3. Een sleutel per route zou alle bezoekers op dezelfde Cloudflare-locatie in
   één teller plaatsen. Dat kan gewone bezoekers gezamenlijk blokkeren.
4. De Cloudflare Vite-plugin biedt geen gelijkwaardige lokale ondersteuning
   voor deze binding. Daardoor wijkt lokaal gedrag af van productie.
5. Exacte URI-validatie, begrensde query's en gedeelde caches beperken de
   overige routes al zonder extra platformstate.

De huidige zoeklimiter blijft een best-effortnoodrem per Worker-isolate. Hij is
niet bedoeld als harde beveiligingsgrens.

## Wanneer heroverwegen

Voeg pas een platformlimiter toe als minstens één van deze voorwaarden geldt:

- observability toont herhaalde bronbelasting of misbruik;
- Doorzoeker krijgt accounts of API-sleutels met een stabiele gebruikers-ID;
- een route veroorzaakt aantoonbaar hoge kosten ondanks caching;
- Cloudflare biedt een passende, testbare globale handhaving voor dit gebruik.

Bronnen: [Cloudflare Rate Limiting-binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
en [ondersteunde bindings per ontwikkelmodus](https://developers.cloudflare.com/workers/local-development/bindings-per-env/).
