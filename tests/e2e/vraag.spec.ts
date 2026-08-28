import { expect, test, type Page } from "@playwright/test";

const GENERATED_QUERY = "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT DISTINCT ?rm ?nummer ?naam ?gemeente WHERE {\n  ?rm a ceo:Rijksmonument .\n  ?rm ceo:rijksmonumentnummer ?nummer .\n}\nLIMIT 200";

async function mockVraag(page: Page, options: { genereerCalls: number[]; uitvoerenCalls: number[] } = { genereerCalls: [], uitvoerenCalls: [] }) {
  await page.route("**/api/vraag/genereer-sparql", (route) => {
    options.genereerCalls.push(1);
    return route.fulfill({ json: { query: GENERATED_QUERY } });
  });
  await page.route("**/api/vraag/uitvoeren", (route) => {
    options.uitvoerenCalls.push(1);
    return route.fulfill({
      json: {
        results: {
          head: { vars: ["rm", "nummer", "naam", "gemeente"] },
          results: {
            bindings: [
              { rm: { type: "uri", value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/1" }, nummer: { type: "literal", value: "12345" }, naam: { type: "literal", value: "Sint-Maartenskerk" }, gemeente: { type: "literal", value: "Overbetuwe" } },
            ],
          },
        },
      },
    });
  });
  await page.route("**/api/vraag/antwoord", (route) =>
    route.fulfill({ json: { answer: "In Overbetuwe staat onder meer de Sint-Maartenskerk, een rijksmonument met een rijke geschiedenis." } }),
  );
}

test("stelt een vraag en toont de gegenereerde query, resultaten en het antwoord", async ({ page }) => {
  const calls = { genereerCalls: [] as number[], uitvoerenCalls: [] as number[] };
  await mockVraag(page, calls);
  await page.goto("/vraag");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Stel een vraag" })).toBeVisible();
  await page.getByLabel("Stel je vraag in gewone taal").fill("Welke rijksmonumenten staan er in Elst?");
  await page.getByRole("button", { name: "Stel de vraag" }).click();

  await expect(page.getByText("In Overbetuwe staat onder meer de Sint-Maartenskerk")).toBeVisible();
  await expect(page.locator(".vraag-sparql-editor")).toHaveValue(GENERATED_QUERY);
  await expect(page.getByRole("cell", { name: "Sint-Maartenskerk" })).toBeVisible();
  expect(calls.genereerCalls.length).toBe(1);
  expect(calls.uitvoerenCalls.length).toBe(1);

  const deepLink = page.getByRole("link", { name: "Bekijk in Doorzoeker →" });
  await expect(deepLink).toBeVisible();
  await expect(deepLink).toHaveAttribute("href", "/?q=12345&object=12345");
  await expect(deepLink).toHaveAttribute("target", "_blank");
});

test("een voorbeeldvraag vult het vraagveld en de bijbehorende modus", async ({ page }) => {
  await mockVraag(page);
  await page.goto("/vraag");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Hoeveel kerken zijn er in Utrecht?" }).click();
  await expect(page.getByLabel("Stel je vraag in gewone taal")).toHaveValue("Hoeveel kerken zijn er in Utrecht?");
  await expect(page.getByLabel("Alleen een aantal")).toBeChecked();
});

test("'Voer bewerkte query uit' herhaalt alleen uitvoeren en antwoord, niet genereer-sparql", async ({ page }) => {
  const calls = { genereerCalls: [] as number[], uitvoerenCalls: [] as number[] };
  await mockVraag(page, calls);
  await page.goto("/vraag");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Stel je vraag in gewone taal").fill("Welke rijksmonumenten staan er in Elst?");
  await page.getByRole("button", { name: "Stel de vraag" }).click();
  await expect(page.locator(".vraag-sparql-editor")).toHaveValue(GENERATED_QUERY);

  await page.locator(".vraag-sparql-editor").fill(`${GENERATED_QUERY}\n# bewerkt`);
  await page.getByRole("button", { name: "Voer bewerkte query uit" }).click();
  await expect(page.getByText("Sint-Maartenskerk").first()).toBeVisible();

  expect(calls.genereerCalls.length).toBe(1);
  expect(calls.uitvoerenCalls.length).toBe(2);
});

test("de header op de startpagina linkt naar /vraag", async ({ page }) => {
  await page.route("**/api/rce/op-deze-dag", (route) => route.fulfill({ json: { monument: null } }));
  await page.goto("/");
  await page.getByRole("link", { name: "Stel een vraag" }).click();
  await expect(page).toHaveURL(/\/vraag$/);
});

test("op /vraag zelf is de navigatielink een weg terug, geen cirkelroute naar /vraag (gemeld door de eigenaar, 28-08-2026)", async ({ page }) => {
  await page.goto("/vraag");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: "Stel een vraag" })).toHaveCount(0);
  const terugLink = page.getByRole("link", { name: "Terug naar Doorzoeker" });
  await expect(terugLink).toBeVisible();
  await expect(terugLink).toHaveAttribute("href", "/");
});
