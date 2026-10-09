// views/checkin-ui.js — cartão "Check-in da semana" (Diário, a partir de segunda) e histórico de check-ins (Progresso).

import { kvGet, kvSet } from '../db.js';
import { estado, salvarMetas } from '../state.js';
import { metaCalorica, registrarHistorico } from '../goals.js';
import { calcularCheckin, textoCheckin, aplicarDeltaMetas, registrarCheckin, mediaMetas } from '../checkin.js';
import { abrirFolha, fecharFolha, aviso, esc, ic, campoPasso, ligarPassos, valorDe, vibrar } from '../ui.js';
import { chaveData, fmtKcal, fmtData } from '../utils.js';
import { idadePerfil } from './onboarding.js';
import { dadosHistorico, invalidarHistorico } from './dados.js';

const ROT = { aceitar: 'Aceita', ajustar: 'Ajustada', manter: 'Mantida' };

/** Check-in desta semana (calculado agora), ou null sem dados suficientes. */
export async function checkinAtual() {
  const { dias, tend } = await dadosHistorico();
  const p = estado.perfil;
  if (!p) return null;
  return calcularCheckin({ dias, tend, hoje: chaveData(), perfil: p, metas: estado.metas, mc: metaCalorica({ ...p, idade: idadePerfil(p) }) });
}

/** Desenha o cartão no elemento `el` (escondido se não há dados ou se a semana já foi resolvida). */
export async function cartaoCheckin(el, aoMudar) {
  const c = await checkinAtual().catch(() => null);
  const feitos = (await kvGet('checkins', [])) || [];
  if (!el?.isConnected) return;
  if (!c || feitos.some((x) => x.semana === c.semana)) { el.hidden = true; return; }
  el.hidden = false;
  const alinhada = Math.abs(c.diferenca) < 50;
  el.innerHTML = `<div class="card-tit"><h2>${ic('calendar-check')} Check-in da semana</h2><span class="selo ${c.confianca === 'alta' ? 'alta' : c.confianca === 'baixa' ? 'baixa' : ''}">confiança ${c.confianca}</span></div>
    <ul class="checkin-txt">${textoCheckin(c).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    ${c.emGramas && !alinhada ? `<p class="mudo">Seus macros estão em gramas (as kcal derivam deles): ajuste os gramas em Metas.</p>
      <div class="linha"><a class="btn suave" href="#metas">Abrir Metas</a><button class="btn texto" data-ck="manter">Manter</button></div>`
      : alinhada ? '<div class="linha"><button class="btn prim" data-ck="manter">Manter a meta</button></div>'
      : `<div class="linha checkin-acoes"><button class="btn prim" data-ck="aceitar">Aceitar ${fmtKcal(c.metaSugerida)}</button>
        <button class="btn suave" data-ck="ajustar">Ajustar</button><button class="btn texto" data-ck="manter">Manter</button></div>`}`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-ck]');
    if (!b) return;
    const op = b.dataset.ck;
    if (op === 'ajustar') return folhaAjustar(c, aoMudar);
    await concluir(c, op, op === 'aceitar' ? c.metaSugerida : null, aoMudar);
  };
}

/** Grava a decisão (e aplica a meta, se for o caso), com desfazer. */
async function concluir(c, decisao, metaNova, aoMudar) {
  const antesMetas = estado.metas, antesLista = (await kvGet('checkins', [])) || [];
  if (metaNova != null) {
    const delta = Math.round(metaNova - mediaMetas(estado.metas));
    await salvarMetas(registrarHistorico(aplicarDeltaMetas(estado.metas, delta), chaveData()));
  }
  await kvSet('checkins', registrarCheckin(antesLista, { ...c, decisao, metaNova: metaNova ?? c.metaAtual }));
  invalidarHistorico();
  vibrar(12);
  await aoMudar?.();
  aviso(metaNova != null ? `Meta: ${fmtKcal(mediaMetas(estado.metas))} kcal a partir de hoje` : 'Meta mantida', {
    acao: async () => { await salvarMetas(antesMetas); await kvSet('checkins', antesLista); aoMudar?.(); },
  });
}

function folhaAjustar(c, aoMudar) {
  const p = abrirFolha('Ajustar a meta', `<form id="fck" novalidate>
    <p class="mudo" style="margin-top:0">Sugerida: <b>${fmtKcal(c.metaSugerida)} kcal</b> · atual ${fmtKcal(c.metaAtual)} kcal. Vale a partir de hoje; os dias anteriores mantêm a meta da época.</p>
    ${campoPasso('kcal', c.metaSugerida, { passo: 10, rotulo: 'Meta (kcal/dia, média da semana)' })}
    <p class="erro" id="erro"></p><button class="btn prim bloco">Aplicar</button></form>`);
  ligarPassos(p);
  p.querySelector('#fck').onsubmit = async (e) => {
    e.preventDefault();
    const v = Math.round(valorDe(p, 'kcal'));
    if (!(v >= 1000 && v <= 6000)) { p.querySelector('#erro').textContent = 'Use um valor entre 1000 e 6000 kcal.'; return; }
    fecharFolha();
    await concluir(c, 'ajustar', v, aoMudar);
  };
}

/** Histórico de check-ins (Progresso). */
export async function cartaoHistoricoCheckins(el) {
  const lista = ((await kvGet('checkins', [])) || []).slice().reverse();
  if (!el?.isConnected) return;
  el.innerHTML = `<h2 style="margin-bottom:6px">${ic('calendar-check')} Check-ins semanais</h2>
    ${lista.length ? `<table class="tabela num"><tr><th>Semana</th><th>Gasto</th><th>Meta</th><th>Decisão</th></tr>
      ${lista.slice(0, 8).map((x) => `<tr><td>${esc(fmtData(x.semana).slice(0, 5))}</td><td>${fmtKcal(x.tdee)}</td>
        <td>${x.metaNova !== x.metaAtual ? `${fmtKcal(x.metaAtual)} → <b>${fmtKcal(x.metaNova)}</b>` : fmtKcal(x.metaAtual)}</td><td>${ROT[x.decisao] || ''}</td></tr>`).join('')}</table>`
      : '<p class="mudo" style="margin:0">Toda segunda, com 2+ semanas de registros e pesagens, o Diário mostra o check-in: gasto estimado, tendência e a meta proposta (Aceitar, Ajustar ou Manter).</p>'}`;
}
