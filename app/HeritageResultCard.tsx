import { useState } from "react";
import {
  primaryIdentifier,
  statusLabel,
  truncateAtWordBoundary,
  typeBadge,
  type Item,
} from "@/lib/heritage-view-model";

const DESCRIPTION_EXCERPT_LENGTH = 300;

export function CardDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_EXCERPT_LENGTH;
  if (!isLong || expanded)
    return (
      <p>
        {text}
        {isLong && (
          <>
            {" "}
            <button
              type="button"
              className="lees-meer"
              onClick={() => setExpanded(false)}
            >
              Lees minder
            </button>
          </>
        )}
      </p>
    );
  return (
    <p>
      {truncateAtWordBoundary(text, DESCRIPTION_EXCERPT_LENGTH)}…{" "}
      <button
        type="button"
        className="lees-meer"
        onClick={() => setExpanded(true)}
      >
        Lees meer
      </button>
    </p>
  );
}

export function HeritageResultCard({
  item,
  onOpen,
  onConceptSearch,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onConceptSearch: (concept: { uri: string; label: string }) => void;
}) {
  const badge = typeBadge(item);
  const identifier = primaryIdentifier(item);
  const hasAddress = item.address && item.address !== "Adres niet opgenomen";
  const hasFunction = item.kind && item.kind !== "Functie niet opgenomen";
  const location = [
    hasAddress ? item.address : "",
    [item.postalCode, item.place].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const cardLabel = statusLabel(item.objectType);
  const identifierRepeatsTitle =
    item.title.trim().toLocaleLowerCase("nl") ===
    `${identifier.label} ${identifier.value}`.toLocaleLowerCase("nl");

  return (
    <article
      className={`heritage-card heritage-card--${badge.modifier || "monument"}`}
    >
      <div
        className={`tile ${badge.modifier}${item.image ? " has-image" : ""}`.trim()}
        style={
          item.image ? { backgroundImage: `url(${item.image.url})` } : undefined
        }
      >
        {item.image ? (
          <span className="tile-badge">{badge.letter}</span>
        ) : (
          <b>{badge.letter}</b>
        )}
      </div>
      <div className="copy">
        <small className="card-heading">
          <span>{cardLabel}</span>
          {!identifierRepeatsTitle ? (
            <code>
              {identifier.label} {identifier.value}
            </code>
          ) : null}
        </small>
        <h3>{item.title}</h3>
        {location ? <p className="address">{location}</p> : null}
        <CardDescription text={item.description} />
        <div className="card-facts" aria-label="Kenmerken">
          {hasFunction && item.objectType === "Rijksmonument" ? (
            <span>{item.kind}</span>
          ) : null}
          {item.objectType === "Rijksmonument" ? (
            item.monumentAardConcept ? (
              <button
                type="button"
                className="concept-link"
                onClick={() => onConceptSearch(item.monumentAardConcept!)}
                title="Zoek alle rijksmonumenten met deze monumentaard"
              >
                {item.monumentAard ?? "Rijksmonument"}
              </button>
            ) : (
              (item.monumentAard ?? "Rijksmonument")
            )
          ) : null}
          {item.objectType === "Complex" && item.complexMemberCount ? (
            <span>
              {item.complexMemberCount}{" "}
              {item.complexMemberCount === 1 ? "onderdeel" : "onderdelen"}
            </span>
          ) : null}
          {item.legalStatus && item.objectType !== "Rijksmonument" ? (
            <span>{item.legalStatus}</span>
          ) : null}
          {item.period !== "Datering niet opgenomen" ? (
            <span>{item.period}</span>
          ) : null}
        </div>
      </div>
      <button
        className="open"
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`Details van ${item.title}`}
      >
        →
      </button>
    </article>
  );
}
