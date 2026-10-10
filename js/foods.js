// foods.js — base de alimentos (foods.json), índice de busca e porções caseiras.
// A busca é pura (testável); o carregamento usa fetch relativo.

import { normalizar } from './utils.js';

// ---------- Índice e busca ----------

/** Tira trechos entre parênteses (também aninhados): na TBCA são a lista de ingredientes, que não deve casar na busca. */
export function semParenteses(s) {
  let out = '', nivel = 0;
  for (const c of s) {
    if (c === '(') nivel++;
    else if (c === ')') nivel = Math.max(0, nivel - 1);
    else if (!nivel) out += c;
  }
  return out;
}

/** Cria índice normalizado (uma vez, em memória). */
export function criarIndice(foods) {
  return foods.map((f) => {
    const norm = normalizar(f.fonte === 'TBCA' ? semParenteses(f.nome) : f.nome);
    return { f, norm, palavras: norm.split(' ') };
  });
}

// ---------- Plural, sinônimos e erro de digitação ----------

/** Singular aproximado de uma palavra normalizada (pães → pao, colheres → colher, ovos → ovo). */
export function raiz(p) {
  if (p.length <= 3) return p;
  if (/(oes|aes|aos)$/.test(p)) return p.slice(0, -3) + 'ao';
  if (/[rsz]es$/.test(p) && p.length > 4) return p.slice(0, -2);
  if (/is$/.test(p) && p.length > 4) return p.slice(0, -2) + 'l';      // pastéis → pastel
  if (p.endsWith('s')) return p.slice(0, -1);
  return p;
}

/** Troca nomes regionais pelo termo da tabela (porcoes.json › sinonimos: {"aipim": "mandioca", …}); expressões mais longas primeiro. */
export function expandirSinonimos(qNorm, sinonimos = {}) {
  let q = ` ${qNorm} `;
  for (const k of Object.keys(sinonimos).sort((a, b) => b.length - a.length)) {
    const nk = ` ${normalizar(k)} `;
    if (q.includes(nk)) q = q.split(nk).join(` ${normalizar(sinonimos[k])} `);
  }
  return q.trim();
}

/** Distância de edição (Levenshtein) com corte: devolve max+1 se passar de `max`. */
export function distancia(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < menor) menor = cur[j];
    }
    if (menor > max) return max + 1;
    ant = cur;
  }
  return ant[b.length];
}

/** Termo bate com a palavra: início de palavra (também no singular) ou, se `tolerar`, até 1–2 letras erradas. */
function bateTermo(t, p, tolerar) {
  if (p.startsWith(t) || p.startsWith(raiz(t))) return true;
  if (!tolerar || t.length < 4) return false;
  const max = t.length >= 8 ? 2 : 1;
  return distancia(t, p.slice(0, t.length), max) <= max || distancia(raiz(t), p, max) <= max;
}

// TBCA (nomes longos, muitas preparações) fica uma faixa abaixo da TACO quando as duas batem de forma parecida.
const PESO_TBCA = 1;

/**
 * Ranqueia: começa com (0) > contém (1) > todas as palavras como início de palavra, também no singular (2)
 * > todas as palavras contidas (3) > com erro de digitação de 1–2 letras por palavra (4).
 * `prioridade`: Set de ids que sobem 0,5 dentro da faixa. `bonus`: Map id → 0–0,9 (frequência, recência e
 * horário, ver inteligencia.pesosBusca). `escolha`: id que o usuário já escolheu para esta busca (vai ao topo).
 * `sinonimos`: nomes regionais (porcoes.json). Empate: nome mais curto, depois alfabético.
 * `comNota: true` devolve [{ f, s }] (s = faixa ajustada) em vez de só os alimentos.
 */
export function buscar(indice, consulta, { limite = 60, prioridade = null, bonus = null, escolha = null, sinonimos = null, comNota = false } = {}) {
  const q0 = normalizar(consulta);
  if (!q0) return [];
  const q = sinonimos ? expandirSinonimos(q0, sinonimos) : q0;
  const termos = q.split(' ');
  const res = [];
  let exatos = 0;
  for (const pass of [false, true]) {                          // 2ª passada (com tolerância) só se a 1ª não achou nada
    if (pass && exatos) break;
    for (const e of indice) {
      let s;
      if (!pass) {
        if (e.norm.startsWith(q)) s = 0;
        else if (e.norm.includes(q)) s = 1;
        else if (termos.every((t) => e.palavras.some((p) => bateTermo(t, p, false)))) s = 2;
        else if (termos.every((t) => e.norm.includes(t))) s = 3;
        else continue;
        exatos++;
      // na TBCA (10× maior) a tolerância só vale com a 1ª letra certa, para a busca seguir rápida
      } else if (termos.every((t) => e.palavras.some((p) => bateTermo(t, p, e.f.fonte !== 'TBCA' || p[0] === t[0])))) s = 4;
      else continue;
      // nome que começa pela 1ª palavra buscada vem antes ("ovo" → "Ovo, …" antes de "Macarrão, … com ovos")
      if (s >= 1 && bateTermo(termos[0], e.palavras[0], pass)) s -= 1.1;
      // palavra inteira vale mais que só o começo ("maca" → Maçã antes de Macarrão)
      if (termos.every((t) => e.palavras.some((p) => p === t || p === raiz(t)))) s -= 0.6;
      // o hábito do usuário (bônus/escolha) ainda sobe um item da TBCA
      if (e.f.fonte === 'TBCA' && !e.f.tbca) s += PESO_TBCA;     // f.tbca = substituiu nome igual da TACO
      if (prioridade?.has(e.f.id)) s -= 0.5;
      if (bonus?.has(e.f.id)) s -= bonus.get(e.f.id);
      if (escolha && e.f.id === escolha) s = -2;
      res.push([s, e]);
    }
  }
  res.sort((a, b) => a[0] - b[0] || a[1].norm.length - b[1].norm.length || (a[1].norm < b[1].norm ? -1 : 1));
  return res.slice(0, limite).map((r) => (comNota ? { f: r[1].f, s: r[0] } : r[1].f));
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
