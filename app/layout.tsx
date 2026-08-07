import type{Metadata}from"next";import"./globals.css";
export const metadata:Metadata={title:"Doorzoeker — Rijksmonumenten in RCE Linked Data",description:"Doorzoek de actuele RCE-registratie op monumentnummer, functie, monumentaard, plaats en formele omschrijving."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}
