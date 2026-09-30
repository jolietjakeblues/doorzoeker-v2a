// Start the local app on port 3002 first. All API calls are intercepted.
import { chromium } from 'file:///C:/AI/doorzoeker-v2a-standalone/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const requestedPages = [];
  let delayed = false;
  const record = { choNumber: 'review-1', monumentNumber: '12345', registrationDate: '', street: '', houseNumber: '', postalCode: '', sourceUrl: 'https://review.test/1', name: 'Reviewmonument', monumentNature: 'onroerend gebouwd', place: 'Goirle', municipality: 'Goirle', provinceCode: 'NB', lat: 51.52, lng: 5.07 };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/search')) {
      requestedPages.push(url.searchParams.get('page'));
      if (delayed) await new Promise(resolve => setTimeout(resolve, 1200));
      return route.fulfill({ json: { results: url.searchParams.get('scope') === 'core' ? [record] : [], hasMore: true, page: 1 } });
    }
    return route.fulfill({ json: { monument: null, suggestions: [], gebieden: [] } });
  });
  await page.goto('http://localhost:3002/?q=Goirle&pagina=3');
  await page.getByText('Reviewmonument', { exact: true }).waitFor();
  assert.deepEqual([...new Set(requestedPages)], ['1']);
  assert.equal(new URL(page.url()).searchParams.has('pagina'), false);
  console.log('CONFIRMED: opening pagina=3 requests only page 1 and removes pagina from the URL.');
  delayed = true;
  await page.getByRole('combobox', { name: 'Zoeken' }).fill('Tilburg');
  const pending = page.waitForRequest(request => request.url().includes('/search?') && request.url().includes('Tilburg'));
  await page.getByRole('button', { name: 'Doorzoek RCE' }).click();
  await pending;
  await page.getByRole('button', { name: 'Terug naar de startpagina' }).click();
  await page.waitForTimeout(1800);
  console.log('RESET URL:', page.url());
  console.log('RESET headings:', await page.getByRole('heading').allTextContents());
  console.log('RESET stale result visible:', await page.getByText('Reviewmonument', { exact: true }).isVisible());
  await page.screenshot({ path: 'review-reset.png', fullPage: true });
} finally { await browser.close(); }
