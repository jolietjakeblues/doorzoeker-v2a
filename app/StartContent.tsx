import { typeBadge, type Item } from "@/lib/heritage-view-model";
import { CardDescription } from "./HeritageResultCard";

type StartContentProps = {
  item: Item | null;
  onSearch: (query: string) => void;
  verrasMeItem: Item | null;
  verrasMeLoading: boolean;
  onVerrasMe: () => void;
};

function HeritageTile({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <div className="cards">
      <article>
        <div
          className={`tile ${typeBadge(item).modifier}${item.image ? " has-image" : ""}`.trim()}
          style={item.image ? { backgroundImage: `url(${item.image.url})` } : undefined}
        >
          {item.image ? (
            <span className="tile-badge">{typeBadge(item).letter}</span>
          ) : (
            <>
              <b>{typeBadge(item).letter}</b>
              <small>RCE register</small>
            </>
          )}
        </div>
        <div className="copy">
          <small>
            {item.kind}
            <code>RM {item.monumentNumber ?? item.id}</code>
          </small>
          <h3>{item.title}</h3>
          <p className="address">
            ● {item.address}
            {item.postalCode || item.place ? `, ${item.postalCode} ${item.place}` : ""}
          </p>
          <CardDescription text={item.description} />
          <span>{item.registrationDate ? `Ingeschreven ${item.registrationDate}` : item.period}</span>
        </div>
        <button
          className="open"
          type="button"
          onClick={onOpen}
          aria-label={`Details van ${item.title}`}
        >
          →
        </button>
      </article>
    </div>
  );
}

export function StartContent({ item, onSearch, verrasMeItem, verrasMeLoading, onVerrasMe }: StartContentProps) {
  const open = (target: Item) => onSearch(target.monumentNumber ?? target.id);

  return (
    <>
      {item && (
        <section className="op-deze-dag">
          <small>OP DEZE DAG INGESCHREVEN</small>
          <HeritageTile item={item} onOpen={() => open(item)} />
        </section>
      )}
      <section className="verras-me">
        <small>ONTDEKKEN</small>
        <button
          type="button"
          className="verras-me-button"
          onClick={onVerrasMe}
          disabled={verrasMeLoading}
        >
          {verrasMeLoading
            ? "Op zoek naar een verrassing…"
            : verrasMeItem
              ? "Verras me nog een keer"
              : "Verras me"}
        </button>
        {verrasMeItem && <HeritageTile item={verrasMeItem} onOpen={() => open(verrasMeItem)} />}
      </section>
      <div className="start-panel">
        <small>ZO WERKT HET</small>
        <h2>Wat deze zoekmachine doet</h2>
        <p>
          Doorzoeker doorzoekt de actuele CHO-dataset van de Rijksdienst voor het
          Cultureel Erfgoed en laat bij elk resultaat het gegevensveld zien waarin
          de zoekterm is gevonden.
        </p>
        <div>
          <article>
            <b>01</b>
            <h3>Zoek breed</h3>
            <p>Gebruik een nummer, plaats, functie, monumentaard of omschrijving.</p>
          </article>
          <article>
            <b>02</b>
            <h3>Matchbron per resultaat</h3>
            <p>Elk resultaat vermeldt de matchbron en de geregistreerde waarde.</p>
          </article>
          <article>
            <b>03</b>
            <h3>Controleer de bron</h3>
            <p>Bekijk functie, adres, geometrie, percelen en de canonieke RCE-link.</p>
          </article>
        </div>
      </div>
    </>
  );
}
