import { expect, test, type Page } from '@playwright/test';

// The fixture case in e2e/fixture-case: a bone cylinder along Z (radius 8 mm), a plate on its +X side
// (x 8.5 to 11.5 mm, y ±5, z ±20), a screw along X at z = 10, a clear guide, and a white spacer.

function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) problems.push(`console: ${m.text()}`); });
  return problems;
}

async function enter(page: Page, dvm = 'ayse yilmaz', patient = 'MAX') {
  await page.fill('#f-dvm', dvm);
  await page.fill('#f-patient', patient);
  await page.click('#ac');
}

const waitForModel = (page: Page) => page.locator('#ozet', { hasText: 'triangles' }).waitFor({ timeout: 30_000 });

async function openCase(page: Page) {
  await page.goto('/');
  await enter(page);
  await waitForModel(page);
}

/** Waits until the cube has stopped moving, since slow graphics stretch the 420 ms flight. */
async function settle(page: Page) {
  await page.waitForTimeout(500);
  let last = '';
  await expect.poll(async () => {
    const now = await page.locator('#kup').evaluate((el) => (el as HTMLElement).style.transform);
    const still = now === last;
    last = now;
    return still;
  }, { timeout: 20_000, intervals: [250] }).toBe(true);
}

const center = async (page: Page) => { const b = (await page.locator('#tuval').boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test.describe('name check', () => {
  test('wrong names are refused, and no part is downloaded', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/case/')) fetched.push(r.url()); });
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('.urun-ad')).toHaveText('Design Viewer');
    await expect(page.locator('#yanit')).toBeHidden();
    await expect(page.locator('#vaka')).toBeHidden();

    for (const [dvm, patient] of [['Ayşe Yılmaz', 'Maxi'], ['Ayşe', 'Max'], ['', '']]) {
      await enter(page, dvm, patient);
      await expect(page.locator('#giris-hata')).toHaveText("These names don't match the current case. Check the spelling, or write to info@vimics.vet.");
      await expect(page.locator('#giris')).toBeVisible();
    }
    // Typing again clears the message.
    await page.fill('#f-patient', 'M');
    await expect(page.locator('#giris-hata')).toBeHidden();
    expect(fetched).toEqual([]);
  });

  test('matches whatever the case, accents or dotless i, and a refresh skips the check', async ({ page }) => {
    const problems = collectProblems(page);
    const outside: string[] = [];
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) outside.push(r.url()); });
    await page.goto('/');
    await enter(page, '  DR. AYSE   YILMAZ ', 'max');
    await waitForModel(page);
    await expect(page.locator('#vaka-satir')).toHaveText('Max · Prepared for Ayşe Yılmaz, DVM');
    await expect(page.locator('#yanit')).toHaveAttribute('href', `mailto:info@vimics.vet?subject=${encodeURIComponent('Design – Max')}`);

    await page.reload();
    await waitForModel(page);
    await expect(page.locator('#giris')).toBeHidden();
    expect(outside).toEqual([]);
    expect(problems).toEqual([]);
  });
});

