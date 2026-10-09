// goals.js — cálculo de metas (funções puras, testadas em tests/run.js).

import { diaSemana } from './utils.js';

// ---------- Gasto energético ----------

/**
 * TMB por Mifflin-St Jeor.
 * Ref.: Mifflin MD, St Jeor ST et al. "A new predictive equation for resting energy
 * expenditure in healthy individuals." Am J Clin Nutr 1990;51(2):241-247.
 * homem: 10·peso(kg) + 6,25·altura(cm) − 5·idade + 5 ; mulher: … − 161
 */
export function tmbMifflin({ sexo, peso, altura, idade }) {
  const base = 10 * peso + 6.25 * altura - 5 * idade;
  return sexo === 'F' ? base - 161 : base + 5;
}

/** Fatores de atividade (multiplicadores convencionais definidos no CLAUDE.md, seção 4.3). */
export const FATORES_ATIVIDADE = {
  sedentario: { fator: 1.2, nome: 'Sedentário' },
  leve: { fator: 1.375, nome: 'Leve (1–3x/semana)' },
  moderado: { fator: 1.55, nome: 'Moderado (3–5x/semana)' },
  intenso: { fator: 1.725, nome: 'Intenso (6–7x/semana)' },
  muito: { fator: 1.9, nome: 'Muito intenso (2x/dia, trabalho físico)' },
};

export function tdee(tmb, atividade) {
  return tmb * (FATORES_ATIVIDADE[atividade]?.fator ?? 1.2);
}

/**
 * Ajuste diário = ritmo (kg/semana) × 7700 ÷ 7.
 * 7700 kcal/kg ≈ 3500 kcal/lb (Wishnofsky M. Am J Clin Nutr 1958;6:542-546) — aproximação.
 * Negativo para perder, positivo para ganhar.
 */
export function ajusteDiario(objetivo, ritmoKgSemana) {
  const a = (Math.abs(ritmoKgSemana) * 7700) / 7;
  if (objetivo === 'perder') return -a;
  if (objetivo === 'ganhar') return a;
  return 0;
}

/** Piso de segurança (CLAUDE.md 4.3): 1200 kcal mulher / 1500 kcal homem. */
export const pisoKcal = (sexo) => (sexo === 'F' ? 1200 : 1500);

/** Meta calórica sugerida a partir do perfil. Retorna detalhes para exibir. */
export function metaCalorica(perfil) {
  const tmb = tmbMifflin(perfil);
  const gasto = tdee(tmb, perfil.atividade);
  const ajuste = ajusteDiario(perfil.objetivo, perfil.ritmo || 0);
  const bruta = gasto + ajuste;
  const piso = pisoKcal(perfil.sexo);
  const abaixoPiso = bruta < piso;
  return { tmb, tdee: gasto, ajuste, bruta, piso, abaixoPiso, kcal: abaixoPiso ? piso : bruta };
}

// ---------- Macros ----------

export const KCAL_G = { prot: 4, carb: 4, gord: 9 };
export const MACROS = ['prot', 'carb', 'gord'];

/** % das kcal -> gramas. */
export function pctParaGramas(kcal, pct) {
  const r = {};
  for (const m of MACROS) r[m] = (kcal * (pct[m] || 0)) / 100 / KCAL_G[m];
  return r;
}

/** gramas -> % das kcal (das kcal derivadas dos próprios macros). */
export function gramasParaPct(g) {
  const kcal = kcalDeMacros(g);
  const r = {};
  for (const m of MACROS) r[m] = kcal ? ((g[m] || 0) * KCAL_G[m] * 100) / kcal : 0;
  return r;
}

export function gkgParaGramas(gkg, peso) {
  const r = {};
  for (const m of MACROS) r[m] = (gkg[m] || 0) * peso;
  return r;
}

export function gramasParaGkg(g, peso) {
  const r = {};
  for (const m of MACROS) r[m] = peso ? (g[m] || 0) / peso : 0;
  return r;
}

export function kcalDeMacros(g) {
  return MACROS.reduce((s, m) => s + (g[m] || 0) * KCAL_G[m], 0);
}

