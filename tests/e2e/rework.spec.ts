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
  await page.route("**/api/rce/vondstlocatie-inhoud**", (route) =>
    route.fulfill({ json: { complexen: [], vondsten: [], grondsporen: [], complexenTotaal: 0, vondstenTotaal: 0, grondsporenTotaal: 0 } }),
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

test("de startpagina biedt een brede reeks directe zoekvoorbeelden", async ({ page }) => {
  await page.goto("/");

  const directZoeken = page.getByRole("navigation", { name: "Direct zoeken" });
  for (const term of [
    "36046",
    "Woonhuis",
    "Archeologisch",
    "Collse",
    "moutmolen",
    "Utrecht",
    "Kinderdijk",
    "517912",
    "517443",
  ]) {
    await expect(directZoeken.getByRole("button", { name: term, exact: true })).toBeVisible();
  }

  const collecties = page.getByRole("navigation", {
    name: "Bekijk een volledige collectie",
  });
  await expect(collecties.getByRole("button", { name: "Werelderfgoed" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Gezichten" })).toBeVisible();
  await expect(
    collecties.getByRole("button", { name: "Gebouwde complexen" }),
  ).toBeVisible();
});

test("zoeken toont een rustige laadstaat op de plaats van de resultaten", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ json: { results: records, page: 1, hasMore: false } });
  });

  await page.getByRole("combobox", { name: "Zoeken" }).fill("moutmolen");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();

  await expect(page.getByRole("status").filter({ hasText: "We zoeken in de RCE-bronnen" })).toBeVisible();
  await expect(page.locator(".skeleton-card")).toHaveCount(3);
  await expect(page.locator(".search-combobox form")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { name: /3 resultaten/ })).toBeVisible();
});

test("een vondstlocatie toont vondsten met hun RN2-bron", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({ json: { results: [{
    choNumber: "6109334", monumentNumber: "102482", registrationDate: "2016-09-30", street: "", houseNumber: "", postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6109334", name: "Padstuk-Dres", place: "Opmeer", municipality: "Opmeer",
    description: "Archeologische vondstlocatie.", monumentNature: "vondstlocatie", archaeologicalAcquisition: "archeologisch: boring",
    matchSource: "Archis-vondstmeldingsnummer", matchedText: "102482", matchScore: 10,
  }], page: 1, hasMore: false } }));
  await page.unroute("**/api/rce/vondstlocatie-inhoud**");
  await page.route("**/api/rce/vondstlocatie-inhoud**", (route) => route.fulfill({ json: {
    complexen: [], grondsporen: [], complexenTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 1,
    vondsten: [{ uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondsten/2199539", choNumber: "2199539", archisVondstnummer: "5888", aantal: 1,
      types: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/type", label: "aardewerk", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] }],
      materialen: [], stijlen: [], toestand: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/toestand", label: "fragment", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/choi", label: "Cultuurhistorische Object Informatie" }] } }],
  } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("102482");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Details van Padstuk-Dres" }).click();
  await expect(page.getByText("Archis-vondst 5888", { exact: true })).toBeVisible();
  await expect(page.getByText(/aardewerk \(Archeologisch Informatie Systeem\).*fragment \(Cultuurhistorische Object Informatie\)/)).toBeVisible();
});

test("een grondspoor toont aantal, RN2-bron en bijbehorende vondstlocatie", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({ json: { results: [{
    choNumber: "10000135", monumentNumber: "10000135", registrationDate: "2015-06-05", street: "", houseNumber: "", postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/grondsporen/10000135", name: "Karrespoor", place: "Brunssum", municipality: "Brunssum",
    description: "Karrespoor", monumentNature: "grondsporen", archaeologicalTraceCount: 1, archaeologicalType: "onbekend",
    archaeologicalTypeConceptUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/type",
    archaeologicalTypeSchemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }],
    parentObjectUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6175362", parentObjectLabel: "Bijbehorende vondstlocatie",
    matchSource: "omschrijving (grondspoor)", matchedText: "Karrespoor", matchScore: 20,
  }], page: 1, hasMore: false } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Karrespoor");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Details van Karrespoor" }).click();
  await expect(page.getByText("Archeologisch grondspoor", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("onbekend (Archeologisch Informatie Systeem)", { exact: true })).toBeVisible();
  await expect(page.getByText("Bijbehorende vondstlocatie", { exact: true })).toBeVisible();
});

