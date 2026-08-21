import { useCallback, useEffect, useRef } from "react";
import {
  readUrlState,
  type BrowseKind,
  type ConceptField,
  type MapViewport,
  type SelectedTermIdentity,
} from "@/lib/heritage-view-model";

export type SearchUrlState = ReturnType<typeof readUrlState>;

type SearchUrlSnapshot = {
  active: string;
  activeBrowseKind?: BrowseKind;
  activeConceptUri?: string;
  activeConceptVeld?: ConceptField;
  selectedTerm?: SelectedTermIdentity;
  objectType: string;
  monumentAard: string;
  province: string;
  municipality: string;
  functionFilter: string;
  matchSourceFilter: string;
  excludedCategories: string[];
  onlyGroenaanleg: boolean;
  onlyMsp: boolean;
  view: "list" | "map";
  mapViewport?: MapViewport;
  resultPage: number;
  selectedId?: string;
};

export function useSearchUrlState({
  snapshot,
  onRestore,
}: {
  snapshot: SearchUrlSnapshot;
  onRestore: (state: SearchUrlState) => void;
}) {
  const urlStateHydrated = useRef(false);
  const restoringHistory = useRef(false);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  const beginHistoryEntry = useCallback(() => {
    if (!urlStateHydrated.current || restoringHistory.current) return;
    window.history.pushState({}, "", window.location.href);
  }, []);

  useEffect(() => {
    if (!urlStateHydrated.current) return;
    const params = new URLSearchParams();
    if (snapshot.active) params.set("q", snapshot.active);
    if (snapshot.activeBrowseKind)
      params.set("browse", snapshot.activeBrowseKind);
    if (snapshot.activeConceptUri)
      params.set("concept", snapshot.activeConceptUri);
    if (snapshot.activeConceptVeld)
      params.set("veld", snapshot.activeConceptVeld);
    if (snapshot.selectedTerm) {
      params.set("begrip", snapshot.selectedTerm.uri);
      params.set("begripbron", snapshot.selectedTerm.sourceUri);
      params.set("begripbronnaam", snapshot.selectedTerm.sourceName);
    }
    if (snapshot.objectType !== "Alle")
      params.set("soort", snapshot.objectType);
    if (snapshot.monumentAard !== "Alle")
      params.set("aard", snapshot.monumentAard);
    if (snapshot.province !== "Alle")
      params.set("provincie", snapshot.province);
    if (snapshot.municipality !== "Alle")
      params.set("gemeente", snapshot.municipality);
    if (snapshot.functionFilter !== "Alle")
      params.set("functie", snapshot.functionFilter);
    if (snapshot.matchSourceFilter !== "Alle")
      params.set("bron", snapshot.matchSourceFilter);
    if (snapshot.excludedCategories.length)
      params.set("uitgesloten", snapshot.excludedCategories.join(","));
    if (snapshot.onlyGroenaanleg) params.set("groenaanleg", "1");
    if (snapshot.onlyMsp) params.set("msp", "1");
    if (snapshot.view === "map") params.set("view", "map");
    if (snapshot.view === "map" && snapshot.mapViewport) {
      params.set("lat", snapshot.mapViewport.lat.toFixed(5));
      params.set("lng", snapshot.mapViewport.lng.toFixed(5));
      params.set("zoom", String(snapshot.mapViewport.zoom));
    }
    if (snapshot.resultPage > 1)
      params.set("pagina", String(snapshot.resultPage));
    if (snapshot.selectedId) params.set("object", snapshot.selectedId);
    window.history.replaceState(
      {},
      "",
      params.size ? `?${params}` : window.location.pathname,
    );
  }, [
    snapshot.active,
    snapshot.activeBrowseKind,
    snapshot.activeConceptUri,
    snapshot.activeConceptVeld,
    snapshot.excludedCategories,
    snapshot.functionFilter,
    snapshot.mapViewport,
    snapshot.matchSourceFilter,
    snapshot.monumentAard,
    snapshot.municipality,
    snapshot.objectType,
    snapshot.onlyGroenaanleg,
    snapshot.onlyMsp,
    snapshot.province,
    snapshot.resultPage,
    snapshot.selectedId,
    snapshot.selectedTerm,
    snapshot.view,
  ]);

  useEffect(() => {
    function restore(state: SearchUrlState) {
      restoringHistory.current = true;
      onRestoreRef.current(state);
      restoringHistory.current = false;
    }

    const timer = window.setTimeout(() => {
      urlStateHydrated.current = true;
      restore(readUrlState());
    }, 0);
    function handlePopState() {
      restore(readUrlState());
    }
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return { beginHistoryEntry };
}
