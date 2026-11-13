import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fixture, command, entry, treeText } from '../helpers.mjs';
import { createStudio } from '../../studio/server.mjs';

let f, studio, server, publicUrl;
const build = () => command(f.root, 'npm', ['run', 'build'], { SITE_URL: 'https://example.invalid', BASE_PATH: '/journal' });
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  f = await fixture();
  studio = await createStudio({ root: f.root, port: 0, publisherOptions: { build } });
  await build();
  server = http.createServer(async (req, res) => {
    try {
      let route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!route.startsWith('/journal/')) { res.writeHead(404).end(); return; }
      route = route.slice('/journal/'.length);
      const file = path.join(f.root, 'dist', route.endsWith('/') || !route ? `${route}index.html` : route);
      if (!file.startsWith(path.join(f.root, 'dist') + '/')) { res.writeHead(403).end(); return; }
      const data = await fs.readFile(file);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); publicUrl = `http://127.0.0.1:${server.address().port}/journal/`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (studio) await new Promise(resolve => studio.server.close(resolve)); if (f) await f.cleanup(); });

test('empty public site: five routes, responsive layout, keyboard navigation, accessibility and reduced motion', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['', 'writing/', 'projects/', 'about/', 'contact/']) {
      const response = await page.goto(publicUrl + route); expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(publicUrl);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Writing', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Tab');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.diagram').evaluate(node => getComputedStyle(node).transform)).toBe('none');
  await page.screenshot({ path: path.join(f.temp, 'empty-mobile.png'), fullPage: true });
});

