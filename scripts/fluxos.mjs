// scripts/fluxos.mjs — testes de fluxo de ponta a ponta (só desenvolvimento), no Edge/Chrome instalado:
// onboarding → lançar → editar → apagar e desfazer → backup → restaurar. Uso: node scripts/fluxos.mjs  (código 1 se algo falhar)

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const servidor = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { res.writeHead(200, { 'content-type': TIPOS[extname(p)] || 'application/octet-stream' }); res.end(await readFile(normalize(join(RAIZ, p)))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => servidor.listen(0, ok));
const URL_APP = `http://localhost:${servidor.address().port}/`;

let nav;
for (const channel of ['msedge', 'chrome']) { try { nav = await chromium.launch({ channel }); break; } catch {} }
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true, reducedMotion: 'reduce' });
ctx.setDefaultTimeout(8000);
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
const falhas = [];
const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓', nome); } catch (e) {
    falhas.push(nome); console.log('  ✗', nome, '—', e.message.split('\n')[0]);
    await p.screenshot({ path: join(RAIZ, 'capturas', `falha-${falhas.length}.png`) }).catch(() => {});
  }
};
const espera = (ms) => p.waitForTimeout(ms);
const itensAlmoco = () => p.locator('section[data-ref="almoco"] .item').count();

await p.goto(URL_APP);
await p.waitForSelector('#tela');

await passo('Onboarding 2.0: 7 perguntas → meta e projeção', async () => {
  await p.click('[data-proximo]');                                                  // Começar
  await p.click('[data-v="sexo:M"]'); await p.click('[data-proximo]');
  await p.fill('[name=idade]', '30'); await p.click('[data-proximo]');
  await p.fill('[name=altura]', '180'); await p.click('[data-proximo]');
  await p.fill('[name=peso]', '84'); await p.click('[data-proximo]');
  await p.click('[data-v="atividade:moderado"]'); await p.click('[data-proximo]');
  await p.click('[data-v="objetivo:perder"]'); await p.click('[data-proximo]');
  await p.click('[data-v="ritmo:0.5"]'); await p.fill('[name=alvo]', '78'); await p.click('[data-proximo]');
  const meta = await p.textContent('.bv-meta b');
  if (meta.replace(/\D/g, '') !== '2271') throw new Error('meta esperada 2.271 kcal (TMB 1.820 × 1,55 − 550), veio ' + meta);
  if (!(await p.locator('svg.proj').count())) throw new Error('sem projeção');
  await p.click('[data-proximo]');
  await p.waitForSelector('.heroi');
  // tour de primeiro uso (abre logo depois do onboarding): pular
  await p.click('#folha button:has-text("Pular")', { timeout: 4000 }).catch(() => {});
  await espera(500);
});

await passo('Lançar: + do almoço → busca → teclado próprio → Adicionar', async () => {
  await p.click('.ref-vazia[data-ref="almoco"] [data-add]').catch(() => p.click('section[data-ref="almoco"] [data-add]'));
  await p.fill('#q', 'arroz tipo 1 cozido'); await espera(300);
  await p.click('#res [data-id]');
  await p.waitForSelector('.teclado');
  for (const k of ['1', '5', '0']) await p.click(`[data-tecla="${k}"]`);
  await p.click('[data-ok]'); await espera(400);
  await p.goto(URL_APP + '#diario'); await espera(700);
  if ((await itensAlmoco()) !== 1) throw new Error('item não apareceu no almoço');
  if (!/150 g/.test(await p.textContent('section[data-ref="almoco"] .item'))) throw new Error('quantidade errada');
});

await passo('Editar: 150 g → 200 g', async () => {
  await p.click('section[data-ref="almoco"] [data-editar]');
  await p.waitForSelector('.teclado');
  for (const k of ['2', '0', '0']) await p.click(`[data-tecla="${k}"]`);
  await p.click('[data-ok]'); await espera(600);
  if (!/200 g/.test(await p.textContent('section[data-ref="almoco"] .item'))) throw new Error('não editou');
});

await passo('Apagar e desfazer', async () => {
  await p.click('section[data-ref="almoco"] [data-apagar]'); await espera(500);
  if (await p.locator('section[data-ref="almoco"] .item').count()) throw new Error('não apagou');
  await p.click('#aviso button'); await espera(600);
  if ((await itensAlmoco()) !== 1) throw new Error('desfazer não voltou o item');
});

let arquivo;
await passo('Backup: exportar JSON', async () => {
  await p.goto(URL_APP + '#config'); await espera(800);
  const baixou = p.waitForEvent('download', { timeout: 8000 });
  await p.click('[data-exportar]');
  await p.click('dialog [value=nao]', { timeout: 2500 }).catch(() => {});      // "Só baixar" (onde dá para compartilhar)
  const dl = await baixou;
  arquivo = await dl.path();
  const j = JSON.parse(await readFile(arquivo, 'utf8'));
  if (!JSON.stringify(j).includes('Arroz, tipo 1, cozido')) throw new Error('backup sem o item');
});

await passo('Restaurar: apagar o item e importar o backup', async () => {
  await p.goto(URL_APP + '#diario'); await espera(600);
  await p.click('section[data-ref="almoco"] [data-apagar]'); await espera(500);
  await p.goto(URL_APP + '#config'); await espera(800);
  await p.setInputFiles('#bk-arq', arquivo); await espera(500);
  await p.click('dialog [value=sim]'); await espera(1500);
  await p.goto(URL_APP + '#diario'); await espera(1000);
  if ((await itensAlmoco()) !== 1) throw new Error('item não voltou com o backup');
});

await passo('Cópia automática do dia: listada em Ajustes e restaurável', async () => {
  await p.goto(URL_APP + '#diario'); await espera(600);
  await p.click('section[data-ref="almoco"] [data-apagar]'); await espera(500);
  await p.goto(URL_APP + '#config'); await espera(1200);
  await p.click('#copias [data-copia]');
  await p.click('dialog [value=sim]'); await espera(1500);
  await p.goto(URL_APP + '#diario'); await espera(1000);
  if ((await itensAlmoco()) !== 1) throw new Error('a cópia do dia não trouxe o item de volta');
});

if (erros.length) { falhas.push('console'); console.log('  ✗ erros no console:', [...new Set(erros)].join(' | ')); }
await nav.close(); servidor.close();

console.log(falhas.length ? `${falhas.length} fluxo(s) falharam` : 'Todos os fluxos passaram');
process.exitCode = falhas.length ? 1 : 0;
