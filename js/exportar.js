// exportar.js — diário em CSV (separador ";" e vírgula decimal, abre direto no Excel/Planilhas em português).

import { totalDia } from './diary.js';

const n = (v, casas = 1) => (v == null || Number.isNaN(v) ? '' : (Math.round(v * 10 ** casas) / 10 ** casas).toString().replace('.', ','));
const txt = (s) => { const t = String(s ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const linha = (cols) => cols.map((c) => (typeof c === 'number' ? n(c) : txt(c))).join(';');
const dataBR = (c) => `${c.slice(8, 10)}/${c.slice(5, 7)}/${c.slice(0, 4)}`;

/** Um item por linha. diarios: objetos do diário; nomesRef: {refId: nome}. */
export function csvItens(diarios, nomesRef = {}) {
  const out = [linha(['Data', 'Refeição', 'Alimento', 'Quantidade (g)', 'Porção', 'kcal', 'Proteína (g)', 'Carboidrato (g)', 'Gordura (g)', 'Fibra (g)', 'Sódio (mg)', 'Fonte'])];
  for (const d of [...diarios].sort((a, b) => (a.data < b.data ? -1 : 1))) {
    for (const [refId, itens] of Object.entries(d.refeicoes)) {
      for (const it of itens) {
        out.push([txt(dataBR(d.data)), txt(nomesRef[refId] || d.nomes?.[refId] || refId), txt(it.nome),
          it.rapido ? '' : n(it.g), txt(it.porcao ? `${n(it.porcao.qtd, 2)} × ${it.porcao.nome}` : ''),
          n(it.n.kcal, 0), n(it.n.prot), n(it.n.carb), n(it.n.gord),
          it.falta?.includes('fibra') ? '' : n(it.n.fibra), it.falta?.includes('sodio_mg') ? '' : n(it.n.sodio_mg, 0),
          txt(it.rapido ? 'adição rápida' : it.fonte)].join(';'));
      }
    }
  }
  return '﻿' + out.join('\r\n');   // BOM: Excel reconhece UTF-8 (acentos)
}

/** Uma linha por dia: totais, meta e etiquetas. metaDe(dia) → {kcal, prot, carb, gord}. */
export function csvTotais(diarios, metaDe) {
  const out = [linha(['Data', 'kcal', 'Meta kcal', 'Proteína (g)', 'Meta P', 'Carboidrato (g)', 'Meta C', 'Gordura (g)', 'Meta G', 'Fibra (g)', 'Sódio (mg)', 'Etiquetas', 'Nota'])];
  for (const d of [...diarios].sort((a, b) => (a.data < b.data ? -1 : 1))) {
    const t = totalDia(d), m = metaDe(d);
    out.push([txt(dataBR(d.data)), n(t.kcal, 0), n(m.kcal, 0), n(t.prot), n(m.prot), n(t.carb), n(m.carb), n(t.gord), n(m.gord),
      n(t.fibra), n(t.sodio_mg, 0), txt((d.tags || []).join(', ')), txt(d.nota || '')].join(';'));
  }
  return '﻿' + out.join('\r\n');
}
