"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeritageMap } from "./HeritageMap";
import { browseRceObjects, searchRceMonuments } from "@/lib/rce-client";
import { provinceName, type RceMonument } from "@/lib/rce";
import { fetchTermSuggestions, type TermSuggestion } from "@/lib/terms-client";

// Rijksmonument, Werelderfgoed en Gezicht zijn geen drie smaken van hetzelfde
// ding: het zijn verschillende soorten cultuurhistorisch object. Werelderfgoed
// en Gezicht zijn gebieden waar de RCE verantwoordelijk voor is en die
// rijksmonumenten kunnen bevatten, maar zijn zelf niet "een monumentaard".
// Monumentaard (gebouwd/archeologisch) is dan ook alleen een eigenschap van
// een Rijksmonument, niet van de andere twee.
type Item = {
  id: string; objectNumber: string; title: string; kind: string; address: string;
  postalCode: string; place: string; municipality: string; province: string;
  objectType: "Rijksmonument" | "Werelderfgoed" | "Gezicht";
  monumentAard?: "Gebouwd" | "Archeologisch";
  period: string; description: string;
  lat: number; lng: number;
  monumentNumber?: string; registrationDate?: string; official?: boolean; sourceUrl?: string; linkedDataUrl?: string; wkt?: string;
  matchSource?: string; matchedText?: string; matchScore?: number; legalStatus?: string;
  originalFunctionNames?: string[]; currentFunctionNames?: string[]; typeNames?: string[];
  parcels?: Array<{ municipality: string; municipalityCode: string; section: string; parcelNumber: string; provinceCode: string }>;
  archaeologicalSites?: Array<{ archisMonumentnummer?: string; waardering?: string }>;
  complexes?: Array<{ complexnummer?: string; complexnaam?: string; role: "hoofdobject" | "onderdeel" }>;
};

const EMPTY_ITEMS: Item[] = [];
const EMPTY_URL_STATE = { query: "", objectType: "Alle", monumentAard: "Alle", province: "Alle", municipality: "Alle", functionFilter: "Alle", matchSourceFilter: "Alle", view: "list" as const, selectedId: "" };
const MONUMENT_REGISTER_BASE_URL = "https://monumentenregister.cultureelerfgoed.nl/monumenten/";

