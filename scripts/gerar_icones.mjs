// gerar_icones.mjs — gera os ícones do app e dos atalhos (PNG, sem dependências, com antialiasing 4×4).
// Uso: node scripts/gerar_icones.mjs
//
// icons/icon-192.png, icon-512.png, icon-maskable-512.png — anel clássico refinado (arco verde ~74% + ponto claro na ponta)
// icons/atalho-adicionar.png, atalho-codigo.png, atalho-peso.png, atalho-foto.png, atalho-falar.png, atalho-agua.png (192 px)

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SS = 4;
const FUNDO_A = [17, 35, 25], FUNDO_B = [11, 24, 17];          // verde quase preto, gradiente vertical bem sutil
const TRILHO = [36, 64, 47], PONTA = [233, 246, 238], BRANCO = [240, 247, 242], VERDE = [126, 204, 152], ESCURO = [14, 29, 21];

// ---------- PNG ----------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function bloco(tipo, dados) {
  const t = Buffer.from(tipo), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(dados.length); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}
function png(n, rgba) {
  const linhas = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) { linhas[y * (n * 4 + 1)] = 0; rgba.copy(linhas, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(linhas, { level: 9 })), bloco('IEND', Buffer.alloc(0))]);
}

// ---------- Desenho ----------
/** camadas: [[dentro(x,y), cor]] em coordenadas 0..1 (a última que contém o ponto vence; cor com alfa opcional). */
function desenhar(tam, camadas, forma) {
  const t = tam * SS, out = Buffer.alloc(tam * tam * 4);
  for (let Y = 0; Y < tam; Y++) for (let X = 0; X < tam; X++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const x = (X * SS + dx + 0.5) / t, y = (Y * SS + dy + 0.5) / t;
      if (!forma(x, y)) continue;
      let c = fundo(x, y);
      for (const [dentro, cor] of camadas) {
        if (!dentro(x, y)) continue;
        const al = cor[3] ?? 1;
        c = [0, 1, 2].map((i) => c[i] * (1 - al) + cor[i] * al);
      }
      r += c[0]; g += c[1]; b += c[2]; a += 255;
    }
    const k = SS * SS, i = (Y * tam + X) * 4;
    out[i] = a ? r / (a / 255) : 0; out[i + 1] = a ? g / (a / 255) : 0; out[i + 2] = a ? b / (a / 255) : 0; out[i + 3] = a / k;
  }
  return out;
}
function fundo(x, y) {
  const f = Math.min(1, Math.max(0, y));
  return FUNDO_A.map((a, i) => a + (FUNDO_B[i] - a) * f);
}
const cantoArredondado = (r) => (x, y) => { const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r); return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; };
const circulo = (x, y) => Math.hypot(x - 0.5, y - 0.5) <= 0.5;
const cheio = () => true;

/** Arco de anel com pontas arredondadas, ângulos em graus a partir do topo, sentido horário. */
function arco(re, ri, a0, a1) {
  const rm = (re + ri) / 2, rp = (re - ri) / 2;
  const ponta = (ang) => { const a = (ang * Math.PI) / 180; return [0.5 + rm * Math.sin(a), 0.5 - rm * Math.cos(a)]; };
  const [p0, p1] = [ponta(a0), ponta(a1)];
  return (x, y) => {
    const d = Math.hypot(x - 0.5, y - 0.5);
    if (d >= ri && d <= re) {
      const ang = ((Math.atan2(x - 0.5, 0.5 - y) * 180) / Math.PI + 360) % 360;
      if (ang >= a0 && ang <= a1) return true;
    }
    return Math.hypot(x - p0[0], y - p0[1]) <= rp || Math.hypot(x - p1[0], y - p1[1]) <= rp;
  };
}

/** Anel clássico: trilho escuro, arco verde do topo até ~265° (sentido horário) e ponto claro na ponta. */
function iconeApp(esc) {
  const rm = 0.29 * esc, larg = 0.06 * esc, re = rm + larg, ri = rm - larg, fim = 265;
  const a = (fim * Math.PI) / 180, px = 0.5 + rm * Math.sin(a), py = 0.5 - rm * Math.cos(a);
  return [
    [(x, y) => { const d = Math.hypot(x - 0.5, y - 0.5); return d >= ri && d <= re; }, TRILHO],
    [arco(re, ri, 0, fim), VERDE],
    [disco(px, py, 0.032 * esc), PONTA],
  ];
}

