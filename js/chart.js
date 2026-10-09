// chart.js — gráfico de linha em SVG, leve, sem biblioteca. Toque/clique mostra data e valor.

import { fmtData, fmtNum, dataDeChave, escapeHtml } from './utils.js';

/** Toque ou arraste o dedo sobre o gráfico: chama `fn` a cada posição (sem travar a rolagem vertical). */
function arrastar(svg, fn) {
  let ativo = false;
  svg.addEventListener('pointerdown', (e) => { ativo = true; fn(e); });
  svg.addEventListener('pointermove', (e) => { if (ativo || e.pointerType === 'mouse') fn(e); });
  const parar = () => { ativo = false; };
  svg.addEventListener('pointerup', parar); svg.addEventListener('pointercancel', parar); svg.addEventListener('pointerleave', parar);
}

/**
 * Barras com marca de meta por barra. barras: [{ rotulo, y, meta?, dica }].
 * Barra acima da meta em mais de 10% fica em âmbar.
 */
export function graficoBarras(el, barras, { unidade = '' } = {}) {
  if (!barras.length) { el.innerHTML = '<p class="mudo">Sem registros no período.</p>'; return; }
  const W = 340, H = 170, ml = 36, mr = 8, mt = 10, mb = 22;
  const ymax = Math.max(...barras.map((b) => Math.max(b.y, b.meta || 0))) * 1.1 || 1;
  const bw = (W - ml - mr) / barras.length;
  const py = (v) => mt + (1 - v / ymax) * (H - mt - mb);
  const passo = Math.ceil(barras.length / 6);
  el.innerHTML = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">
    ${[0, ymax / 2, ymax / 1.1].map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${py(v)}" y2="${py(v)}" class="grade"/>
      <text x="${ml - 4}" y="${py(v) + 3}" text-anchor="end">${fmtNum(Math.round(v))}</text>`).join('')}
    ${barras.map((b, i) => {
      const w = Math.min(bw * 0.7, 36), x = ml + i * bw + (bw - w) / 2;
      return `<rect x="${x}" y="${py(b.y)}" width="${w}" height="${py(0) - py(b.y)}" rx="2" class="${b.meta && b.y > b.meta * 1.1 ? 'barra-acima' : 'barra'}" data-i="${i}"/>
        ${b.meta ? `<line x1="${x - 2}" x2="${x + w + 2}" y1="${py(b.meta)}" y2="${py(b.meta)}" class="meta"/>` : ''}
        ${i % passo === 0 ? `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${escapeHtml(b.rotulo)}</text>` : ''}`;
    }).join('')}
  </svg><p class="mudo legenda" id="dica-b">Toque numa barra para ver o valor · traço = meta</p>`;
  const svg = el.querySelector('svg');
  arrastar(svg, (e) => {
    const b = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(barras.length - 1, Math.floor((((e.clientX - b.left) / b.width) * W - ml) / bw)));
    svg.querySelectorAll('rect[data-i]').forEach((r) => r.classList.toggle('sel', Number(r.dataset.i) === i));
    el.querySelector('#dica-b').textContent = barras[i].dica || `${barras[i].rotulo}: ${fmtNum(Math.round(barras[i].y))} ${unidade}`;
  });
}

/**
 * pontos: [{ data: 'AAAA-MM-DD', y }] em ordem cronológica.
 * opcoes: { unidade, casas = 1, linha2: [y…] (ex.: média móvel, mesmo comprimento), rotulo2 }
 */
