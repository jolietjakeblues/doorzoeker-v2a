import type { FormEvent, KeyboardEventHandler } from "react";
import type { TermSuggestion } from "@/lib/terms-client";

type RemoteState = "idle" | "loading" | "error" | "success";
type BrowseKind = "werelderfgoed" | "gezicht" | "complex";

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
        <form onSubmit={submitSearch}>
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
                  <small>{suggestion.sourceName} · zoekt op tekst</small>
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
      <nav aria-label="Bekijk een volledige collectie">
        Bekijk alles:{" "}
        <button type="button" onClick={() => onBrowse("werelderfgoed")}>
          Werelderfgoed
        </button>
        <button type="button" onClick={() => onBrowse("gezicht")}>
          Gezichten
        </button>
        <button type="button" onClick={() => onBrowse("complex")}>
          Gebouwde complexen
        </button>
      </nav>
      <p className={`source-status ${remoteState}`} aria-live="polite">
        {remoteState === "loading"
          ? "De actuele RCE-data wordt doorzocht…"
          : remoteState === "error"
            ? "De RCE Linked Data-service is momenteel niet bereikbaar. Probeer het later opnieuw."
            : remoteState === "success"
              ? "Resultaten rechtstreeks uit de actuele RCE Linked Data"
              : "Actuele brondata · vaste URI's · herleidbare bronnen"}
      </p>
    </section>
  );
}
