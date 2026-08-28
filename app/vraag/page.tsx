"use client";

import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { BetaBadge } from "../BetaBadge";
import { VraagScherm } from "../VraagScherm";

export default function VraagPagina() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- volle paginanavigatie tussen twee losse routes, geen SPA-interne overgang */}
      <SiteHeader onReset={() => { window.location.href = "/"; }} />
      <BetaBadge />
      <main className="vraag-main">
        <section className="hero vraag-hero">
          <small>NIEUW</small>
          <h1>Stel een vraag</h1>
          <p className="hero-intro">
            Stel een vraag in gewone taal over Nederlands erfgoed. De
            assistent zet &apos;m om in SPARQL, voert die uit tegen dezelfde
            RCE-data als Doorzoeker, en geeft een leesbaar antwoord.
          </p>
        </section>
        <div className="vraag-work">
          <VraagScherm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
