import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFilteredResults } from "@/hooks/useFilteredResults";
import { useSearchRequest } from "@/hooks/useSearchRequest";
import {
  useSearchUrlState,
  type SearchUrlState,
} from "@/hooks/useSearchUrlState";
import {
  browseRceObjects,
  type BrowseKind,
  searchByActorConcept,
  searchByArcheologischeWaarderingConcept,
  searchByArcheologischComplexTypeConcept,
  searchByBouwkundigeStaatConcept,
  searchByGebeurtenisConcept,
  searchByGrondspoorTypeConcept,
  searchByFunctieConcept,
  searchByMonumentAardConcept,
  searchByMonumentTypeConcept,
  searchByMateriaalConcept,
  searchByStijlConcept,
  searchByToestandConcept,
  searchByVerwervingConcept,
  searchByVondstTypeConcept,
  searchRceMonuments,
} from "@/lib/rce-client";
import {
  EMPTY_ITEMS,
  EMPTY_URL_STATE,
  toItem,
  type ConceptField,
  type Item,
  type MapViewport,
  type SelectedTermIdentity,
} from "@/lib/heritage-view-model";

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
  const [activeConceptUri, setActiveConceptUri] = useState<string | undefined>(
    undefined,
  );
  // Onthoudt via welk veld de actieve conceptzoekopdracht liep (bv. "actor")
  // - alleen gebruikt voor de portfolio-koptekst bij een actor-klik (zie
  // docs/vertical-slices/009-architect-portfolio.md), geen invloed op de
  // zoeklogica zelf.
  const [activeConceptVeld, setActiveConceptVeld] = useState<
    ConceptField | undefined
  >(undefined);
  const [selectedTerm, setSelectedTerm] = useState<
    SelectedTermIdentity | undefined
  >(EMPTY_URL_STATE.selectedTerm);
  const [objectType, setObjectType] = useState(EMPTY_URL_STATE.objectType);
  const [monumentAard, setMonumentAard] = useState(
    EMPTY_URL_STATE.monumentAard,
  );
  const [province, setProvince] = useState(EMPTY_URL_STATE.province);
  const [municipality, setMunicipality] = useState(
    EMPTY_URL_STATE.municipality,
  );
  const [functionFilter, setFunctionFilter] = useState(
    EMPTY_URL_STATE.functionFilter,
  );
  const [matchSourceFilter, setMatchSourceFilter] = useState(
    EMPTY_URL_STATE.matchSourceFilter,
  );
  const [excludedStatuses, setExcludedStatuses] = useState<string[]>(
    EMPTY_URL_STATE.excludedStatuses,
  );
  const [onlyGroenaanleg, setOnlyGroenaanleg] = useState(
    EMPTY_URL_STATE.onlyGroenaanleg,
  );
  const [onlyMsp, setOnlyMsp] = useState(EMPTY_URL_STATE.onlyMsp);
  const [view, setView] = useState<"list" | "map">(EMPTY_URL_STATE.view);
  const [mapViewport, setMapViewport] = useState<MapViewport | undefined>(
    EMPTY_URL_STATE.mapViewport,
  );
  const [selected, setSelected] = useState<Item | null>(null);
  const [filters, setFilters] = useState(false);
  const {
    remoteResults,
    setRemoteResults,
    remoteState,
    setRemoteState,
    resultPage,
    setResultPage,
    hasMore,
    setHasMore,
    loadingMore,
    setLoadingMore,
    beginRequest,
  } = useSearchRequest();
  const [activeBrowseKind, setActiveBrowseKind] = useState<BrowseKind | undefined>();
  const pendingSelectedId = useRef(EMPTY_URL_STATE.selectedId);
  const { beginHistoryEntry } = useSearchUrlState({
    snapshot: {
      active,
      activeBrowseKind,
      activeConceptUri,
      activeConceptVeld,
      selectedTerm,
      objectType,
      monumentAard,
      province,
      municipality,
      functionFilter,
      matchSourceFilter,
      excludedStatuses,
      onlyGroenaanleg,
      onlyMsp,
      view,
      mapViewport,
      resultPage,
      selectedId: selected?.id,
    },
    onRestore: restoreUrlState,
  });

  const choose = useCallback((item: Item) => setSelected(item), []);
  // Gedeeld door executeSearch, executeConceptSearch en browseType: een
  // URL-herstel (?object=<id>) moet het detailvenster heropenen ongeacht via
  // welk van de drie zoekpaden de pagina is geladen - vóór deze functie werd
  // dit alleen in executeSearch afgehandeld, waardoor een gedeelde link naar
  // een via browsen of een conceptzoekopdracht geopend detail na herladen
  // stil de dialoog niet heropende.
  function applyPendingSelection(items: Item[]) {
    if (!pendingSelectedId.current) return;
    setSelected(
      items.find(
        (item) =>
          item.id === pendingSelectedId.current ||
          item.monumentNumber === pendingSelectedId.current,
      ) ?? null,
    );
    pendingSelectedId.current = "";
  }
  const baseResults = remoteResults ?? EMPTY_ITEMS;
  const activeFilters = useMemo(
    () => ({
      functionFilter,
      objectType,
      monumentAard,
      province,
      municipality,
      matchSourceFilter,
      excludedStatuses,
      onlyGroenaanleg,
      onlyMsp,
    }),
    [
      excludedStatuses,
      functionFilter,
      matchSourceFilter,
      monumentAard,
      municipality,
      objectType,
      onlyGroenaanleg,
      onlyMsp,
      province,
    ],
  );
  const { results, groenaanlegCount, mspCount } = useFilteredResults(
    baseResults,
    activeFilters,
  );
  useEffect(() => {
    // Tijdens het laden (bv. net na URL-herstel) is baseResults nog leeg en
    // is groenaanlegCount/mspCount dus altijd 0 - dat zegt niets over de
    // uiteindelijke resultaten. Pas na een afgeronde zoekopdracht vertelt
    // een telling van 0 daadwerkelijk dat het filter niets zou tonen.
    if (remoteState === "loading") return;
    const timer = window.setTimeout(() => {
      if (onlyGroenaanleg && groenaanlegCount === 0) setOnlyGroenaanleg(false);
      if (onlyMsp && mspCount === 0) setOnlyMsp(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [groenaanlegCount, mspCount, onlyGroenaanleg, onlyMsp, remoteState]);
  function toggleLegalStatus(label: string) {
    setExcludedStatuses((current) =>
      current.includes(label)
        ? current.filter((excluded) => excluded !== label)
        : [...current, label],
    );
  }
  function clearExcludedStatuses() {
    setExcludedStatuses([]);
  }

  // Een mislukte zoekopdracht hoort niet als rode waarschuwing te blijven
  // staan zodra iemand alweer een nieuwe term invoert. Op dat moment is de
  // fout oud nieuws; de nieuwe zoekopdracht is nog niet uitgevoerd.
  function editQuery(value: string) {
    setQuery(value);
    if (selectedTerm?.label !== value) setSelectedTerm(undefined);
    if (remoteState === "error") {
      setActive("");
      setRemoteResults(null);
      setRemoteState("idle");
    }
  }

  function selectTermSuggestion(term: SelectedTermIdentity) {
    editQuery(term.label);
    setSelectedTerm(term);
  }

  async function executeSearch(
    term: string,
    termIdentity = selectedTerm?.label === term ? selectedTerm : undefined,
  ) {
    beginHistoryEntry();
    const request = beginRequest();
    setQuery(term);
    setActive(term);
    setActiveConceptUri(undefined);
    setActiveConceptVeld(undefined);
    setActiveBrowseKind(undefined);
    setSelectedTerm(termIdentity);
    setSelected(null);
    setView("list");
    setMapViewport(undefined);
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
    if (!term) {
      setRemoteResults(null);
      setRemoteState("idle");
      return;
    }
    setRemoteState("loading");
    try {
      const response = await searchRceMonuments(term, request.signal);
      if (!request.isCurrent()) return;
      const items = response.results.map((record) => toItem(record));
      setRemoteResults(items);
      applyPendingSelection(items);
      setHasMore(response.hasMore);
      setRemoteState("success");
    } catch {
      if (request.isAborted() || !request.isCurrent())
        return;
      setRemoteResults([]);
      setRemoteState("error");
    }
  }
  // Exacte match op een concept-URI uit het Referentienetwerk in plaats van
  // een tekstzoekopdracht - bv. een klik op een monumentaard- of
  // waardering-label in de resultatenlijst of het detailpaneel. `veld`
  // bepaalt via welke eigenschap gezocht wordt (de aanroeper weet dit al op
  // basis van welk label is aangeklikt).
  async function executeConceptSearch(
    concept: { uri: string; label: string },
    veld: ConceptField = "monumentaard",
  ) {
    beginHistoryEntry();
    const request = beginRequest();
    setQuery(concept.label);
    setActive(concept.label);
    setActiveConceptUri(concept.uri);
    setActiveConceptVeld(veld);
    setActiveBrowseKind(undefined);
    setSelectedTerm(undefined);
    setSelected(null);
    setView("list");
    setMapViewport(undefined);
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
      const records =
        veld === "functie"
          ? await searchByFunctieConcept(concept.uri, request.signal)
          : veld === "waardering"
          ? await searchByArcheologischeWaarderingConcept(
              concept.uri,
              request.signal,
            )
          : veld === "gebeurtenis"
            ? await searchByGebeurtenisConcept(concept.uri, request.signal)
            : veld === "actor"
              ? await searchByActorConcept(concept.uri, request.signal)
            : veld === "vondsttype"
              ? await searchByVondstTypeConcept(concept.uri, request.signal)
            : veld === "materiaal"
              ? await searchByMateriaalConcept(concept.uri, request.signal)
            : veld === "toestand"
              ? await searchByToestandConcept(concept.uri, request.signal)
            : veld === "archeologischcomplextype"
              ? await searchByArcheologischComplexTypeConcept(concept.uri, request.signal)
            : veld === "stijl"
              ? await searchByStijlConcept(concept.uri, request.signal)
            : veld === "bouwkundigestaat"
              ? await searchByBouwkundigeStaatConcept(concept.uri, request.signal)
            : veld === "verwerving"
              ? await searchByVerwervingConcept(concept.uri, request.signal)
            : veld === "grondspoortype"
              ? await searchByGrondspoorTypeConcept(concept.uri, request.signal)
            : veld === "monumenttype"
              ? await searchByMonumentTypeConcept(concept.uri, request.signal)
              : await searchByMonumentAardConcept(
                  concept.uri,
                  request.signal,
                );
      if (!request.isCurrent()) return;
      const items = records.map((record) => toItem(record));
      setRemoteResults(items);
      applyPendingSelection(items);
      setHasMore(false);
      setRemoteState("success");
    } catch {
      if (request.isAborted() || !request.isCurrent())
        return;
      setRemoteResults([]);
      setRemoteState("error");
    }
  }
  // Werelderfgoed en Gezicht zijn anders te vinden dan Rijksmonumenten: er is
  // geen zoekterm voor "laat alles zien", dus browsen ze de volledige (kleine)
  // collectie in plaats van op naam te matchen.
  async function browseType(kind: BrowseKind) {
    beginHistoryEntry();
    const request = beginRequest();
    setQuery("");
    setActive(
      kind === "rijksmonument"
        ? "Rijksmonumenten"
        : kind === "archeologischterrein"
          ? "Archeologische terreinen"
          : kind === "onderzoeksgebied"
            ? "Onderzoeksgebieden"
            : kind === "vondstlocatie"
              ? "Vondstlocaties"
              : kind === "archeologischcomplex"
                ? "Archeologische complexen"
                : kind === "vondsten"
                  ? "Vondsten"
                  : kind === "grondsporen"
                    ? "Grondsporen"
        : kind === "werelderfgoed"
        ? "Werelderfgoed"
        : kind === "gezicht"
          ? "Rijksbeschermde gezichten"
          : "Complexen",
    );
    setActiveConceptUri(undefined);
    setActiveConceptVeld(undefined);
    setActiveBrowseKind(kind);
    setSelectedTerm(undefined);
    setSelected(null);
    setView("list");
    setMapViewport(undefined);
    setObjectType(
      kind === "rijksmonument"
        ? "Rijksmonument"
        : kind === "archeologischterrein"
          ? "Archeologisch terrein"
          : kind === "onderzoeksgebied"
            ? "Onderzoeksgebied"
            : kind === "vondstlocatie"
              ? "Vondstlocatie"
              : kind === "archeologischcomplex"
                ? "Archeologisch complex"
                : kind === "vondsten"
                  ? "Vondst"
                  : kind === "grondsporen"
                    ? "Grondspoor"
        : kind === "werelderfgoed"
        ? "Werelderfgoed"
        : kind === "gezicht"
          ? "Gezicht"
          : "Complex",
    );
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
      const response = await browseRceObjects(kind, request.signal);
      if (!request.isCurrent()) return;
      const items = response.results.map((record) => toItem(record));
      setRemoteResults(items);
      applyPendingSelection(items);
      setHasMore(response.hasMore);
      setRemoteState("success");
    } catch {
      if (request.isAborted() || !request.isCurrent())
        return;
      setRemoteResults([]);
      setRemoteState("error");
    }
  }
  async function loadMore() {
    if (!active || loadingMore || activeConceptUri) return;
    const nextPage = resultPage + 1;
    // Deelt hetzelfde abort/sequence-systeem als executeSearch/
    // executeConceptSearch/browseType: start de gebruiker een nieuwe
    // zoekopdracht terwijl deze aanvraag nog loopt, dan annuleert die nieuwe
    // aanvraag deze fetch en faalt de isCurrent()-check hieronder, zodat
    // verouderde resultaten niet alsnog in de nieuwe zoekopdracht belanden.
    const request = beginRequest();
    setLoadingMore(true);
    try {
      const response = activeBrowseKind
        ? await browseRceObjects(activeBrowseKind, request.signal, nextPage)
        : await searchRceMonuments(active, request.signal, nextPage);
      if (!request.isCurrent()) return;
      const additions = response.results.map((record) => toItem(record));
      setRemoteResults((current) => {
        const merged = new Map(
          (current ?? []).map((item) => [item.monumentNumber ?? item.id, item]),
        );
        for (const item of additions)
          merged.set(item.monumentNumber ?? item.id, item);
        return [...merged.values()];
      });
      setResultPage(nextPage);
      setHasMore(response.hasMore);
    } catch {
      if (!request.isAborted() && request.isCurrent()) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  function restoreUrlState(initial: SearchUrlState) {
    pendingSelectedId.current = initial.selectedId;
    if (initial.browseKind)
      void browseType(initial.browseKind);
    else if (initial.conceptUri && initial.conceptField)
      void executeConceptSearch(
        { uri: initial.conceptUri, label: initial.query || "Gekozen begrip" },
        initial.conceptField,
      );
    else if (initial.query)
      void executeSearch(initial.query, initial.selectedTerm);
    else reset();
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
    setMapViewport(initial.mapViewport);
  }
  function reset() {
    setQuery("");
    setActive("");
    setActiveConceptUri(undefined);
    setActiveConceptVeld(undefined);
    setActiveBrowseKind(undefined);
    setSelectedTerm(undefined);
    setObjectType("Alle");
    setMonumentAard("Alle");
    setProvince("Alle");
    setMunicipality("Alle");
    setFunctionFilter("Alle");
    setMatchSourceFilter("Alle");
    setExcludedStatuses([]);
    setOnlyGroenaanleg(false);
    setOnlyMsp(false);
    setView("list");
    setSelected(null);
    setMapViewport(undefined);
    setRemoteResults(null);
    setRemoteState("idle");
    setResultPage(1);
    setHasMore(false);
  }

  // Herhaalt de laatst geprobeerde actie (tekstzoekopdracht, conceptzoekopdracht
  // of browse) na een mislukte poging. Alle drie zetten hun eigen
  // "actief"-state al vóór de fetch en laten die staan wanneer
  // setRemoteState("error") wordt gezet, dus die state is hier zonder extra
  // boekhouding opnieuw af te leiden.
  function retry() {
    if (activeBrowseKind) void browseType(activeBrowseKind);
    else if (activeConceptUri)
      void executeConceptSearch({ uri: activeConceptUri, label: active }, activeConceptVeld);
    else void executeSearch(query);
  }

  return {
    query,
    setQuery: editQuery,
    active,
    view,
    setView,
    mapViewport,
    setMapViewport,
    objectType,
    setObjectType,
    monumentAard,
    setMonumentAard,
    province,
    setProvince,
    municipality,
    setMunicipality,
    functionFilter,
    setFunctionFilter,
    matchSourceFilter,
    setMatchSourceFilter,
    excludedStatuses,
    toggleLegalStatus,
    clearExcludedStatuses,
    onlyGroenaanleg,
    setOnlyGroenaanleg,
    onlyMsp,
    setOnlyMsp,
    selected,
    setSelected,
    choose,
    filters,
    setFilters,
    remoteState,
    resultPage,
    hasMore,
    loadingMore,
    baseResults,
    groenaanlegCount,
    mspCount,
    results,
    activeConceptUri,
    activeConceptVeld,
    selectedTerm,
    selectTermSuggestion,
    executeSearch,
    executeConceptSearch,
    browseType,
    loadMore,
    reset,
    retry,
  };
}
