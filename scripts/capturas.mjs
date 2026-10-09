// scripts/capturas.mjs — capturas das 5 telas principais (só desenvolvimento).
// Uso: node scripts/capturas.mjs <rótulo>   → capturas/<rótulo>/<tela>-<tema>.png (390 px, claro e escuro, página inteira)
// Usa o Edge/Chrome instalado (playwright-core, sem baixar navegador) e os dados de tests/semente.js.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const ROTULO = process.argv[2] || 'atual';
const TELAS = ['diario', 'adicionar', 'registros', 'progresso', 'config'];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// ---------- servidor estático temporário ----------
const servidor = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = normalize(join(RAIZ, p));
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  try { res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream' }); res.end(await readFile(arq)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => servidor.listen(0, ok));
const URL_APP = `http://localhost:${servidor.address().port}/`;

// ---------- navegador ----------
async function abrirNavegador() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel }); } catch {}
  }
  throw new Error('Edge/Chrome não encontrado');
}
const nav = await abrirNavegador();
const saida = join(RAIZ, 'capturas', ROTULO);
await mkdir(saida, { recursive: true });
const erros = [];

for (const tema of ['escuro', 'claro']) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: tema === 'escuro' ? 'dark' : 'light',
    serviceWorkers: 'block', locale: 'pt-BR', reducedMotion: 'reduce' });
  const pag = await ctx.newPage();
  pag.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  pag.on('console', (m) => { if (m.type() === 'error') erros.push(`${tema}: ${m.text()}`); });
  await pag.goto(URL_APP);
  await pag.waitForSelector('#tela');
  await pag.evaluate(async () => { const m = await import('./tests/semente.js'); await m.semear(); });
  for (const tela of TELAS) {
    await pag.goto(URL_APP + '#' + tela);
    await pag.reload();
    await pag.waitForTimeout(900);
    // viewport da altura da página: a barra inferior fixa fica no fim, e não no meio da captura
    await pag.setViewportSize({ width: 390, height: 844 });
    const h = await pag.evaluate(() => document.documentElement.scrollHeight);
    await pag.setViewportSize({ width: 390, height: Math.max(844, h) });
    await pag.waitForTimeout(150);
    await pag.screenshot({ path: join(saida, `${tela}-${tema}.png`) });
    await pag.setViewportSize({ width: 390, height: 844 });
  }
  await ctx.close();
}
await nav.close();
servidor.close();
console.log(`capturas em ${saida}`);
if (erros.length) { console.log('erros no console:'); for (const e of [...new Set(erros)]) console.log(' -', e); process.exitCode = 1; }
