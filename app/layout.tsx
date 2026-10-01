import type { Metadata } from "next";
import "./globals.css";

const TITLE = "Doorzoeker - Erfgoed digitaal";
const DESCRIPTION = "Doorzoek actuele erfgoeddata van de Rijksdienst voor het Cultureel Erfgoed.";
// Aangeleverde social-preview-afbeelding (30-09-2026), al op de aanbevolen
// ~1.91:1-verhouding (1731x909) voor Open Graph/Twitter-cards.
const SOCIAL_PREVIEW_IMAGE = { url: "/social-preview.webp", width: 1731, height: 909, type: "image/webp", alt: TITLE };

export const metadata: Metadata = {
  // Front-end kwaliteitscontrole (30-09-2026): metadataBase ontbrak, dus
  // relatieve Open Graph/canonical-URL's zouden zonder deze basis niet
  // correct opgelost worden. doorzoekerfgoed.nl is het echte productie-
  // domein (ook al gebruikt in lib/server/rce-adapter.ts's User-Agent).
  metadataBase: new URL("https://doorzoekerfgoed.nl"),
  title: TITLE,
  description: DESCRIPTION,
  // public/favicon.svg bestond al, maar werd nergens gelinkt - browsers
  // vroegen alleen standaard /favicon.ico op (404) en gebruikten dus geen
  // enkel icoon.
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Doorzoeker",
    locale: "nl_NL",
    type: "website",
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  // Beperkt wat externe bronnen (PDOK-kaarttegels, RCE-afbeeldingen) als
  // referrer te zien krijgen: alleen de eigen origin, nooit het volledige
  // pad met eventuele zoektermen (securityreview 15-08-2026).
  referrer: "strict-origin-when-cross-origin",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="nl"><body>{children}</body></html>;
}
