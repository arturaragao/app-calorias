// scripts/auditar_contraste.mjs — auditoria WCAG AA no navegador (só desenvolvimento).
// Para cada tema × paleta × tela: todo texto visível contra o fundo efetivo (mistura das camadas com transparência).
// Uso: node scripts/auditar_contraste.mjs   (sai com código 1 se achar texto abaixo de 4,5:1 — 3:1 para texto grande)

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETAS } from '../js/cores.js';

const RAIZ = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const TELAS = ['diario', 'adicionar', 'registros', 'progresso', 'config', 'metas'];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const servidor = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = normalize(join(RAIZ, p));
  try { res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream' }); res.end(await readFile(arq)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => servidor.listen(0, ok));
const URL_APP = `http://localhost:${servidor.address().port}/`;

// roda dentro da página: devolve os textos reprovados
function auditar() {
  const lerCor = (s) => {
    let m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
    m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] == null ? 1 : +m[4]];
    return [0, 0, 0, 0];
  };
  const sobre = (c, f) => [0, 1, 2].map((i) => c[i] * c[3] + f[i] * (1 - c[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fundo = (el) => {
    const camadas = [];
    for (let e = el; e; e = e.parentElement) { const c = lerCor(getComputedStyle(e).backgroundColor); if (c[3] > 0) { camadas.push(c); if (c[3] >= 1) break; } }
    let f = lerCor(getComputedStyle(document.body).backgroundColor);
    for (const c of camadas.reverse()) f = sobre(c, f);
    return f;
  };
  const ruins = [];
  const vistos = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || vistos.has(el) || el.closest('[hidden],svg,#impressao,option,select,:disabled,[aria-disabled=true]')) continue;
    vistos.add(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const bg = fundo(el);
    const cor = sobre(lerCor(cs.color), bg);
    const px = parseFloat(cs.fontSize), negrito = +cs.fontWeight >= 700;
    const minimo = px >= 24 || (px >= 18.66 && negrito) ? 3 : 4.5;
    const k = razao(cor, bg);
    if (k < minimo) ruins.push(`${k.toFixed(2)} < ${minimo} "${n.textContent.trim().slice(0, 40)}" (${el.className || el.tagName})`);
  }
  return ruins;
}

let nav;
for (const channel of ['msedge', 'chrome']) { try { nav = await chromium.launch({ channel }); break; } catch {} }
const falhas = [];
let verificados = 0;
for (const tema of ['escuro', 'claro']) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, colorScheme: tema === 'escuro' ? 'dark' : 'light', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const pag = await ctx.newPage();
  await pag.goto(URL_APP);
  await pag.waitForSelector('#tela');
  await pag.evaluate(async () => { const m = await import('./tests/semente.js'); await m.semear(); });
  for (const [nomePal, cor] of PALETAS) {
    await pag.goto(URL_APP + '#config'); await pag.reload(); await pag.waitForTimeout(500);
    await pag.click(`[data-paleta="${cor}"]`); await pag.waitForTimeout(200);
    for (const tela of TELAS) {
      await pag.goto(URL_APP + '#' + tela); await pag.waitForTimeout(500);
      if (process.env.TESTE_AUDITORIA) await pag.evaluate(() => document.querySelector('#tela').insertAdjacentHTML('afterbegin', '<p style="color:#888;background:#999">teste ruim</p>'));
      for (const f of await pag.evaluate(auditar)) falhas.push(`${tema} · ${nomePal} · ${tela}: ${f}`);
      verificados++;
    }
  }
  await ctx.close();
}
await nav.close(); servidor.close();
console.log(`${verificados} telas auditadas (2 temas × ${PALETAS.length} paletas × ${TELAS.length} telas)`);
if (falhas.length) { console.log([...new Set(falhas)].join('\n')); process.exitCode = 1; } else console.log('Contraste AA: nenhum texto reprovado.');
