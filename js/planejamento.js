// planejamento.js — lógica pura do Pacote 13: fator de cocção pelo par cru/pronto da TACO, montar a semana sem IA
// (refeições salvas + combinações dos alimentos habituais) e lista de compras agregada.

import { normalizar } from './utils.js';
import { sugerirCombinacoes } from './inteligencia.js';

// ---------- Fator de cocção (rendimento) ----------
// Aproximação declarada: a energia se conserva no preparo (só entra/sai água), então
// gramas prontas por grama crua = kcal/100 g cru ÷ kcal/100 g pronto. Vale só quando a TACO tem o par
// (ex.: "Arroz, tipo 1, cru" <-> "Arroz, tipo 1, cozido"); preparos com gordura adicionada (frito) ficam de fora.
const PREPAROS = ['cozido', 'cozida', 'cozidos', 'cozidas', 'grelhado', 'grelhada', 'assado', 'assada', 'refogado', 'refogada'];

/** Chave do alimento sem o preparo/cru (para achar o par). */
function chavePar(nome) {
  return normalizar(nome).split(' ').filter((p) => !PREPAROS.includes(p) && !/^(cru|crua|crus|cruas)$/.test(p)).join(' ');
}
const ehCru = (nome) => /\b(cru|crua|crus|cruas)\b/.test(normalizar(nome));
const ehPronto = (nome) => normalizar(nome).split(' ').some((p) => PREPAROS.includes(p));

/** Índice dos pares cru/pronto da base: chave → { cru, pronto }. */
export function paresCoccao(foods) {
  const m = new Map();
  for (const f of foods) {
    if (f.kcal == null || f.kcal <= 0 || String(f.id).startsWith('r-')) continue;
    const tipo = ehCru(f.nome) ? 'cru' : ehPronto(f.nome) ? 'pronto' : null;
    if (!tipo) continue;
    const k = chavePar(f.nome);
    const p = m.get(k) || {};
    if (!p[tipo]) p[tipo] = f;
    m.set(k, p);
  }
  return m;
}

/** Rendimento (g pronto por g cru) do alimento, se a TACO tiver o par; senão null. Aceita o cru ou o pronto. */
export function rendimento(food, pares) {
  const p = pares.get(chavePar(food.nome));
  if (!p?.cru || !p?.pronto) return null;
  const r = p.cru.kcal / p.pronto.kcal;
  return r > 0.2 && r < 5 ? { fator: r, cru: p.cru, pronto: p.pronto } : null;
}

/** Peso pronto estimado de uma receita: soma de cada ingrediente cru × rendimento (sem par = mesmo peso). */
export function pesoProntoEstimado(ingredientes, porId, pares) {
  let total = 0, comPar = 0;
  for (const ing of ingredientes) {
    const f = porId(ing.foodId) || { nome: ing.nome, kcal: ing.por100?.kcal };
    const r = ehCru(f.nome) ? rendimento(f, pares) : null;
    total += ing.g * (r ? r.fator : 1);
    if (r) comPar++;
  }
  return { g: Math.round(total), comPar, n: ingredientes.length };
}

// ---------- Montar a semana sem IA ----------

const chaveCombo = (itens) => itens.map((i) => i.foodId || i.food?.id).sort().join('+');

/**
 * datas: dias a planejar; refs: refeições; alvos(data, refId) → { kcal, prot, carb, gord } (parcela da meta do dia);
 * candidatos(refId) → candidatos do otimizador (inteligencia.candidatosFrequentes); salvas: refeições salvas
 * ({ nome, itens (snapshot), refId? }); ocupadas: Set('data|ref') que já têm itens; maxRepeticoes: variedade mínima
 * (a mesma combinação no máximo N vezes por refeição na semana).
 * Devolve [{ data, refId, origem: 'salva'|'combo', nome, itens: [{ food, g } | snapshot] }].
 */