function displayFunctionName(value: string) {
  return value.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

function typeBadge(item: { objectType: Item["objectType"]; monumentAard?: Item["monumentAard"] }) {
  if (item.objectType === "Werelderfgoed") return { letter: "W", modifier: "world" };
  if (item.objectType === "Gezicht") return { letter: "G", modifier: "green" };
  if (item.monumentAard === "Archeologisch") return { letter: "A", modifier: "sand" };
  return { letter: "M", modifier: "" };
}

// Niet elk resultaat is een Rijksmonument: Werelderfgoed en Gezicht hebben
// hun eigen juridische status.
function statusLabel(objectType: Item["objectType"]) {
  if (objectType === "Werelderfgoed") return "Werelderfgoed";
  if (objectType === "Gezicht") return "Rijksbeschermd stads- of dorpsgezicht";
  return "Rijksmonument";
}

function toItem(record: RceMonument): Item {
  const functionName = record.functionName ? displayFunctionName(record.functionName) : "";
  const originalFunctionNames = record.originalFunctionNames?.map(displayFunctionName).filter(Boolean);
  const matchedText = record.matchSource === "oorspronkelijke functie" && record.matchedText
    ? displayFunctionName(record.matchedText)
    : record.matchedText;
  const isWerelderfgoed = record.monumentNature === "werelderfgoed";
  const isGezicht = record.monumentNature === "gezicht";
  const hasOwnOfficialUrl = isWerelderfgoed || isGezicht;
  const objectType: Item["objectType"] = isWerelderfgoed ? "Werelderfgoed" : isGezicht ? "Gezicht" : "Rijksmonument";
  const monumentAard: Item["monumentAard"] = objectType === "Rijksmonument"
    ? (record.monumentNature?.toLocaleLowerCase("nl").includes("archeologisch") ? "Archeologisch" : "Gebouwd")
    : undefined;
  return {
    id: record.choNumber, monumentNumber: record.monumentNumber, objectNumber: record.choNumber,
    title: record.name || functionName || `Rijksmonument ${record.monumentNumber}`,
    kind: functionName || "Functie niet opgenomen",
    address: record.fullAddress || [record.street, record.houseNumber].filter(Boolean).join(" ") || "Adres niet opgenomen",
    postalCode: record.postalCode, place: record.place ?? "",
    municipality: record.municipality ?? record.place ?? "", province: provinceName(record.provinceCode) ?? "",
    objectType, monumentAard,
    period: record.matchSource ? `Gevonden via ${record.matchSource}${matchedText ? `: ${matchedText.slice(0, 72)}${matchedText.length > 72 ? "…" : ""}` : ""}` : record.registrationDate ? `Ingeschreven ${record.registrationDate}` : "Datering niet opgenomen",
    description: record.description || "Actueel record uit de Linked Data Voorziening van de Rijksdienst voor het Cultureel Erfgoed.",
    registrationDate: record.registrationDate, official: true,
    sourceUrl: hasOwnOfficialUrl ? (record.officialUrl ?? record.sourceUrl) : record.monumentNumber ? `${MONUMENT_REGISTER_BASE_URL}${encodeURIComponent(record.monumentNumber)}` : record.sourceUrl,
    linkedDataUrl: record.sourceUrl, wkt: record.wkt,
    parcels: record.parcels, archaeologicalSites: record.archaeologicalSites, complexes: record.complexes, matchSource: record.matchSource, matchedText, matchScore: record.matchScore,
    legalStatus: record.legalStatus, originalFunctionNames,
    currentFunctionNames: record.currentFunctionNames, typeNames: record.typeNames,
    lat: record.lat ?? 0, lng: record.lng ?? 0,
  };
}

function readUrlState() {
  if (typeof window === "undefined") return EMPTY_URL_STATE;
  const params = new URLSearchParams(window.location.search);
  const objectType = params.get("soort");
  const monumentAard = params.get("aard");
  const province = params.get("provincie");
  const municipality = params.get("gemeente");
  return {
    query: params.get("q") ?? "",
    objectType: objectType === "Rijksmonument" || objectType === "Werelderfgoed" || objectType === "Gezicht" ? objectType : "Alle",
    monumentAard: monumentAard === "Gebouwd" || monumentAard === "Archeologisch" ? monumentAard : "Alle",
    province: province || "Alle",
    municipality: municipality || "Alle",
    functionFilter: params.get("functie") ?? "Alle",
    matchSourceFilter: params.get("bron") ?? "Alle",
    view: params.get("view") === "map" ? "map" as const : "list" as const,
    selectedId: params.get("rm") ?? "",
  };
}

export default function Home() {
  const [query, setQuery] = useState(EMPTY_URL_STATE.query);
  const [active, setActive] = useState(EMPTY_URL_STATE.query);
  const [objectType, setObjectType] = useState(EMPTY_URL_STATE.objectType);
  const [monumentAard, setMonumentAard] = useState(EMPTY_URL_STATE.monumentAard);
  const [province, setProvince] = useState(EMPTY_URL_STATE.province);
  const [municipality, setMunicipality] = useState(EMPTY_URL_STATE.municipality);
  const [functionFilter, setFunctionFilter] = useState(EMPTY_URL_STATE.functionFilter);
  const [matchSourceFilter, setMatchSourceFilter] = useState(EMPTY_URL_STATE.matchSourceFilter);
  const [view, setView] = useState<"list" | "map">(EMPTY_URL_STATE.view);
  const [selected, setSelected] = useState<Item | null>(null);
  const [filters, setFilters] = useState(false);
  const [remoteResults, setRemoteResults] = useState<Item[] | null>(null);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [resultPage, setResultPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<TermSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
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
    if (view === "map") params.set("view", "map");
    if (selected) params.set("rm", selected.id);
    window.history.replaceState({}, "", params.size ? `?${params}` : window.location.pathname);
  }, [active, functionFilter, matchSourceFilter, monumentAard, municipality, objectType, province, selected, view]);

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
    (matchSourceFilter === "Alle" || item.matchSource === matchSourceFilter)
  ), [baseResults, functionFilter, matchSourceFilter, monumentAard, municipality, objectType, province]);

  async function executeSearch(term: string) {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setQuery(term);
    setActive(term); setSelected(null); setView("list");
    setObjectType("Alle");
    setMonumentAard("Alle");
    setProvince("Alle");
    setMunicipality("Alle");
    setFunctionFilter("Alle");
    setMatchSourceFilter("Alle");
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
  // Werelderfgoed en Gezicht zijn anders te vinden dan Rijksmonumenten: er is
  // geen zoekterm voor "laat alles zien", dus browsen ze de volledige (kleine)
  // collectie in plaats van op naam te matchen.
  async function browseType(kind: "werelderfgoed" | "gezicht") {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setQuery("");
    setActive(kind === "werelderfgoed" ? "Werelderfgoed" : "Rijksbeschermde gezichten");
    setSelected(null); setView("list");
    setObjectType(kind === "werelderfgoed" ? "Werelderfgoed" : "Gezicht");
    setMonumentAard("Alle"); setProvince("Alle"); setMunicipality("Alle");
    setFunctionFilter("Alle"); setMatchSourceFilter("Alle");
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
    if (!active || loadingMore) return;
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
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void executeSearch(query.trim());
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
      setView(initial.view);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => () => searchController.current?.abort(), []);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || term === active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const nextSuggestions = await fetchTermSuggestions(term, controller.signal).catch(() => []);
      if (!controller.signal.aborted) {
        setSuggestions(nextSuggestions);
        setSuggestionsOpen(nextSuggestions.length > 0);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, query]);
  function reset() {
    setQuery(""); setActive(""); setObjectType("Alle"); setMonumentAard("Alle"); setProvince("Alle"); setMunicipality("Alle"); setFunctionFilter("Alle"); setMatchSourceFilter("Alle"); setSelected(null); setRemoteResults(null); setRemoteState("idle"); setResultPage(1); setHasMore(false);
  }

  return <main>
    <div className="govbar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-rce.gif" alt="Rijksdienst voor het Cultureel Erfgoed, Ministerie van Onderwijs, Cultuur en Wetenschap" />
    </div>
    <header>
      <button className="brand brand-button" type="button" onClick={reset} aria-label="Terug naar de startpagina"><b>D</b><span><strong>Doorzoeker</strong><small>Rijksmonumenten in actuele RCE-data</small></span></button>
      <p><i />Live gekoppeld aan RCE Linked Data <a href="https://linkeddata.cultureelerfgoed.nl/rce/cho" target="_blank" rel="noreferrer">Bronverantwoording</a></p>
    </header>
    <section className="hero">
      <small>DE OFFICIËLE RIJKSMONUMENTEN DOORZOEKEN</small><h1>Vind het monument.<br /><span>Begrijp de registratie.</span></h1>
      <p className="hero-intro">Zoek op monumentnummer, plaats, oorspronkelijke functie, monumentaard of woorden uit de formele omschrijving.</p>
      <div className="search-combobox"><form onSubmit={(event) => { setSuggestionsOpen(false); submitSearch(event); }}><span aria-hidden="true">⌕</span><label className="sr" htmlFor="q">Zoeken</label><input id="q" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls="term-suggestions" value={query} onFocus={() => setSuggestionsOpen(suggestions.length > 0)} onChange={(event) => setQuery(event.target.value)} placeholder="Bijvoorbeeld 36046, woonhuis, lijstgevel of Utrecht" />{query && <button type="button" className="clear" onClick={() => { setQuery(""); setSuggestionsOpen(false); }} aria-label="Zoekveld wissen">×</button>}<button type="submit">Doorzoek RCE</button></form>{suggestionsOpen && <ul id="term-suggestions" className="term-suggestions" role="listbox" aria-label="Termsuggesties">{suggestions.map((suggestion) => <li key={suggestion.uri} role="option" aria-selected="false"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(suggestion.label); setSuggestionsOpen(false); }}>{suggestion.label}<small>{suggestion.sourceName}</small></button></li>)}</ul>}</div>
      <nav aria-label="Direct zoeken">Direct zoeken: {["36046", "Woonhuis", "Archeologisch", "Utrecht"].map((term) => <button type="button" key={term} onClick={() => void executeSearch(term)}>{term}</button>)}</nav>
      <nav aria-label="Bekijk een volledige collectie">Bekijk alles: <button type="button" onClick={() => void browseType("werelderfgoed")}>Werelderfgoed</button><button type="button" onClick={() => void browseType("gezicht")}>Gezichten</button></nav>
      <p className={`source-status ${remoteState}`} aria-live="polite">{remoteState === "loading" ? "De actuele RCE-registratie wordt doorzocht…" : remoteState === "error" ? "De RCE Linked Data-service is momenteel niet bereikbaar. Probeer het later opnieuw." : remoteState === "success" ? "Resultaten rechtstreeks uit de actuele RCE Linked Data" : "Actuele brondata · formele registraties · juridische status rijksmonument"}</p>
    </section>
    <section className={`work ${!active ? "start" : ""}`}>
      <aside className={filters ? "show" : ""} aria-label="Zoekfilters">
        <div className="aside-title"><div><small>VERFIJN</small><h2>Filters</h2></div><button type="button" onClick={() => setFilters(false)} aria-label="Filters sluiten">×</button></div>
        <fieldset><legend>Soort object</legend>{["Alle", "Rijksmonument", "Werelderfgoed", "Gezicht"].map((option) => <label key={option}><input type="radio" name="soort" checked={objectType === option} onChange={() => setObjectType(option)} /><span>{option === "Alle" ? "Alle soorten" : option}</span><em>{option === "Alle" ? baseResults.length : baseResults.filter((item) => item.objectType === option).length}</em></label>)}</fieldset>
        <fieldset><legend>Monumentaard</legend>{["Alle", "Gebouwd", "Archeologisch"].map((option) => <label key={option}><input type="radio" name="aard" checked={monumentAard === option} onChange={() => setMonumentAard(option)} /><span>{option === "Alle" ? "Alle monumentaarden" : option}</span><em>{option === "Alle" ? baseResults.filter((item) => item.objectType === "Rijksmonument").length : baseResults.filter((item) => item.monumentAard === option).length}</em></label>)}</fieldset>
        {provinces.length > 0 && <fieldset><legend>Provincie</legend><label className="select-label"><span className="sr">Filter op provincie</span><select aria-label="Filter op provincie" value={province} onChange={(event) => { setProvince(event.target.value); setMunicipality("Alle"); }}><option value="Alle">Alle provincies ({baseResults.length})</option>{provinces.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => item.province === option).length})</option>)}</select></label></fieldset>}
        {municipalities.length > 0 && <fieldset><legend>Gemeente / woonplaats</legend><label className="select-label"><span className="sr">Filter op gemeente of woonplaats</span><select aria-label="Filter op gemeente of woonplaats" value={municipality} onChange={(event) => setMunicipality(event.target.value)}><option value="Alle">Alle plaatsen ({baseResults.filter((item) => province === "Alle" || item.province === province).length})</option>{municipalities.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => item.municipality === option && (province === "Alle" || item.province === province)).length})</option>)}</select></label></fieldset>}
        <fieldset><legend>Functie</legend><label className="select-label"><span className="sr">Filter op functie</span><select aria-label="Filter op functie" value={functionFilter} onChange={(event) => setFunctionFilter(event.target.value)}><option value="Alle">Alle functies ({baseResults.length})</option>{functions.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => [item.kind, ...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? [])].includes(option)).length})</option>)}</select></label></fieldset>
        {matchSources.length > 0 && <fieldset><legend>Gevonden via</legend><label className="select-label"><span className="sr">Filter op matchbron</span><select aria-label="Filter op matchbron" value={matchSourceFilter} onChange={(event) => setMatchSourceFilter(event.target.value)}><option value="Alle">Alle matchbronnen</option>{matchSources.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => item.matchSource === option).length})</option>)}</select></label></fieldset>}
        <fieldset><legend>Juridische status</legend>{[...new Set(baseResults.map((item) => statusLabel(item.objectType)))].map((label) => <label key={label}><input type="checkbox" checked readOnly /><span>{label}</span><em>{baseResults.filter((item) => statusLabel(item.objectType) === label).length}</em></label>)}</fieldset>
        <button className="reset" type="button" onClick={reset}>Wis alle filters</button>
      </aside>
      <div className="results">
        <div className="toolbar"><div><small>RIJKSMONUMENTEN</small><h2 aria-live="polite">{results.length} {results.length === 1 ? "resultaat" : "resultaten"}{active ? ` voor “${active}”` : ""}</h2></div><div><button className="mobile-filter" type="button" onClick={() => setFilters(true)}>☰ Filters</button><span className="switch" aria-label="Weergave"><button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="Lijstweergave" aria-pressed={view === "list"}>☷</button><button type="button" className={view === "map" ? "on" : ""} onClick={() => setView("map")} aria-label="Kaartweergave" aria-pressed={view === "map"}>⌖</button></span></div></div>
        {remoteState === "idle" ? <div className="start-panel"><small>ZO WERKT HET</small><h2>Van zoekwoord naar officiële registratie</h2><p>Doorzoek de actuele CHO-dataset van de Rijksdienst voor het Cultureel Erfgoed. Doorzoeker toont niet alleen wat gevonden is, maar ook via welk formeel gegevensveld.</p><div><article><b>01</b><h3>Zoek breed</h3><p>Gebruik een nummer, plaats, functie, monumentaard of omschrijving.</p></article><article><b>02</b><h3>Zie waarom</h3><p>Elk resultaat vermeldt de matchbron en de geregistreerde waarde.</p></article><article><b>03</b><h3>Controleer de bron</h3><p>Bekijk functie, adres, geometrie, percelen en de canonieke RCE-link.</p></article></div></div> : remoteState === "loading" ? <div className="empty"><b>…</b><h3>RCE Linked Data doorzoeken</h3><p>Een ogenblik; de officiële bron wordt geraadpleegd.</p></div> : results.length === 0 ? <div className="empty"><b>0</b><h3>Geen monumenten gevonden</h3><p>Probeer een plaats, postcode, formele functie, monumentaard of monumentnummer.</p><button type="button" onClick={reset}>Nieuwe zoekopdracht</button></div> : view === "list" ? <div className="cards">{results.map((item) => { const badge = typeBadge(item); return <article key={item.id}><div className={`tile ${badge.modifier}`.trim()}><b>{badge.letter}</b><small>RCE register</small></div><div className="copy"><small>{item.kind}<code>RM {item.monumentNumber ?? item.id}</code></small><h3>{item.title}</h3><p className="address">● {item.address}{item.postalCode || item.place ? `, ${item.postalCode} ${item.place}` : ""}</p><p>{item.description}</p><span>{item.objectType === "Rijksmonument" ? (item.monumentAard ?? "Rijksmonument") : item.objectType}</span><span>{item.period}</span></div><button className="open" type="button" onClick={() => setSelected(item)} aria-label={`Details van ${item.title}`}>→</button></article>; })}</div> : <div className="map-view"><HeritageMap items={results.filter((item) => item.lat && item.lng)} onSelect={(mapItem) => { const item = results.find((candidate) => candidate.id === mapItem.id); if (item) choose(item); }} /><div className="map-object-list"><h3>Objecten op deze kaart</h3><ul>{results.filter((item) => item.lat && item.lng).map((item) => <li key={item.id}><button type="button" onClick={() => choose(item)}>{item.title}</button></li>)}</ul></div></div>}
        {hasMore && remoteState === "success" && view === "list" && <div className="more-results"><button type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Meer RCE-resultaten laden…" : "Laad 25 volgende resultaten"}</button><small>{baseResults.length} unieke monumenten geladen</small></div>}
      </div>
    </section>
    {selected && <div className="backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="x" type="button" onClick={() => setSelected(null)} aria-label="Details sluiten">×</button><div className={`detail-head ${typeBadge(selected).modifier}`.trim()}><b>{typeBadge(selected).letter}</b><small>{selected.official ? "RCE Linked Data" : `${selected.objectType} erfgoed`}</small></div><div className="detail-copy"><small>{selected.objectType === "Werelderfgoed" ? "WERELDERFGOED" : selected.objectType === "Gezicht" ? "GEZICHT" : "RIJKSMONUMENT"} {selected.monumentNumber ?? selected.id}</small><h2 id="detail-title">{selected.title}</h2><p>{selected.address}<br />{selected.postalCode} {selected.place}{selected.province ? `, ${selected.province}` : ""}</p><hr /><p>{selected.description}</p>{selected.lat && selected.lng ? <div className="detail-map"><HeritageMap items={[selected]} onSelect={() => {}} compact /></div> : null}<dl><div><dt>Status</dt><dd>{statusLabel(selected.objectType)}</dd></div><div><dt>CHO-nummer</dt><dd>{selected.objectNumber}</dd></div><div><dt>Functie</dt><dd>{selected.kind}</dd></div><div><dt>Registratie / datering</dt><dd>{selected.registrationDate ?? selected.period}</dd></div>{selected.wkt && <div><dt>Geometrie</dt><dd><details><summary>Toon ruwe WKT (WGS84)</summary><code>{selected.wkt}</code></details></dd></div>}{selected.parcels?.length ? <div><dt>Kadastrale percelen</dt><dd>{selected.parcels.map((parcel) => <span key={`${parcel.municipalityCode}-${parcel.section}-${parcel.parcelNumber}`}>{parcel.municipality} {parcel.section} {parcel.parcelNumber}{parcel.provinceCode ? ` (${parcel.provinceCode})` : ""}</span>)}</dd></div> : null}{selected.archaeologicalSites?.length ? <div><dt>Archeologisch terrein</dt><dd>{selected.archaeologicalSites.map((site, index) => <span key={site.archisMonumentnummer ?? index}>{site.archisMonumentnummer ? `Archis-monumentnummer ${site.archisMonumentnummer}` : "Archis-monumentnummer onbekend"}{site.waardering ? ` — ${site.waardering}` : ""}</span>)}</dd></div> : null}{selected.complexes?.length ? <div><dt>Onderdeel van complex</dt><dd>{selected.complexes.map((complex, index) => <span key={complex.complexnummer ?? index}>{complex.complexnaam || (complex.complexnummer ? `Complex ${complex.complexnummer}` : "Complex")}{complex.complexnummer && complex.complexnaam ? ` (${complex.complexnummer})` : ""}{complex.role === "hoofdobject" ? " — hoofdobject" : ""}</span>)}</dd></div> : null}<div><dt>Bron</dt><dd>{selected.official ? "RCE Linked Data" : "Voorbeelddata"}</dd></div></dl><div className="detail-links"><a href={selected.sourceUrl ?? `${MONUMENT_REGISTER_BASE_URL}${encodeURIComponent(selected.monumentNumber ?? selected.id)}`} target="_blank" rel="noreferrer">{selected.objectType === "Werelderfgoed" ? "Bekijk op de UNESCO Werelderfgoedlijst" : selected.objectType === "Gezicht" ? "Bekijk in het Archis-archief" : "Bekijk in het Monumentenregister"} <b>→</b></a>{selected.linkedDataUrl && <a href={selected.linkedDataUrl} target="_blank" rel="noreferrer">Bekijk in de RCE Linked Data <b>→</b></a>}</div><blockquote>{selected.official ? "Actueel record uit de officiële Linked Data Voorziening van de RCE." : "Voorbeeldrecord; nog niet alle zoekvelden zijn live gekoppeld."}</blockquote></div></aside></div>}
  </main>;
}
