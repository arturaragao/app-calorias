// views/sugestao.js — "O que comer agora" e contexto do histórico para os avisos de lançamento suspeito.
// Tudo local (sem IA, sem rede): usa os alimentos frequentes/favoritos e a quantidade típica do usuário.

import { estado, lerDia, gravarDia } from '../state.js';
import { db } from '../db.js';
import { criarItem, adicionarItem, distribuicaoRefeicoes } from '../diary.js';
import { catalogo, registrarRecente } from '../custom.js';
import { candidatosFrequentes, sugerirCombinacoes, fracaoProximaRefeicao } from '../inteligencia.js';
import { abrirFolha, fecharFolha, aviso, esc, $, vibrar } from '../ui.js';
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

// ---------- Folha "O que comer agora" ----------

/**
 * restante = { kcal, prot, carb, gord } do dia `dia`. Alvo padrão: a parte do restante para a refeição escolhida
 * (parcela dela entre as refeições ainda vazias); opção "Restante do dia". `aoLancar` redesenha a tela de origem.
 */
export async function folhaOQueComer({ dia, restante, aoLancar }) {
  const cat = await catalogo();
  const recentes = await diariosRecentes(30);
  const opc = { favoritos: estado.config.favoritos || [], ultimaQtd: estado.config.ultimaQtd || {} };
  const candsDia = candidatosFrequentes(recentes, (id) => cat.porId.get(id), opc);
  // modo refeição: alimentos que você costuma comer nela (+ favoritos); poucos → todos os frequentes
  const candsDe = (ref) => { const c = candidatosFrequentes(recentes, (id) => cat.porId.get(id), { ...opc, refId: ref }); return c.length >= 2 ? c : candsDia; };
  const refs = estado.config.refeicoes;
  const dist = distribuicaoRefeicoes(refs, estado.config.distRef);
  const vazias = new Set(refs.filter((r) => !(dia.refeicoes[r.id] || []).length).map((r) => r.id));
  // refeição pelo horário; se já tem itens, a próxima vazia
  const ordem = refs.map((r) => r.id), ini = ordem.indexOf(refeicaoPeloHorario(refs));
  let refId = ordem.slice(Math.max(0, ini)).find((id) => vazias.has(id)) || ordem[Math.max(0, ini)], modo = 'ref', combos = [];
  const p = abrirFolha('O que comer agora', '<div id="oqc"></div>', { foco: false });
  const r0 = (o, k) => Math.max(0, o[k] || 0);
  const desenhar = () => {
    const f = modo === 'dia' ? 1 : fracaoProximaRefeicao(refId, refs.map((r) => r.id), vazias, dist);
    const alvo = Object.fromEntries(['kcal', 'prot', 'carb', 'gord'].map((k) => [k, r0(restante, k) * f]));
    combos = sugerirCombinacoes(alvo, modo === 'dia' ? candsDia : candsDe(refId));
    const nomeRef = refs.find((x) => x.id === refId)?.nome || '';
    $('#oqc', p).innerHTML = `
      <div class="seg" role="group"><button type="button" data-modo="ref" aria-pressed="${modo === 'ref'}">Próxima refeição</button>
        <button type="button" data-modo="dia" aria-pressed="${modo === 'dia'}">Restante do dia</button></div>
      <label class="campo"><span>Refeição</span><select name="ref">${refs.map((x) =>
        `<option value="${x.id}" ${x.id === refId ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <p class="mudo">Alvo${modo === 'ref' ? ` para ${esc(nomeRef)} (${Math.round(f * 100)}% do que falta hoje)` : ' (tudo o que falta hoje)'}:
        <b class="num">${fmtKcal(alvo.kcal)} kcal</b> · P ${fmtG(alvo.prot)} · C ${fmtG(alvo.carb)} · G ${fmtG(alvo.gord)} g.
        Com os alimentos que você mais usa e seus favoritos (valores da tabela de cada alimento).</p>
      ${combos.length ? combos.map((c, i) => `<div class="card sug-combo" style="margin:10px 0;padding:12px">
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
    const c = combos[Number(b.dataset.lancarCombo)];
    const nomeRef = refs.find((x) => x.id === refId)?.nome;
    const antes = await lerDia(dia.data);
    let d = antes;
    for (const it of c.itens) { d = adicionarItem(d, refId, nomeRef, criarItem(it.food, it.g)); registrarRecente(it.food.id); }
    await gravarDia(d);
    vibrar(15);
    fecharFolha();
    await aoLancar?.();
    aviso(`${c.itens.length} item(ns) → ${nomeRef}`, { acao: async () => { await gravarDia(antes); aoLancar?.(); } });
  };
}
