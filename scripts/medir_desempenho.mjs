// scripts/medir_desempenho.mjs — orçamento de desempenho (só desenvolvimento): JS carregado para abrir o Diário
// (bruto e gzip, como o GitHub Pages entrega), tempo até o Diário pronto (CPU 4× mais lenta) e tempo da busca.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const servidor = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { res.writeHead(200, { 'content-type': TIPOS[extname(p)] || 'application/octet-stream' }); res.end(await readFile(normalize(join(RAIZ, p)))); } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => servidor.listen(0, ok));
const URL_APP = `http://localhost:${servidor.address().port}/`;
let nav;
for (const channel of ['msedge', 'chrome']) { try { nav = await chromium.launch({ channel }); break; } catch {} }
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const p = await ctx.newPage();
await p.goto(URL_APP); await p.waitForSelector('#tela');
await p.evaluate(async () => { const m = await import('./tests/semente.js'); await m.semear(); });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const t0 = Date.now();
await p.reload(); await p.waitForSelector('.heroi .anel'); 
const pronto = Date.now() - t0;
await p.waitForTimeout(1500);
const js = await p.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.js')).map((r) => new URL(r.name).pathname.slice(1)));
let bruto = 0, gz = 0;
const tamanhos = [];
for (const f of js) { const b = await readFile(join(RAIZ, f)); bruto += b.length; gz += gzipSync(b).length; tamanhos.push([f, b.length]); }
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const busca = await p.evaluate(async () => {
  const { catalogo } = await import('./js/custom.js'); const { buscar } = await import('./js/foods.js');
  const cat = await catalogo(); const out = {};
  for (const q of ['arroz', 'fejao', 'frango grelhado', 'brocolis cozdo', 'aipim']) { const t = performance.now(); for (let i = 0; i < 20; i++) buscar(cat.indice, q, { limite: 500, sinonimos: cat.porcoes?.sinonimos }); out[q] = +((performance.now() - t) / 20).toFixed(1); }
  const t = performance.now(); const { criarIndice } = await import('./js/foods.js'); criarIndice(cat.base.foods); out.indice = +(performance.now() - t).toFixed(1);
  return out;
});
await nav.close(); servidor.close();
console.log(`Diário pronto (CPU 4× mais lenta): ${pronto} ms`);
console.log(`JS carregado ao abrir: ${js.length} arquivos · ${(bruto / 1024).toFixed(0)} KB bruto · ${(gz / 1024).toFixed(0)} KB gzip (orçamento 120 KB)`);
console.log('maiores:', tamanhos.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `${f} ${(n / 1024).toFixed(0)}K`).join(', '));
console.log('busca (ms por consulta, CPU normal):', JSON.stringify(busca));
