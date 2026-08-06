import type{Metadata}from"next";import"./globals.css";
export const metadata:Metadata={title:"Doorzoeker — Cultureel erfgoed ontdekken",description:"Zoek en ontdek monumenten, plaatsen en verhalen uit de RCE Linked Data-voorziening."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}