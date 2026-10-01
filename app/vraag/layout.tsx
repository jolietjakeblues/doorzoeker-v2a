import type { Metadata } from "next";

// Front-end kwaliteitscontrole (30-09-2026): /vraag/page.tsx is een client
// component (kan zelf geen `metadata` exporteren), maar erfde daardoor
// tot dusver letterlijk dezelfde titel/omschrijving als de startpagina -
// een geneste server-only layout mag wél metadata exporteren; Next.js
// merget dit met de root-metadata (title/description overschreven, de
// rest zoals metadataBase/icons/referrer blijft staan).
const TITLE = "Stel een vraag - Doorzoeker";
const DESCRIPTION = "Stel een vraag in gewone taal over Nederlands erfgoed en krijg een leesbaar antwoord, gebaseerd op actuele RCE-linked-data.";
// Zelfde asset als app/layout.tsx - hier expliciet herhaald, want Next.js
// vervangt het hele openGraph/twitter-object per geneste layout (geen
// veld-voor-veld merge), dus zonder dit zou /vraag zijn eigen titel tonen
// maar wél de social-preview-afbeelding verliezen.
const SOCIAL_PREVIEW_IMAGE = { url: "/social-preview.webp", width: 1731, height: 909, type: "image/webp", alt: TITLE };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
};

export default function VraagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
