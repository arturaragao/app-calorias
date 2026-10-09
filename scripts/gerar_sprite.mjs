// scripts/gerar_sprite.mjs — gera icons/sprite.svg só com os ícones Lucide usados pelo app (só desenvolvimento).
// Procura ic('nome') em js/ e index.html (+ EXTRA, nomes montados em tempo de execução). Requer: npm i (lucide-static).
// Lucide — licença ISC (https://lucide.dev/license), citada em Ajustes › Sobre.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const LUCIDE = join(RAIZ, 'node_modules', 'lucide-static', 'icons');
// nomes que não aparecem como ic('…') literal (ex.: ícones das etiquetas guardados em tabelas)
const EXTRA = ['dumbbell', 'pizza', 'party-popper', 'thermometer', 'plane', 'bed', 'hospital'];

async function fontes(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...await fontes(join(dir, e.name)));
    else if (e.name.endsWith('.js')) out.push(join(dir, e.name));
  }
  return out;
}

const nomes = new Set(EXTRA);
for (const f of [...await fontes(join(RAIZ, 'js')), join(RAIZ, 'index.html')]) {
  const t = await readFile(f, 'utf8');
  for (const m of t.matchAll(/\bic\(\s*'([a-z0-9-]+)'/g)) nomes.add(m[1]);
  for (const m of t.matchAll(/sprite\.svg#([a-z0-9-]+)/g)) nomes.add(m[1]);
}

const simbolos = [];
for (const n of [...nomes].sort()) {
  let svg;
  try { svg = await readFile(join(LUCIDE, n + '.svg'), 'utf8'); } catch { throw new Error(`ícone Lucide inexistente: ${n}`); }
  const corpo = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '').replace(/\s*\/>/g, '/>');
  simbolos.push(`<symbol id="${n}" viewBox="0 0 24 24">${corpo}</symbol>`);
}
const sprite = `<svg xmlns="http://www.w3.org/2000/svg"><!-- Lucide (ISC) · gerado por scripts/gerar_sprite.mjs -->\n${simbolos.join('\n')}\n</svg>\n`;
await writeFile(join(RAIZ, 'icons', 'sprite.svg'), sprite);
console.log(`icons/sprite.svg: ${simbolos.length} ícones, ${sprite.length} bytes`);
