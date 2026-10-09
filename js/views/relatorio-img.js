// views/relatorio-img.js — desenha o resumo da semana numa imagem (canvas → PNG) e compartilha ou baixa.

import { fmtData, fmtKcal, fmtNum } from '../utils.js';

const W = 1080, H = 1250;

/** r: resultado de relatorioSemana (progress.js). */
export async function compartilharRelatorio(r) {
  const css = getComputedStyle(document.documentElement);
  const cor = (v, p) => css.getPropertyValue(v).trim() || p;
  const C = { bg: cor('--bg', '#0a110d'), sup: cor('--sup', '#121b15'), sup2: cor('--sup2', '#18241d'), txt: cor('--txt', '#e5eee8'),
    txt2: cor('--txt2', '#9cb2a4'), acento: cor('--acento', '#7ccd97'), prot: cor('--prot', '#2b7c85'), carb: cor('--carb', '#8a7622'), gord: cor('--gord', '#a2583a') };
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const fonte = (peso, tam) => `${peso} ${tam}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const texto = (t, x, y, { peso = 400, tam = 36, c = C.txt, al = 'left' } = {}) => { g.font = fonte(peso, tam); g.fillStyle = c; g.textAlign = al; g.fillText(t, x, y); };
  const caixa = (x, y, w, h, c, raio = 28) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, raio); g.fill(); };
  const sinal = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));
  const m = r.medias;

  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  texto('Resumo da semana', 72, 130, { peso: 700, tam: 64 });
  texto(`${fmtData(r.inicio)} a ${fmtData(r.fim)} · ${r.registrados} de 7 dias registrados`, 72, 190, { tam: 34, c: C.txt2 });

  const blocos = [
    [fmtKcal(m.consumo.kcal), `kcal/dia · meta ${fmtKcal(m.meta.kcal)}`],
    [`${r.aderencia.dentro} de ${r.registrados}`, 'dias na meta (±10%)'],
    [`${fmtNum(Math.round(m.consumo.prot))} g`, `proteína/dia · meta ${fmtNum(Math.round(m.meta.prot))} g`],
    [r.deltaPeso != null ? `${sinal(r.deltaPeso, (v) => fmtNum(Math.round(v * 10) / 10))} kg` : '—', r.pesoFim != null ? `tendência ${fmtNum(Math.round(r.pesoFim * 10) / 10)} kg` : 'sem pesagens'],
  ];
  blocos.forEach(([v, rot], i) => {
    const x = 72 + (i % 2) * 480, y = 250 + Math.floor(i / 2) * 250;
    caixa(x, y, 456, 220, C.sup2);
    texto(v, x + 36, y + 115, { peso: 700, tam: 72, c: i === 0 ? C.acento : C.txt });
    texto(rot, x + 36, y + 170, { tam: 30, c: C.txt2 });
  });

  // barra de distribuição das kcal
  const y0 = 790;
  texto('De onde vieram as calorias', 72, y0, { peso: 600, tam: 38 });
  let x = 72;
  const larg = W - 144;
  [['prot', 'Proteína', C.prot], ['carb', 'Carboidrato', C.carb], ['gord', 'Gordura', C.gord]].forEach(([k, nome, c], i) => {
    const w = (larg * (m.pct[k] || 0)) / 100;
    g.fillStyle = c; g.fillRect(x, y0 + 30, w, 44);
    texto(`${nome} ${fmtNum(Math.round(m.pct[k] || 0))}%`, 72 + i * 330, y0 + 130, { tam: 32, c: C.txt });
    g.fillStyle = c; g.fillRect(72 + i * 330, y0 + 148, 60, 8);
    x += w;
  });

  const linha = (t, y) => texto(t, 72, y, { tam: 34, c: C.txt2 });
  if (r.melhor) linha(`Mais perto da meta: ${fmtData(r.melhor.data).slice(0, 5)} · ${fmtKcal(r.melhor.tot.kcal)} kcal`, 1040);
  if (r.pior) linha(`Mais longe: ${fmtData(r.pior.data).slice(0, 5)} · ${fmtKcal(r.pior.tot.kcal)} kcal (${sinal(r.pior.tot.kcal - r.pior.meta.kcal, fmtKcal)})`, 1100);
  linha(`Fibra ${fmtNum(Math.round(m.consumo.fibra))} g/dia · Sódio ${fmtNum(Math.round(m.consumo.sodio_mg))} mg/dia`, 1160);
  texto('Calorias e Macros', W - 72, H - 50, { peso: 600, tam: 30, c: C.acento, al: 'right' });

  const blob = await new Promise((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error('falha no canvas'))), 'image/png'));
  const nome = `semana-${r.inicio}.png`;
  const arq = new File([blob], nome, { type: 'image/png' });
  if (navigator.canShare?.({ files: [arq] })) {
    await navigator.share({ files: [arq], title: 'Resumo da semana' }).catch((e) => { if (e.name !== 'AbortError') throw e; });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}
