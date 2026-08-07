"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeritageMap } from "./HeritageMap";
import { searchRceMonuments } from "@/lib/rce-client";
import type { RceMonument } from "@/lib/rce";
import { fetchTermSuggestions, type TermSuggestion } from "@/lib/terms-client";

type Item = {
  id: string; objectNumber: string; title: string; kind: string; address: string;
  postalCode: string; place: string; municipality: string; province: string;
  type: "Gebouwd" | "Archeologisch"; period: string; description: string;
  lat: number; lng: number;
  monumentNumber?: string; registrationDate?: string; official?: boolean; sourceUrl?: string; linkedDataUrl?: string; wkt?: string;
  matchSource?: string; matchedText?: string; matchScore?: number; legalStatus?: string;
  originalFunctionNames?: string[]; currentFunctionNames?: string[]; typeNames?: string[];
  parcels?: Array<{ municipality: string; municipalityCode: string; section: string; parcelNumber: string; provinceCode: string }>;
  archaeologicalSites?: Array<{ archisMonumentnummer?: string; waardering?: string }>;
};

const EMPTY_ITEMS: Item[] = [];
const EMPTY_URL_STATE = { query: "", type: "Alle", municipality: "Alle", functionFilter: "Alle", matchSourceFilter: "Alle", view: "list" as const, selectedId: "" };
const MONUMENT_REGISTER_BASE_URL = "https://monumentenregister.cultureelerfgoed.nl/monumenten/";

