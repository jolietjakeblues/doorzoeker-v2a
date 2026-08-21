export function SiteHeader({ onReset }: { onReset: () => void }) {
  return (
    <header>
      <button className="brand brand-button" type="button" onClick={onReset} aria-label="Terug naar de startpagina">
        <b>D</b>
        <span><strong>Doorzoeker</strong><small>Erfgoed digitaal</small></span>
      </button>
      <div className="header-links">
        <p><i aria-hidden="true" />Live gekoppeld aan RCE Linked Data <a href="https://linkeddata.cultureelerfgoed.nl/rce/cho" target="_blank" rel="noreferrer">Bronverantwoording</a></p>
        <a className="achtergrond-link" href="/achtergrond.html">Achtergrond</a>
      </div>
    </header>
  );
}