// ---------- Atalhos ----------
const ret = (x0, y0, x1, y1, r = 0) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1e-12;
};
const disco = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r;
const anelzinho = (cx, cy, r0, r1) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; };

const ATALHOS = {
  'atalho-adicionar.png': [
    [ret(0.455, 0.27, 0.545, 0.73, 0.045), BRANCO], [ret(0.27, 0.455, 0.73, 0.545, 0.045), BRANCO],
  ],
  'atalho-codigo.png': [
    ...[[0.24, 0.035], [0.3, 0.02], [0.345, 0.05], [0.42, 0.02], [0.465, 0.035], [0.53, 0.055], [0.61, 0.02], [0.655, 0.04], [0.725, 0.02]]
      .map(([x0, w]) => [ret(x0, 0.32, x0 + w, 0.68), BRANCO]),
    ...[[0.18, 0.2, 1, 1], [0.82, 0.2, -1, 1], [0.18, 0.8, 1, -1], [0.82, 0.8, -1, -1]].map(([cx, cy, sx, sy]) => [(x, y) => {
      const dx = (x - cx) * sx, dy = (y - cy) * sy, e = 0.03, c = 0.12;
      return (dx >= 0 && dx <= c && dy >= 0 && dy <= e) || (dy >= 0 && dy <= c && dx >= 0 && dx <= e);
    }, VERDE]),
  ],
  'atalho-peso.png': [
    [ret(0.22, 0.25, 0.78, 0.78, 0.09), BRANCO],
    [(x, y) => Math.hypot(x - 0.5, y - 0.47) <= 0.15 && y <= 0.47, ESCURO],
    [(x, y) => { const ax = 0.5, ay = 0.47, bx = 0.58, by = 0.37; const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) <= 0.02; }, VERDE],
  ],
  // microfone: cápsula, arco do suporte e haste
  'atalho-falar.png': [
    [ret(0.405, 0.2, 0.595, 0.58, 0.095), BRANCO],
    [(x, y) => { const d = Math.hypot(x - 0.5, y - 0.44); return d >= 0.175 && d <= 0.215 && y >= 0.44; }, VERDE],
    [ret(0.48, 0.65, 0.52, 0.76, 0.01), VERDE], [ret(0.39, 0.74, 0.61, 0.78, 0.02), VERDE],
  ],
  // gota d'água: círculo embaixo + ponta (triângulo) em cima
  'atalho-agua.png': [
    [(x, y) => Math.hypot(x - 0.5, y - 0.58) <= 0.2 || (y >= 0.2 && y <= 0.58 && Math.abs(x - 0.5) <= (y - 0.2) * 0.53), BRANCO],
    [(x, y) => Math.hypot(x - 0.44, y - 0.62) <= 0.11 && Math.hypot(x - 0.47, y - 0.59) > 0.11, VERDE],
  ],
  'atalho-foto.png': [
    [ret(0.37, 0.25, 0.63, 0.36, 0.03), BRANCO], [ret(0.18, 0.31, 0.82, 0.76, 0.08), BRANCO],
    [disco(0.5, 0.535, 0.165), ESCURO], [anelzinho(0.5, 0.535, 0.075, 0.11), VERDE], [disco(0.72, 0.4, 0.025), VERDE],
  ],
};

mkdirSync(join(RAIZ, 'icons'), { recursive: true });
const salvar = (nome, tam, camadas, forma) => writeFileSync(join(RAIZ, 'icons', nome), png(tam, desenhar(tam, camadas, forma)));
salvar('icon-192.png', 192, iconeApp(1), cantoArredondado(0.22));
salvar('icon-512.png', 512, iconeApp(1), cantoArredondado(0.22));
salvar('icon-maskable-512.png', 512, iconeApp(1), cheio);                   // anel (raio 0,35) dentro da zona segura do Android (círculo de raio 0,40)
for (const [nome, camadas] of Object.entries(ATALHOS)) salvar(nome, 192, camadas, circulo);
console.log('ícones gerados');
