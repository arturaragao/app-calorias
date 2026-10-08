// diary.js — lógica pura do diário: itens com snapshot de nutrientes e totais.
// Dia = { data, nomes: {refId: nome}, refeicoes: {refId: [item]} }
// item = { id, foodId, nome, fonte, g, porcao: {nome, g, qtd} | null, n: {kcal,…}, falta: [] }

import { uid } from './utils.js';

export const NUTRIENTES = ['kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg'];

export const REFEICOES_PADRAO = [
  { id: 'cafe', nome: 'Café da manhã' },
  { id: 'almoco', nome: 'Almoço' },
  { id: 'lanche', nome: 'Lanche' },
  { id: 'jantar', nome: 'Jantar' },
  { id: 'ceia', nome: 'Ceia' },
];

export function diaVazio(data) {
  return { data, nomes: {}, refeicoes: {} };
}

/** Nutrientes do item = valor por 100 g × gramas ÷ 100 (sem arredondar). */
export function nutrientesPorGramas(food, gramas) {
  const n = {}, falta = [];
  for (const k of NUTRIENTES) {
    const v = food[k];
    if (v == null) { n[k] = 0; falta.push(k); } else n[k] = (v * gramas) / 100;
  }
  return { n, falta };
}

/** Gramas de uma quantidade em porção caseira. */
export const gramasDaPorcao = (porcao, qtd) => porcao.g * qtd;

/** Cria um item (snapshot): editar o alimento depois não altera o histórico. */
export function criarItem(food, gramas, porcao = null) {
  const { n, falta } = nutrientesPorGramas(food, gramas);
  return {
    id: uid(), foodId: food.id, nome: food.nome, fonte: food.fonte || '',
    g: gramas, porcao, n, falta,
    por100: Object.fromEntries(NUTRIENTES.map((k) => [k, food[k] ?? null])),
  };
}

/** Recalcula um item com nova quantidade, usando o snapshot por 100 g guardado nele. */
export function alterarQuantidade(item, gramas, porcao = null) {
  const { n, falta } = nutrientesPorGramas(item.por100, gramas);
  return { ...item, g: gramas, porcao, n, falta };
}

export function adicionarItem(dia, refId, refNome, item) {
  const d = structuredClone(dia);
  (d.refeicoes[refId] ||= []).push(item);
  d.nomes[refId] = refNome;
  return d;
}

export function removerItem(dia, refId, itemId) {
  const d = structuredClone(dia);
  const lista = d.refeicoes[refId] || [];
  const idx = lista.findIndex((i) => i.id === itemId);
  const [removido] = idx >= 0 ? lista.splice(idx, 1) : [null];
  return { dia: d, removido, idx };
}

export function substituirItem(dia, refId, item) {
  const d = structuredClone(dia);
  const lista = d.refeicoes[refId] || [];
  const idx = lista.findIndex((i) => i.id === item.id);
  if (idx >= 0) lista[idx] = item;
  return d;
}

export function somar(itens) {
  const t = Object.fromEntries(NUTRIENTES.map((k) => [k, 0]));
  for (const it of itens) for (const k of NUTRIENTES) t[k] += it.n[k] || 0;
  return t;
}

export const totalRefeicao = (dia, refId) => somar(dia.refeicoes[refId] || []);
export const totalDia = (dia) => somar(Object.values(dia.refeicoes).flat());

/** Algum item do dia tem nutriente ausente na fonte? (para marcar o total como parcial) */
export function camposFaltando(itens) {
  const s = new Set();
  for (const it of itens) for (const k of it.falta || []) s.add(k);
  return [...s];
}

/** Refeições a exibir: as configuradas + as antigas que ainda tenham itens no dia. */
export function refeicoesDoDia(dia, configuradas) {
  const lista = configuradas.map((r) => ({ ...r }));
  for (const id of Object.keys(dia.refeicoes)) {
    if (!lista.some((r) => r.id === id) && dia.refeicoes[id].length) lista.push({ id, nome: dia.nomes[id] || 'Refeição' });
  }
  return lista;
}
