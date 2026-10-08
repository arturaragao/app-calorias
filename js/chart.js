// chart.js — gráfico de linha em SVG, leve, sem biblioteca. Toque/clique mostra data e valor.

import { fmtData, fmtNum, dataDeChave, escapeHtml } from './utils.js';

/**
 * pontos: [{ data: 'AAAA-MM-DD', y }] em ordem cronológica.
 * opcoes: { unidade, casas = 1, linha2: [y…] (ex.: média móvel, mesmo comprimento), rotulo2 }
 */
export function graficoLinha(el, pontos, { unidade = '', casas = 1, linha2 = null, rotulo2 = '' } = {}) {
  if (pontos.length < 2) {
    el.innerHTML = `<p class="mudo">${pontos.length ? 'Registre mais um valor para ver o gráfico.' : 'Sem registros ainda.'}</p>`;
    return;
  }
  const W = 340, H = 170, ml = 36, mr = 8, mt = 10, mb = 22;
  const xs = pontos.map((p) => dataDeChave(p.data).getTime());
  const todos = [...pontos.map((p) => p.y), ...(linha2 || [])];
  let ymin = Math.min(...todos), ymax = Math.max(...todos);
  if (ymax - ymin < 1e-9) { ymin -= 1; ymax += 1; }
  const pad = (ymax - ymin) * 0.1; ymin -= pad; ymax += pad;
  const x0 = xs[0], x1 = xs.at(-1) === x0 ? x0 + 1 : xs.at(-1);
  const px = (t) => ml + ((t - x0) / (x1 - x0)) * (W - ml - mr);
  const py = (v) => mt + (1 - (v - ymin) / (ymax - ymin)) * (H - mt - mb);
  const caminho = (ys) => ys.map((y, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${py(y).toFixed(1)}`).join('');
  const r = (v) => fmtNum(Math.round(v * 10 ** casas) / 10 ** casas);
  el.innerHTML = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de ${pontos.length} registros">
    ${[ymin + pad, (ymin + ymax) / 2, ymax - pad].map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${py(v)}" y2="${py(v)}" class="grade"/>
      <text x="${ml - 4}" y="${py(v) + 3}" text-anchor="end">${r(v)}</text>`).join('')}
    <text x="${ml}" y="${H - 6}">${fmtData(pontos[0].data).slice(0, 5)}</text>
    <text x="${W - mr}" y="${H - 6}" text-anchor="end">${fmtData(pontos.at(-1).data).slice(0, 5)}</text>
    ${linha2 ? `<path d="${caminho(linha2)}" class="l2"/>` : ''}
    <path d="${caminho(pontos.map((p) => p.y))}" class="l1"/>
    ${pontos.map((p, i) => `<circle cx="${px(xs[i])}" cy="${py(p.y)}" r="3.5" class="pt"/>`).join('')}
    <g class="dica" hidden><rect rx="6" height="22"/><text></text></g>
  </svg>${linha2 ? `<p class="mudo legenda"><span class="sw1"></span> valores <span class="sw2"></span> ${escapeHtml(rotulo2)}</p>` : ''}`;
  const svg = el.querySelector('svg'), dica = svg.querySelector('.dica');
  svg.addEventListener('pointerdown', (e) => {
    const b = svg.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * W;
    let i = 0;
    xs.forEach((t, j) => { if (Math.abs(px(t) - x) < Math.abs(px(xs[i]) - x)) i = j; });
    const txt = `${fmtData(pontos[i].data)}: ${r(pontos[i].y)} ${unidade}`;
    const tx = dica.querySelector('text'), rect = dica.querySelector('rect');
    tx.textContent = txt;
    const w = txt.length * 6.2 + 12;
    const cx = Math.min(Math.max(px(xs[i]) - w / 2, 2), W - w - 2);
    const cy = Math.max(py(pontos[i].y) - 30, 2);
    rect.setAttribute('x', cx); rect.setAttribute('y', cy); rect.setAttribute('width', w);
    tx.setAttribute('x', cx + 6); tx.setAttribute('y', cy + 15);
    dica.hidden = false;
  });
}
