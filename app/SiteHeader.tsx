export function SiteHeader({ onReset }: { onReset: () => void }) {
  return <>
    <div className="govbar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-rce.gif" alt="Rijksdienst voor het Cultureel Erfgoed, Ministerie van Onderwijs, Cultuur en Wetenschap" />
    </div>
    <header>
      <button className="brand brand-button" type="button" onClick={onReset} aria-label="Terug naar de startpagina">
        <b>D</b>
        <span><strong>Doorzoeker</strong><small>Erfgoed digitaal</small></span>
      </button>
      <p><i />Live gekoppeld aan RCE Linked Data <a href="https://linkeddata.cultureelerfgoed.nl/rce/cho" target="_blank" rel="noreferrer">Bronverantwoording</a></p>
    </header>
  </>;
}
