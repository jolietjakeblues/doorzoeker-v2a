import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/heritage-view-model";

// "timeout" is een apart, minder alarmerend geval dan "error": de RCE-bron
// zelf is bereikbaar maar antwoordde niet binnen de serverzijdige limiet (zie
// isTimeoutError in lib/server/route-error-handling.ts, live nodig geworden
// 21-08-2026 na een 20s-timeout op een breed RN2-begrip). Een gewone "error"
// blijft voor een echte connectiviteitsfout.
export type RemoteState = "idle" | "loading" | "error" | "timeout" | "success";

export function useSearchRequest() {
  const [remoteResults, setRemoteResults] = useState<Item[] | null>(null);
  const [remoteState, setRemoteState] = useState<RemoteState>("idle");
  // Welke "Soort object"-categorieën bij een overigens succesvolle
  // zoekopdracht niet geladen konden worden (bv. Scheepswrak via de
  // losstaande MASS-dienst) - apart van remoteState, want de zoekopdracht
  // zelf is wél gelukt, alleen onvolledig. Zonder dit signaal is "0
  // scheepswrakken" niet te onderscheiden van "geen enkel scheepswrak kon
  // geladen worden" (gemeld door de eigenaar, 21-08-2026).
  const [failedCategories, setFailedCategories] = useState<string[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Apart van hasMore: een mislukte 'laad meer'-aanvraag betekent niet dat
  // er niets meer te laden valt (P2, externe review 22-08-2026 - voorheen
  // verdween de knop stilzwijgend via setHasMore(false), niet te
  // onderscheiden van "alle resultaten zijn geladen").
  const [loadMoreError, setLoadMoreError] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const searchSequence = useRef(0);

  const beginRequest = useCallback(() => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    return {
      signal: controller.signal,
      isCurrent: () => sequence === searchSequence.current,
      isAborted: () => controller.signal.aborted,
    };
  }, []);

  // Externe review (15-09-2026): reset() in useSearchState.ts leegde de
  // schermstate zonder de actieve fetch te annuleren of ongeldig te maken -
  // een oude, nog lopende aanvraag kon ná een reset alsnog slagen en
  // stilzwijgend oude resultaten terugzetten (isCurrent() bleef true, want
  // searchSequence was niet verhoogd). cancel() doet wat beginRequest() ook
  // doet aan annulering/ongeldigmaking, maar start zelf geen nieuwe
  // aanvraag.
  const cancel = useCallback(() => {
    searchController.current?.abort();
    searchController.current = null;
    searchSequence.current += 1;
  }, []);

  useEffect(() => () => searchController.current?.abort(), []);

  return {
    remoteResults,
    setRemoteResults,
    remoteState,
    setRemoteState,
    failedCategories,
    setFailedCategories,
    resultPage,
    setResultPage,
    hasMore,
    setHasMore,
    loadingMore,
    setLoadingMore,
    loadMoreError,
    setLoadMoreError,
    beginRequest,
    cancel,
  };
}
