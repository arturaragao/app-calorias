// views/reg-peso.js — registro de peso (vários por dia; vale o último do dia) e recálculo opcional da meta.

import { db } from '../db.js';
import { estado, salvarPerfil, salvarMetas } from '../state.js';
import { pesoDoDia, foraDaFaixa, mediaMovel } from '../body.js';
import { metaCalorica, registrarHistorico } from '../goals.js';
import { graficoLinha } from '../chart.js';
import { idadePerfil } from './onboarding.js';
import { $, aviso, ICONES } from '../ui.js';
import { chaveData, fmtData, fmtNum, fmtKcal, lerNumero } from '../utils.js';

export async function lerPesos() {
  return (await db.getAll('weights')).map(([data, regs]) => ({ data, regs, kg: pesoDoDia(regs) }))
    .filter((r) => r.kg != null).sort((a, b) => (a.data < b.data ? -1 : 1));
}

export async function render(el) {
  const pesos = await lerPesos();
  const ult = pesos.at(-1);
  el.innerHTML = `
    <form class="card" id="fp" novalidate>
      <div class="grade2">
        <label class="campo"><span>Peso (kg)</span><input type="text" inputmode="decimal" name="kg" value="" placeholder="${ult ? fmtNum(ult.kg) : 'ex.: 80,5'}"></label>
        <label class="campo"><span>Data</span><input type="date" name="data" value="${chaveData()}" max="${chaveData()}"></label>
      </div>
      <p class="erro" id="erro"></p>
      <button class="btn prim bloco">Registrar peso</button>
      ${estado.config.recalcularComPeso ? '<p class="mudo">A meta calórica será recalculada com o novo peso (opção ligada em Metas).</p>' : ''}
    </form>
    <div class="card"><div class="card-tit"><h2>Evolução</h2>${ult ? `<span class="num"><b>${fmtNum(ult.kg)} kg</b> <span class="mudo">em ${fmtData(ult.data)}</span></span>` : ''}</div>
      <div id="graf"></div></div>
    <div class="card"><h2 style="margin-bottom:6px">Histórico</h2><ul class="itens" id="hist"></ul></div>`;

  const ultimos = pesos.slice(-60);
  graficoLinha($('#graf', el), ultimos.map((p) => ({ data: p.data, y: p.kg })),
    { unidade: 'kg', linha2: mediaMovel(ultimos.map((p) => p.kg), 7), rotulo2: 'média dos últimos 7 registros' });

  $('#hist', el).innerHTML = pesos.slice().reverse().slice(0, 60).map((p, i, arr) => {
    const ant = arr[i + 1];
    const dif = ant ? p.kg - ant.kg : null;
    return `<li class="item" data-data="${p.data}"><div class="info"><div class="nome">${fmtData(p.data)}</div>
      <div class="mudo">${p.regs.length > 1 ? `${p.regs.length} registros no dia (vale o último)` : ''}</div></div>
      <span class="num"><b>${fmtNum(p.kg)} kg</b> ${dif != null ? `<span class="mudo">${dif > 0 ? '+' : dif < 0 ? '−' : ''}${fmtNum(Math.abs(Math.round(dif * 10) / 10))}</span>` : ''}</span>
      <button class="ico" data-apagar aria-label="Apagar peso de ${fmtData(p.data)}">${ICONES.lixo}</button></li>`;
  }).join('') || '<li class="mudo" style="padding:8px 0">Nenhum peso registrado.</li>';

  $('#fp', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const kg = lerNumero(f.kg.value), data = f.data.value;
    const erro = !(kg > 0) ? 'Informe o peso em kg.' : !data ? 'Informe a data.' : data > chaveData() ? 'A data não pode ser futura.' : '';
    $('#erro', el).textContent = erro;
    if (erro) return;
    if (foraDaFaixa('peso', kg) && !confirm(`${fmtNum(kg)} kg está fora da faixa usual (30–300 kg). Registrar mesmo assim?`)) return;
    const regs = (await db.get('weights', data)) || [];
    regs.push({ ts: Date.now(), kg });
    await db.put('weights', data, regs);
    await aposPeso();
    aviso(`Peso registrado: ${fmtNum(kg)} kg`);
    render(el);
  };
  $('#hist', el).onclick = async (e) => {
    const li = e.target.closest('[data-data]');
    if (!li || !e.target.closest('[data-apagar]')) return;
    const data = li.dataset.data;
    const antes = await db.get('weights', data);
    await db.del('weights', data);
    await aposPeso(false);
    render(el);
    aviso(`Peso de ${fmtData(data)} apagado`, { acao: async () => { await db.put('weights', data, antes); await aposPeso(false); render(el); } });
  };
}

/**
 * Atualiza o peso do perfil com o mais recente. Se a opção estiver ligada, recalcula a meta:
 * soma a diferença (meta nova − meta antiga pelo perfil) às kcal de cada conjunto, preservando
 * diferenças entre dias da semana. Vale a partir de hoje (histórico de metas).
 */
async function aposPeso(recalcular = true) {
  const ult = (await lerPesos()).at(-1);
  const p = estado.perfil;
  if (!ult || !p || ult.kg === p.peso) return;
  const antiga = metaCalorica({ ...p, idade: idadePerfil(p) }).kcal;
  const novoPerfil = { ...p, peso: ult.kg };
  await salvarPerfil(novoPerfil);
  if (!recalcular || !estado.config.recalcularComPeso) return;
  const delta = Math.round(metaCalorica({ ...novoPerfil, idade: idadePerfil(novoPerfil) }).kcal - antiga);
  if (!delta) return;
  const m = structuredClone(estado.metas);
  m.base.kcal += delta;
  m.semana.forEach((c) => { c.kcal += delta; });
  await salvarMetas(registrarHistorico(m, chaveData()));
  setTimeout(() => aviso(`Meta calórica ${delta > 0 ? '+' : '−'}${fmtKcal(Math.abs(delta))} kcal pelo novo peso`), 1200);
}
