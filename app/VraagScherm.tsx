"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SparqlResultsDocument } from "@/lib/vraag/postprocess";

type VraagMode = "lijst" | "telling";
type Step = "idle" | "genereren" | "uitvoeren" | "antwoorden" | "klaar" | "fout";

const VOORBEELDVRAGEN: { label: string; mode: VraagMode }[] = [
  { label: "Welke rijksmonumenten staan er in Zeist?", mode: "lijst" },
  { label: "Hoeveel kerken zijn er in Utrecht?", mode: "telling" },
  { label: "Welke kastelen staan er in Gelderland?", mode: "lijst" },
  { label: "Welke rijksmonumenten liggen binnen beschermd gezicht Dordrecht?", mode: "lijst" },
  { label: "Wie is de architect van het Rijksmuseum?", mode: "lijst" },
  { label: "Welke archeologische terreinen zijn er in Limburg?", mode: "lijst" },
];

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "genereren", label: "01 Vraag analyseren" },
  { key: "uitvoeren", label: "02 Erfgoeddata ophalen" },
  { key: "antwoorden", label: "03 Antwoord maken" },
];

async function postJson<T>(url: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const document = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((document as { error?: string }).error ?? "Er ging iets mis.");
  return document as T;
}

function resultRows(results: SparqlResultsDocument) {
  const vars = results.head?.vars ?? [];
  const bindings = results.results?.bindings ?? [];
  return { vars, bindings };
}

export function VraagScherm() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<VraagMode>("lijst");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SparqlResultsDocument | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const busy = step === "genereren" || step === "uitvoeren" || step === "antwoorden";

  function reset() {
    setError(null);
    setResults(null);
    setAnswer(null);
  }

  async function runUitvoerenEnAntwoord(vraag: string, sparql: string, signal: AbortSignal) {
    setStep("uitvoeren");
    const uitvoerData = await postJson<{ results: SparqlResultsDocument }>("/api/vraag/uitvoeren", { query: sparql }, signal);
    setResults(uitvoerData.results);

    setStep("antwoorden");
    const antwoordData = await postJson<{ answer: string }>("/api/vraag/antwoord", { question: vraag, results: uitvoerData.results }, signal);
    setAnswer(antwoordData.answer);
    setStep("klaar");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (question.trim().length < 3 || busy) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    reset();
    setStep("genereren");
    try {
      const generateData = await postJson<{ query: string }>("/api/vraag/genereer-sparql", { question: question.trim(), mode }, controller.signal);
      setGeneratedQuery(generateData.query);
      setQuery(generateData.query);
      await runUitvoerenEnAntwoord(question.trim(), generateData.query, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
      setStep("fout");
    }
  }

  async function handleHerhaalMetBewerkteQuery() {
    if (query.trim().length === 0 || busy) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    reset();
    try {
      await runUitvoerenEnAntwoord(question.trim(), query, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
      setStep("fout");
    }
  }

  const { vars, bindings } = results ? resultRows(results) : { vars: [], bindings: [] };

  return (
    <section className="vraag-scherm">
      <form onSubmit={handleSubmit} className="vraag-form">
        <label htmlFor="vraag-input">Stel je vraag in gewone taal</label>
        <textarea
          id="vraag-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Bijvoorbeeld: welke rijksmonumenten in Bunnik zijn een kerk?"
          rows={2}
        />
        <div className="vraag-mode">
          <label>
            <input type="radio" name="mode" checked={mode === "lijst"} onChange={() => setMode("lijst")} />
            Lijst van monumenten
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === "telling"} onChange={() => setMode("telling")} />
            Alleen een aantal
          </label>
        </div>
        <button type="submit" disabled={busy || question.trim().length < 3}>
          {busy ? "Bezig…" : "Stel de vraag"}
        </button>
      </form>

      <div className="vraag-voorbeelden">
        <small>OF PROBEER</small>
        <div className="vraag-voorbeelden-buttons">
          {VOORBEELDVRAGEN.map((voorbeeld) => (
            <button
              key={voorbeeld.label}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuestion(voorbeeld.label);
                setMode(voorbeeld.mode);
              }}
            >
              {voorbeeld.label}
            </button>
          ))}
        </div>
      </div>

      {step !== "idle" && (
        <ol className="vraag-stappen">
          {STEP_LABELS.map(({ key, label }) => {
            const order: Step[] = ["genereren", "uitvoeren", "antwoorden"];
            const currentIndex = order.indexOf(step);
            const thisIndex = order.indexOf(key);
            const state = step === "klaar" || (currentIndex >= 0 && thisIndex < currentIndex) ? "gedaan" : thisIndex === currentIndex ? "bezig" : "wacht";
            return (
              <li key={key} className={`vraag-stap vraag-stap--${state}`}>
                {label}
              </li>
            );
          })}
        </ol>
      )}

      {error && <p className="vraag-fout">{error}</p>}

      {generatedQuery && (
        <div className="vraag-sparql">
          <div className="vraag-sparql-head">
            <strong>Gegenereerde SPARQL-query</strong>
            <div className="vraag-sparql-acties">
              <button type="button" onClick={() => navigator.clipboard?.writeText(query)}>
                Kopiëren
              </button>
              <button type="button" onClick={() => setQuery(generatedQuery)} disabled={query === generatedQuery}>
                Herstel gegenereerde query
              </button>
              <button type="button" onClick={handleHerhaalMetBewerkteQuery} disabled={busy}>
                Voer bewerkte query uit
              </button>
            </div>
          </div>
          <textarea className="vraag-sparql-editor" value={query} onChange={(event) => setQuery(event.target.value)} rows={10} spellCheck={false} />
        </div>
      )}

      {answer && (
        <div className="vraag-antwoord">
          <strong>Antwoord</strong>
          <p>{answer}</p>
        </div>
      )}

      {results && bindings.length > 0 && (
        <div className="vraag-resultaten">
          <strong>{bindings.length} {bindings.length === 1 ? "resultaat" : "resultaten"}</strong>
          <div className="vraag-resultaten-tabel-wrap">
            <table className="vraag-resultaten-tabel">
              <thead>
                <tr>
                  {vars.map((variable) => (
                    <th key={variable}>{variable}</th>
                  ))}
                  {vars.includes("nummer") && <th />}
                </tr>
              </thead>
              <tbody>
                {bindings.map((row, index) => {
                  // Doorzoekers eigen zoekpagina herkent ?q=<nummer>&object=<nummer>
                  // al (zie hooks/useSearchState.ts's applyPendingSelection) - een
                  // numerieke zoekopdracht matcht exact op rijksmonumentnummer, dus
                  // dit heropent daar meteen het volledige detail, zonder nieuwe
                  // route of backend-wijziging.
                  const nummer = row.nummer?.value;
                  return (
                    <tr key={index}>
                      {vars.map((variable) => (
                        <td key={variable}>{row[variable]?.value ?? ""}</td>
                      ))}
                      {vars.includes("nummer") && (
                        <td>
                          {nummer && (
                            <a href={`/?q=${encodeURIComponent(nummer)}&object=${encodeURIComponent(nummer)}`} target="_blank" rel="noreferrer">
                              Bekijk in Doorzoeker →
                            </a>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="vraag-bron">
        Deze assistent is gebaseerd op{" "}
        <a href="https://github.com/cultureelerfgoed/ldv-talk-to-your-data-test" target="_blank" rel="noreferrer">
          ldv-talk-to-your-data-test
        </a>
        , een project van de Rijksdienst voor het Cultureel Erfgoed.
      </p>
    </section>
  );
}
