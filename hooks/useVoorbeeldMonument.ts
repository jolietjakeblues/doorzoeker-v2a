import { useEffect, useRef, useState } from "react";
import { fetchArcheologischeContext, searchRceMonuments } from "@/lib/rce-client";
import { toItem, type Item } from "@/lib/heritage-view-model";
import type { ArcheologischeContext } from "@/lib/rce";

// Rijksmonument 14948 (Sint-Maartenskerk, Elst) - door de eigenaar gekozen
// als vaste showcase omdat het in één record de volle breedte van de
// knowledge graph laat zien: kaart, archeologische context (staat boven een
// Romeins tempelcomplex, zie 017-archeologische-context-onderzoeksgebied.md),
// literatuur, foto, gekoppelde begrippen. Bewust géén willekeurig
// Rijksmonument (dat is al useVerrasMe) - dit is een vaste, herhaalbare demo.
const VOORBEELD_MONUMENTNUMMER = "14948";

export type VoorbeeldResult = { item: Item; gebieden: ArcheologischeContext[] };

// Op klik aangeroepen, geen idle-load - zelfde aanpak als useVerrasMe/
// useOpDezeDag: faalt stil (geen foutmelding) omdat dit een leuk extraatje
// is, geen kernfunctie. searchRceMonuments("14948") hergebruikt de gewone
// exacte-nummerlookup (geen nieuwe route nodig) en levert daarmee al een
// volledig verrijkt record (percelen, complexen, afbeelding, literatuur,
// gebeurtenissen) - Werelderfgoed-lidmaatschap/onderwerpbegrippen volgen
// automatisch zodra de aanroeper dit item als `selected` zet, via de
// bestaande lazy-detailhooks.
//
// De archeologische context (normaal alleen op expliciete knopklik, want dat
// kost 15+ seconden bij een willekeurig monument) wordt hier WEL meteen
// meegehaald: fetchArcheologischeContext gebruikt voor precies dit
// monumentnummer een voorbereide kortsluiting (zie de toelichting bij
// fetchArcheologischeContext in lib/server/rce-adapter.ts) en blijft daardoor
// snel genoeg om vóór het openen van het detailvenster op te halen - de
// gebruiker hoeft dus niet nog een keer te klikken om de Romeinse tempel
// onder de kerk te zien.
export function useVoorbeeldMonument() {
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function trigger(onLoaded: (result: VoorbeeldResult) => void) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    Promise.all([
      searchRceMonuments(VOORBEELD_MONUMENTNUMMER, controller.signal),
      fetchArcheologischeContext(VOORBEELD_MONUMENTNUMMER, controller.signal).catch(() => [] as ArcheologischeContext[]),
    ])
      .then(([response, gebieden]) => {
        if (controller.signal.aborted) return;
        const record = response.results[0];
        if (record) onLoaded({ item: toItem(record), gebieden });
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }

  return { loading, trigger };
}
