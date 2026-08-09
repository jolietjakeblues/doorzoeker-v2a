import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browseRceObjects, searchByMonumentAardConcept, searchRceMonuments } from "@/lib/rce-client";
import { EMPTY_ITEMS, EMPTY_URL_STATE, readUrlState, statusLabel, toItem, type Item } from "@/lib/heritage-view-model";

// Alle zoek-, filter-, resultaat- en URL-state van Doorzoeker leeft in één
// hook: dit is bewust één cohesieve state machine (een zoekopdracht raakt
// bijna elk stuk state tegelijk - objectType, filters, pagina, geselecteerd
// record worden allemaal gereset zodra een nieuwe zoekopdracht start), niet
// een verzameling losse velden die toevallig in hetzelfde bestand stonden.
// Het scheidt deze logica van de presentatielaag in app/page.tsx.
export function useSearchState() {
  const [query, setQuery] = useState(EMPTY_URL_STATE.query);
  const [active, setActive] = useState(EMPTY_URL_STATE.query);
  // Gezet zodra de actieve zoekopdracht een exacte concept-URI-match is
  // (bv. klik op een monumentaard-label) in plaats van een tekstzoekopdracht.
  // loadMore ondersteunt dit nog niet (concept-resultaten worden serverzijdig
  // al tot 25 beperkt), dus deze state voorkomt dat loadMore de labeltekst
  // per ongeluk als tekstzoekopdracht hergebruikt.
  const [activeConceptUri, setActiveConceptUri] = useState<string | undefined>(undefined);
  const [objectType, setObjectType] = useState(EMPTY_URL_STATE.objectType);
  const [monumentAard, setMonumentAard] = useState(EMPTY_URL_STATE.monumentAard);
  const [province, setProvince] = useState(EMPTY_URL_STATE.province);
  const [municipality, setMunicipality] = useState(EMPTY_URL_STATE.municipality);
  const [functionFilter, setFunctionFilter] = useState(EMPTY_URL_STATE.functionFilter);
  const [matchSourceFilter, setMatchSourceFilter] = useState(EMPTY_URL_STATE.matchSourceFilter);
  const [excludedStatuses, setExcludedStatuses] = useState<string[]>(EMPTY_URL_STATE.excludedStatuses);
  const [onlyGroenaanleg, setOnlyGroenaanleg] = useState(EMPTY_URL_STATE.onlyGroenaanleg);
  const [onlyMsp, setOnlyMsp] = useState(EMPTY_URL_STATE.onlyMsp);
  const [view, setView] = useState<"list" | "map">(EMPTY_URL_STATE.view);
  const [selected, setSelected] = useState<Item | null>(null);
  const [filters, setFilters] = useState(false);
  const [remoteResults, setRemoteResults] = useState<Item[] | null>(null);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [resultPage, setResultPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const searchSequence = useRef(0);
  const pendingSelectedId = useRef(EMPTY_URL_STATE.selectedId);
  const urlStateHydrated = useRef(false);

  useEffect(() => {
    if (!urlStateHydrated.current) return;
    const params = new URLSearchParams();
    if (active) params.set("q", active);
    if (objectType !== "Alle") params.set("soort", objectType);
    if (monumentAard !== "Alle") params.set("aard", monumentAard);
    if (province !== "Alle") params.set("provincie", province);
    if (municipality !== "Alle") params.set("gemeente", municipality);
    if (functionFilter !== "Alle") params.set("functie", functionFilter);
    if (matchSourceFilter !== "Alle") params.set("bron", matchSourceFilter);
    if (excludedStatuses.length) params.set("uitgesloten", excludedStatuses.join(","));
    if (onlyGroenaanleg) params.set("groenaanleg", "1");
    if (onlyMsp) params.set("msp", "1");
    if (view === "map") params.set("view", "map");
    if (selected) params.set("rm", selected.id);
    window.history.replaceState({}, "", params.size ? `?${params}` : window.location.pathname);
  }, [active, excludedStatuses, functionFilter, matchSourceFilter, monumentAard, municipality, objectType, onlyGroenaanleg, onlyMsp, province, selected, view]);

  const choose = useCallback((item: Item) => setSelected(item), []);
  const baseResults = remoteResults ?? EMPTY_ITEMS;
  const functions = useMemo(() => [...new Set(baseResults.flatMap((item) => [...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? []), item.kind]).filter((kind) => kind !== "Functie niet opgenomen"))].sort((a, b) => a.localeCompare(b, "nl")), [baseResults]);
  const provinces = useMemo(() => [...new Set(baseResults.map((item) => item.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl")), [baseResults]);
  // Gemeenten worden beperkt tot de gekozen provincie, zodat kiezen van een
  // provincie de lijst eerst versmalt in plaats van los ernaast te staan.
  const municipalities = useMemo(() => [...new Set(baseResults.filter((item) => province === "Alle" || item.province === province).map((item) => item.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl")), [baseResults, province]);
  const matchSources = useMemo(() => [...new Set(baseResults.map((item) => item.matchSource).filter((source): source is string => Boolean(source)))], [baseResults]);
  const results = useMemo(() => baseResults.filter((item) =>
    (functionFilter === "Alle" || [item.kind, ...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? [])].includes(functionFilter)) &&
    (objectType === "Alle" || item.objectType === objectType) &&
    (monumentAard === "Alle" || item.monumentAard === monumentAard) &&
    (province === "Alle" || item.province === province) &&
    (municipality === "Alle" || item.municipality === municipality) &&
    (matchSourceFilter === "Alle" || item.matchSource === matchSourceFilter) &&
    !excludedStatuses.includes(statusLabel(item.objectType)) &&
    (!onlyGroenaanleg || Boolean(item.groenaanleg)) &&
    (!onlyMsp || item.msp === true)
  ), [baseResults, excludedStatuses, functionFilter, matchSourceFilter, monumentAard, municipality, objectType, onlyGroenaanleg, onlyMsp, province]);
  function toggleLegalStatus(label: string) {
    setExcludedStatuses((current) => current.includes(label) ? current.filter((excluded) => excluded !== label) : [...current, label]);
  }

  async function executeSearch(term: string) {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setQuery(term);
    setActive(term); setActiveConceptUri(undefined); setSelected(null); setView("list");
    setObjectType("Alle");
    setMonumentAard("Alle");
    setProvince("Alle");
    setMunicipality("Alle");
    setFunctionFilter("Alle");
    setMatchSourceFilter("Alle");
    setExcludedStatuses([]);
    setOnlyGroenaanleg(false);
    setOnlyMsp(false);
    setResultPage(1);
    setHasMore(false);
    if (!term) { setRemoteResults(null); setRemoteState("idle"); return; }
    setRemoteState("loading");
    try {
      const records = await searchRceMonuments(term, controller.signal);
      if (sequence !== searchSequence.current) return;
      const items = records.map((record) => toItem(record));
      setRemoteResults(items);
      if (pendingSelectedId.current) {
        setSelected(items.find((item) => item.id === pendingSelectedId.current || item.monumentNumber === pendingSelectedId.current) ?? null);
        pendingSelectedId.current = "";
      }
      setHasMore(false);
      setRemoteState("success");
    } catch {
      if (controller.signal.aborted || sequence !== searchSequence.current) return;
      setRemoteResults([]);
      setRemoteState("error");
    }
  }
  // Exacte match op een concept-URI uit het Referentienetwerk (fase 1:
  // monumentaard) in plaats van een tekstzoekopdracht - bv. een klik op een
  // monumentaard-label in de resultatenlijst of het detailpaneel.
  async function executeConceptSearch(concept: { uri: string; label: string }) {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setQuery(concept.label);
    setActive(concept.label); setActiveConceptUri(concept.uri); setSelected(null); setView("list");
    setObjectType("Alle");
    setMonumentAard("Alle");
    setProvince("Alle");
    setMunicipality("Alle");
    setFunctionFilter("Alle");
    setMatchSourceFilter("Alle");
    setExcludedStatuses([]);
    setOnlyGroenaanleg(false);
    setOnlyMsp(false);
    setResultPage(1);
    setHasMore(false);
    setRemoteState("loading");
    try {
      const records = await searchByMonumentAardConcept(concept.uri, controller.signal);
      if (sequence !== searchSequence.current) return;
      setRemoteResults(records.map((record) => toItem(record)));
      setHasMore(false);
      setRemoteState("success");
    } catch {
      if (controller.signal.aborted || sequence !== searchSequence.current) return;
      setRemoteResults([]);
      setRemoteState("error");
    }
  }
  // Werelderfgoed en Gezicht zijn anders te vinden dan Rijksmonumenten: er is
  // geen zoekterm voor "laat alles zien", dus browsen ze de volledige (kleine)
  // collectie in plaats van op naam te matchen.
  async function browseType(kind: "werelderfgoed" | "gezicht" | "complex") {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setQuery("");
    setActive(kind === "werelderfgoed" ? "Werelderfgoed" : kind === "gezicht" ? "Rijksbeschermde gezichten" : "Complexen");
    setActiveConceptUri(undefined);
    setSelected(null); setView("list");
    setObjectType(kind === "werelderfgoed" ? "Werelderfgoed" : kind === "gezicht" ? "Gezicht" : "Complex");
    setMonumentAard("Alle"); setProvince("Alle"); setMunicipality("Alle");
    setFunctionFilter("Alle"); setMatchSourceFilter("Alle"); setExcludedStatuses([]);
    setOnlyGroenaanleg(false); setOnlyMsp(false);
    setResultPage(1); setHasMore(false);
    setRemoteState("loading");
    try {
      const records = await browseRceObjects(kind, controller.signal);
      if (sequence !== searchSequence.current) return;
      setRemoteResults(records.map((record) => toItem(record)));
      setHasMore(false);
      setRemoteState("success");
    } catch {
      if (controller.signal.aborted || sequence !== searchSequence.current) return;
      setRemoteResults([]);
      setRemoteState("error");
    }
  }
  async function loadMore() {
    if (!active || loadingMore || activeConceptUri) return;
    const nextPage = resultPage + 1;
    const lastResult = remoteResults?.at(-1);
    if (!lastResult?.monumentNumber || !lastResult.matchedText || lastResult.matchScore === undefined) {
      setHasMore(false);
      return;
    }
    setLoadingMore(true);
    try {
      const records = await searchRceMonuments(active, undefined, nextPage);
      const additions = records.map((record) => toItem(record));
      setRemoteResults((current) => {
        const merged = new Map((current ?? []).map((item) => [item.monumentNumber ?? item.id, item]));
        for (const item of additions) merged.set(item.monumentNumber ?? item.id, item);
        return [...merged.values()];
      });
      setResultPage(nextPage);
      setHasMore(records.length === 25);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const initial = readUrlState();
      urlStateHydrated.current = true;
      pendingSelectedId.current = initial.selectedId;
      if (initial.query) void executeSearch(initial.query);
      setObjectType(initial.objectType);
      setMonumentAard(initial.monumentAard);
      setProvince(initial.province);
      setMunicipality(initial.municipality);
      setFunctionFilter(initial.functionFilter);
      setMatchSourceFilter(initial.matchSourceFilter);
      setExcludedStatuses(initial.excludedStatuses);
      setOnlyGroenaanleg(initial.onlyGroenaanleg);
      setOnlyMsp(initial.onlyMsp);
      setView(initial.view);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => () => searchController.current?.abort(), []);

  function reset() {
    setQuery(""); setActive(""); setActiveConceptUri(undefined); setObjectType("Alle"); setMonumentAard("Alle"); setProvince("Alle"); setMunicipality("Alle"); setFunctionFilter("Alle"); setMatchSourceFilter("Alle"); setExcludedStatuses([]); setOnlyGroenaanleg(false); setOnlyMsp(false); setSelected(null); setRemoteResults(null); setRemoteState("idle"); setResultPage(1); setHasMore(false);
  }

  return {
    query, setQuery, active, view, setView,
    objectType, setObjectType, monumentAard, setMonumentAard,
    province, setProvince, municipality, setMunicipality,
    functionFilter, setFunctionFilter, matchSourceFilter, setMatchSourceFilter,
    excludedStatuses, toggleLegalStatus, onlyGroenaanleg, setOnlyGroenaanleg, onlyMsp, setOnlyMsp,
    selected, setSelected, choose, filters, setFilters,
    remoteState, resultPage, hasMore, loadingMore,
    baseResults, functions, provinces, municipalities, matchSources, results,
    executeSearch, executeConceptSearch, browseType, loadMore, reset,
  };
}
