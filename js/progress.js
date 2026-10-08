// progress.js — cálculos da tela Progresso (funções puras, testadas).
// dias: [{ data, tot: {kcal, prot, carb, gord, …}, meta: {kcal, prot, carb, gord} }] — só dias com algum item.

import { dataDeChave, diaSemana, somarDias } from './utils.js';

/** Média móvel por calendário: média dos pontos dos últimos `n` dias (inclui o dia). pontos ordenados. */
export function mediaMovelDias(pontos, n = 7) {
  return pontos.map((p) => {
    const ini = somarDias(p.data, -(n - 1));
    const jan = pontos.filter((q) => q.data >= ini && q.data <= p.data);
    return jan.reduce((s, q) => s + q.y, 0) / jan.length;
  });
}

/** Segunda-feira da semana da data. */
export const inicioSemana = (chave) => somarDias(chave, -diaSemana(chave));

/** Médias semanais de kcal (só dias registrados) e meta média da semana. */
export function semanas(dias) {
  const g = new Map();
  for (const d of dias) {
    const s = inicioSemana(d.data);
    if (!g.has(s)) g.set(s, []);
    g.get(s).push(d);
  }
  return [...g.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([inicio, ds]) => ({
    inicio, n: ds.length,
    kcal: ds.reduce((s, d) => s + d.tot.kcal, 0) / ds.length,
    meta: ds.reduce((s, d) => s + d.meta.kcal, 0) / ds.length,
  }));
}

/** Aderência: % dos dias registrados com kcal dentro de ±tol da meta do dia. */
export function aderencia(dias, tol = 0.1) {
  if (!dias.length) return { pct: null, dentro: 0, total: 0, acima: 0, abaixo: 0 };
  let dentro = 0, acima = 0, abaixo = 0;
  for (const d of dias) {
    const r = d.tot.kcal / d.meta.kcal;
    if (r > 1 + tol) acima++; else if (r < 1 - tol) abaixo++; else dentro++;
  }
  return { pct: (dentro / dias.length) * 100, dentro, total: dias.length, acima, abaixo };
}

/** Médias diárias de consumo e de meta (P, C, G, kcal) e % das kcal de cada macro. */
export function mediasMacros(dias) {
  const ks = ['kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg'];
  const m = Object.fromEntries(ks.map((k) => [k, 0]));
  const mm = { kcal: 0, prot: 0, carb: 0, gord: 0 };
  for (const d of dias) {
    for (const k of ks) m[k] += d.tot[k] || 0;
    for (const k of Object.keys(mm)) mm[k] += d.meta[k] || 0;
  }
  const n = dias.length || 1;
  for (const k of ks) m[k] /= n;
  for (const k of Object.keys(mm)) mm[k] /= n;
  const kcalMacros = m.prot * 4 + m.carb * 4 + m.gord * 9;
  const pct = kcalMacros ? { prot: (m.prot * 400) / kcalMacros, carb: (m.carb * 400) / kcalMacros, gord: (m.gord * 900) / kcalMacros } : { prot: 0, carb: 0, gord: 0 };
  return { consumo: m, meta: mm, pct, n: dias.length };
}

/** Filtra por período (últimos n dias até `hoje`, inclusive). n = null → tudo. */
export function noPeriodo(itens, n, hoje) {
  if (!n) return itens;
  const ini = somarDias(hoje, -(n - 1));
  return itens.filter((x) => x.data >= ini && x.data <= hoje);
}

/**
 * Sequência de dias seguidos com registro, terminando hoje (ou ontem, se hoje ainda está vazio,
 * para não "quebrar" a sequência de manhã). datas: Set de 'AAAA-MM-DD'.
 */
export function sequencia(datas, hoje) {
  let d = datas.has(hoje) ? hoje : somarDias(hoje, -1);
  let n = 0;
  while (datas.has(d)) { n++; d = somarDias(d, -1); }
  return n;
}

export const diasEntre = (a, b) => Math.round((dataDeChave(b) - dataDeChave(a)) / 86400000);
