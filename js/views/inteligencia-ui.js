// views/inteligencia-ui.js — blocos do Progresso do Pacote 14: padrões da semana, "Pergunte ao app",
// lacuna de micronutrientes (com alimentos ricos) e histórico dos check-ins. Tudo calculado no aparelho.

import { estado, salvarConfig } from '../state.js';
import { ETIQUETAS } from '../diary.js';
import { detectarPadroes, cartoesDaSemana } from '../padroes.js';
import { maiorLacuna, alimentosRicos } from '../nutricao.js';
import { interpretarPergunta, normalizarConsulta, executarConsulta, respostaTexto, PERGUNTAS_PRONTAS } from '../perguntas.js';
import { motorIA, perguntaParaConsulta } from '../ia.js';
import { esc, ic, $, aviso } from '../ui.js';
import { chaveData, somarDias, fmtNum } from '../utils.js';
import { idadePerfil } from './onboarding.js';
import { dadosHistorico } from './dados.js';
import { cartaoHistoricoCheckins } from './checkin-ui.js';

const fmtMic = (v) => fmtNum(v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

/** Preenche #c-padroes, #c-perg, #c-lacuna e #c-checkins (os que existirem na tela). */
export async function montarInteligencia(tela, { baseAlim = null } = {}) {
  const H = await dadosHistorico();
  const hoje = chaveData();
  desenharPadroes($('#c-padroes', tela), H, hoje);
  desenharPergunte($('#c-perg', tela), H, hoje);
  desenharLacuna($('#c-lacuna', tela), H, hoje, baseAlim);
  const ck = $('#c-checkins', tela);
  if (ck) cartaoHistoricoCheckins(ck);
}

// ---------- Padrões (no máximo 2 por semana) ----------
function desenharPadroes(el, H, hoje) {
  if (!el) return;
  const ult = H.dias.filter((d) => d.data >= somarDias(hoje, -27) && d.data <= hoje);
  const nomesTags = Object.fromEntries(ETIQUETAS.map(([id, r]) => [id, r]));
  const cards = cartoesDaSemana(detectarPadroes(ult, { peso: H.pesoEm(hoje), nomesTags }), estado.config.padroesOcultos || []);
  el.hidden = !cards.length;
  el.innerHTML = cards.length ? `<h2 style="margin-bottom:6px">${ic('lightbulb')} Padrões das últimas 4 semanas</h2>
    ${cards.map((c) => `<div class="padrao"><b>${esc(c.titulo)}</b><p>${esc(c.texto)}</p>
      <button type="button" class="btn texto peq" data-ocultar="${c.tipo}">Não mostrar este tipo</button></div>`).join('')}
    <p class="mudo" style="margin:4px 0 0;font-size:var(--fs-12)">Observações do próprio histórico (heurística do app), não recomendações clínicas.</p>` : '';
  el.onclick = async (e) => {
    const b = e.target.closest('[data-ocultar]');
    if (!b) return;
    estado.config.padroesOcultos = [...new Set([...(estado.config.padroesOcultos || []), b.dataset.ocultar])];
    await salvarConfig();
    desenharPadroes(el, H, hoje);
    aviso('Esse tipo de padrão não aparece mais.', { acao: async () => {
      estado.config.padroesOcultos = estado.config.padroesOcultos.filter((t) => t !== b.dataset.ocultar);
      await salvarConfig(); desenharPadroes(el, H, hoje);
    } });
  };
}

// ---------- Pergunte ao app ----------
function desenharPergunte(el, H, hoje) {
  if (!el) return;
  const refs = estado.config.refeicoes;
  el.innerHTML = `<h2 style="margin-bottom:6px">${ic('message-circle-question')} Pergunte ao app</h2>
    <form class="linha perg-form" novalidate><input type="text" name="q" maxlength="160" placeholder="ex.: proteína no jantar nas últimas 2 semanas" aria-label="Pergunta">
      <button class="btn prim" style="flex:0 0 auto">Perguntar</button></form>
    <div class="fr-chips" style="margin-top:8px">${PERGUNTAS_PRONTAS.map((t) => `<button type="button" class="chip-tog" data-pronta>${esc(t)}</button>`).join('')}</div>
    <div id="perg-r" aria-live="polite"></div>`;
  const responder = async (texto) => {
    const out = $('#perg-r', el);
    let c = interpretarPergunta(texto, hoje, refs), viaIA = false;
    if (!c && (await motorIA().catch(() => null))) {
      out.innerHTML = '<p class="mudo">Entendendo a pergunta…</p>';
      try { c = normalizarConsulta(await perguntaParaConsulta(texto, refs, hoje), hoje, refs); viaIA = true; } catch (e) { out.innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    }
    if (!c) { out.innerHTML = '<p class="mudo">Não entendi. Cite um nutriente (calorias, proteína, carboidrato, gordura, fibra, sódio) e um período (hoje, esta semana, últimos 14 dias…).</p>'; return; }
    const r = executarConsulta(c, H.todos);
    const nomeRef = refs.find((x) => x.id === c.refeicao)?.nome || '';
    out.innerHTML = `<p class="perg-resp num">${esc(respostaTexto(c, r, nomeRef))}</p>
      <p class="mudo" style="margin:0;font-size:var(--fs-12)">Calculado no aparelho com o seu diário${viaIA ? '; a IA só leu a pergunta (nenhum dado do diário saiu daqui)' : ''}.</p>`;
  };
  el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const t = e.target.q.value.trim(); if (t) responder(t); };
  el.onclick = (e) => {
    const b = e.target.closest('[data-pronta]');
    if (b) { el.querySelector('[name=q]').value = b.textContent; responder(b.textContent); }
  };
}

// ---------- Lacuna de micronutrientes → alimentos ricos ----------
function desenharLacuna(el, H, hoje, baseAlim) {
  if (!el) return;
  const n = Number(estado.periodoProg) || 30;
  const ini = somarDias(hoje, -(n - 1));
  const dias = H.todos.filter((d) => d.data >= ini && d.data <= hoje);
  const itens = dias.flatMap((d) => Object.values(d.refeicoes || {}).flat()).filter((i) => !i.planejado);
  const nDias = H.dias.filter((d) => d.data >= ini && d.data <= hoje).length;
  const p = estado.perfil || {};
  const l = maiorLacuna(itens, nDias, { sexo: p.sexo, idade: idadePerfil(p) || 30 });
  if (!l || l.frac >= 0.9 || !baseAlim) { el.hidden = true; return; }
  el.hidden = false;
  const comidos = new Set(H.todos.filter((d) => d.data >= somarDias(hoje, -59)).flatMap((d) => Object.values(d.refeicoes || {}).flat().map((i) => i.foodId)).filter(Boolean));
  const r = alimentosRicos(l.campo, baseAlim.foods, comidos);
  const linha = (x) => `<li><button type="button" data-buscar-alim="${esc(x.f.nome)}"><span>${esc(x.f.nome)}</span>
    <span class="num mudo">${fmtMic(x.por100kcal)} ${l.un}/100 kcal</span></button></li>`;
  el.innerHTML = `<h2 style="margin-bottom:6px">${ic('leaf')} Micronutriente mais em falta</h2>
    <p style="margin:0 0 6px"><b>${esc(l.nome)}</b>: média de <b class="num">${fmtMic(l.media)} ${l.un}</b>/dia, ${Math.round(l.frac * 100)}% da referência (${fmtMic(l.ref)} ${l.un}, DRI) em ${nDias} dia(s).</p>
    ${l.cobertura < 0.8 ? '<p class="mudo" style="margin:0 0 6px;font-size:var(--fs-12)">Parcial: há itens sem micronutrientes (adição rápida, rótulos).</p>' : ''}
    ${r.seus.length ? `<p class="secao" style="margin:8px 0 2px">Que você já come</p><ul class="lista lista-ricos">${r.seus.map(linha).join('')}</ul>` : ''}
    <p class="secao" style="margin:8px 0 2px">Mais ricos da TACO (por 100 kcal)</p><ul class="lista lista-ricos">${r.outros.map(linha).join('')}</ul>`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-buscar-alim]');
    if (b) location.hash = '#adicionar?q=' + encodeURIComponent(b.dataset.buscarAlim);
  };
}
