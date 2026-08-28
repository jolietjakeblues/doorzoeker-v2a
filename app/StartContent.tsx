import { typeBadge, type Item } from "@/lib/heritage-view-model";
import type { ArcheologischeContext, WerelderfgoedLidmaatschap } from "@/lib/rce";
import { CardDescription } from "./HeritageResultCard";
import { HeritageMap } from "./HeritageMap";

type VoorbeeldResult = { item: Item; gebieden: ArcheologischeContext[]; werelderfgoed: WerelderfgoedLidmaatschap[] };

type StartContentProps = {
  item: Item | null;
  onOpen: (item: Item) => void;
  verrasMeItem: Item | null;
  verrasMeLoading: boolean;
  onVerrasMe: () => void;
  voorbeeldResult: VoorbeeldResult | null;
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

// Compacte, zelfstandige kaart voor het vaste showcase-monument (zie
// useVoorbeeldMonument.ts) - bewust GEEN popup/detailvenster: het idee is
// dat alles in één oogopslag (en desnoods een screenshot) te zien is, dus
// staat dit gewoon inline op de startpagina, direct onder de knop. Toont
// bewust een kleinere selectie dan het volledige detailvenster (geen
// vergelijkbare rijksmonumenten, alle gekoppelde begrippen, brongegevens) -
// wie meer wil kan doorklikken naar het volledige detail.
function VoorbeeldShowcase({ result, onOpen }: { result: VoorbeeldResult; onOpen: () => void }) {
  const { item, gebieden, werelderfgoed } = result;
  // Bij meerdere overlappende onderzoeksgebieden (zoals bij 14948: één rijke
  // vondstbeschrijving náást een kale administratieve BoneInfo-koppeling) wint
  // de langste omschrijving - een generieke, niet aan deze ene tekst
  // gebonden heuristiek voor "meest inhoudelijke gebied", i.p.v. gewoon het
  // eerste gebied in de array te pakken.
  const archeologie = gebieden.reduce<ArcheologischeContext | undefined>(
    (best, gebied) => ((gebied.omschrijving?.length ?? 0) > (best?.omschrijving?.length ?? 0) ? gebied : best),
    undefined,
  );
  return (
    <article className="voorbeeld-showcase">
      <div className="voorbeeld-showcase-header">
        {item.image ? (
          <img
            className="voorbeeld-showcase-photo"
            src={item.image.url}
            alt={item.image.title ?? item.title}
          />
        ) : null}
        <div className="voorbeeld-showcase-copy">
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
          {werelderfgoed.length ? (
            <p className="voorbeeld-showcase-fact">
              <strong>Onderdeel van Werelderfgoed:</strong>{" "}
              {werelderfgoed.map((membership) => membership.naam).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="voorbeeld-showcase-body">
        {item.lat && item.lng ? (
          <div className="voorbeeld-showcase-map">
            <HeritageMap items={[item]} onSelect={() => {}} compact />
          </div>
        ) : null}
        {archeologie ? (
          <div className="voorbeeld-showcase-archeologie">
            <strong>Archeologische context</strong>
            <p>{archeologie.omschrijving}</p>
          </div>
        ) : null}
      </div>
      <button type="button" className="voorbeeld-showcase-open" onClick={onOpen}>
        Bekijk het volledige detail →
      </button>
    </article>
  );
}

export function StartContent({
  item,
  onOpen,
  verrasMeItem,
  verrasMeLoading,
  onVerrasMe,
  voorbeeldResult,
  voorbeeldLoading,
  onVoorbeeld,
}: StartContentProps) {
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
        <div className="verras-me-buttons">
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
        </div>
        {verrasMeItem && <HeritageTile item={verrasMeItem} onOpen={() => onOpen(verrasMeItem)} />}
        {voorbeeldResult && (
          <VoorbeeldShowcase result={voorbeeldResult} onOpen={() => onOpen(voorbeeldResult.item)} />
        )}
      </section>
    </>
  );
}
