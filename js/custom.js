// custom.js — Meus alimentos, receitas, favoritos/recentes e catálogo unificado (base + meus + receitas).
// Funções puras no topo (testadas); acesso ao banco embaixo.

import { db } from './db.js';
import { estado, salvarConfig } from './state.js';
import { carregarBase, criarIndice } from './foods.js';
import { NUTRIENTES } from './diary.js';
import { normalizar, uid } from './utils.js';

// ---------- Puras ----------

/** Converte valores digitados "por X g" para "por 100 g". */
export function paraPor100(valores, baseG) {
  const r = {};
  for (const k of NUTRIENTES) r[k] = valores[k] == null || Number.isNaN(valores[k]) ? null : (valores[k] * 100) / baseG;
  return r;
}

/** Aviso (não bloqueio) quando as kcal não batem com 4P + 4C + 9G. */
export function avisoKcalMacros({ kcal, prot, carb, gord }) {
  if ([kcal, prot, carb, gord].some((v) => v == null)) return '';
  const calc = 4 * prot + 4 * carb + 9 * gord;
  if (Math.abs(kcal - calc) > Math.max(20, 0.2 * Math.max(kcal, calc))) {
    return `As calorias (${Math.round(kcal)}) não batem com os macros (4P+4C+9G ≈ ${Math.round(calc)} kcal). Confira os valores.`;
  }
  return '';
}

/**
 * Receita -> alimento por 100 g.
 * receita = { id, nome, ingredientes: [{ foodId, nome, g, por100 }], porcoes, pesoFinal? }
 * Se houver peso final (preparo cozido), os nutrientes totais se distribuem por esse peso;
 * senão, pela soma dos pesos crus dos ingredientes. `resolver(id)` dá o alimento atual (fallback: snapshot).
 */
export function alimentoDaReceita(rec, resolver = () => null) {
  const total = Object.fromEntries(NUTRIENTES.map((k) => [k, 0]));
  const falta = new Set();
  let somaG = 0;
  for (const ing of rec.ingredientes) {
    const f = resolver(ing.foodId) || ing.por100;
    somaG += ing.g;
    for (const k of NUTRIENTES) {
      if (f[k] == null) falta.add(k); else total[k] += (f[k] * ing.g) / 100;
    }
  }
  const peso = rec.pesoFinal > 0 ? rec.pesoFinal : somaG;
  const food = { id: rec.id, nome: rec.nome, grupo: 'Receitas', fonte: 'Receita', origem: 'receita' };
  for (const k of NUTRIENTES) food[k] = peso > 0 ? (total[k] * 100) / peso : 0;
  const n = Math.max(1, rec.porcoes || 1);
  food.porcoes = [{ nome: n > 1 ? `porção (1/${n} da receita)` : 'receita inteira', g: peso / n }];
  if (n > 1) food.porcoes.push({ nome: 'receita inteira', g: peso });
  if (falta.size) food.falta = [...falta];
  food.total = total; food.peso = peso;
  return food;
}

/** Lista de recentes: id no topo, sem repetir, máx. 40. */
export function atualizarRecentes(lista, id, max = 40) {
  return [id, ...lista.filter((x) => x !== id)].slice(0, max);
}

// ---------- Banco ----------

let cat = null;    // catálogo em memória: { foods, indice, porId, meus, receitas }

export function invalidarCatalogo() { cat = null; }

export async function catalogo() {
  if (cat) return cat;
  const base = await carregarBase();
  const meus = (await db.getAll('customFoods')).map(([, v]) => v);
  const receitas = (await db.getAll('recipes')).map(([, v]) => v);
  const porId = new Map(base.porId);
  for (const f of meus) porId.set(f.id, f);
  const resolver = (id) => porId.get(id);
  const recFoods = receitas.map((r) => alimentoDaReceita(r, resolver));
  for (const f of recFoods) porId.set(f.id, f);
  const extras = [...meus, ...recFoods];
  cat = {
    base, meus, receitas, recFoods, porId, porcoes: base.porcoes,
    indice: [...criarIndice(extras), ...base.indice],
  };
  return cat;
}

export async function salvarAlimento(f) {
  const food = { ...f, id: f.id || 'c-' + uid(), grupo: 'Meus alimentos', criado: f.criado || Date.now() };
  await db.put('customFoods', food.id, food);
  invalidarCatalogo();
  return food;
}

export async function apagarAlimento(id) {
  const antes = await db.get('customFoods', id);
  await db.del('customFoods', id);
  invalidarCatalogo();
  return antes;
}

export async function salvarReceita(r) {
  const rec = { ...r, id: r.id || 'r-' + uid() };
  await db.put('recipes', rec.id, rec);
  invalidarCatalogo();
  return rec;
}

export async function apagarReceita(id) {
  const antes = await db.get('recipes', id);
  await db.del('recipes', id);
  invalidarCatalogo();
  return antes;
}

/** Nomes já existentes (para avisar duplicatas). */
export async function nomesExistentes() {
  const c = await catalogo();
  return new Set([...c.porId.values()].map((f) => normalizar(f.nome)));
}

// ---------- Favoritos e recentes (em config) ----------

export const ehFavorito = (id) => (estado.config.favoritos || []).includes(id);

export function alternarFavorito(id) {
  const fav = estado.config.favoritos || [];
  estado.config.favoritos = fav.includes(id) ? fav.filter((x) => x !== id) : [id, ...fav];
  salvarConfig();
  return ehFavorito(id);
}

export function registrarRecente(id) {
  estado.config.recentes = atualizarRecentes(estado.config.recentes || [], id);
  salvarConfig();
}
