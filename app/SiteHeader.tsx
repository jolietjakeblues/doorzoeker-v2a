export function SiteHeader({ onReset, huidigePagina = "start" }: { onReset: () => void; huidigePagina?: "start" | "vraag" }) {
  return (
    <header>
      <button className="brand brand-button" type="button" onClick={onReset} aria-label="Terug naar de startpagina">
        <b>D</b>
        <span><strong>Doorzoeker</strong><small>Erfgoed digitaal</small></span>
      </button>
      <div className="header-links">
        <p><i aria-hidden="true" />Live gekoppeld aan RCE Linked Data <a href="https://linkeddata.cultureelerfgoed.nl/rce/cho" target="_blank" rel="noreferrer">Bronverantwoording</a></p>
        {huidigePagina === "vraag" ? (
          // Op /vraag zelf is een link náár /vraag een cirkelroute (gemeld
          // door de eigenaar, 28-08-2026) - op deze pagina hoort dezelfde
          // koppositie de weg terug te zijn, niet nogmaals dezelfde plek.
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- volle paginanavigatie tussen twee losse routes, geen SPA-interne overgang (zelfde reden als app/vraag/page.tsx's onReset)
          <a className="achtergrond-link" href="/">← Terug naar Doorzoeker</a>
        ) : (
          <a className="achtergrond-link" href="/vraag">Stel een vraag</a>
        )}
        <a className="achtergrond-link" href="/achtergrond.html">Achtergrond</a>
      </div>
    </header>
  );
}
