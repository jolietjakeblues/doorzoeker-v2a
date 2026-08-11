import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doorzoeker - Erfgoed digitaal",
  description: "Doorzoek actuele erfgoeddata van de Rijksdienst voor het Cultureel Erfgoed.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="nl"><body>{children}</body></html>;
}
