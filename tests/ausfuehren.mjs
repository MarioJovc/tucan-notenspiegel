// Führt Renderer- und Live-Tests ohne Fenster aus (für den Workflow und die Kommandozeile).
//
//   npm install --no-save playwright && npx playwright install chromium
//   node tests/ausfuehren.mjs
//
// Voraussetzung: dist/tucan-skin.user.js ist gebaut (build.ps1). Das Skript startet
// einen kleinen Webserver auf dem Projektordner, öffnet tests/index.html und
// tests/live.html in Chromium und wartet auf deren Ergebnis. Zusätzlich gilt: Keine
// Anfrage darf den lokalen Server verlassen — das Userscript lädt nichts von außen.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, path);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('kein Datei');
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const seiten = [
  { pfad: 'tests/index.html', ergebnis: '__testResult', name: 'Renderer-Tests' },
  { pfad: 'tests/live.html', ergebnis: '__liveResult', name: 'Live-Tests' },
];

const browser = await chromium.launch();
let fehler = 0;
try {
  for (const seite of seiten) {
    const page = await browser.newPage();
    const fremd = [];
    const ausnahmen = [];
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('about:')) fremd.push(u); });
    page.on('websocket', (w) => fremd.push(w.url()));
    page.on('pageerror', (e) => ausnahmen.push(String(e)));
    await page.goto(base + seite.pfad);
    const ergebnis = await page.waitForFunction((k) => window[k], seite.ergebnis, { timeout: 60_000 }).then((h) => h.jsonValue());
    const zusammenfassung = (await page.locator('#summary').textContent())?.trim();
    const ok = ergebnis.failed === 0 && fremd.length === 0 && ausnahmen.length === 0;
    console.log(`${ok ? 'OK  ' : 'FEHL'} ${seite.name}: ${zusammenfassung}`);
    for (const u of fremd) console.log(`     Anfrage nach außen: ${u}`);
    for (const a of ausnahmen) console.log(`     Ausnahme: ${a}`);
    if (!ok) {
      fehler++;
      const zeilen = ergebnis.rows ?? ergebnis.results ?? [];
      for (const z of zeilen) if ((z.problems ?? []).length) console.log(`     ${z.name}: ${z.problems.join('; ')}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(fehler ? 1 : 0);