test.describe('viewer', () => {
  test('lists the parts with their materials, the note, and no V-Seg controls', async ({ page }) => {
    await openCase(page);
    await expect(page.locator('#not-metin')).toHaveText('TPLO plate 3.5 mm, 6 holes. Screws 2.7 mm.');
    await expect(page.locator('#parcalar .ad b')).toHaveText(['Tibia', 'TPLO plate 3.5 mm', 'Spacer', 'Cutting guide', 'Screw 1']);
    await expect(page.locator('#parcalar .ad small')).toHaveText(['Bone', 'Metal', 'Resin, white', 'Resin, clear', 'Screw']);
    await expect(page.locator('.ray .etiket:visible')).toHaveText(['Case note', 'Structures', 'Measure', 'Section Analysis']);
    await expect(page.locator('#esik-min, #filtreler')).toHaveCount(0);
    await expect(page.locator('.kup button').first()).toHaveText('Z');
    await expect(page.locator('#ozet')).toContainText('5 of 5 parts');
  });

  test('hiding and see-through respond, from the list and from the model', async ({ page }) => {
    await openCase(page);
    await page.locator('#parcalar input').nth(2).uncheck();
    await expect(page.locator('#ozet')).toContainText('4 of 5 parts');
    await expect(page.locator('#parcalar li').nth(2)).toHaveClass('kapali');
    await expect(page.locator('#parcalar .gecirgen').nth(2)).toBeDisabled();

    // Square on to the plate, from +X.
    await page.click('#kup button[data-yuz="x"]');
    await settle(page);
    const c = await center(page);
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#aksiyon-yazi')).toHaveText('TPLO plate 3.5 mm');

    // A see-through plate lets the click reach the bone behind it.
    await page.click('button[aria-label="See through TPLO plate 3.5 mm"]');
    await expect(page.locator('button[aria-label="See through TPLO plate 3.5 mm"]')).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#aksiyon-yazi')).toHaveText('Tibia');
    await page.click('#aksiyon-gizle');
    await expect(page.locator('#ozet')).toContainText('3 of 5 parts');
    await expect(page.locator('#parcalar input').first()).not.toBeChecked();

    for (const box of await page.locator('#parcalar input').all()) await box.uncheck();
    await expect(page.locator('#ipucu')).toHaveText('Every part is hidden. Tick one under Structures.');
  });

  test('measures true millimetres on the plate', async ({ page }) => {
    await openCase(page);
    await page.click('#kup button[data-yuz="x"]');
    await settle(page);
    const scaleMm = parseFloat(await page.locator('#olcek-yazi').innerText());
    const scalePx = (await page.locator('#olcek-cizgi').boundingBox())!.width;
    const c = await center(page);
    const offset = 30;
    await page.click('.arac[data-arac="distance"]');
    await page.mouse.click(c.x - offset, c.y);
    await page.mouse.click(c.x + offset, c.y);
    await expect(page.locator('#olculer li')).toHaveCount(1);
    const measured = parseFloat(await page.locator('#olculer b').innerText());
    expect(Math.abs(measured - (2 * offset) / (scalePx / scaleMm))).toBeLessThan(0.3);
  });

  test('a section cap belongs to the part it cuts', async ({ page }) => {
    await openCase(page);
    await page.click('#kup button[data-yuz="x"]');
    await settle(page);
    // Cutting at x = 10 leaves the plate's cut face toward the viewer, and the bone untouched behind it.
    await page.check('#kesitler input[type=checkbox][data-eksen="0"]');
    await page.locator('#kesitler input[type=range][data-eksen="0"]').evaluate((el: HTMLInputElement) => { el.value = '10'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const c = await center(page);
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#aksiyon-yazi')).toHaveText('TPLO plate 3.5 mm');
    // Past the plate, the click reaches the bone.
    await page.locator('#kesitler input[type=range][data-eksen="0"]').evaluate((el: HTMLInputElement) => { el.value = '8.2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#aksiyon-yazi')).toHaveText('Tibia');
  });

  test('the snapshot carries the case line and the Vimics mark, and dark mode switches', async ({ page }) => {
    await openCase(page);
    await page.evaluate(() => {
      const drawn: string[] = [];
      (window as unknown as { drawn: string[] }).drawn = drawn;
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number) { drawn.push(text); original.call(this, text, x, y); };
    });
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#goruntu')]);
    const drawn = await page.evaluate(() => (window as unknown as { drawn: string[] }).drawn);
    expect(drawn).toContain('vimics.vet');
    expect(drawn.some((t) => t.startsWith('Max · Prepared for Ayşe Yılmaz, DVM · '))).toBe(true);
    expect(download.suggestedFilename()).toBe('vimics-design.png');

    await page.click('#tema');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('small screens', () => {
  for (const [label, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]] as const) {
    test(`nothing is cut off on a ${label}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto('/');
      for (const selector of ['#f-dvm', '#ac', '.logo-link svg']) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x + box.width, `${selector} right`).toBeLessThanOrEqual(width + 1);
      }
      await enter(page);
      await waitForModel(page);
      for (const selector of ['.logo-link svg', '#yanit', '#tema', '#sigdir', '.kup-kap', '#ozet', '#parcalar .gecirgen']) {
        const box = (await page.locator(selector).first().boundingBox())!;
        expect(box.x, `${selector} left`).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width, `${selector} right`).toBeLessThanOrEqual(width + 1);
      }
      await context.close();
    });
  }
});
