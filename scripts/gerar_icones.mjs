// gerar_icones.mjs — gera os ícones do app e dos atalhos (PNG, sem dependências, com antialiasing 4×4).
// Uso: node scripts/gerar_icones.mjs
//
// icons/icon-192.png, icon-512.png, icon-maskable-512.png — anel em 3 segmentos (cores dos macros) + folha
// icons/atalho-adicionar.png, atalho-codigo.png, atalho-peso.png, atalho-foto.png (192 px)

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SS = 4;
const FUNDO_A = [31, 92, 60], FUNDO_B = [8, 30, 19];          // gradiente diagonal verde
const PROT = [126, 199, 152], CARB = [235, 211, 111], GORD = [240, 160, 102];
const TRILHO = [255, 255, 255, 0.10], BRANCO = [246, 250, 247], VERDE = [126, 204, 152], ESCURO = [22, 66, 42];

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
  const f = Math.min(1, Math.max(0, (x + y) / 2));                       // diagonal
  const base = FUNDO_A.map((a, i) => a + (FUNDO_B[i] - a) * f);
  const brilho = Math.max(0, 1 - Math.hypot(x - 0.25, y - 0.2) / 0.6) * 18; // luz suave no canto superior esquerdo
  return base.map((v) => Math.min(255, v + brilho));
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

/** Folha (lente de dois círculos) inclinada 45°, com nervura central. */
function folha(esc) {
  const L = 0.15 * esc, W = 0.088 * esc;                                 // meio comprimento e meia largura
  const d = (L * L - W * W) / (2 * W), R = d + W;                          // geometria da lente
  const loc = (x, y) => { const X = x - 0.5, Y = 0.5 - y; return [(X + Y) / Math.SQRT2, (X - Y) / Math.SQRT2]; };
  return {
    corpo: (x, y) => { const [u, v] = loc(x, y); return Math.hypot(u, v - d) <= R && Math.hypot(u, v + d) <= R; },
    nervura: (x, y) => { const [u, v] = loc(x, y); return Math.abs(v) <= 0.006 * esc && u <= L * 0.55 && u >= -L * 0.75; },
  };
}

function iconeApp(esc) {
  const re = 0.37 * esc, ri = 0.295 * esc, f = folha(esc * 1.3);
  const segs = [[PROT, 12, 108], [CARB, 132, 228], [GORD, 252, 348]];
  return [
    [(x, y) => { const d = Math.hypot(x - 0.5, y - 0.5); return d >= ri && d <= re; }, TRILHO],
    ...segs.map(([cor, a0, a1]) => [arco(re, ri, a0, a1), cor]),
    [f.corpo, BRANCO], [f.nervura, ESCURO],
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
  'atalho-foto.png': [
    [ret(0.37, 0.25, 0.63, 0.36, 0.03), BRANCO], [ret(0.18, 0.31, 0.82, 0.76, 0.08), BRANCO],
    [disco(0.5, 0.535, 0.165), ESCURO], [anelzinho(0.5, 0.535, 0.075, 0.11), VERDE], [disco(0.72, 0.4, 0.025), VERDE],
  ],
};

mkdirSync(join(RAIZ, 'icons'), { recursive: true });
const salvar = (nome, tam, camadas, forma) => writeFileSync(join(RAIZ, 'icons', nome), png(tam, desenhar(tam, camadas, forma)));
salvar('icon-192.png', 192, iconeApp(1), cantoArredondado(0.22));
salvar('icon-512.png', 512, iconeApp(1), cantoArredondado(0.22));
salvar('icon-maskable-512.png', 512, iconeApp(0.78), cheio);                // zona segura do Android (círculo de 80%)
for (const [nome, camadas] of Object.entries(ATALHOS)) salvar(nome, 192, camadas, circulo);
console.log('ícones gerados');
