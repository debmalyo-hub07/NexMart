/**
 * Responsive and touch-target audit.
 *
 * Drives the built app at every width the brief requires and reports, per
 * route/width: horizontal overflow, undersized interactive targets, and
 * whether a data-dependent screen rendered an honest error state while the API
 * is unreachable (rather than an empty state or a blank panel).
 *
 * Read-only: it navigates and measures. It never submits a form.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const WIDTHS = [320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1440, 1920];
const ROUTES = [
  '/', '/products', '/categories', '/search?q=phone', '/about', '/help', '/cart',
  '/wishlist', '/orders', '/customer/login', '/customer/register',
  '/admin/login', '/admin', '/delivery/login', '/delivery/dashboard',
  '/this-route-does-not-exist',
];
const SHOT_WIDTHS = [375, 1440];
/** Routes whose content depends on the API; sampled after retries exhaust. */
const DATA_ROUTES = ['/', '/products', '/orders'];
const OUT = path.resolve(__dirname, '../artifacts/product-experience/after');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const findings = [];
  const pageErrors = [];

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      hasTouch: width < 768,
      isMobile: width < 768,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push({ width, message: String(error).slice(0, 200) }));

    for (const route of ROUTES) {
      try {
        await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      } catch {
        // networkidle can time out while a failing request retries; the DOM is
        // still measurable, so carry on rather than dropping the route.
      }
      // The query retry policy takes ~13s to exhaust on a network failure;
      // sampling sooner reads an honest loading state as a missing error state.
      await page.waitForTimeout(DATA_ROUTES.includes(route) ? 14000 : 400);

      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflow = doc.scrollWidth - window.innerWidth;

        // Visible, genuinely interactive controls only.
        const selector = 'a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [role="button"], summary';
        const small = [];
        for (const el of document.querySelectorAll(selector)) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
          // Inline links inside a paragraph are exempt from the 44px rule;
          // WCAG 2.2 2.5.8 excludes targets in a sentence of text.
          const inSentence = !!el.closest('p, address, li.prose, .prose');
          if (inSentence && el.tagName === 'A') continue;
          if (rect.height < 24 || rect.width < 24) {
            small.push({
              tag: el.tagName.toLowerCase(),
              label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
              w: Math.round(rect.width), h: Math.round(rect.height),
            });
          }
        }

        // Elements physically wider than the viewport are the usual cause of
        // a horizontally scrolling page.
        const wide = [];
        if (overflow > 1) {
          for (const el of document.querySelectorAll('body *')) {
            const rect = el.getBoundingClientRect();
            if (rect.width > window.innerWidth + 1 && rect.height > 0) {
              wide.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 90),
                w: Math.round(rect.width),
              });
            }
          }
        }

        const text = document.body.innerText;
        return {
          overflow,
          small: small.slice(0, 6),
          wide: wide.slice(0, 4),
          // Evidence that a failed request is surfaced, not swallowed.
          hasErrorState: /could not be loaded|couldn’t reach|Try again|Retry|unavailable/i.test(text),
          hasFakeEmpty: /No orders yet|No products found|No deliveries assigned/i.test(text),
          title: document.title.slice(0, 80),
          h1Count: document.querySelectorAll('h1').length,
        };
      });

      findings.push({ width, route, ...result });

      if (SHOT_WIDTHS.includes(width)) {
        const name = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: false });
      }
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'responsive-audit.json'), JSON.stringify({ findings, pageErrors }, null, 2));

  const overflowing = findings.filter((f) => f.overflow > 1);
  const undersized = findings.filter((f) => f.small.length > 0);
  const multiH1 = findings.filter((f) => f.h1Count > 1);

  console.log(`checked ${findings.length} route×width combinations`);
  console.log(`\nHORIZONTAL OVERFLOW: ${overflowing.length}`);
  for (const f of overflowing) {
    console.log(`  ${f.width}px ${f.route} — +${f.overflow}px`, JSON.stringify(f.wide));
  }
  console.log(`\nTARGETS UNDER 24px: ${undersized.length}`);
  const seen = new Set();
  for (const f of undersized) {
    const key = JSON.stringify(f.small);
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${f.width}px ${f.route}`, JSON.stringify(f.small));
  }
  console.log(`\nMULTIPLE H1: ${multiH1.length}`);
  for (const f of [...new Map(multiH1.map((f) => [f.route, f])).values()]) {
    console.log(`  ${f.route} — ${f.h1Count} h1 elements`);
  }
  console.log(`\nPAGE ERRORS: ${pageErrors.length}`);
  for (const e of [...new Map(pageErrors.map((e) => [e.message, e])).values()].slice(0, 8)) {
    console.log(`  ${e.message}`);
  }
  const dataRoutes = findings.filter((f) => ['/', '/products', '/orders'].includes(f.route) && f.width === 375);
  console.log('\nAPI-DOWN HONESTY (375px):');
  for (const f of dataRoutes) {
    console.log(`  ${f.route} — error state shown: ${f.hasErrorState}, empty-state text: ${f.hasFakeEmpty}`);
  }
})();
