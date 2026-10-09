// foods.js — base de alimentos (foods.json), índice de busca e porções caseiras.
// A busca é pura (testável); o carregamento usa fetch relativo.

import { normalizar } from './utils.js';

// ---------- Índice e busca ----------

/** Cria índice normalizado (uma vez, em memória). */
export function criarIndice(foods) {
  return foods.map((f) => {
    const norm = normalizar(f.nome);
    return { f, norm, palavras: norm.split(' ') };
  });
}

/**
 * Ranqueia: começa com (0) > contém (1) > todas as palavras como início de palavra (2)
 * > todas as palavras contidas (3). `prioridade`: Set de ids (Meus alimentos/Recentes) que
 * sobem dentro da mesma faixa. Empate: nome mais curto, depois alfabético.
 */
export function buscar(indice, consulta, { limite = 60, prioridade = null } = {}) {
  const q = normalizar(consulta);
  if (!q) return [];
  const termos = q.split(' ');
  const res = [];
  for (const e of indice) {
    let s;
    if (e.norm.startsWith(q)) s = 0;
    else if (e.norm.includes(q)) s = 1;
    else if (termos.every((t) => e.palavras.some((p) => p.startsWith(t)))) s = 2;
    else if (termos.every((t) => e.norm.includes(t))) s = 3;
    else continue;
    if (prioridade?.has(e.f.id)) s -= 0.5;
    res.push([s, e]);
  }
  res.sort((a, b) => a[0] - b[0] || a[1].norm.length - b[1].norm.length || (a[1].norm < b[1].norm ? -1 : 1));
  return res.slice(0, limite).map((r) => r[1].f);
}

/**
 * Correspondência de um alimento identificado pela IA com a base (TACO + Meus alimentos).
 * Tenta o nome no estilo TACO inteiro, depois o nome curto (correspondência "exata": vira o padrão);
 * se nada, vai tirando os últimos trechos do nome TACO ("Carne, bovina, patinho, grelhado" → "Carne, bovina, patinho")
 * só como opções. Devolve { opcoes: [food…] (até max), exata }.
 */
export function correspondencias(indice, { nomeTaco = '', nome = '' }, max = 3) {
  for (const q of [nomeTaco, nome]) {
    const r = q ? buscar(indice, q, { limite: max }) : [];
    if (r.length) return { opcoes: r, exata: true };
  }
  const partes = nomeTaco.split(',').map((s) => s.trim()).filter(Boolean);
  for (let n = partes.length - 1; n >= 1; n--) {
    const r = buscar(indice, partes.slice(0, n).join(', '), { limite: max });
    if (r.length) return { opcoes: r, exata: false };
  }
  return { opcoes: [], exata: false };
}

// ---------- Porções caseiras (aproximadas) ----------

/**
 * porcoes.json = { regras: [{ chaves: [...], porcoes: [{nome, g}] }], grupos: {grupo: [...]}, padrao: [...] }
 * Regra vale se todas as chaves aparecem como início de palavra no nome normalizado.
 * `doUsuario` (por id do alimento) substitui as sugeridas.
 */
export function porcoesDe(food, tabela, doUsuario = {}) {
  if (doUsuario[food.id]) return doUsuario[food.id].map((p) => ({ ...p, usuario: true }));
  if (food.porcoes?.length) return food.porcoes;
  const r = regraDe(food, tabela?.regras);
  if (r) return r.porcoes.map((p) => ({ ...p, aprox: true }));
  const g = tabela?.grupos?.[food.grupo];
  if (g) return g.map((p) => ({ ...p, aprox: true }));
  return (tabela?.padrao || []).map((p) => ({ ...p, aprox: true }));
}

/** 1ª regra cujas chaves aparecem todas (início de palavra) no nome e nenhuma das "exceto". */
function regraDe(food, regras = []) {
  const palavras = normalizar(food.nome).split(' ');
  const tem = (c) => normalizar(c).split(' ').every((t) => palavras.some((p) => p.startsWith(t)));
  return regras.find((r) => r.chaves.every(tem) && !(r.exceto || []).some(tem)) || null;
}

// ---------- Líquidos e densidade (mL → g) ----------

/** Bebidas e líquidos comuns (grupo "Bebidas" da TACO ou nome típico), para abrir já em mL. */
export function ehLiquido(food) {
  const n = normalizar(food.nome), g = normalizar(food.grupo);
  if (/bebida/.test(g)) return true;
  return /^(leite|suco|refrigerante|cafe|cha|agua|bebida|iogurte|caldo|sopa|vinho|cerveja|kefir|isotonico|achocolatado)\b/.test(n)
    && !/\b(po|condensado|creme|em po|solido)\b/.test(n);
}

/**
 * Densidade (g/mL) para converter mL em gramas. Ordem: campo `densidade` do alimento →
 * regra em porcoes.json › densidades (valores com fonte citada no próprio arquivo) → 1 g/mL.
 */
export function densidadeDe(food, tabela) {
  if (food.densidade > 0) return food.densidade;
  return regraDe(food, tabela?.densidades?.regras)?.g_ml || 1;
}

// ---------- Carregamento ----------

let cache = null;

export async function carregarBase() {
  if (cache) return cache;
  const [foods, porcoes] = await Promise.all([
    fetch('./foods.json').then((r) => r.json()),
    fetch('./porcoes.json').then((r) => r.json()).catch(() => ({})),
  ]);
  cache = { foods, porcoes, indice: criarIndice(foods), porId: new Map(foods.map((f) => [f.id, f])) };
  return cache;
}

/** Nome de exibição do grupo/fonte. */
export const rotuloFonte = (f) => [f.fonte, f.grupo].filter(Boolean).join(' · ');
