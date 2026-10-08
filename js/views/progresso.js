// views/progresso.js — peso (média móvel 7 dias), calorias por semana, aderência, macros, %G e circunferências.

import { db } from '../db.js';
import { estado } from '../state.js';
import { totalDia } from '../diary.js';
import { metaDoDia } from '../goals.js';
import { PROTOCOLOS, CIRC_PADRAO } from '../body.js';
import { mediaMovelDias, semanas, aderencia, mediasMacros, noPeriodo, sequencia } from '../progress.js';
import { graficoLinha, graficoBarras } from '../chart.js';
import { lerPesos } from './reg-peso.js';
import { lerDobras } from './reg-dobras.js';
import { topo, esc, $, seg } from '../ui.js';
import { chaveData, fmtData, fmtKcal, fmtMacro, fmtMg, fmtNum } from '../utils.js';

const PERIODOS = [['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['0', 'Tudo']];

export async function render(tela) {
  topo('<h1 class="esq">Progresso</h1>');
  estado.periodoProg ||= '30';
  const hoje = chaveData();
  const pesos = await lerPesos();
  const pesoEm = (data) => {
    let kg = estado.perfil?.peso || 0;
    for (const p of pesos) { if (p.data <= data) kg = p.kg; else break; }
    return kg;
  };
  // dias com algum item lançado
  const dias = (await db.getAll('diary')).map(([data, d]) => ({ data, d }))
    .filter(({ d }) => Object.values(d.refeicoes).some((l) => l.length))
    .map(({ data, d }) => ({ data, tot: totalDia(d), meta: metaDoDia(estado.metas, data, pesoEm(data)) }))
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const dobras = await lerDobras();
  const seq = sequencia(new Set(dias.map((d) => d.data)), hoje);
  const circ = (await db.getAll('circumferences')).map(([data, v]) => ({ data, valores: v.valores })).sort((a, b) => (a.data < b.data ? -1 : 1));
  const defsCirc = estado.config.circDef || CIRC_PADRAO;
  let protSel = estado.config.dobras?.protocolo || 'parrillo';
  let circSel = defsCirc.find((d) => circ.some((c) => c.valores[d.id] != null))?.id || defsCirc[0]?.id;

  const desenhar = () => {
    const n = Number(estado.periodoProg) || null;
    const dP = noPeriodo(dias, n, hoje), pP = noPeriodo(pesos, n, hoje);
    const ad = aderencia(dP), mm = mediasMacros(dP);
    const sem = semanas(dP);
    const pontosPeso = pP.map((p) => ({ data: p.data, y: p.kg }));
    const dPeso = pP.length > 1 ? pP.at(-1).kg - pP[0].kg : null;
    tela.innerHTML = `${seg('periodo', PERIODOS, estado.periodoProg)}
      <div class="kpis num">
        <div class="kpi"><b>${seq}</b><span>${seq === 1 ? 'dia seguido' : 'dias seguidos'}</span></div>
        <div class="kpi"><b>${ad.total ? fmtNum(Math.round(ad.pct)) + '%' : '—'}</b><span>na meta (±10%)</span></div>
        <div class="kpi"><b>${dPeso != null ? (dPeso > 0 ? '+' : dPeso < 0 ? '−' : '') + fmtNum(Math.abs(Math.round(dPeso * 10) / 10)) : '—'}</b><span>kg no período</span></div>
      </div>
      <div class="card"><div class="card-tit"><h2>Peso</h2>${dPeso != null ? `<span class="num"><b>${dPeso > 0 ? '+' : dPeso < 0 ? '−' : ''}${fmtNum(Math.abs(Math.round(dPeso * 10) / 10))} kg</b> <span class="mudo">no período</span></span>` : ''}</div>
        <div id="g-peso"></div></div>
      <div class="card"><h2 style="margin-bottom:4px">Calorias — média por semana</h2>
        <p class="mudo" style="margin:0 0 6px">Média dos dias com registro; semanas começam na segunda.</p><div id="g-sem"></div></div>
      <div class="card"><h2 style="margin-bottom:6px">Aderência à meta (±10%)</h2>
        ${ad.total ? `<p class="num" style="font-size:1.8rem;font-weight:700;margin:0">${fmtNum(Math.round(ad.pct))}%</p>
        <p class="mudo" style="margin:2px 0 0">${ad.dentro} de ${ad.total} dia(s) registrados dentro da faixa · ${ad.acima} acima · ${ad.abaixo} abaixo</p>`
        : '<p class="mudo">Sem dias registrados no período.</p>'}</div>
      <div class="card"><h2 style="margin-bottom:6px">Médias diárias × meta</h2>${mm.n ? `<table class="tabela num">
        <tr><th></th><th>Consumo</th><th>Meta</th><th>% kcal</th></tr>
        <tr><td>Calorias</td><td><b>${fmtKcal(mm.consumo.kcal)}</b></td><td>${fmtKcal(mm.meta.kcal)}</td><td></td></tr>
        <tr><td>Proteína</td><td><b>${fmtMacro(mm.consumo.prot)}</b> g</td><td>${fmtMacro(mm.meta.prot)} g</td><td>${fmtNum(Math.round(mm.pct.prot))}%</td></tr>
        <tr><td>Carboidrato</td><td><b>${fmtMacro(mm.consumo.carb)}</b> g</td><td>${fmtMacro(mm.meta.carb)} g</td><td>${fmtNum(Math.round(mm.pct.carb))}%</td></tr>
        <tr><td>Gordura</td><td><b>${fmtMacro(mm.consumo.gord)}</b> g</td><td>${fmtMacro(mm.meta.gord)} g</td><td>${fmtNum(Math.round(mm.pct.gord))}%</td></tr>
        <tr><td>Fibra</td><td>${fmtMacro(mm.consumo.fibra)} g</td><td></td><td></td></tr>
        <tr><td>Sódio</td><td>${fmtMg(mm.consumo.sodio_mg)} mg</td><td></td><td></td></tr></table>
        <p class="mudo">Base: ${mm.n} dia(s) com registro.</p>` : '<p class="mudo">Sem dias registrados no período.</p>'}</div>
      <div class="card"><div class="card-tit"><h2>Gordura corporal</h2>
        <select id="s-prot" style="width:auto;min-height:40px">${Object.entries(PROTOCOLOS).map(([k, p]) => `<option value="${k}" ${k === protSel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
        <div id="g-dobra"></div></div>
      <div class="card"><div class="card-tit"><h2>Circunferências</h2>
        <select id="s-circ" style="width:auto;min-height:40px">${defsCirc.map((d) => `<option value="${d.id}" ${d.id === circSel ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></div>
        <div id="g-circ"></div></div>`;

    graficoLinha($('#g-peso', tela), pontosPeso, { unidade: 'kg', linha2: mediaMovelDias(pontosPeso, 7), rotulo2: 'média móvel de 7 dias' });
    graficoBarras($('#g-sem', tela), sem.map((s) => ({
      rotulo: fmtData(s.inicio).slice(0, 5), y: s.kcal, meta: s.meta,
      dica: `Semana de ${fmtData(s.inicio)}: média ${fmtKcal(s.kcal)} kcal (meta ${fmtKcal(s.meta)}) · ${s.n} dia(s)`,
    })), { unidade: 'kcal' });
    const grafDobra = () => {
      const l = noPeriodo(dobras, n, hoje).filter((r) => r.protocolo === protSel);
      graficoLinha($('#g-dobra', tela), l.map((r) => ({ data: r.data, y: protSel === 'personalizado' ? r.soma : r.pct })), { unidade: protSel === 'personalizado' ? 'mm' : '%' });
    };
    const grafCirc = () => graficoLinha($('#g-circ', tela), noPeriodo(circ, n, hoje).filter((c) => c.valores[circSel] != null)
      .map((c) => ({ data: c.data, y: c.valores[circSel] })), { unidade: 'cm' });
    grafDobra(); grafCirc();
    $('#s-prot', tela).onchange = (e) => { protSel = e.target.value; grafDobra(); };
    $('#s-circ', tela).onchange = (e) => { circSel = e.target.value; grafCirc(); };
    $('[data-seg=periodo]', tela).onclick = (e) => {
      const b = e.target.closest('button');
      if (b) { estado.periodoProg = b.dataset.v; desenhar(); }
    };
  };
  desenhar();
}
