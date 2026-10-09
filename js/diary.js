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

/** Etiquetas do dia (notas/etiquetas aparecem no calendário e no relatório). 'treino' ativa a meta de dia de treino. */
export const ETIQUETAS = [
  ['treino', '🏋️ Treino'], ['livre', '🍕 Dia livre'], ['festa', '🎉 Festa/restaurante'],
  ['doente', '🤒 Doente'], ['viagem', '✈️ Viagem'], ['sono', '😴 Dormiu mal'], ['plantao', '🏥 Plantão'],
];
export const ehTreino = (dia) => !!dia?.tags?.includes('treino');
export const temAnotacao = (dia) => !!(dia?.tags?.length || dia?.nota);

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

/** Adição rápida: kcal e macros digitados direto (sem alimento). Ausente = 0, marcado. */
export function criarItemRapido({ nome, ...valores }) {
  const n = {}, falta = [];
  for (const k of NUTRIENTES) {
    const v = valores[k];
    if (v == null || Number.isNaN(v)) { n[k] = 0; if (k === 'fibra' || k === 'sodio_mg') falta.push(k); } else n[k] = v;
  }
  return { id: uid(), foodId: null, rapido: true, nome: nome || 'Adição rápida', fonte: '', g: 0, porcao: null, n, falta };
}

/** Cópia de itens com ids novos (copiar refeição/dia). */
export const copiarItens = (itens) => itens.map((it) => ({ ...structuredClone(it), id: uid() }));

/** Acrescenta os itens de `origem` (dia inteiro ou uma refeição) em `destino`. */
export function copiarPara(destino, origem, refId = null) {
  const d = structuredClone(destino);
  const refs = refId ? [refId] : Object.keys(origem.refeicoes);
  let n = 0;
  for (const r of refs) {
    const itens = origem.refeicoes[r] || [];
    if (!itens.length) continue;
    (d.refeicoes[r] ||= []).push(...copiarItens(itens));
    d.nomes[r] = d.nomes[r] || origem.nomes[r];
    n += itens.length;
  }
  return { dia: d, n };
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

// ---------- Refeições salvas ("meu café de sempre") ----------

/** Cria uma refeição salva a partir dos itens (snapshot, sem ids). */
export function criarRefeicaoSalva(nome, itens) {
  return { id: uid(), nome, itens: itens.map(({ id, ...resto }) => structuredClone(resto)), criada: Date.now() };
}

/** Lança todos os itens de uma refeição salva na refeição `refId` do dia (ids novos). */
export function lancarSalva(dia, refId, refNome, salva) {
  let d = dia;
  for (const it of salva.itens) d = adicionarItem(d, refId, refNome, { ...structuredClone(it), id: uid() });
  return d;
}

// ---------- Sugestões pelo horário ----------

/**
 * O que costuma ser lançado nesta refeição: alimentos (com foodId) nos diários dados, por frequência
 * (desempate: mais recente). Devolve [{ foodId, vezes, ultima: { g, porcao } }].
 */
export function sugestoesRefeicao(diarios, refId, max = 6) {
  const cont = new Map();
  const ordenados = [...diarios].sort((a, b) => (a.data < b.data ? -1 : 1));
  for (const d of ordenados) {
    for (const it of d.refeicoes[refId] || []) {
      if (!it.foodId) continue;
      const c = cont.get(it.foodId) || { foodId: it.foodId, vezes: 0, data: '', ultima: null };
      c.vezes++; c.data = d.data; c.ultima = { g: it.g, porcao: it.porcao };
      cont.set(it.foodId, c);
    }
  }
  return [...cont.values()].filter((c) => c.vezes >= 2)
    .sort((a, b) => b.vezes - a.vezes || (a.data < b.data ? 1 : -1)).slice(0, max)
    .map(({ data, ...c }) => c);
}

// ---------- Proteína por refeição ----------
// Alvo por refeição ≈ 0,4 g/kg (Schoenfeld BJ, Aragon AA. J Int Soc Sports Nutr 2018;15:10),
// distribuído em ≥ 4 refeições para maximizar a síntese proteica muscular.
export const PROT_G_KG_REFEICAO = 0.4;
export const alvoProteinaRefeicao = (peso) => Math.round(PROT_G_KG_REFEICAO * (peso || 0));
