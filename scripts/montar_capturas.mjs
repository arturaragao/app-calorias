// scripts/montar_capturas.mjs — junta capturas lado a lado (só desenvolvimento): node scripts/montar_capturas.mjs <pasta> a.png b.png …
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [dir, ...arqs] = process.argv.slice(2);
const nav = await chromium.launch({ channel: 'msedge' });
const p = await nav.newPage({ viewport: { width: 1660, height: 900 } });
const im = (f) => `<img style="width:390px;border-radius:12px;align-self:flex-start" src="data:image/png;base64,${readFileSync(dir + '/' + f).toString('base64')}">`;
await p.setContent(`<body style="margin:0;background:#777;display:flex;gap:12px;padding:12px;flex-wrap:wrap">${arqs.map(im).join('')}</body>`);
await p.screenshot({ path: dir + '/montagem.png', fullPage: true });
await nav.close();
