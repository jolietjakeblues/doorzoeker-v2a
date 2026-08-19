import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArcheologischeContext } from "@/lib/rce-client";
import type { ArcheologischeContext } from "@/lib/rce";
import type { Item } from "@/lib/heritage-view-model";

export type ArcheologischeContextState =
  | { status: "idle" }
  | { status: "loading"; monumentNumber: string }
  | { status: "done"; monumentNumber: string; gebieden: ArcheologischeContext[] }
  | { status: "error"; monumentNumber: string };

// Bewust GEEN lazy-bij-openen zoals de andere verrijkingen in
// useSelectedDetailEnrichment.ts: deze check kost 15+ seconden (112.184
// ArcheologischOnderzoeksgebied-instanties, geen kleine vaste kandidatenset
// zoals bij Werelderfgoed/Gezicht) - zie
// docs/vertical-slices/017-archeologische-context-onderzoeksgebied.md. Start
// daarom pas op een expliciete knopklik via zoek(), niet automatisch zodra
// een detail opent.
//
// State bevat het eigen monumentNumber i.p.v. terug te vallen op een
// setState-in-effect om te resetten bij een gewisseld Rijksmonument (dat
// triggert cascaderende renders, zie react-hooks/set-state-in-effect) -
// zelfde "identiteit controleren bij consumptie"-patroon als ligtInLoaded in
// HeritageDetailDialog.tsx.
export function useArcheologischeContext(selected: Item | null) {
  const [state, setState] = useState<ArcheologischeContextState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, [selected]);

  const zoek = useCallback(() => {
    if (!selected?.monumentNumber) return;
    const monumentNumber = selected.monumentNumber;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading", monumentNumber });
    fetchArcheologischeContext(monumentNumber, controller.signal)
      .then((gebieden) => {
        if (!controller.signal.aborted) setState({ status: "done", monumentNumber, gebieden });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error", monumentNumber });
      });
  }, [selected]);

  return { state, zoek };
}