export const somaPct = (pct) => MACROS.reduce((s, m) => s + (Number(pct[m]) || 0), 0);

// ---------- Conjuntos de metas ----------
// conjunto = { kcal, macroModo: 'pct'|'g'|'gkg', pct:{prot,carb,gord}, g:{…}, gkg:{…}, fibra, sodio }
// Modo 'pct': kcal é a referência e os macros derivam dela.
// Modos 'g' e 'gkg': os macros são a referência e as kcal derivam deles (4/4/9);
// a diferença em relação à kcal planejada é mostrada na tela.

export function novoConjunto(kcal, extra = {}) {
  const pct = { prot: 25, carb: 45, gord: 30 };
  const g = pctParaGramas(kcal, pct);
  return {
    kcal, macroModo: 'pct', pct, g,
    gkg: { prot: 2, carb: 3, gord: 0.8 },
    fibra: 30, sodio: 2000, ...extra,
  };
}

/** Resolve um conjunto em valores efetivos (kcal e gramas) usando o peso atual. */
export function resolverConjunto(c, peso) {
  let g;
  if (c.macroModo === 'g') g = { ...c.g };
  else if (c.macroModo === 'gkg') g = gkgParaGramas(c.gkg, peso || 0);
  else g = pctParaGramas(c.kcal, c.pct);
  const kcalMacros = kcalDeMacros(g);
  const kcal = c.macroModo === 'pct' ? c.kcal : kcalMacros;
  return {
    kcal, prot: g.prot, carb: g.carb, gord: g.gord,
    fibra: c.fibra, sodio: c.sodio,
    kcalPlanejada: c.kcal, diferenca: kcalMacros - c.kcal, macroModo: c.macroModo,
  };
}

/**
 * metas = { modo: 'iguais'|'semana', base: conjunto, semana: [7 conjuntos], historico: [{desde, modo, base, semana}] }
 * Retorna o conjunto vigente para a data (usa o histórico: a meta de cada dia é a que valia nele).
 */
/** Configuração de metas vigente na data (entrada do histórico ou as metas atuais). */
export function metasVigentes(metas, chave) {
  if (!metas.historico?.length) return metas;
  const ord = metas.historico.slice().sort((a, b) => (a.desde < b.desde ? -1 : 1));
  const vig = ord.filter((h) => h.desde <= chave);
  return vig.length ? vig[vig.length - 1] : ord[0];
}

export function conjuntoDoDia(metas, chave) {
  const m = metasVigentes(metas, chave);
  if (m.modo === 'semana' && m.semana?.length === 7) return m.semana[diaSemana(chave)];
  return m.base;
}

/**
 * Meta efetiva do dia. `treino`: dia marcado como treino → soma `treinoExtra` kcal (vigente na data),
 * todas em carboidrato (4 kcal/g), sem mexer em proteína e gordura.
 */
export function metaDoDia(metas, chave, peso, { treino = false } = {}) {
  const r = resolverConjunto(conjuntoDoDia(metas, chave), peso);
  const extra = treino ? Number(metasVigentes(metas, chave).treinoExtra) || 0 : 0;
  if (extra > 0) { r.kcal += extra; r.carb += extra / 4; r.kcalPlanejada += extra; r.treinoExtra = extra; }
  return r;
}

/** Grava a configuração atual no histórico a partir de `desde` (substitui entrada do mesmo dia). */
export function registrarHistorico(metas, desde) {
  const snap = JSON.parse(JSON.stringify({ desde, modo: metas.modo, base: metas.base, semana: metas.semana, treinoExtra: metas.treinoExtra || 0 }));
  const hist = (metas.historico || []).filter((h) => h.desde !== desde);
  hist.push(snap);
  return { ...metas, historico: hist };
}

/** Cria metas iniciais a partir do perfil (onboarding). */
export function metasIniciais(perfil, hojeChave) {
  const { kcal } = metaCalorica(perfil);
  const base = novoConjunto(Math.round(kcal));
  const metas = { modo: 'iguais', base, semana: Array.from({ length: 7 }, () => structuredCloneSafe(base)), historico: [] };
  return registrarHistorico(metas, hojeChave);
}

export function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}
