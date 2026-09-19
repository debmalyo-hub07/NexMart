import { test, expect, type Page } from '@playwright/test';

const api = 'http://localhost:4100/api/v1';
async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
test.beforeAll(async ({ request }) => {
  const response = await request.get(`${api}/products/preview-galaxy-s25`);
  expect(response.ok(), 'Start the disposable previewStorefront.ts server first.').toBe(true);
  expect((await response.json()).data.description).toContain('Isolated browser-test inventory');
});

test('home and visual category directory render useful real catalog data', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What are you into?' })).toBeVisible();
  await expect(page.locator('.home-category')).toHaveCount(9);
  await expect(page.locator('.product-tile').first()).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
  await page.goto('/categories');
  await expect(page.locator('.category-directory-card')).toHaveCount(9);
  await page.getByRole('searchbox', { name: 'Find a department' }).fill('books');
  await expect(page.locator('.category-directory-card')).toHaveCount(1);
  await expect(page.locator('.category-directory-card').getByRole('heading', { level: 2 })).toContainText('Books');
  await page.getByRole('searchbox', { name: 'Find a department' }).fill('');
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('categories.png'), fullPage: true });
});

test('keyboard autocomplete tolerates a typo and preserves the chosen price option', async ({ page }, info) => {
  await page.goto('/products');
  const input = page.locator('input[role="combobox"]:visible');
  await input.fill('samsng s25');
  const suggestions = page.getByRole('listbox', { name: 'Search suggestions' });
  await expect(suggestions.getByRole('option', { name: /Preview · Samsung Galaxy S25/ })).toBeVisible();
  await expect(page.getByText('No exact matches. Here are some close suggestions.')).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/products\/preview-galaxy-s25\?option=PREVIEW-256/);
  await expect(page.getByRole('radio', { name: /256 GB/ })).toBeChecked();
  await page.getByRole('radio', { name: /512 GB/ }).check();
  await expect(page).toHaveURL(/option=PREVIEW-512/);
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('product.png'), fullPage: true });
});

test('URL filters, price sorting, history and mobile apply stay consistent', async ({ page }, info) => {
  await page.goto('/products?category=mobiles&brand=Samsung&minPrice=49000&inStock=true');
  await expect(page.locator('.product-tile')).toHaveCount(1);
  await expect(page.locator('.product-tile')).toContainText('50,000');
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.getByRole('button', { name: /^Filters/ }).click();
  const filterScope = mobile ? page.getByRole('dialog', { name: 'Refine your find' }) : page.getByRole('complementary', { name: 'Catalog filters' });
  await filterScope.getByRole('checkbox', { name: 'Available to buy' }).uncheck();
  if (mobile) {
    await expect(page).toHaveURL(/inStock=true/);
    await filterScope.getByRole('button', { name: 'Apply filters' }).click();
    await expect(filterScope).not.toBeVisible();
  }
  await expect(page).not.toHaveURL(/inStock=true/);
  await page.goBack();
  await expect(page).toHaveURL(/inStock=true/);
  await expect(page.locator('.product-tile')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Sort products' }).click();
  await page.getByRole('option', { name: 'Price: high to low' }).click();
  await expect(page).toHaveURL(/sort=-price/);
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('filtered-catalog.png'), fullPage: true });
});

test('quick look, comparison and sample restrictions work by keyboard', async ({ page }, info) => {
  await page.goto('/categories/books');
  await expect(page.locator('.product-tile').first()).toBeVisible();
  const quick = page.getByRole('button', { name: /^Quick look at/ }).first();
  await quick.focus(); await quick.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'A closer look' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Sample product · illustrative price · not for sale')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add to cart', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(quick).toBeFocused();
  await page.locator('.product-tile').nth(0).getByRole('checkbox', { name: /^Compare/ }).check();
  await page.locator('.product-tile').nth(1).getByRole('checkbox', { name: /^Compare/ }).check();
  await page.getByRole('complementary', { name: 'Product comparison' }).getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Find your better fit' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Sample · not for sale');
  await page.screenshot({ path: info.outputPath('comparison.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear comparison' }).click();
  await page.locator('.product-tile').first().getByRole('link', { name: 'View details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sample · not for sale', exact: true })).toBeDisabled();
  await noPageOverflow(page);
});

test('guest cart maintains option, price and quantity without a checkout', async ({ page }, info) => {
  await page.goto('/products/preview-galaxy-s25?option=PREVIEW-512');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('512 GB');
  await expect(page.getByRole('dialog')).toContainText('62,000');
  await page.keyboard.press('Escape');
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your shopping cart' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue to checkout' })).toBeVisible();
  await page.getByRole('button', { name: /^Increase quantity/ }).click();
  await expect(page.getByLabel('Quantity 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Increase quantity/ })).toBeDisabled();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('cart.png'), fullPage: true });
  await page.getByRole('button', { name: /^Remove .* from cart$/ }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('help, legal drafts and customer sign-in are reachable and responsive', async ({ page }, info) => {
  for (const path of ['/terms', '/privacy', '/shipping', '/returns', '/contact']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Draft · pending business approval')).toBeVisible();
    await noPageOverflow(page);
  }
  await page.screenshot({ path: info.outputPath('contact.png'), fullPage: true });
  await page.goto('/help');
  await page.getByRole('searchbox', { name: 'Search shopping help' }).fill('interrupted');
  await page.getByText('What if an online payment is interrupted?', { exact: true }).click();
  await expect(page.getByText(/Check your order’s payment status before retrying/)).toBeVisible();
  await page.goto('/customer/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy notice' })).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('login.png'), fullPage: true });
});

test('public seller profiles do not redirect visitors into the seller portal', async ({ page }) => {
  const response = await page.goto('/sellers/000000000000000000000000');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/sellers\/000000000000000000000000$/);
});
