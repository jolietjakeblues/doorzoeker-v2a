export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        Bezoekers-IP gaat naar PDOK (kaarttegels) en de RCE-beeldbank
        (afbeeldingen) zodra je de kaart of een foto bekijkt. Doorzoeker
        zelf verzamelt geen persoonsgegevens en gebruikt geen
        tracking-cookies.
      </p>
      <p>
        Doorzoeker is in bèta.{" "}
        <a
          href="https://github.com/jolietjakeblues/doorzoeker-v2a/issues/new?template=bug_report.md"
          target="_blank"
          rel="noreferrer"
        >
          Bug gevonden of suggestie? Meld het op GitHub
        </a>
        .
      </p>
    </footer>
  );
}
