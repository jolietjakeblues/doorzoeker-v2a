"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { HeritageMap } from "./HeritageMap";

type Item = {
  id: string; objectNumber: string; title: string; kind: string; address: string;
  postalCode: string; place: string; municipality: string; province: string;
  type: "Gebouwd" | "Archeologisch"; period: string; description: string;
  lat: number; lng: number;
};

const ITEMS: Item[] = [
  { id: "527668", objectNumber: "203354", title: "Rietveld Schröderhuis", kind: "Woonhuis", address: "Prins Hendriklaan 50", postalCode: "3583 EP", place: "Utrecht", municipality: "Utrecht", province: "Utrecht", type: "Gebouwd", period: "1924", description: "Experimenteel woonhuis van Gerrit Rietveld en een sleutelwerk van De Stijl.", lat: 52.0856, lng: 5.1475 },
  { id: "36046", objectNumber: "100295", title: "Domtoren", kind: "Kerktoren", address: "Domplein 21", postalCode: "3512 JE", place: "Utrecht", municipality: "Utrecht", province: "Utrecht", type: "Gebouwd", period: "1254–1517", description: "Vrijstaande gotische toren en herkenningspunt van de historische binnenstad.", lat: 52.0907, lng: 5.1214 },
  { id: "38755", objectNumber: "100912", title: "Kasteel de Haar", kind: "Kasteel", address: "Kasteellaan 1", postalCode: "3455 RR", place: "Haarzuilens", municipality: "Utrecht", province: "Utrecht", type: "Gebouwd", period: "1892–1912", description: "Monumentaal kasteelcomplex met tuinen en park, gerestaureerd door Pierre Cuypers.", lat: 52.1214, lng: 4.9867 },
  { id: "531052", objectNumber: "204761", title: "Castellum Hoge Woerd", kind: "Romeins castellum", address: "Hoge Woerdplein 1", postalCode: "3454 PB", place: "De Meern", municipality: "Utrecht", province: "Utrecht", type: "Archeologisch", period: "Romeinse tijd", description: "Archeologisch terrein met resten van een Romeins grensfort.", lat: 52.0835, lng: 5.0018 },
  { id: "531034", objectNumber: "204743", title: "Fort bij Rijnauwen", kind: "Fort", address: "Vossegatsedijk 5", postalCode: "3981 HS", place: "Bunnik", municipality: "Bunnik", province: "Utrecht", type: "Gebouwd", period: "1868–1871", description: "Groot fort van de Nieuwe Hollandse Waterlinie bij Bunnik.", lat: 52.0845, lng: 5.1772 },
];

function readUrlState() {
  if (typeof window === "undefined") return { query: "", type: "Alle", municipality: "Alle", view: "list" as const, selectedId: "" };
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const municipality = params.get("gemeente");
  return {
    query: params.get("q") ?? "",
    type: type === "Gebouwd" || type === "Archeologisch" ? type : "Alle",
    municipality: municipality === "Utrecht" || municipality === "Bunnik" ? municipality : "Alle",
    view: params.get("view") === "map" ? "map" as const : "list" as const,
    selectedId: params.get("rm") ?? "",
  };
}

