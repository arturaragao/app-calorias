// scripts/comparar_capturas.mjs — monta uma imagem por tela: antes × depois, escuro e claro (só desenvolvimento).
// Uso: node scripts/comparar_capturas.mjs antes depois  → capturas/comparacao-<tela>.png (topo de cada tela, 1200 px)
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const [A = 'antes', B = 'depois'] = process.argv.slice(2);
const TELAS = ['diario', 'adicionar', 'registros', 'progresso', 'config'];
let nav;
for (const channel of ['msedge', 'chrome']) { try { nav = await chromium.launch({ channel }); break; } catch {} }
const pag = await nav.newPage({ viewport: { width: 1680, height: 1300 } });
for (const tela of TELAS) {
  const col = (rot, tema) => `<figure><figcaption>${rot} · ${tema}</figcaption><div><img src="data:image/png;base64,${readFileSync(join(RAIZ, 'capturas', rot, `${tela}-${tema}.png`)).toString('base64')}"></div></figure>`;
  await pag.setContent(`<style>body{margin:0;background:#888;font:600 18px system-ui;display:flex;gap:16px;padding:16px}
    figure{margin:0;width:390px}figcaption{color:#fff;padding:0 0 8px}div{height:1220px;overflow:hidden;border-radius:12px}img{width:390px;display:block}</style>
    ${col(A, 'escuro')}${col(B, 'escuro')}${col(A, 'claro')}${col(B, 'claro')}`);
  await pag.waitForLoadState('load');
  await pag.screenshot({ path: join(RAIZ, 'capturas', `comparacao-${tela}.png`) });
}
await nav.close();
console.log('ok');
