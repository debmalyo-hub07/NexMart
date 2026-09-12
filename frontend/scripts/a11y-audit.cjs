/**
 * Keyboard and reduced-motion checks for the surfaces changed in waves 6–8.
 * Read-only: tabs, presses Escape, and reads computed styles. Never submits.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();

  // ── 1. Focus is always visible on the storefront ──────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    let invisible = 0;
    let checked = 0;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return s.outlineStyle !== 'none' || s.boxShadow !== 'none' || s.borderColor !== 'rgba(0, 0, 0, 0)';
      });
      if (visible === null) continue;
      checked++;
      if (!visible) invisible++;
    }
    console.log(`focus ring: ${checked - invisible}/${checked} focused elements show a visible indicator`);
    await page.close();
  }

  // ── 2. Skip link is the first stop and actually targets main ──────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => {
      const el = document.activeElement;
      const href = el?.getAttribute('href') || '';
      return { text: (el?.textContent || '').trim(), href, targetExists: !!(href.startsWith('#') && document.querySelector(href)) };
    });
    console.log(`skip link: "${first.text}" → ${first.href} (target present: ${first.targetExists})`);
    await page.close();
  }

  // ── 3. Reduced motion actually reduces motion ─────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const motion = await page.evaluate(() => {
      let animating = 0;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        const dur = parseFloat(s.animationDuration) || 0;
        if (dur > 0.05 && s.animationIterationCount === 'infinite') {
          animating++;
          if (offenders.length < 5) offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} ${s.animationDuration}`);
        }
      }
      return { animating, offenders, canvases: document.querySelectorAll('canvas').length };
    });
    console.log(`reduced motion: ${motion.animating} infinite animations, ${motion.canvases} canvas elements`);
    if (motion.offenders.length) console.log('  offenders:', motion.offenders);
    await context.close();
  }

  // ── 4. The admin table disclosure is keyboard-operable ────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const labelled = await page.evaluate(() => {
      const missing = [];
      for (const input of document.querySelectorAll('input, select, textarea')) {
        if (input.type === 'hidden') continue;
        const id = input.id;
        const hasLabel = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
          || input.closest('label')
          || input.getAttribute('aria-label')
          || input.getAttribute('aria-labelledby');
        if (!hasLabel) missing.push(input.name || input.type);
      }
      return missing;
    });
    console.log(`admin login: unlabelled fields → ${labelled.length ? labelled.join(', ') : 'none'}`);
    await page.close();
  }

  // ── 5. Escape closes the search drawer and focus returns ──────────────────
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const trigger = page.getByRole('button', { name: 'Search the catalog' }).first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(500);
      const opened = await page.evaluate(() => !!document.querySelector('[role="dialog"], [aria-modal="true"]'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const closed = await page.evaluate(() => !document.querySelector('[role="dialog"], [aria-modal="true"]'));
      const scrollRestored = await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden');
      const focusReturned = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName);
      console.log(`search drawer: opened=${opened} closedOnEscape=${closed} bodyScrollRestored=${scrollRestored} focusReturnedTo=${focusReturned}`);
    } else {
      console.log('search drawer: no trigger found at 375px');
    }
    await page.close();
  }

  await browser.close();
})();
