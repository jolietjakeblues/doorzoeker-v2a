import { useEffect, useRef, useState } from "react";
import { fetchArcheologischeContext, fetchLigtIn, searchRceMonuments } from "@/lib/rce-client";
import { toItem, type Item } from "@/lib/heritage-view-model";
import type { ArcheologischeContext, WerelderfgoedLidmaatschap } from "@/lib/rce";

// Rijksmonument 14948 (Sint-Maartenskerk, Elst) - door de eigenaar gekozen
// als vaste showcase omdat het in één record de volle breedte van de
// knowledge graph laat zien: kaart, archeologische context (staat boven een
// Romeins tempelcomplex, zie 017-archeologische-context-onderzoeksgebied.md),
// literatuur, foto, gekoppelde begrippen, Werelderfgoed-lidmaatschap. Bewust
// géén willekeurig Rijksmonument (dat is al useVerrasMe) - dit is een vaste,
// herhaalbare demo, bedoeld om in één oogopslag (en desnoods een screenshot)
// te laten zien wat Doorzoeker kan.
const VOORBEELD_MONUMENTNUMMER = "14948";

export type VoorbeeldResult = { item: Item; gebieden: ArcheologischeContext[]; werelderfgoed: WerelderfgoedLidmaatschap[] };

// Op klik aangeroepen, geen idle-load - zelfde aanpak als useVerrasMe/
// useOpDezeDag: faalt stil (geen foutmelding) omdat dit een leuk extraatje
// is, geen kernfunctie. searchRceMonuments("14948") hergebruikt de gewone
// exacte-nummerlookup (geen nieuwe route nodig) en levert daarmee al een
// volledig verrijkt record (percelen, complexen, afbeelding, literatuur,
// gebeurtenissen).
//
// De archeologische context en het Werelderfgoed-lidmaatschap zijn normaal
// alleen lazy/op-klik beschikbaar (archeologie kost 15+ seconden bij een
// willekeurig monument, zie fetchArcheologischeContext in lib/server/
// rce-adapter.ts voor de kortsluiting die specifiek voor dit monumentnummer
// geldt) - hier WEL meteen meegehaald, samen met het monument zelf, zodat de
// compacte weergave (zie StartContent.tsx) in één keer klaar staat, geen
// tweede klik of laadstatus nodig.
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
      fetchLigtIn(VOORBEELD_MONUMENTNUMMER, controller.signal).catch(() => ({ gezicht: [], werelderfgoed: [] as WerelderfgoedLidmaatschap[] })),
    ])
      .then(([response, gebieden, ligtIn]) => {
        if (controller.signal.aborted) return;
        const record = response.results[0];
        if (record) onLoaded({ item: toItem(record), gebieden, werelderfgoed: ligtIn.werelderfgoed });
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }

  return { loading, trigger };
}
