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
  await page.route("**/api/terms/suggest**", (route) =>
    route.fulfill({ json: { suggestions: [] } }),
  );
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
