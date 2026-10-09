// scripts/comparar_capturas.mjs — monta uma imagem por tela: antes × depois, escuro e claro (só desenvolvimento).
// Uso: node scripts/comparar_capturas.mjs antes depois  → capturas/comparacao-<tela>.png (topo de cada tela, 1200 px)
// e lista as diferenças: altura da página e % de pixels que mudaram (comparação no próprio navegador, canvas).
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
// ---------- diferenças ----------
const dif = [];
for (const tela of TELAS) for (const tema of ['escuro', 'claro']) {
  const img = (rot) => 'data:image/png;base64,' + readFileSync(join(RAIZ, 'capturas', rot, `${tela}-${tema}.png`)).toString('base64');
  dif.push([tela, tema, await pag.evaluate(async ([a, b]) => {
    const carregar = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([carregar(a), carregar(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (i) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let n = 0;
    for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 48) n++;
    return { pct: (n / (w * h)) * 100, ha: ia.height, hb: ib.height };
  }, [img(A), img(B)])]);
}
await nav.close();
console.log(`Diferenças ${A} → ${B} (pixels alterados na área comum; altura em px de tela ×2):`);
for (const [tela, tema, r] of dif) console.log(`  ${tela.padEnd(10)} ${tema.padEnd(7)} ${r.pct.toFixed(1).padStart(5)}%${r.ha !== r.hb ? `  · altura ${r.ha} → ${r.hb}` : ''}${r.pct < 0.5 && r.ha === r.hb ? '  (igual)' : ''}`);
