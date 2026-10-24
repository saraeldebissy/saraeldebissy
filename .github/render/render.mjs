// Fills template.html with the numbers from stats.json and screenshots the
// result to assets/dash_mega.png.

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const here = (p) => new URL(p, import.meta.url);

const stats = JSON.parse(await readFile(here('./stats.json'), 'utf8'));
let html = await readFile(here('./template.html'), 'utf8');

const pad = (n) => String(n).padStart(2, '0');

const waveform = stats.waveform
  .map((b) => `<i class="${b.on ? 'on' : ''}" style="height:${b.height}%"></i>`)
  .join('');

html = html
  .replaceAll('{{CURRENT}}', pad(stats.current))
  .replaceAll('{{LONGEST}}', pad(stats.longest))
  .replaceAll('{{REPOS}}', stats.repos)
  .replaceAll('{{STARS}}', stats.stars)
  .replaceAll('{{WAVEFORM}}', waveform);

const filled = here('./filled.html');
await writeFile(filled, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
await page.goto(filled.href);

const height = await page.evaluate(() => document.querySelector('.page').scrollHeight);
await page.setViewportSize({ width: 1200, height });
await page.screenshot({ path: here('../../assets/dash_mega.png').pathname, fullPage: true });

await browser.close();
console.log(`Rendered ${height}px — streak ${stats.current}, record ${stats.longest}`);
