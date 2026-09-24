import { test, expect, type Page, type TestInfo } from '@playwright/test';

const origin = 'http://localhost:3100';
const api = 'http://localhost:4100/api/v1';
const password = 'PreviewOnly123';

async function signIn(page: Page, role = 'customer', redirect = '/orders') {
  const email = role === 'customer' ? 'preview@example.test' : `${role}-preview@example.test`;
  await page.goto(`/${role}/login?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${origin}${redirect}`, { timeout: 60000 });
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}
test.beforeAll(async ({ request }) => {
  const result = await request.get(`${api}/products/preview-galaxy-s25`);
  expect(result.ok(), 'Run the isolated preview server before browser tests.').toBe(true);
  expect((await result.json()).data.description).toContain('Isolated browser-test inventory');
});

test('planner includes delivery, saves a budget, and adds the exact quantities', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/planner');
  await page.getByRole('searchbox', { name: 'Search products for your plan' }).fill('Ikigai');
  const product = page.locator('.plan-product').filter({ has: page.getByRole('heading', { name: 'Ikigai', exact: true }) });
  await product.getByRole('button', { name: 'Add to plan' }).click();
  const basket = page.getByRole('complementary', { name: 'Your next basket' });
  await page.getByLabel('Your budget').fill('400');
  await expect(basket).toContainText('₹52 left in your budget');
  await basket.getByRole('button', { name: 'Increase quantity of Ikigai', exact: true }).click();
  await expect(basket).toContainText('₹247 over your budget');
  await page.reload();
  await expect(page.getByLabel('Your budget')).toHaveValue('400');
  await expect(basket).toContainText('₹247 over your budget');
  await basket.getByRole('button', { name: 'Decrease quantity of Ikigai', exact: true }).click();
  await basket.getByRole('button', { name: 'Add plan to cart' }).click();
  await expect(basket.getByRole('status')).toContainText('1 product added');
  await screenshot(page, info, 'planner');
  await basket.getByRole('link', { name: 'Review cart', exact: true }).click();
  await expect(page.getByLabel('Quantity 1', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('₹348');
  expect(errors).toEqual([]);
});

test('single sign-in returns to checkout, with support, delivery and a private receipt', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  const logins: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/auth/customer/login')) logins.push(req.url()); });
  await signIn(page, 'customer', '/cart');
  expect(logins).toHaveLength(1);
  expect((await page.request.delete(`${api}/cart`, { headers: { Origin: origin } })).ok()).toBe(true);
  await page.goto('/products/preview-galaxy-s25?option=PREVIEW-256');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('256 GB');
  await page.keyboard.press('Escape');
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await page.getByRole('radio', { name: /Cash on delivery/ }).check();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByLabel('House, building and street')).toHaveAttribute('aria-invalid', 'true');
  for (const [label, value] of [['Full name', 'Preview Customer'], ['Mobile number', '9876543210'], ['House, building and street', '12 Preview Street'], ['City', 'Kolkata'], ['State', 'West Bengal'], ['Pincode', '700001']]) await page.getByLabel(label, { exact: true }).fill(value);
  await screenshot(page, info, 'checkout');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/[a-f\d]{24}$/, { timeout: 30000 });
  const orderId = page.url().split('/').pop()!;
  const reason = `Browser QA ${info.project.name}: please confirm the delivery address.`;
  await page.getByRole('button', { name: 'Get order help' }).click();
  await page.getByLabel('Tell us what happened').fill(reason);
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Request received' })).toBeVisible();
  const saved = await page.request.get(`${api}/orders/${orderId}`);
  expect((await saved.json()).data.orderStatus).toBe('placed');

  const operatorContext = await browser.newContext({ viewport: page.viewportSize()!, reducedMotion: 'reduce' });
  const operator = await operatorContext.newPage();
  await signIn(operator, 'admin', '/admin/support');
  const row = operator.locator('article').filter({ hasText: reason });
  await row.getByRole('button', { name: 'Review & respond' }).click();
  await row.getByLabel('Message to the customer').fill('Your delivery address is recorded. We are reviewing your request.');
  await row.getByRole('button', { name: 'Save customer update' }).click();
  await expect(operator.getByText('Customer-visible update saved.')).toBeVisible();
  await screenshot(operator, info, 'admin-support');
  for (const status of ['confirmed', 'shipped', 'out_for_delivery', 'delivered']) {
    const updated = await operator.request.patch(`${api}/orders/${orderId}/status`, { headers: { Origin: origin }, data: { status } });
    expect(updated.status(), `Isolated order transition: ${status}`).toBe(200);
  }
  await page.reload();
  await expect(page.getByText('Your delivery address is recorded. We are reviewing your request.')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download receipt' }).click();
  const receipt = await download;
  expect(receipt.suggestedFilename()).toMatch(/\.pdf$/);
  await receipt.saveAs(info.outputPath('private-receipt.pdf'));
  await page.getByRole('button', { name: 'Request a return' }).click();
  await page.getByLabel('Tell us what happened').fill('Browser QA: the received product has a damaged edge.');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Request received' })).toBeVisible();
  await screenshot(page, info, 'order-support');
  await operatorContext.close();
  expect(errors).toEqual([]);
});

test('seller prepares a real package and sees its shipment and complete destination', async ({ page, request }, info) => {
  test.setTimeout(180000);
  const login = await request.post(`${api}/auth/customer/login`, { headers: { Origin: origin }, data: { email: 'preview@example.test', password } });
  expect(login.status()).toBe(200);
  const product = (await (await request.get(`${api}/products/preview-galaxy-s25`)).json()).data;
  const sellerLogin = await request.post(`${api}/auth/seller/login`, { headers: { Origin: origin }, data: { email: 'seller-preview@example.test', password } });
  expect(sellerLogin.status()).toBe(200);
  const listings = (await (await request.get(`${api}/seller/listings`)).json()).data;
  const listing = listings[0];
  const placed = await request.post(`${api}/orders`, { headers: { Origin: origin }, data: { checkoutId: crypto.randomUUID(), paymentMethod: 'cod', expectedTotal: 49000, items: [{ product: product._id, variant: 'PREVIEW-256', listing: listing.id || listing._id, quantity: 1, expectedPrice: 49000 }], shippingAddress: { fullName: 'Preview Customer', phone: '9876543210', addressLine1: '12 Preview Street', city: 'Kolkata', state: 'West Bengal', pincode: '700001' } } });
  expect(placed.status()).toBe(201);
  const id = (await placed.json()).data.orderId;
  const order = (await (await request.get(`${api}/orders/${id}`)).json()).data;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page, 'seller', '/seller/dashboard');
  await expect(page.getByRole('heading', { name: 'Preview Electronics', exact: true })).toBeVisible();
  await screenshot(page, info, 'seller-dashboard');
  await page.getByRole('link', { name: order.orderId, exact: true }).click();
  for (const name of ['Confirm', 'Start processing', 'Ready for pickup']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Create shipment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipment Details' })).toBeVisible();
  await expect(page.getByText('Preview Customer', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('700001');
  await screenshot(page, info, 'seller-shipment');
  expect(errors).toEqual([]);
});