test('studio: create, autosave, reopen, preview, upload, dates, publish and revise without changing public source', async ({ page }) => {
  await page.goto(studio.url);
  await page.getByRole('button', { name: '+ New article' }).click();
  await page.locator('[data-key="title"]').fill('Temporary browser fixture');
  await page.locator('[data-key="slug"]').fill('browser-fixture');
  await page.locator('[data-key="category"]').selectOption('Technology');
  await page.locator('[data-key="body"]').fill('## Temporary heading\n\nThis is temporary browser test content.\n\n**Bold text** and a [link](/about/).');
  await page.getByText('Dates', { exact: true }).click();
  await page.locator('[data-key="displayDate"]').fill('2001-01-01');
  await page.locator('[data-key="writtenAt"]').fill('2000-12-31');
  await page.getByRole('button', { name: 'Choose image' }).click();
  const image = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#925039' } }).png().toBuffer();
  await page.locator('#media-upload').setInputFiles({ name: 'temporary-portrait.png', mimeType: 'image/png', buffer: image });
  await page.getByText('Saved privately. Choose the image below.').waitFor();
  await page.locator('[data-choose-media]').first().click();
  await page.locator('[data-key="coverAlt"]').fill('Temporary image for an isolated browser test');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Draft saved privately on this Mac');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await expect(page.frameLocator('#live-preview').getByRole('heading', { name: 'Temporary browser fixture', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-key="title"]')).toHaveValue('Temporary browser fixture');
  expect((await studio.store.list('writing'))[0].published).toBe(false);
  expect(await treeText(path.join(f.root, 'dist'))).not.toContain('Temporary browser fixture');
  await page.getByRole('button', { name: 'Publish article' }).click();
  await expect(page.locator('#notice')).toContainText('Pushed to GitHub', { timeout: 30000 });
  const raw = await studio.store.raw('writing', (await studio.store.list('writing'))[0].id);
  expect(raw).toContain('2001-01-01'); expect(raw).not.toContain('firstPublishedAt');
  const publicPage = await page.context().newPage();
  await publicPage.goto(`${publicUrl}writing/browser-fixture/`);
  await expect(publicPage.getByRole('heading', { name: 'Temporary browser fixture', exact: true })).toBeVisible();
  await expect(publicPage.locator('time')).toHaveText('January 1, 2001');
  expect(await publicPage.locator('img').first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(publicPage.locator('.prose a')).toHaveAttribute('href', '/journal/about/');
  expect((await new AxeBuilder({ page: publicPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.locator('[data-key="body"]').fill('PRIVATE_BROWSER_REVISION_CANARY');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Draft saved privately on this Mac');
  expect(await studio.store.raw('writing', (await studio.store.list('writing'))[0].id)).toBe(raw);
  await publicPage.reload(); await expect(publicPage.locator('.prose')).not.toContainText('PRIVATE_BROWSER_REVISION_CANARY');
  await publicPage.close();
});

test('studio homepage, manual features, portrait, projects, About and Contact all publish separately', async ({ page }) => {
  await page.goto(studio.url);
  await page.locator('[data-nav="home"]').click();
  await page.locator('[data-key="mode"]').selectOption('introduction');
  await page.locator('[data-key="intro"]').fill('Temporary authored introduction for browser testing.');
  await page.locator('[data-key="quote"]').fill('PRIVATE_HIDDEN_QUOTE_CANARY');
  await page.getByRole('button', { name: 'Choose image' }).click(); await page.locator('[data-choose-media]').first().click();
  await page.locator('[data-key="portraitAlt"]').fill('Temporary portrait fixture');
  await page.locator('[data-feature="featuredWriting"]').check();
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.locator('#notice')).toContainText('Pushed to GitHub', { timeout: 30000 });
  const publicPage = await page.context().newPage(); await publicPage.goto(publicUrl);
  await expect(publicPage.locator('.hero-intro')).toContainText('Temporary authored introduction');
  await expect(publicPage.getByRole('heading', { name: 'Temporary browser fixture', exact: true })).toBeVisible();
  expect(await publicPage.locator('.portrait').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await treeText(path.join(f.root, 'dist'))).not.toMatch(/PRIVATE_HIDDEN_QUOTE|PRIVATE_BROWSER_REVISION/);
  await page.locator('[data-nav="projects"]').click(); await page.getByRole('button', { name: '+ New project' }).click();
  await page.locator('[data-key="title"]').fill('Temporary project fixture'); await page.locator('[data-key="slug"]').fill('project-fixture'); await page.locator('[data-key="body"]').fill('Temporary project test body.');
  await page.getByRole('button', { name: 'Publish project' }).click(); await expect(page.locator('#notice')).toContainText('Pushed to GitHub', { timeout: 30000 });
  await page.locator('[data-nav="about"]').click(); await page.locator('[data-key="body"]').fill('## Temporary About fixture\n\nTemporary test text.');
  await page.getByRole('button', { name: 'Publish changes' }).click(); await expect(page.locator('#notice')).toContainText('Pushed to GitHub', { timeout: 30000 });
  await page.locator('[data-nav="contact"]').click(); await page.locator('[data-key="email"]').fill('browser-test@example.invalid');
  await page.getByRole('button', { name: '+ Add link' }).click(); await page.locator('[data-key="links.0.label"]').fill('Temporary link'); await page.locator('[data-key="links.0.url"]').fill('https://example.invalid/');
  await page.getByRole('button', { name: 'Publish changes' }).click(); await expect(page.locator('#notice')).toContainText('Pushed to GitHub', { timeout: 30000 });
  await publicPage.goto(`${publicUrl}contact/`); await expect(publicPage.getByRole('link', { name: /Email/ })).toHaveAttribute('href', 'mailto:browser-test@example.invalid');
  await publicPage.goto(`${publicUrl}about/`); await expect(publicPage.getByRole('heading', { name: 'Temporary About fixture' })).toBeVisible();
  await publicPage.goto(`${publicUrl}projects/`); await expect(publicPage.getByRole('heading', { name: /Temporary project fixture/ })).toBeVisible();
  await publicPage.close();
});

test('populated archive: search, category, real date sorting, keyboard, mobile and studio accessibility', async ({ page }) => {
  const item = await studio.store.save('writing', 'older-fixture', entry({ title: 'Older football fixture', slug: 'older-football', category: 'Football', displayDate: '1990-02-01', body: 'Temporary searchable phrase for archive filtering.' }), 0);
  await studio.publisher.publish('writing', item.id, item.version);
  await page.goto(`${publicUrl}writing/`);
  await expect(page.locator('[data-entry]:visible').first()).toContainText('Temporary browser fixture');
  await page.getByLabel('Sort articles').selectOption('oldest');
  await expect(page.locator('[data-entry]:visible').first()).toContainText('Older football fixture');
  await page.getByRole('button', { name: 'Football', exact: true }).click(); await expect(page.locator('[data-entry]:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'All', exact: true }).click(); await page.getByRole('searchbox').fill('searchable phrase'); await expect(page.locator('[data-entry]:visible')).toHaveCount(1);
  await page.getByRole('searchbox').fill('not found'); await expect(page.locator('#empty')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${publicUrl}writing/browser-fixture/`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(studio.url);
  await expect(page.getByRole('heading', { name: 'Your words, at home.' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});