test("materiaal van een vondst zoekt exact verder via de RN2-URI", async ({ page }) => {
  const materialUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/91645e25-8d66-44ba-9126-56e64ac5fd1f";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    const exactMaterial = url.searchParams.get("veld") === "materiaal" && url.searchParams.get("concept") === materialUri;
    return route.fulfill({ json: { results: [{
      choNumber: exactMaterial ? "10004949" : "10015422", monumentNumber: exactMaterial ? "10004949" : "10015422", registrationDate: "2016-03-17", street: "", houseNumber: "", postalCode: "",
      sourceUrl: `https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondsten/${exactMaterial ? "10004949" : "10015422"}`,
      description: exactMaterial ? "Bedelaarsgildepenning" : "Een riemtong van messing.", monumentNature: "vondsten", place: "Eindhoven", municipality: "Eindhoven", archaeologicalFindCount: 1,
      archaeologicalFindTypes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/type", label: exactMaterial ? "penning" : "riemtong - langwerpig", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] }],
      archaeologicalMaterials: [{ uri: materialUri, label: "messing", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] }],
      archaeologicalCondition: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/toestand", label: "onbekend", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/choi", label: "Cultuurhistorische Object Informatie" }] },
      parentObjectUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6175445", parentObjectLabel: "Collse Watermolen",
      matchSource: exactMaterial ? "materiaal vondst" : "CHO-nummer (vondst)", matchedText: exactMaterial ? "" : "10015422", matchScore: exactMaterial ? 0 : 10,
    }], page: 1, hasMore: false } });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("10015422");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: /Details van/ }).click();
  await expect(page.getByRole("button", { name: "messing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "messing", exact: true }).click();
  await expect(page).toHaveURL(/veld=materiaal/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(materialUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Bedelaarsgildepenning", { exact: true })).toBeVisible();
});

test("een archeologisch complex blijft onderscheiden van een gebouwd complex", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({ json: { results: [{
    choNumber: "10015403", monumentNumber: "10015403", registrationDate: "2016-03-17", street: "", houseNumber: "", postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischcomplex/10015403", name: "watermolen", description: "Archeologische duiding bij de watermolen.", monumentNature: "archeologischcomplex", place: "Eindhoven", municipality: "Eindhoven",
    archaeologicalComplexType: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/watermolen", label: "watermolen", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] },
    archaeologicalContexts: [{ uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6175445", label: "Collse Watermolen", type: "Vondstlocatie" }],
    matchSource: "CHO-nummer (archeologisch complex)", matchedText: "10015403", matchScore: 10,
  }], page: 1, hasMore: false } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("10015403");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByText("Archeologisch complex", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Complex van rijksmonumenten", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Details van watermolen" }).click();
  await expect(page.getByRole("button", { name: "watermolen", exact: true })).toBeVisible();
  await expect(page.getByText("Collse Watermolen", { exact: true })).toBeVisible();
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

test("groenaanleg verdwijnt wanneer de overige filters geen keuze meer overlaten", async ({
  page,
}) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        results: [
          { ...records[0], choNumber: "cho-goirle", monumentNumber: "1" },
          {
            ...records[0],
            choNumber: "cho-utrecht",
            monumentNumber: "2",
            place: "Utrecht",
            municipality: "Utrecht",
            provinceCode: "UT",
            groenaanleg: { typeAanleg: "Tuin" },
          },
        ],
      },
    }),
  );

  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const groenaanleg = page.getByRole("checkbox", {
    name: /Historische aanleg \(groenaanleg\)/,
  });
  await expect(groenaanleg).toBeVisible();
  await groenaanleg.check();
  await page
    .getByRole("combobox", { name: "Filter op gemeente of woonplaats" })
    .selectOption("Goirle");

  await expect(groenaanleg).toHaveCount(0);
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
});
