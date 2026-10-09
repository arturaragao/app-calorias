// scripts/auditar_a11y.mjs — auditoria de acessibilidade (só desenvolvimento): todo controle com nome acessível
// (TalkBack lê) e alvos de toque ≥ 44 px (meta 48). Telas principais e as folhas mais usadas, com dados simulados.
// Uso: node scripts/auditar_a11y.mjs   (código 1 se houver controle sem nome ou alvo < 44 px)

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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

function auditar(onde) {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && !e.closest('[hidden]'); };
  const nome = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'))?.textContent
    || e.title || (e.labels && [...e.labels].map((l) => l.textContent).join(' ')) || e.textContent || e.placeholder || e.value || '').trim();
  const out = { semNome: [], pequenos: [], medios: 0, total: 0 };
  const raiz = document.querySelector('#folha:not([hidden]) .painel') || document.body;
  for (const e of raiz.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea')) {
    if (!vis(e) && !(e.matches('input[type=file]'))) continue;
    if (e.matches('input[type=file]')) continue;                      // dentro de <label class="btn">, o rótulo é o alvo
    out.total++;
    const alvo = e.matches('input[type=checkbox]') ? (e.closest('label') || e) : e;
    if (!nome(e) && !(e.matches('input[type=checkbox]') && e.closest('label')?.textContent.trim())) out.semNome.push(`${onde}: ${e.outerHTML.slice(0, 90)}`);
    const r = alvo.getBoundingClientRect();
    const dentroDeTexto = e.matches('a') && e.closest('p, li span');
    if (dentroDeTexto) continue;
    // área de toque ampliada por ::before (inset negativo) conta como alvo
    const b = getComputedStyle(e, '::before');
    const ext = b.content !== 'none' && b.position === 'absolute' ? { v: -parseFloat(b.top) - parseFloat(b.bottom), h: -parseFloat(b.left) - parseFloat(b.right) } : { v: 0, h: 0 };
    if (getComputedStyle(e).display === 'inline') continue;          // link no meio do texto (isento na WCAG)
    const m = Math.min(r.width + (ext.h || 0), r.height + (ext.v || 0));
    if (m < 44) out.pequenos.push(`${onde}: ${Math.round(r.width)}×${Math.round(r.height)} ${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${nome(e).slice(0, 30)}"`);
    else if (m < 48) out.medios++;
  }
  return out;
}

let nav;
for (const channel of ['msedge', 'chrome']) { try { nav = await chromium.launch({ channel }); break; } catch {} }
const p = await (await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' })).newPage();
await p.goto(URL_APP); await p.waitForSelector('#tela');
await p.evaluate(async () => { const m = await import('./tests/semente.js'); await m.semear(); });
const res = { semNome: [], pequenos: [], medios: 0, total: 0 };
const juntar = (r) => { res.semNome.push(...r.semNome); res.pequenos.push(...r.pequenos); res.medios += r.medios; res.total += r.total; };
for (const tela of ['diario', 'adicionar', 'registros', 'progresso', 'config', 'plano', 'metas']) {
  await p.goto(URL_APP + '#' + tela); await p.reload(); await p.waitForTimeout(1200);
  juntar(await p.evaluate(auditar, tela));
}
// folhas mais usadas
const folhas = [
  ['acoes', async () => { await p.goto(URL_APP + '#diario'); await p.waitForTimeout(800); await p.evaluate(async () => (await import('./js/views/acoes.js')).folhaAcoes()); }],
  ['quantidade', async () => { await p.goto(URL_APP + '#adicionar'); await p.waitForTimeout(900); await p.fill('#q', 'banana'); await p.waitForTimeout(300); await p.click('#res [data-id]'); }],
  ['frase', async () => { await p.goto(URL_APP + '#adicionar'); await p.waitForTimeout(900); await p.click('[data-texto-ia]'); await p.fill('[name=txt]', '2 ovos e 1 pão francês'); }],
  ['menu-refeicao', async () => { await p.goto(URL_APP + '#diario'); await p.waitForTimeout(900); await p.click('section[data-ref="almoco"] [data-menu]'); }],
  ['detalhes', async () => { await p.goto(URL_APP + '#diario'); await p.waitForTimeout(900); await p.click('.heroi-pag[data-pag="0"]'); }],
];
for (const [nomeF, abrir] of folhas) { await abrir(); await p.waitForTimeout(800); juntar(await p.evaluate(auditar, nomeF)); await p.keyboard.press('Escape'); }
await nav.close(); servidor.close();
console.log(`${res.total} controles auditados · sem nome: ${res.semNome.length} · alvo < 44 px: ${res.pequenos.length} · 44–47 px: ${res.medios}`);
for (const x of [...new Set(res.semNome)]) console.log('  SEM NOME', x);
for (const x of [...new Set(res.pequenos)]) console.log('  PEQUENO ', x);
process.exitCode = res.semNome.length || res.pequenos.length ? 1 : 0;
