// views/sugestao.js — "O que comer agora" e contexto do histórico para os avisos de lançamento suspeito.
// Tudo local (sem IA, sem rede): usa os alimentos frequentes/favoritos e a quantidade típica do usuário.

import { estado, lerDia, gravarDia } from '../state.js';
import { db } from '../db.js';
import { criarItem, adicionarItem, distribuicaoRefeicoes } from '../diary.js';
import { catalogo, registrarRecente } from '../custom.js';
import { candidatosFrequentes, sugerirSaudaveis, fracaoProximaRefeicao, BASICOS, tipoRefeicao } from '../inteligencia.js';
import { porcoesDe } from '../foods.js';
import { abrirFolha, fecharFolha, aviso, esc, $, vibrar, ic } from '../ui.js';
import { chaveData, somarDias, fmtKcal, fmtG } from '../utils.js';

// ---------- Histórico recente (cache curto em memória) ----------

let cache = null;   // { ts, diarios }
/** Diários dos últimos `dias` dias (cache de 1 min; gravar um dia não exige invalidar: é só sugestão). */
export async function diariosRecentes(dias = 30) {
  if (!cache || Date.now() - cache.ts > 60000) {
    cache = { ts: Date.now(), todos: (await db.getAll('diary')).map(([, d]) => d) };
  }
  const ini = somarDias(chaveData(), -dias);
  return cache.todos.filter((d) => d.data >= ini);
}

/** Contexto para avaliarSuspeito: kcal dos itens dos últimos 90 dias e gramas usuais (mediana) do alimento. */
export async function contextoSuspeito(foodId) {
  const itens = (await diariosRecentes(90)).flatMap((d) => Object.values(d.refeicoes || {}).flat());
  const gs = itens.filter((i) => foodId && i.foodId === foodId && i.g > 0).map((i) => i.g).sort((a, b) => a - b);
  return { kcalItensUsuario: itens.map((i) => i.n?.kcal || 0), gUsual: gs.length >= 2 ? gs[gs.length >> 1] : null };
}

// ---------- Refeição provável pelo horário ----------
export function refeicaoPeloHorario(refs = estado.config.refeicoes) {
  const h = new Date().getHours();
  const id = h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia';
  return (refs.find((r) => r.id === id) || refs[0])?.id;
}

// ---------- Candidatos: o que você come + básicos nutritivos da TACO ----------

let porNome = null;
/** Habituais da refeição (ou do dia) + básicos nutritivos do tipo de refeição (refId null = todos). */
export async function candidatosAgora(refId, recentes) {
  const cat = await catalogo();
  porNome ||= new Map(cat.base.foods.map((f) => [f.nome, f]));
  const opc = { favoritos: estado.config.favoritos || [], ultimaQtd: estado.config.ultimaQtd || {}, max: 20 };
  let hab = refId ? candidatosFrequentes(recentes, (id) => cat.porId.get(id), { ...opc, refId }) : [];
  if (hab.length < 2) hab = candidatosFrequentes(recentes, (id) => cat.porId.get(id), opc);
  const ids = new Set(hab.map((c) => c.food.id));
  const nomes = refId ? BASICOS[tipoRefeicao(refId)] : [...BASICOS.leve, ...BASICOS.prato];
  const basicos = [...new Set(nomes)].map((n) => porNome.get(n)).filter((f) => f && !ids.has(f.id)).map((food) => ({
    food, vezes: 0, gTipico: estado.config.ultimaQtd[food.id]?.g || porcoesDe(food, cat.porcoes, estado.config.porcoesUsuario)[0]?.g || 100,
  }));
  return [...hab.map((c) => ({ ...c, habitual: true })), ...basicos];
}

// ---------- Primeira sugestão (cartão do Diário) ----------

/** Refeição alvo: a do horário; se já tem itens, a próxima vazia. */
function refeicaoAlvo(dia, refs) {
  const vazias = new Set(refs.filter((r) => !(dia.refeicoes[r.id] || []).length).map((r) => r.id));
  const ordem = refs.map((r) => r.id), ini = ordem.indexOf(refeicaoPeloHorario(refs));
  return { vazias, refId: ordem.slice(Math.max(0, ini)).find((id) => vazias.has(id)) || ordem[Math.max(0, ini)] };
}

/** Melhor combinação para a próxima refeição (mesma lógica da folha), ou null. */
export async function primeiraSugestao(dia, restante) {
  const cat = await catalogo();
  const recentes = await diariosRecentes(30);
  const opc = { favoritos: estado.config.favoritos || [], ultimaQtd: estado.config.ultimaQtd || {} };
  const refs = estado.config.refeicoes;
  const { vazias, refId } = refeicaoAlvo(dia, refs);
  const cands = await candidatosAgora(refId, recentes);
  const f = fracaoProximaRefeicao(refId, refs.map((r) => r.id), vazias, distribuicaoRefeicoes(refs, estado.config.distRef));
  const alvo = Object.fromEntries(['kcal', 'prot', 'carb', 'gord'].map((k) => [k, Math.max(0, restante[k] || 0) * f]));
  if (alvo.kcal < 50) return null;
  const combo = sugerirSaudaveis(alvo, cands, { n: 1, agrado: false })[0];
  return combo ? { refId, nomeRef: refs.find((r) => r.id === refId)?.nome || '', combo } : null;
}

