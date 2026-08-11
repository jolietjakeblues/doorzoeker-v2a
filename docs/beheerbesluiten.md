# Beheerbesluiten

Datum: 11 augustus 2026.

Status: besluitvoorstel. Er zijn geen dependencies of licentiebestanden gewijzigd.

## TypeScript 7, PR 6

Voorstel: bewust uitstellen en open houden totdat vinext, Vite,
`@vitejs/plugin-rsc`, React Server Components en Cloudflare Workers-types
TypeScript 7 aantoonbaar ondersteunen.

Voor latere beoordeling:

1. Gebruik een eigen testbranch.
2. Werk alleen TypeScript en direct noodzakelijke compatibiliteitsdependencies bij.
3. Draai typecheck, lint, build en de volledige unit-, contract- en Playwright-testsets.
4. Controleer gewijzigde compilerdefaults en verwijderde opties.
5. Voeg geen productwijzigingen aan dezelfde branch toe.

## ESLint 10, PR 10

Voorstel: bewust uitstellen totdat alle gebruikte plugins ESLint 10 als peer
dependency ondersteunen:

- `typescript-eslint`;
- `eslint-plugin-react`;
- `eslint-plugin-react-hooks`;
- `eslint-plugin-jsx-a11y`;
- `@next/eslint-plugin-next`.

Beoordeel deze upgrade in een andere branch dan TypeScript 7. Zo blijft de
oorzaak van configuratie- en pluginproblemen zichtbaar.

## Licentie

Er is nu geen `LICENSE`-bestand.

| Keuze | Geschikt wanneer | Belangrijk gevolg |
| --- | --- | --- |
| MIT | Ruim hergebruik gewenst is | Eenvoudige permissieve licentie zonder expliciete patentclausule |
| Apache-2.0 | Ruim hergebruik en expliciete patentvoorwaarden gewenst zijn | Meer tekst en voorwaarden dan MIT |
| Geen openbare licentie | Hergebruik nog niet is toegestaan | Publieke broncode is niet automatisch vrij herbruikbaar |

Voorstel: leg eerst het publicatiedoel en rechthebberschap vast. Voeg pas daarna
een licentie toe.

## Testaantallen in documentatie

Vermeld testaantallen alleen met datum en verificatiecontext. Gebruik in
verticale slices bij voorkeur “testset geslaagd bij implementatie” wanneer het
exacte aantal geen functionele betekenis heeft.
