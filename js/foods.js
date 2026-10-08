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

// ---------- Porções caseiras (aproximadas) ----------

/**
 * porcoes.json = { regras: [{ chaves: [...], porcoes: [{nome, g}] }], grupos: {grupo: [...]}, padrao: [...] }
 * Regra vale se todas as chaves aparecem como início de palavra no nome normalizado.
 * `doUsuario` (por id do alimento) substitui as sugeridas.
 */
export function porcoesDe(food, tabela, doUsuario = {}) {
  if (doUsuario[food.id]) return doUsuario[food.id].map((p) => ({ ...p, usuario: true }));
  if (food.porcoes?.length) return food.porcoes;
  const palavras = normalizar(food.nome).split(' ');
  const tem = (c) => normalizar(c).split(' ').every((t) => palavras.some((p) => p.startsWith(t)));
  for (const r of tabela?.regras || []) {
    if (r.chaves.every(tem) && !(r.exceto || []).some(tem)) return r.porcoes.map((p) => ({ ...p, aprox: true }));
  }
  const g = tabela?.grupos?.[food.grupo];
  if (g) return g.map((p) => ({ ...p, aprox: true }));
  return (tabela?.padrao || []).map((p) => ({ ...p, aprox: true }));
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