function displayFunctionName(value: string) {
  return value.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

function toItem(record: RceMonument, term: string): Item {
  const functionName = record.functionName ? displayFunctionName(record.functionName) : "";
  const originalFunctionNames = record.originalFunctionNames?.map(displayFunctionName).filter(Boolean);
  const matchedText = record.matchSource === "oorspronkelijke functie" && record.matchedText
    ? displayFunctionName(record.matchedText)
    : record.matchedText;
  return {
    id: record.choNumber, monumentNumber: record.monumentNumber, objectNumber: record.choNumber,
    title: record.name || functionName || `Rijksmonument ${record.monumentNumber}`,
    kind: functionName || "Functie niet opgenomen",
    address: record.fullAddress || [record.street, record.houseNumber].filter(Boolean).join(" ") || "Adres niet opgenomen",
    postalCode: record.postalCode, place: record.place || (/^\d/.test(term) ? "" : term),
    municipality: record.place || (/^\d/.test(term) ? "" : term), province: "",
    type: record.monumentNature?.toLocaleLowerCase("nl").includes("archeologisch") ? "Archeologisch" : "Gebouwd",
    period: record.matchSource ? `Gevonden via ${record.matchSource}${matchedText ? `: ${matchedText.slice(0, 72)}${matchedText.length > 72 ? "…" : ""}` : ""}` : record.registrationDate ? `Ingeschreven ${record.registrationDate}` : "Datering niet opgenomen",
    description: record.description || "Actueel record uit de Linked Data Voorziening van de Rijksdienst voor het Cultureel Erfgoed.",
    registrationDate: record.registrationDate, official: true, sourceUrl: record.monumentNumber ? `${MONUMENT_REGISTER_BASE_URL}${encodeURIComponent(record.monumentNumber)}` : record.sourceUrl, linkedDataUrl: record.sourceUrl, wkt: record.wkt,
    parcels: record.parcels, archaeologicalSites: record.archaeologicalSites, matchSource: record.matchSource, matchedText, matchScore: record.matchScore,
    legalStatus: record.legalStatus, originalFunctionNames,
    currentFunctionNames: record.currentFunctionNames, typeNames: record.typeNames,
    lat: record.lat ?? 0, lng: record.lng ?? 0,
  };
}

function readUrlState() {
  if (typeof window === "undefined") return EMPTY_URL_STATE;
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const municipality = params.get("gemeente");
  return {
    query: params.get("q") ?? "",
    type: type === "Gebouwd" || type === "Archeologisch" ? type : "Alle",
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
  const [type, setType] = useState(EMPTY_URL_STATE.type);
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
    if (type !== "Alle") params.set("type", type);
    if (municipality !== "Alle") params.set("gemeente", municipality);
    if (functionFilter !== "Alle") params.set("functie", functionFilter);
    if (matchSourceFilter !== "Alle") params.set("bron", matchSourceFilter);
    if (view === "map") params.set("view", "map");
    if (selected) params.set("rm", selected.id);
    window.history.replaceState({}, "", params.size ? `?${params}` : window.location.pathname);
  }, [active, functionFilter, matchSourceFilter, municipality, selected, type, view]);

  const choose = useCallback((item: Item) => setSelected(item), []);
  const baseResults = remoteResults ?? EMPTY_ITEMS;
  const functions = useMemo(() => [...new Set(baseResults.flatMap((item) => [...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? []), item.kind]).filter((kind) => kind !== "Functie niet opgenomen"))].sort((a, b) => a.localeCompare(b, "nl")), [baseResults]);
  const municipalities = useMemo(() => [...new Set(baseResults.map((item) => item.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl")), [baseResults]);
  const matchSources = useMemo(() => [...new Set(baseResults.map((item) => item.matchSource).filter((source): source is string => Boolean(source)))], [baseResults]);
  const results = useMemo(() => baseResults.filter((item) =>
    (functionFilter === "Alle" || [item.kind, ...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? [])].includes(functionFilter)) &&
    (type === "Alle" || item.type === type) &&
    (municipality === "Alle" || item.municipality === municipality) &&
    (matchSourceFilter === "Alle" || item.matchSource === matchSourceFilter)
  ), [baseResults, functionFilter, matchSourceFilter, municipality, type]);

  async function executeSearch(term: string) {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setQuery(term);
    setActive(term); setSelected(null); setView("list");
    setType("Alle");
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
      const items = records.map((record) => toItem(record, term));
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
      const additions = records.map((record) => toItem(record, active));
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
      setType(initial.type);
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
    setQuery(""); setActive(""); setType("Alle"); setMunicipality("Alle"); setFunctionFilter("Alle"); setMatchSourceFilter("Alle"); setSelected(null); setRemoteResults(null); setRemoteState("idle"); setResultPage(1); setHasMore(false);
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
      <p className={`source-status ${remoteState}`} aria-live="polite">{remoteState === "loading" ? "De actuele RCE-registratie wordt doorzocht…" : remoteState === "error" ? "De RCE Linked Data-service is momenteel niet bereikbaar. Probeer het later opnieuw." : remoteState === "success" ? "Resultaten rechtstreeks uit de actuele RCE Linked Data" : "Actuele brondata · formele registraties · juridische status rijksmonument"}</p>
    </section>
    <section className={`work ${!active ? "start" : ""}`}>
      <aside className={filters ? "show" : ""} aria-label="Zoekfilters">
        <div className="aside-title"><div><small>VERFIJN</small><h2>Filters</h2></div><button type="button" onClick={() => setFilters(false)} aria-label="Filters sluiten">×</button></div>
        <fieldset><legend>Monumentaard</legend>{["Alle", "Gebouwd", "Archeologisch"].map((option) => <label key={option}><input type="radio" name="type" checked={type === option} onChange={() => setType(option)} /><span>{option === "Alle" ? "Alle monumentaarden" : option}</span><em>{option === "Alle" ? baseResults.length : baseResults.filter((item) => item.type === option).length}</em></label>)}</fieldset>
        <fieldset><legend>Gemeente / woonplaats</legend><label className="select-label"><span className="sr">Filter op gemeente of woonplaats</span><select aria-label="Filter op gemeente of woonplaats" value={municipality} onChange={(event) => setMunicipality(event.target.value)}><option value="Alle">Alle plaatsen ({baseResults.length})</option>{municipalities.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => item.municipality === option).length})</option>)}</select></label></fieldset>
        <fieldset><legend>Functie</legend><label className="select-label"><span className="sr">Filter op functie</span><select aria-label="Filter op functie" value={functionFilter} onChange={(event) => setFunctionFilter(event.target.value)}><option value="Alle">Alle functies ({baseResults.length})</option>{functions.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => [item.kind, ...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? [])].includes(option)).length})</option>)}</select></label></fieldset>
        {matchSources.length > 0 && <fieldset><legend>Gevonden via</legend><label className="select-label"><span className="sr">Filter op matchbron</span><select aria-label="Filter op matchbron" value={matchSourceFilter} onChange={(event) => setMatchSourceFilter(event.target.value)}><option value="Alle">Alle matchbronnen</option>{matchSources.map((option) => <option key={option} value={option}>{option} ({baseResults.filter((item) => item.matchSource === option).length})</option>)}</select></label></fieldset>}
        <fieldset><legend>Juridische status</legend><label><input type="checkbox" checked readOnly /><span>Rijksmonument</span><em>{baseResults.filter((item) => !item.official || item.legalStatus === "rijksmonument").length}</em></label></fieldset>
        <button className="reset" type="button" onClick={reset}>Wis alle filters</button>
      </aside>
      <div className="results">
        <div className="toolbar"><div><small>RIJKSMONUMENTEN</small><h2 aria-live="polite">{results.length} {results.length === 1 ? "resultaat" : "resultaten"}{active ? ` voor “${active}”` : ""}</h2></div><div><button className="mobile-filter" type="button" onClick={() => setFilters(true)}>☰ Filters</button><span className="switch" aria-label="Weergave"><button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="Lijstweergave" aria-pressed={view === "list"}>☷</button><button type="button" className={view === "map" ? "on" : ""} onClick={() => setView("map")} aria-label="Kaartweergave" aria-pressed={view === "map"}>⌖</button></span></div></div>
        {remoteState === "idle" ? <div className="start-panel"><small>ZO WERKT HET</small><h2>Van zoekwoord naar officiële registratie</h2><p>Doorzoek de actuele CHO-dataset van de Rijksdienst voor het Cultureel Erfgoed. Doorzoeker toont niet alleen wat gevonden is, maar ook via welk formeel gegevensveld.</p><div><article><b>01</b><h3>Zoek breed</h3><p>Gebruik een nummer, plaats, functie, monumentaard of omschrijving.</p></article><article><b>02</b><h3>Zie waarom</h3><p>Elk resultaat vermeldt de matchbron en de geregistreerde waarde.</p></article><article><b>03</b><h3>Controleer de bron</h3><p>Bekijk functie, adres, geometrie, percelen en de canonieke RCE-link.</p></article></div></div> : remoteState === "loading" ? <div className="empty"><b>…</b><h3>RCE Linked Data doorzoeken</h3><p>Een ogenblik; de officiële bron wordt geraadpleegd.</p></div> : results.length === 0 ? <div className="empty"><b>0</b><h3>Geen monumenten gevonden</h3><p>Probeer een plaats, postcode, formele functie, monumentaard of monumentnummer.</p><button type="button" onClick={reset}>Nieuwe zoekopdracht</button></div> : view === "list" ? <div className="cards">{results.map((item) => <article key={item.id}><div className={item.type === "Archeologisch" ? "tile sand" : "tile"}><b>{item.type === "Archeologisch" ? "A" : "M"}</b><small>RCE register</small></div><div className="copy"><small>{item.kind}<code>RM {item.monumentNumber ?? item.id}</code></small><h3>{item.title}</h3><p className="address">● {item.address}{item.postalCode || item.place ? `, ${item.postalCode} ${item.place}` : ""}</p><p>{item.description}</p><span>{item.type}</span><span>{item.period}</span></div><button className="open" type="button" onClick={() => setSelected(item)} aria-label={`Details van ${item.title}`}>→</button></article>)}</div> : <HeritageMap items={results.filter((item) => item.lat && item.lng)} onSelect={(mapItem) => { const item = results.find((candidate) => candidate.id === mapItem.id); if (item) choose(item); }} />}
        {hasMore && remoteState === "success" && view === "list" && <div className="more-results"><button type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Meer RCE-resultaten laden…" : "Laad 25 volgende resultaten"}</button><small>{baseResults.length} unieke monumenten geladen</small></div>}
      </div>
    </section>
    {selected && <div className="backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="x" type="button" onClick={() => setSelected(null)} aria-label="Details sluiten">×</button><div className={selected.type === "Archeologisch" ? "detail-head sand" : "detail-head"}><b>{selected.type === "Archeologisch" ? "A" : "M"}</b><small>{selected.official ? "RCE Linked Data" : `${selected.type} erfgoed`}</small></div><div className="detail-copy"><small>RIJKSMONUMENT {selected.monumentNumber ?? selected.id}</small><h2 id="detail-title">{selected.title}</h2><p>{selected.address}<br />{selected.postalCode} {selected.place}{selected.province ? `, ${selected.province}` : ""}</p><hr /><p>{selected.description}</p><dl><div><dt>Status</dt><dd>Rijksmonument</dd></div><div><dt>CHO-nummer</dt><dd>{selected.objectNumber}</dd></div><div><dt>Functie</dt><dd>{selected.kind}</dd></div><div><dt>Registratie / datering</dt><dd>{selected.registrationDate ?? selected.period}</dd></div>{selected.wkt && <div><dt>Geometrie (WGS84)</dt><dd><code>{selected.wkt}</code></dd></div>}{selected.parcels?.length ? <div><dt>Kadastrale percelen</dt><dd>{selected.parcels.map((parcel) => <span key={`${parcel.municipalityCode}-${parcel.section}-${parcel.parcelNumber}`}>{parcel.municipality} {parcel.section} {parcel.parcelNumber}{parcel.provinceCode ? ` (${parcel.provinceCode})` : ""}</span>)}</dd></div> : null}{selected.archaeologicalSites?.length ? <div><dt>Archeologisch terrein</dt><dd>{selected.archaeologicalSites.map((site, index) => <span key={site.archisMonumentnummer ?? index}>{site.archisMonumentnummer ? `Archis-monumentnummer ${site.archisMonumentnummer}` : "Archis-monumentnummer onbekend"}{site.waardering ? ` — ${site.waardering}` : ""}</span>)}</dd></div> : null}<div><dt>Bron</dt><dd>{selected.official ? "RCE Linked Data" : "Voorbeelddata"}</dd></div></dl><div className="detail-links"><a href={selected.sourceUrl ?? `${MONUMENT_REGISTER_BASE_URL}${encodeURIComponent(selected.monumentNumber ?? selected.id)}`} target="_blank" rel="noreferrer">Bekijk in het Monumentenregister <b>→</b></a>{selected.linkedDataUrl && <a href={selected.linkedDataUrl} target="_blank" rel="noreferrer">Bekijk in de RCE Linked Data <b>→</b></a>}</div><blockquote>{selected.official ? "Actueel record uit de officiële Linked Data Voorziening van de RCE." : "Voorbeeldrecord; nog niet alle zoekvelden zijn live gekoppeld."}</blockquote></div></aside></div>}
  </main>;
}