export default function Home() {
  const initial = useMemo(() => readUrlState(), []);
  const [query, setQuery] = useState(initial.query);
  const [active, setActive] = useState(initial.query);
  const [type, setType] = useState(initial.type);
  const [municipality, setMunicipality] = useState(initial.municipality);
  const [view, setView] = useState<"list" | "map">(initial.view);
  const [selected, setSelected] = useState<Item | null>(() => ITEMS.find((item) => item.id === initial.selectedId) ?? null);
  const [filters, setFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (active) params.set("q", active);
    if (type !== "Alle") params.set("type", type);
    if (municipality !== "Alle") params.set("gemeente", municipality);
    if (view === "map") params.set("view", "map");
    if (selected) params.set("rm", selected.id);
    window.history.replaceState({}, "", params.size ? `?${params}` : window.location.pathname);
  }, [active, municipality, selected, type, view]);

  const choose = useCallback((item: Item) => setSelected(item), []);
  const results = useMemo(() => {
    const needle = active.trim().toLocaleLowerCase("nl");
    return ITEMS.filter((item) => {
      const haystack = [item.title, item.kind, item.address, item.postalCode, item.place, item.id].join(" ").toLocaleLowerCase("nl");
      return (type === "Alle" || item.type === type) &&
        (municipality === "Alle" || item.municipality === municipality) &&
        (!needle || haystack.includes(needle));
    });
  }, [active, municipality, type]);

  function submitSearch(event: FormEvent) {
    event.preventDefault(); setActive(query.trim()); setSelected(null);
  }
  function reset() {
    setQuery(""); setActive(""); setType("Alle"); setMunicipality("Alle"); setSelected(null);
  }

  return <main>
    <div className="govbar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-rce.gif" alt="Rijksdienst voor het Cultureel Erfgoed, Ministerie van Onderwijs, Cultuur en Wetenschap" />
    </div>
    <header>
      <button className="brand brand-button" type="button" onClick={reset} aria-label="Terug naar alle monumenten"><b>D</b><span><strong>Doorzoeker</strong><small>Cultureel erfgoed ontdekken</small></span></button>
      <p><i />Prototype met voorbeelddata <a href="https://linkeddata.cultureelerfgoed.nl/" target="_blank" rel="noreferrer">Over de bronnen</a></p>
    </header>
    <section className="hero">
      <small>ZOEK DOOR MONUMENTEN, PLAATSEN EN VERHALEN</small><h1>Wat wil je ontdekken?</h1>
      <form onSubmit={submitSearch}><span aria-hidden="true">⌕</span><label className="sr" htmlFor="q">Zoeken</label><input id="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bijvoorbeeld Domtoren, Utrecht of 36046" />{query && <button type="button" className="clear" onClick={() => setQuery("")} aria-label="Zoekveld wissen">×</button>}<button type="submit">Zoeken</button></form>
      <nav aria-label="Voorbeeldzoekopdrachten">Probeer: {["Utrecht", "Kasteel", "Romeins"].map((term) => <button type="button" key={term} onClick={() => { setQuery(term); setActive(term); }}>{term}</button>)}</nav>
    </section>
    <section className="work">
      <aside className={filters ? "show" : ""} aria-label="Zoekfilters">
        <div className="aside-title"><div><small>VERFIJN</small><h2>Filters</h2></div><button type="button" onClick={() => setFilters(false)} aria-label="Filters sluiten">×</button></div>
        <fieldset><legend>Soort monument</legend>{["Alle", "Gebouwd", "Archeologisch"].map((option) => <label key={option}><input type="radio" name="type" checked={type === option} onChange={() => setType(option)} /><span>{option === "Alle" ? "Alle monumenten" : option}</span><em>{option === "Alle" ? ITEMS.length : ITEMS.filter((item) => item.type === option).length}</em></label>)}</fieldset>
        <fieldset><legend>Gemeente</legend>{["Alle", "Utrecht", "Bunnik"].map((option) => <label key={option}><input type="radio" name="municipality" checked={municipality === option} onChange={() => setMunicipality(option)} /><span>{option === "Alle" ? "Alle gemeenten" : option}</span><em>{option === "Alle" ? ITEMS.length : ITEMS.filter((item) => item.municipality === option).length}</em></label>)}</fieldset>
        <fieldset><legend>Provincie</legend><label><input type="checkbox" checked readOnly /><span>Utrecht</span><em>{ITEMS.length}</em></label></fieldset>
        <fieldset><legend>Status</legend><label><input type="checkbox" checked readOnly /><span>Rijksmonument</span><em>{ITEMS.length}</em></label></fieldset>
        <button className="reset" type="button" onClick={reset}>Wis alle filters</button>
      </aside>
      <div className="results">
        <div className="toolbar"><div><small>RIJKSMONUMENTEN</small><h2 aria-live="polite">{results.length} {results.length === 1 ? "resultaat" : "resultaten"}{active ? ` voor “${active}”` : ""}</h2></div><div><button className="mobile-filter" type="button" onClick={() => setFilters(true)}>☰ Filters</button><span className="switch" aria-label="Weergave"><button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="Lijstweergave" aria-pressed={view === "list"}>☷</button><button type="button" className={view === "map" ? "on" : ""} onClick={() => setView("map")} aria-label="Kaartweergave" aria-pressed={view === "map"}>⌖</button></span></div></div>
        {results.length === 0 ? <div className="empty"><b>0</b><h3>Geen monumenten gevonden</h3><p>Probeer een plaats, adres, postcode, functie of monumentnummer.</p><button type="button" onClick={reset}>Toon alle monumenten</button></div> : view === "list" ? <div className="cards">{results.map((item) => <article key={item.id}><div className={item.type === "Archeologisch" ? "tile sand" : "tile"}><b>{item.type === "Archeologisch" ? "A" : "M"}</b><small>{item.type}</small></div><div className="copy"><small>{item.kind}<code>RM {item.id}</code></small><h3>{item.title}</h3><p className="address">● {item.address}, {item.postalCode} {item.place}</p><p>{item.description}</p><span>{item.kind}</span><span>{item.period}</span></div><button className="open" type="button" onClick={() => setSelected(item)} aria-label={`Details van ${item.title}`}>→</button></article>)}</div> : <HeritageMap items={results} onSelect={(mapItem) => { const item = ITEMS.find((candidate) => candidate.id === mapItem.id); if (item) choose(item); }} />}
      </div>
    </section>
    {selected && <div className="backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="x" type="button" onClick={() => setSelected(null)} aria-label="Details sluiten">×</button><div className={selected.type === "Archeologisch" ? "detail-head sand" : "detail-head"}><b>{selected.type === "Archeologisch" ? "A" : "M"}</b><small>{selected.type} erfgoed</small></div><div className="detail-copy"><small>RIJKSMONUMENT {selected.id}</small><h2 id="detail-title">{selected.title}</h2><p>{selected.address}<br />{selected.postalCode} {selected.place}, {selected.province}</p><hr /><p>{selected.description}</p><dl><div><dt>Status</dt><dd>Rijksmonument</dd></div><div><dt>Objectnummer</dt><dd>{selected.objectNumber}</dd></div><div><dt>Oorspronkelijke functie</dt><dd>{selected.kind}</dd></div><div><dt>Datering</dt><dd>{selected.period}</dd></div><div><dt>Monumentaard</dt><dd>{selected.type}</dd></div></dl><a href={`https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/${selected.id}`} target="_blank" rel="noreferrer">Bekijk de canonieke bron bij RCE <b>→</b></a><blockquote>Voorbeeldrecord. De gegevens worden in een volgende stap gekoppeld aan RCE Linked Data.</blockquote></div></aside></div>}
  </main>;
}
