import { expect, test, type Page } from "@playwright/test";

const records = [
  {
    choNumber: "cho-1",
    monumentNumber: "517912",
    registrationDate: "2002-01-01",
    street: "Dorpsstraat",
    houseNumber: "1",
    postalCode: "5051AA",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-1",
    name: "Woonhuis van de architect",
    functionName: "Woonhuis",
    description: "Een gebouwd rijksmonument in Goirle.",
    monumentNature: "onroerend gebouwd",
    fullAddress: "Dorpsstraat 1",
    place: "Goirle",
    municipality: "Goirle",
    provinceCode: "NB",
    lat: 51.52,
    lng: 5.07,
    matchSource: "oorspronkelijke functie",
    matchedText: "Woonhuis",
    matchScore: 1,
  },
  {
    choNumber: "cho-2",
    monumentNumber: "complex-12",
    registrationDate: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-2",
    name: "Historisch boerderijcomplex",
    description: "Een samenhang van twee rijksmonumenten.",
    monumentNature: "complex",
    place: "Goirle",
    municipality: "Goirle",
    provinceCode: "NB",
    complexMemberCount: 2,
    lat: 51.53,
    lng: 5.08,
  },
  {
    choNumber: "cho-3",
    monumentNumber: "onderzoek-4",
    registrationDate: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-3",
    description: "Hier is archeologisch onderzoek uitgevoerd.",
    monumentNature: "archeologischonderzoeksgebied",
    place: "Goirle",
    municipality: "Goirle",
    provinceCode: "NB",
  },
];

async function mockRce(page: Page) {
  await page.route("**/api/rce/op-deze-dag", (route) =>
    route.fulfill({ json: { monument: null } }),
  );
  await page.route("**/api/terms/suggest**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({
      json: {
        suggestions: query.toLocaleLowerCase("nl").startsWith("kerk")
          ? [
              {
                uri: "https://example.test/term/kerk",
                label: "Kerk",
                sourceUri: "https://example.test/cht",
                sourceName: "Cultuurhistorische Thesaurus",
              },
            ]
          : [],
      },
    });
  });
  await page.route("**/api/rce/complex-members**", (route) =>
    route.fulfill({ json: { members: [] } }),
  );
  await page.route("**/api/rce/onderzoeksgebied-verrijking**", (route) =>
    route.fulfill({
      json: {
        complexen: [],
        vondstlocaties: [],
        vondstlocatieTotaal: 0,
        grondsporenTotaal: 0,
        vondstenTotaal: 0,
        complexenViaVondstlocatieTotaal: 0,
      },
    }),
  );
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({
      json: { results: records, page: 1, hasMore: false },
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockRce(page);
  const clientReady = page.waitForResponse((response) =>
    response.url().includes("/api/rce/op-deze-dag"),
  );
  await page.goto("/");
  await clientReady;
});

test("zoeken toont verschillende erfgoedtypen", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "3 resultaten voor “Goirle”" }),
  ).toBeVisible();
  await expect(
    page.getByText("Rijksmonument", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Complex van rijksmonumenten", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Archeologisch onderzoeksgebied", { exact: true }).first(),
  ).toBeVisible();
});

test("filters volgen het gekozen objecttype", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("radio", { name: /Complex 1/ }).check();
  await expect(page.getByRole("group", { name: "Monumentaard" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("group", { name: "Functie" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "1 resultaat voor “Goirle”" }),
  ).toBeVisible();
});

test("een complexdetail toont geen lege monumentvelden", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page
    .getByRole("button", { name: "Details van Historisch boerderijcomplex" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Complex van rijksmonumenten");
  await expect(
    dialog.getByText("2 rijksmonumenten", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Functie", { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByText("Inschrijving of datering", { exact: true }),
  ).toHaveCount(0);
});

test("de detaildialoog houdt focus vast en herstelt hem na Escape", async ({
  page,
}) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const opener = page.getByRole("button", {
    name: "Details van Historisch boerderijcomplex",
  });
  await opener.click();

  const dialog = page.getByRole("dialog");
  const closeButton = dialog.getByRole("button", { name: "Details sluiten" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("link", { name: /Bekijk in de RCE Linked Data/ }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("de kaartpositie blijft in de URL staan na herladen", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Kaartweergave" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("zoom"))
    .not.toBeNull();
  const sharedUrl = page.url();
  const sharedState = new URL(sharedUrl).searchParams;
  expect(sharedState.get("lat")).not.toBeNull();
  expect(sharedState.get("lng")).not.toBeNull();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Kaartweergave" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toBe(sharedUrl);
});

test("een gekozen termsuggestie behoudt URI en bron na herladen", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("kerk");
  await page
    .getByRole("option")
    .getByRole("button", { name: /Kerk.*Cultuurhistorische Thesaurus/ })
    .click();
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("begrip"))
    .toBe("https://example.test/term/kerk");
  expect(new URL(page.url()).searchParams.get("begripbron")).toBe(
    "https://example.test/cht",
  );

  await page.reload();
  await expect(search).toHaveValue("Kerk");
  expect(new URL(page.url()).searchParams.get("begripbronnaam")).toBe(
    "Cultuurhistorische Thesaurus",
  );
});

test("browser-terug en -vooruit herstellen de zoekopdracht", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("Eerste zoekactie");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", {
      name: "3 resultaten voor “Eerste zoekactie”",
    }),
  ).toBeVisible();

  await search.fill("Tweede zoekactie");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", {
      name: "3 resultaten voor “Tweede zoekactie”",
    }),
  ).toBeVisible();

  await page.goBack();
  await expect(search).toHaveValue("Eerste zoekactie");
  await expect(
    page.getByRole("heading", {
      name: "3 resultaten voor “Eerste zoekactie”",
    }),
  ).toBeVisible();

  await page.goForward();
  await expect(search).toHaveValue("Tweede zoekactie");
});

test("een oude verbindingsfout verdwijnt zodra een nieuwe zoekterm wordt ingevoerd", async ({
  page,
}) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({ status: 502, json: { error: "Tijdelijk niet bereikbaar" } }),
  );

  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("Eerste zoekactie");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByText("De RCE Linked Data-service is momenteel niet bereikbaar."),
  ).toBeVisible();

  await search.fill("vuurtoren");
  await expect(
    page.getByText("De RCE Linked Data-service is momenteel niet bereikbaar."),
  ).toHaveCount(0);
});
