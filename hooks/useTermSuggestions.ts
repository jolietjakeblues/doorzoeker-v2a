import { KeyboardEvent, useEffect, useState } from "react";
import { fetchTermSuggestions, type TermSuggestion } from "@/lib/terms-client";

// Zelfstandig, herbruikbaar stuk state: de zoekbalk-suggesties reageren
// alleen op de ingetypte tekst (`query`) en de laatst uitgevoerde
// zoekopdracht (`active`, om geen suggesties te tonen voor een term die al
// als volledige zoekopdracht is uitgevoerd), en communiceren terug via
// `onCommit` zodra een suggestie gekozen wordt - de rest van de app hoeft
// niets van de interne combobox-mechaniek te weten.
export function useTermSuggestions(
  query: string,
  active: string,
  onCommit: (suggestion: TermSuggestion) => void,
) {
  const [suggestions, setSuggestions] = useState<TermSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || term === active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const nextSuggestions = await fetchTermSuggestions(
        term,
        controller.signal,
      ).catch(() => []);
      if (!controller.signal.aborted) {
        setSuggestions(nextSuggestions);
        setSuggestionsOpen(nextSuggestions.length > 0);
        setActiveSuggestion(-1);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, query]);

  function commitSuggestion(suggestion: TermSuggestion) {
    onCommit(suggestion);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  // Combobox-toetsenbordpatroon (ARIA Authoring Practices Guide): de suggesties
  // krijgen nooit echte DOM-focus (dat blijft op het invoerveld), alleen
  // aria-activedescendant wijst naar de gemarkeerde optie. Enter op een
  // gemarkeerde suggestie kiest die in plaats van de gewone zoekopdracht te
  // versturen; zonder markering blijft Enter gewoon zoeken.
  function handleQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((index) =>
        Math.min(index + 1, suggestions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      commitSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  }

  return {
    suggestions,
    suggestionsOpen,
    setSuggestionsOpen,
    activeSuggestion,
    setActiveSuggestion,
    commitSuggestion,
    handleQueryKeyDown,
  };
}
