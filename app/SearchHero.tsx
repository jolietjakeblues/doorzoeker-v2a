import type { FormEvent, KeyboardEventHandler } from "react";
import type { TermSuggestion } from "@/lib/terms-client";

type RemoteState = "idle" | "loading" | "error" | "success";
type BrowseKind = "rijksmonument" | "archeologischterrein" | "onderzoeksgebied" | "vondstlocatie" | "archeologischcomplex" | "vondsten" | "grondsporen" | "werelderfgoed" | "gezicht" | "complex";

const DIRECT_SEARCHES = [
  "36046",
  "Woonhuis",
  "Archeologisch",
  "Collse",
  "moutmolen",
  "Utrecht",
  "Kinderdijk",
  "517912",
  "517443",
] as const;

// Vaste, live tegen de RCE-endpoint geverifieerde functie-concept-URI's
// (14 augustus 2026, via het echte buildFunctieConceptQuery-querypatroon
// in lib/rce/concepts.ts) - laat ontdekken zonder zoekterm toe via een
// paar populaire thema's, met hetzelfde exacte-conceptzoekmechanisme als
// elders in de app (executeConceptSearch, veld "functie"). Aantal
// gekoppelde Rijksmonumenten ter referentie, niet getoond in de UI.
const DISCOVERY_THEMES = [
  { label: "Kerken", uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/6fa5f251-cd84-4f3a-acb7-7c219df2540f" }, // 2310
  { label: "Molens", uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/fea024ba-83a0-4418-afbe-3b7b4588797e" }, // 1126
  { label: "Kastelen", uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/cd714157-2a9f-47ad-bf20-928e17aaf32b" }, // 96
  { label: "Boerderijen", uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/e95cb75d-b99c-4ae9-841c-827b28e75458" }, // 5484
  { label: "Landhuizen", uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/1f7aa947-bb93-4bde-8204-9d82b5f9b617" }, // 452
] as const;

type SearchHeroProps = {
  query: string;
  setQuery: (value: string) => void;
  suggestions: TermSuggestion[];
  suggestionsOpen: boolean;
  setSuggestionsOpen: (open: boolean) => void;
  activeSuggestion: number;
  setActiveSuggestion: (index: number) => void;
  commitSuggestion: (suggestion: TermSuggestion) => void;
  handleQueryKeyDown: KeyboardEventHandler<HTMLInputElement>;
  remoteState: RemoteState;
  onSearch: (term: string) => void;
  onBrowse: (kind: BrowseKind) => void;
  onDiscoverTheme: (uri: string, label: string) => void;
  onRetry: () => void;
};

export function SearchHero({
  query,
  setQuery,
  suggestions,
  suggestionsOpen,
  setSuggestionsOpen,
  activeSuggestion,
  setActiveSuggestion,
  commitSuggestion,
  handleQueryKeyDown,
  remoteState,
  onSearch,
  onBrowse,
  onDiscoverTheme,
  onRetry,
}: SearchHeroProps) {
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSuggestionsOpen(false);
    onSearch(query.trim());
  }

  return (
    <section className="hero">
      <small>ACTUELE ERFGOEDDATA VAN DE RCE</small>
      <h1>Doorzoek erfgoeddata van de RCE.</h1>
      <p className="hero-intro">
        Zoek cultuurhistorische objecten, gebieden en archeologische informatie
        op naam, nummer, plaats, functie of omschrijving.
      </p>
      <div className="search-combobox">
        <form
          onSubmit={submitSearch}
          className={remoteState === "loading" ? "is-searching" : undefined}
          aria-busy={remoteState === "loading"}
        >
          <span aria-hidden="true">⌕</span>
          <label className="sr" htmlFor="q">
            Zoeken
          </label>
          <input
            id="q"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            aria-controls="term-suggestions"
            aria-activedescendant={
              activeSuggestion >= 0
                ? `term-suggestion-${activeSuggestion}`
                : undefined
            }
            value={query}
            onFocus={() => setSuggestionsOpen(suggestions.length > 0)}
            onBlur={() => setSuggestionsOpen(false)}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="Bijvoorbeeld 36046, woonhuis, lijstgevel of Utrecht"
          />
          {query && (
            <button
              type="button"
              className="clear"
              onClick={() => {
                setQuery("");
                setSuggestionsOpen(false);
              }}
              aria-label="Zoekveld wissen"
            >
              ×
            </button>
          )}
          <button type="submit">Doorzoek RCE</button>
        </form>
        {suggestionsOpen && (
          <ul
            id="term-suggestions"
            className="term-suggestions"
            role="listbox"
            aria-label="Termsuggesties"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.uri}
                id={`term-suggestion-${index}`}
                role="option"
                aria-selected={index === activeSuggestion}
                className={index === activeSuggestion ? "active" : ""}
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  onClick={() => commitSuggestion(suggestion)}
                >
                  {suggestion.label}
                  <small>
                    {suggestion.conceptField && suggestion.usageCount
                      ? `${suggestion.usageCount.toLocaleString("nl-NL")} ${suggestion.usageCount === 1 ? "object" : "objecten"} · exact gekoppeld als ${suggestion.conceptField === "archeologischcomplextype" ? "complextype" : suggestion.conceptField}`
                      : `${suggestion.sourceName} · zoekt op tekst`}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <nav aria-label="Direct zoeken">
        Direct zoeken:{" "}
        {DIRECT_SEARCHES.map((term) => (
          <button type="button" key={term} onClick={() => onSearch(term)}>
            {term}
          </button>
        ))}
      </nav>
      <nav aria-label="Ontdek een thema">
        Ontdek een thema:{" "}
        {DISCOVERY_THEMES.map((theme) => (
          <button
            type="button"
            key={theme.uri}
            onClick={() => onDiscoverTheme(theme.uri, theme.label)}
          >
            {theme.label}
          </button>
        ))}
      </nav>
      <nav aria-label="Bekijk een volledige collectie">
        Bekijk alles:{" "}
        <button type="button" onClick={() => onBrowse("rijksmonument")}>
          Rijksmonumenten
        </button>
        <button type="button" onClick={() => onBrowse("werelderfgoed")}>
          Werelderfgoed
        </button>
        <button type="button" onClick={() => onBrowse("gezicht")}>
          Gezichten
        </button>
        <button type="button" onClick={() => onBrowse("complex")}>
          Gebouwde complexen
        </button>
        <button type="button" onClick={() => onBrowse("archeologischterrein")}>
          Archeologische terreinen
        </button>
        <button type="button" onClick={() => onBrowse("onderzoeksgebied")}>
          Onderzoeksgebieden
        </button>
        <button type="button" onClick={() => onBrowse("vondstlocatie")}>
          Vondstlocaties
        </button>
        <button type="button" onClick={() => onBrowse("archeologischcomplex")}>
          Archeologische complexen
        </button>
        <button type="button" onClick={() => onBrowse("vondsten")}>
          Vondsten
        </button>
        <button type="button" onClick={() => onBrowse("grondsporen")}>
          Grondsporen
        </button>
      </nav>
      <p className={`source-status ${remoteState}`} aria-live="polite">
        {remoteState === "loading"
          ? "De actuele RCE-data wordt doorzocht…"
          : remoteState === "error"
            ? "De RCE Linked Data-service is momenteel niet bereikbaar."
            : remoteState === "success"
              ? "Resultaten rechtstreeks uit de actuele RCE Linked Data"
              : "Actuele brondata · vaste URI's · herleidbare bronnen"}
        {remoteState === "error" ? (
          <button type="button" className="retry" onClick={onRetry}>
            Probeer opnieuw
          </button>
        ) : null}
      </p>
    </section>
  );
}