/** Lança uma combinação na refeição, com desfazer. */
export async function lancarCombo(data, refId, combo, aoLancar) {
  const nomeRef = estado.config.refeicoes.find((x) => x.id === refId)?.nome;
  const antes = await lerDia(data);
  let d = antes;
  for (const it of combo.itens) { d = adicionarItem(d, refId, nomeRef, criarItem(it.food, it.g)); registrarRecente(it.food.id); }
  await gravarDia(d);
  vibrar(15);
  await aoLancar?.();
  aviso(`${combo.itens.length} item(ns) → ${nomeRef}`, { acao: async () => { await gravarDia(antes); aoLancar?.(); } });
}

// ---------- Folha "O que comer agora" ----------

/**
 * restante = { kcal, prot, carb, gord } do dia `dia`. Alvo padrão: a parte do restante para a refeição escolhida
 * (parcela dela entre as refeições ainda vazias); opção "Restante do dia". `aoLancar` redesenha a tela de origem.
 */
export async function folhaOQueComer({ dia, restante, aoLancar }) {
  const cat = await catalogo();
  const recentes = await diariosRecentes(30);
  const opc = { favoritos: estado.config.favoritos || [], ultimaQtd: estado.config.ultimaQtd || {} };
  const candsDia = await candidatosAgora(null, recentes);
  const cacheRef = new Map();
  // modo refeição: o que você costuma comer nela (+ favoritos) e básicos nutritivos desse tipo de refeição
  const candsDe = async (ref) => cacheRef.get(ref) || cacheRef.set(ref, await candidatosAgora(ref, recentes)).get(ref);
  const refs = estado.config.refeicoes;
  const dist = distribuicaoRefeicoes(refs, estado.config.distRef);
  const alvoInicial = refeicaoAlvo(dia, refs), vazias = alvoInicial.vazias;
  let refId = alvoInicial.refId, modo = 'ref', combos = [];
  const p = abrirFolha('O que comer agora', '<div id="oqc"></div>', { foco: false });
  const r0 = (o, k) => Math.max(0, o[k] || 0);
  const desenhar = async () => {
    const f = modo === 'dia' ? 1 : fracaoProximaRefeicao(refId, refs.map((r) => r.id), vazias, dist);
    const alvo = Object.fromEntries(['kcal', 'prot', 'carb', 'gord'].map((k) => [k, r0(restante, k) * f]));
    combos = sugerirSaudaveis(alvo, modo === 'dia' ? candsDia : await candsDe(refId));
    const nomeRef = refs.find((x) => x.id === refId)?.nome || '';
    $('#oqc', p).innerHTML = `
      <div class="seg" role="group"><button type="button" data-modo="ref" aria-pressed="${modo === 'ref'}">Próxima refeição</button>
        <button type="button" data-modo="dia" aria-pressed="${modo === 'dia'}">Restante do dia</button></div>
      <label class="campo"><span>Refeição</span><select name="ref">${refs.map((x) =>
        `<option value="${x.id}" ${x.id === refId ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <p class="mudo">Alvo${modo === 'ref' ? ` para ${esc(nomeRef)} (${Math.round(f * 100)}% do que falta hoje)` : ' (tudo o que falta hoje)'}:
        <b class="num">${fmtKcal(alvo.kcal)} kcal</b> · P ${fmtG(alvo.prot)} · C ${fmtG(alvo.carb)} · G ${fmtG(alvo.gord)} g.
        Prioriza o que faz bem (frutas, verduras, leguminosas, proteínas magras, integrais) entre o que você come e básicos da TACO; no máximo um agrado.</p>
      ${combos.length ? combos.map((c, i) => `<div class="card sug-combo${c.tipo === 'agrado' ? ' agrado' : ''}" style="margin:10px 0;padding:12px">
        <span class="chip">${c.tipo === 'agrado' ? ic('cake-slice', 'p') + ' um agrado' : ic('leaf', 'p') + ` nutritivo · ${Math.round(c.saude * 100)}`}</span>
        <ul class="lista-simples">${c.itens.map((it) => `<li><span>${esc(it.food.nome)}</span> <b class="num">${fmtG(it.g)} g</b></li>`).join('')}</ul>
        <p class="num mudo" style="margin:6px 0 8px">${fmtKcal(c.tot.kcal)} kcal · P ${fmtG(c.tot.prot)} · C ${fmtG(c.tot.carb)} · G ${fmtG(c.tot.gord)} g</p>
        <button class="btn prim bloco" data-lancar-combo="${i}">Lançar em ${esc(nomeRef)}</button></div>`).join('')
        : `<p class="nota">${r0(restante, 'kcal') < 50 ? 'Você já está na meta de hoje.' : alvo.kcal < 50 ? 'Quase nada previsto para esta refeição; veja "Restante do dia".'
          : 'Ainda não há alimentos frequentes ou favoritos suficientes. Lance refeições por alguns dias ou favorite alimentos para receber sugestões.'}</p>`}
      ${combos.length ? '<p class="mudo" style="font-size:.78rem">Sugestão aproximada; ajuste as quantidades no diário se quiser.</p>' : ''}`;
  };
  desenhar();
  p.onchange = (e) => { if (e.target.name === 'ref') { refId = e.target.value; desenhar(); } };
  p.onclick = async (e) => {
    const m = e.target.closest('[data-modo]');
    if (m) { modo = m.dataset.modo; return desenhar(); }
    const b = e.target.closest('[data-lancar-combo]');
    if (!b) return;
    fecharFolha();
    await lancarCombo(dia.data, refId, combos[Number(b.dataset.lancarCombo)], aoLancar);
  };
}