export function montarSemana({ datas, refs, alvos, candidatos, salvas = [], ocupadas = new Set(), maxRepeticoes = 2, usarSalvas = true }) {
  const usos = new Map();          // ref|combo → vezes
  const out = [];
  for (const data of datas) {
    for (const r of refs) {
      if (ocupadas.has(`${data}|${r.id}`)) continue;
      const alvo = alvos(data, r.id);
      if (!alvo || alvo.kcal < 80) continue;
      const opcoes = [];
      if (usarSalvas) {
        for (const s of salvas) {
          const kcal = s.itens.reduce((a, i) => a + (i.n?.kcal || 0), 0);
          if (kcal >= alvo.kcal * 0.75 && kcal <= alvo.kcal * 1.25) opcoes.push({ origem: 'salva', nome: s.nome, itens: s.itens, erro: Math.abs(kcal - alvo.kcal) / alvo.kcal });
        }
        opcoes.sort((a, b) => a.erro - b.erro);
      }
      for (const c of sugerirCombinacoes(alvo, candidatos(r.id) || [], { n: 5 })) {
        opcoes.push({ origem: 'combo', nome: c.itens.map((i) => i.food.nome.split(',')[0]).join(' + '), itens: c.itens.map((i) => ({ food: i.food, g: i.g, foodId: i.food.id })) });
      }
      const escolha = opcoes.find((o) => (usos.get(`${r.id}|${chaveCombo(o.itens)}`) || 0) < maxRepeticoes);
      if (!escolha) continue;
      const k = `${r.id}|${chaveCombo(escolha.itens)}`;
      usos.set(k, (usos.get(k) || 0) + 1);
      out.push({ data, refId: r.id, origem: escolha.origem, nome: escolha.nome, itens: escolha.itens });
    }
  }
  return out;
}

// ---------- Lista de compras ----------

/**
 * itens: itens planejados [{ foodId, nome, g }]; porId(id) → alimento (base/Meus/receita); receitas: Map id → receita;
 * pares: paresCoccao(base). Receitas viram ingredientes (proporcionais ao peso lançado); alimento pronto com par vira
 * gramas crus (≈). Devolve [{ grupo, itens: [{ id, nome, g, aprox }] }] ordenado por grupo e nome.
 */
export function listaCompras(itens, { porId, receitas = new Map(), pares = new Map() }) {
  const soma = new Map();
  const add = (food, nome, g, aprox = false) => {
    if (!(g > 0)) return;
    const k = food?.id || 'nome:' + nome;
    const x = soma.get(k) || { id: k, nome: food?.nome || nome, grupo: food?.grupo || 'Outros', g: 0, aprox: false };
    x.g += g; x.aprox = x.aprox || aprox;
    soma.set(k, x);
  };
  for (const it of itens) {
    if (!it.foodId) continue;                                   // adição rápida não tem o que comprar
    const rec = receitas.get(it.foodId);
    if (rec) {
      const pesoTot = rec.pesoFinal > 0 ? rec.pesoFinal : rec.ingredientes.reduce((s, i) => s + i.g, 0);
      for (const ing of rec.ingredientes) add(porId(ing.foodId) || { id: ing.foodId, nome: ing.nome }, ing.nome, (it.g / pesoTot) * ing.g);
      continue;
    }
    const f = porId(it.foodId) || { id: it.foodId, nome: it.nome };
    const r = !ehCru(f.nome) && ehPronto(f.nome) ? rendimento(f, pares) : null;
    if (r) add(r.cru, r.cru.nome, it.g / r.fator, true);       // compra-se cru: pronto ÷ rendimento
    else add(f, f.nome, it.g);
  }
  const grupos = new Map();
  for (const x of soma.values()) (grupos.get(x.grupo) || grupos.set(x.grupo, []).get(x.grupo)).push({ ...x, g: Math.round(x.g) });
  return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([grupo, l]) => ({ grupo, itens: l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }));
}

/** Texto para compartilhar (WhatsApp): grupos em negrito, [ ] / [x] por item, kg acima de 1000 g. */
export function textoCompras(lista, comprados = new Set(), titulo = 'Lista de compras') {
  const q = (g) => (g >= 1000 ? `${(Math.round(g / 100) / 10).toLocaleString('pt-BR')} kg` : `${g} g`);
  return [`*${titulo}*`, ...lista.flatMap((gr) => ['', `*${gr.grupo}*`,
    ...gr.itens.map((i) => `${comprados.has(i.id) ? '[x]' : '[ ]'} ${i.nome.split(',').slice(0, 3).join(',')} — ${i.aprox ? '≈ ' : ''}${q(i.g)}${i.aprox ? ' (cru)' : ''}`)])].join('\n');
}
