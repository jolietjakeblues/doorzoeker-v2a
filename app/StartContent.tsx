import { typeBadge, type Item } from "@/lib/heritage-view-model";
import { CardDescription } from "./HeritageResultCard";

type StartContentProps = {
  item: Item | null;
  onOpen: (item: Item) => void;
  verrasMeItem: Item | null;
  verrasMeLoading: boolean;
  onVerrasMe: () => void;
  voorbeeldLoading: boolean;
  onVoorbeeld: () => void;
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

export function StartContent({ item, onOpen, verrasMeItem, verrasMeLoading, onVerrasMe, voorbeeldLoading, onVoorbeeld }: StartContentProps) {
  return (
    <>
      {item && (
        <section className="op-deze-dag">
          <small>OP DEZE DAG INGESCHREVEN</small>
          <HeritageTile item={item} onOpen={() => onOpen(item)} />
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
        <button
          type="button"
          className="verras-me-button"
          onClick={onVoorbeeld}
          disabled={voorbeeldLoading}
        >
          {voorbeeldLoading ? "Voorbeeld laden…" : "Zie de kracht van Doorzoeker"}
        </button>
        {verrasMeItem && <HeritageTile item={verrasMeItem} onOpen={() => onOpen(verrasMeItem)} />}
      </section>
    </>
  );
}