export function graficoLinha(el, pontos, { unidade = '', casas = 1, linha2 = null, rotulo2 = '', alvo = null, rotuloAlvo = 'alvo' } = {}) {
  if (pontos.length < 2) {
    el.innerHTML = `<p class="mudo">${pontos.length ? 'Registre mais um valor para ver o gráfico.' : 'Sem registros ainda.'}</p>`;
    return;
  }
  const W = 340, H = 170, ml = 36, mr = 8, mt = 10, mb = 22;
  const xs = pontos.map((p) => dataDeChave(p.data).getTime());
  const todos = [...pontos.map((p) => p.y), ...(linha2 || []), ...(alvo != null ? [alvo] : [])];
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
    ${alvo != null ? `<line x1="${ml}" x2="${W - mr}" y1="${py(alvo)}" y2="${py(alvo)}" class="alvo"/>
      <text x="${W - mr - 2}" y="${py(alvo) - 4}" text-anchor="end" class="alvo-t">${escapeHtml(rotuloAlvo)} ${r(alvo)}</text>` : ''}
    ${linha2 ? `<path d="${caminho(linha2)}" class="l2"/>` : ''}
    <path d="${caminho(pontos.map((p) => p.y))}" class="l1"/>
    ${pontos.map((p, i) => `<circle cx="${px(xs[i])}" cy="${py(p.y)}" r="${pontos.length > 40 ? 2.2 : 3.5}" class="pt"/>`).join('')}
    <line class="cursor" y1="${mt}" y2="${H - mb}" visibility="hidden"/>
    <g class="dica" hidden><rect rx="6" height="22"/><text></text></g>
  </svg>${linha2 ? `<p class="mudo legenda"><span class="sw1"></span> valores <span class="sw2"></span> ${escapeHtml(rotulo2)}</p>` : ''}`;
  const svg = el.querySelector('svg'), dica = svg.querySelector('.dica'), cursor = svg.querySelector('.cursor');
  arrastar(svg, (e) => {
    const b = svg.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * W;
    let i = 0;
    xs.forEach((t, j) => { if (Math.abs(px(t) - x) < Math.abs(px(xs[i]) - x)) i = j; });
    const txt = `${fmtData(pontos[i].data).slice(0, 5)}: ${r(pontos[i].y)} ${unidade}${linha2 ? ` · ${rotulo2.split(' ')[0]} ${r(linha2[i])}` : ''}`;
    cursor.setAttribute('x1', px(xs[i])); cursor.setAttribute('x2', px(xs[i])); cursor.setAttribute('visibility', 'visible');
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

/**
 * Barras empilhadas (ex.: massa magra + massa gorda). barras: [{ rotulo, a, b, dica }].
 * `a` embaixo (cor de acento), `b` em cima.
 */
export function graficoEmpilhado(el, barras, { rotuloA = '', rotuloB = '', unidade = '' } = {}) {
  if (!barras.length) { el.innerHTML = '<p class="mudo">Sem avaliações com % de gordura no período.</p>'; return; }
  const W = 340, H = 170, ml = 36, mr = 8, mt = 10, mb = 22;
  const ymax = Math.max(...barras.map((b) => b.a + b.b)) * 1.1 || 1;
  const bw = (W - ml - mr) / barras.length;
  const py = (v) => mt + (1 - v / ymax) * (H - mt - mb);
  const passo = Math.ceil(barras.length / 6);
  el.innerHTML = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras empilhadas">
    ${[0, ymax / 2, ymax / 1.1].map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${py(v)}" y2="${py(v)}" class="grade"/>
      <text x="${ml - 4}" y="${py(v) + 3}" text-anchor="end">${fmtNum(Math.round(v))}</text>`).join('')}
    ${barras.map((b, i) => {
      const w = Math.min(bw * 0.6, 34), x = ml + i * bw + (bw - w) / 2;
      return `<rect x="${x}" y="${py(b.a)}" width="${w}" height="${py(0) - py(b.a)}" class="barra" data-i="${i}"/>
        <rect x="${x}" y="${py(b.a + b.b)}" width="${w}" height="${py(0) - py(b.b)}" rx="2" class="barra-b" data-i="${i}"/>
        ${i % passo === 0 ? `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${escapeHtml(b.rotulo)}</text>` : ''}`;
    }).join('')}
  </svg><p class="mudo legenda"><span class="sq a"></span> ${escapeHtml(rotuloA)} <span class="sq b"></span> ${escapeHtml(rotuloB)}</p>
  <p class="mudo legenda" id="dica-e">Toque numa barra para ver os valores</p>`;
  const svg = el.querySelector('svg');
  arrastar(svg, (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(barras.length - 1, Math.floor((((e.clientX - r.left) / r.width) * W - ml) / bw)));
    svg.querySelectorAll('rect[data-i]').forEach((x) => x.classList.toggle('sel', Number(x.dataset.i) === i));
    el.querySelector('#dica-e').textContent = barras[i].dica || `${barras[i].rotulo}: ${fmtNum(barras[i].a)} + ${fmtNum(barras[i].b)} ${unidade}`;
  });
}
