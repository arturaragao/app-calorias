// checkin.js — check-in semanal (estilo MacroFactor): a conta é local e determinística; nada de julgar a aderência.
// Usa o gasto real (progress.tdeeAdaptativo, balanço energético com a TENDÊNCIA do peso) e propõe a meta para o objetivo do perfil.

import { tdeeAdaptativo, metaSugerida, ritmoSemanal, inicioSemana } from './progress.js';

/** Média das kcal das metas (modo semanal = média dos 7 dias). */
export const mediaMetas = (m) => (m.modo === 'semana' ? m.semana.reduce((s, c) => s + c.kcal, 0) / 7 : m.base.kcal);

/** Algum conjunto está com macros em gramas (as kcal derivam deles)? Então o app só orienta, não aplica sozinho. */
export const metasEmGramas = (m) => (m.modo === 'semana' ? m.semana : [m.base]).some((c) => c.macroModo !== 'pct');

/**
 * dias: [{data, tot:{kcal}}] com registro; tend: tendência do peso; perfil: {objetivo, ritmo}; mc: metaCalorica(perfil) ({ajuste, piso, tdee}).
 * Devolve null sem dados suficientes, ou o check-in da semana (segunda-feira = chave).
 */
export function calcularCheckin({ dias, tend, hoje, perfil, metas, mc }) {
  const g = tdeeAdaptativo(dias, tend, hoje);
  if (!g) return null;
  const sugerida = metaSugerida(g.tdee, mc.ajuste, mc.piso);
  const atual = Math.round(mediaMetas(metas));
  const ritmoReal = ritmoSemanal(tend, hoje);
  const ritmoPlan = perfil.objetivo === 'perder' ? -perfil.ritmo : perfil.objetivo === 'ganhar' ? perfil.ritmo : 0;
  return {
    semana: inicioSemana(hoje), data: hoje,
    tdee: Math.round(g.tdee), confianca: g.confianca, mediaKcal: Math.round(g.mediaKcal), deltaKg: g.deltaKg, periodo: g.periodo,
    ritmoReal, ritmoPlan, metaAtual: atual, metaSugerida: sugerida, diferenca: sugerida - atual, piso: sugerida === mc.piso,
    emGramas: metasEmGramas(metas),
  };
}

const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
const n2 = (v) => (Math.round(v * 100) / 100).toLocaleString('pt-BR');
const kc = (v) => Math.round(v).toLocaleString('pt-BR');

/** Explicação curta (3 frases), só com os números — sem julgar se a pessoa "seguiu" a dieta. */
export function textoCheckin(c) {
  const sinal = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + n2(Math.abs(v));
  const ritmo = c.ritmoReal == null ? 'ritmo ainda indefinido'
    : `ritmo real ${sinal(c.ritmoReal)} kg/semana (planejado ${sinal(c.ritmoPlan)})`;
  return [
    `Gasto estimado: ${kc(c.tdee)} kcal/dia (confiança ${c.confianca}), pelo que você registrou (${kc(c.mediaKcal)} kcal/dia em média) e pela tendência do peso (${sinal(c.deltaKg)} kg em ${c.periodo} dias).`,
    `Tendência: ${ritmo}.`,
    Math.abs(c.diferenca) < 50
      ? `Sua meta atual (${kc(c.metaAtual)} kcal) já está alinhada: dá para manter.`
      : `Para o seu objetivo, a meta passaria de ${kc(c.metaAtual)} para ${kc(c.metaSugerida)} kcal (${c.diferenca > 0 ? '+' : '−'}${kc(Math.abs(c.diferenca))}).${c.piso ? ' Limitada ao piso de segurança.' : ''}`,
  ];
}

/** Soma `delta` kcal a todos os conjuntos de metas (preserva diferenças entre dias). Puro: devolve cópia. */
export function aplicarDeltaMetas(metas, delta) {
  const m = structuredClone(metas);
  m.base.kcal = Math.round(m.base.kcal + delta);
  m.semana.forEach((c) => { c.kcal = Math.round(c.kcal + delta); });
  return m;
}

/** Histórico: guarda/atualiza o check-in da semana (no máximo 26). */
export function registrarCheckin(lista = [], c) {
  return [...lista.filter((x) => x.semana !== c.semana), c].sort((a, b) => (a.semana < b.semana ? -1 : 1)).slice(-26);
}
