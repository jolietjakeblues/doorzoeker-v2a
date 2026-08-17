import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doorzoeker - Erfgoed digitaal",
  description: "Doorzoek actuele erfgoeddata van de Rijksdienst voor het Cultureel Erfgoed.",
  // Beperkt wat externe bronnen (PDOK-kaarttegels, RCE-afbeeldingen) als
  // referrer te zien krijgen: alleen de eigen origin, nooit het volledige
  // pad met eventuele zoektermen (securityreview 15-08-2026).
  referrer: "strict-origin-when-cross-origin",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="nl"><body>{children}</body></html>;
}
