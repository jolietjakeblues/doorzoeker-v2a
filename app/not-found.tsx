"use client";

import { useEffect } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { BetaBadge } from "./BetaBadge";

// Front-end kwaliteitscontrole (30-09-2026): een niet-bestaande URL toonde
// Next.js' generieke, onopgemaakte fallback-404 (zwarte pagina, geen
// koptekst, geen weg terug) i.p.v. een pagina die bij Doorzoeker hoort.
export default function NotFound() {
  // not-found.tsx is een client component en kan geen eigen `metadata`
  // exporteren (zoals app/vraag/layout.tsx dat wel kan) - een 404-route
  // wordt sowieso niet geïndexeerd, dus een client-side titelwissel is hier
  // voldoende, puur voor een duidelijke tabtitel tijdens het bezoek zelf.
  useEffect(() => {
    document.title = "Pagina niet gevonden - Doorzoeker";
  }, []);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- volle paginanavigatie, geen SPA-interne overgang (zelfde reden als app/vraag/page.tsx) */}
      <SiteHeader onReset={() => { window.location.href = "/"; }} />
      <BetaBadge />
      <main className="vraag-main">
        <section className="hero vraag-hero">
          <small>PAGINA NIET GEVONDEN</small>
          <h1>Deze pagina bestaat niet (meer)</h1>
          <p className="hero-intro">
            De opgevraagde pagina kon niet gevonden worden. Mogelijk is de
            link verouderd of is er een typefout in de URL geslopen.
          </p>
          <p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- volle paginanavigatie, geen SPA-interne overgang (zelfde reden als app/vraag/page.tsx) */}
            <a href="/">Ga terug naar de startpagina van Doorzoeker</a>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
