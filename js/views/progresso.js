// views/progresso.js — painel de progresso: resumo com comparação, peso com tendência e alvo, gasto real (TDEE adaptativo),
// calorias por semana, calendário de aderência, relatório semanal, macros, origem das calorias, composição corporal e medidas.

import { db, kvGet, kvSet } from '../db.js';
import { ic } from '../icones.js';
import { estado, salvarConfig, salvarMetas } from '../state.js';
import { totalDia, ehTreino, ETIQUETAS, alvoProteinaRefeicao } from '../diary.js';
import { metaDoDia, metaCalorica, registrarHistorico } from '../goals.js';
import { PROTOCOLOS, CIRC_PADRAO } from '../body.js';
import * as P from '../progress.js';
import { graficoLinha, graficoBarras, graficoEmpilhado } from '../chart.js';
import { lerPesos } from './reg-peso.js';
import { lerDobras } from './reg-dobras.js';
import { idadePerfil } from './onboarding.js';
import { compartilharRelatorio } from './relatorio-img.js';
import { tabelaMicros } from './micros-ui.js';
import { montarInteligencia } from './inteligencia-ui.js';
import { gerarRelatorioPDF } from './relatorio-pdf.js';
import { carregarBase } from '../foods.js';
import { aplicarLayout, botaoOrganizar, visivel } from '../layout.js';
import { estadoVazio } from '../vazio.js';
import { numerosCoach, contarEtiquetas, guardarResposta } from '../coach.js';
import { coachSemanal, motorIA, rotuloCota } from '../ia.js';
import { topo, esc, $, seg, aviso, abrirFolha, fecharFolha, ICONES, confirmar } from '../ui.js';
import { chaveData, fmtData, fmtKcal, fmtMacro, fmtMg, fmtNum, lerNumero, somarDias, DIAS_CURTOS } from '../utils.js';

const PERIODOS = [['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['0', 'Tudo']];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const f1 = (v) => fmtNum(Math.round(v * 10) / 10);
const f2 = (v) => fmtNum(Math.round(v * 100) / 100);
const fk = (v) => fmtKcal(v);
export const sinal = (v, f = f1) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));
const dd5 = (c) => fmtData(c).slice(0, 5);

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
  // dias com algum item lançado (objetos do diário guardados para a "origem das calorias")
  const todosDiarios = (await db.getAll('diary')).map(([, d]) => d);   // uma leitura só do banco
  const brutos = todosDiarios.filter((d) => Object.values(d.refeicoes).some((l) => l.length));
  const dias = brutos.map((d) => ({ data: d.data, tot: totalDia(d), meta: metaDoDia(estado.metas, d.data, pesoEm(d.data), { treino: ehTreino(d) }) }))
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const porData = new Map(dias.map((d) => [d.data, d]));
  const anotEm = new Map(todosDiarios.filter((d) => d.tags?.length || d.nota).map((d) => [d.data, d]));
  const rotTag = (t) => ETIQUETAS.find(([id]) => id === t)?.[1] || t;
  const tend = P.tendenciaPeso(pesos);
  const tendEm = new Map(tend.map((p) => [p.data, p.y]));
  const dobras = await lerDobras();
  const baseAlim = await carregarBase().catch(() => null);
  const circ = (await db.getAll('circumferences')).map(([data, v]) => ({ data, valores: v.valores })).sort((a, b) => (a.data < b.data ? -1 : 1));
  const defsCirc = estado.config.circDef || CIRC_PADRAO;
  const seq = P.sequencia(new Set(dias.map((d) => d.data)), hoje);
  let protSel = estado.config.dobras?.protocolo || 'parrillo';
  let circSel = defsCirc.find((d) => circ.some((c) => c.valores[d.id] != null))?.id || defsCirc[0]?.id;
  let mesCal = hoje.slice(0, 7);
  let semRel = P.inicioSemana(somarDias(hoje, -7));     // última semana completa
  let topModo = 'kcal';

  const desenhar = () => {
    const n = Number(estado.periodoProg) || null;
    const dP = P.noPeriodo(dias, n, hoje), pP = P.noPeriodo(pesos, n, hoje);
    const ad = P.aderencia(dP), mm = P.mediasMacros(dP);
    const cmp = n ? P.compararPeriodos(dias, n, hoje) : null;
    const ritmo = P.ritmoSemanal(tend, hoje);
    const tAtual = tend.at(-1)?.y ?? null;
    const tP = P.noPeriodo(tend, n, hoje);
    const dTend = tP.length > 1 ? tP.at(-1).y - tP[0].y : null;
    const comp = (atual, ant, f, un = '') => (atual == null || ant == null ? '<small>&nbsp;</small>' : (f(Math.abs(atual - ant)) === f(0) ? '<small>igual ao anterior</small>' : `<small>${sinal(atual - ant, f)}${un} vs anterior</small>`));

    tela.innerHTML = `${seg('periodo', PERIODOS, estado.periodoProg)}
      ${!dias.length && !pesos.length ? estadoVazio('grafico', 'Seu progresso aparece aqui', 'Lance refeições e registre o peso por alguns dias para ver tendência, aderência e médias.') : ''}
      <div class="kpis num" data-bloco="kpis">
        <div class="kpi"><b>${mm.n ? fk(mm.consumo.kcal) : '—'}</b><span>kcal/dia</span>${cmp ? comp(cmp.kcal[0], cmp.kcal[1], fk) : ''}</div>
        <div class="kpi"><b>${mm.n ? fmtNum(Math.round(mm.consumo.prot)) + ' g' : '—'}</b><span>proteína/dia</span>${cmp ? comp(cmp.prot[0], cmp.prot[1], (v) => fmtNum(Math.round(v)), ' g') : ''}</div>
        <div class="kpi"><b>${ad.total ? fmtNum(Math.round(ad.pct)) + '%' : '—'}</b><span>dias na meta</span><small>${ad.total ? `${ad.dentro} de ${ad.total}` : '&nbsp;'}</small></div>
        <div class="kpi"><b>${dTend != null ? sinal(dTend) : '—'}</b><span>kg no período</span><small>pela tendência</small></div>
        <div class="kpi"><b>${ritmo != null ? sinal(ritmo, f2) : '—'}</b><span>kg/semana</span><small>ritmo atual</small></div>
        <div class="kpi"><b>${seq}</b><span>${seq === 1 ? 'dia seguido' : 'dias seguidos'}</span><small>registrando</small></div>
      </div>
      <div class="card" id="c-padroes" data-bloco="padroes" hidden></div>
      ${cardPeso(tAtual, ritmo)}
      ${cardGasto()}
      <div class="card" id="c-checkins" data-bloco="checkins"></div>
      <div class="card" data-bloco="semanas"><h2 style="margin-bottom:4px">Calorias por semana</h2>
        <p class="mudo" style="margin:0 0 6px">Média dos dias com registro × meta (traço). Âmbar = mais de 10% acima.</p><div id="g-sem"></div></div>
      <div class="card" id="c-cal" data-bloco="calendario"></div>
      <div class="card" id="c-rel" data-bloco="relatorio"></div>
      <div class="card" id="c-coach" data-bloco="coach" hidden></div>
      <div class="card" id="c-perg" data-bloco="pergunte"></div>
      ${cardMacros(mm)}
      <div class="card" id="c-lacuna" data-bloco="lacuna" hidden></div>
      <div class="card" id="c-orig" data-bloco="origem"></div>
      <div class="card" data-bloco="composicao"><div class="card-tit"><h2>Composição corporal</h2>
        <select id="s-prot" style="width:auto;min-height:44px">${Object.entries(PROTOCOLOS).map(([k, p]) => `<option value="${k}" ${k === protSel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
        <div id="comp-resumo"></div><div id="g-dobra"></div><div id="g-comp" style="margin-top:10px"></div></div>
      <div class="card" data-bloco="circ"><div class="card-tit"><h2>Circunferências</h2>
        <select id="s-circ" style="width:auto;min-height:44px">${defsCirc.map((d) => `<option value="${d.id}" ${d.id === circSel ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></div>
        <div id="circ-resumo"></div><div id="g-circ"></div></div>
      <button class="btn bloco suave" data-bloco="pdf" data-pdf style="margin-bottom:12px">${ic('file-text')} Relatório em PDF (para nutricionista)</button>
      <p class="mudo" style="text-align:center">Arraste o dedo sobre os gráficos para ver os valores.</p>
      ${botaoOrganizar('progresso')}`;
    aplicarLayout(tela, 'progresso');
    montarInteligencia(tela, { baseAlim }).catch((e) => console.warn(e));

    // peso: pontos = pesagens; linha 2 = tendência nas mesmas datas
    graficoLinha($('#g-peso', tela), pP.map((p) => ({ data: p.data, y: p.kg })), {
      unidade: 'kg', linha2: pP.map((p) => tendEm.get(p.data) ?? p.kg), rotulo2: 'tendência (sem oscilações de água)', alvo: estado.config.alvo?.peso ?? null,
    });
    graficoBarras($('#g-sem', tela), P.semanas(dP).map((s) => ({
      rotulo: dd5(s.inicio), y: s.kcal, meta: s.meta,
      dica: `Semana de ${fmtData(s.inicio)}: média ${fk(s.kcal)} kcal (meta ${fk(s.meta)}) · ${s.n} dia(s)`,
    })), { unidade: 'kcal' });
    desenharCalendario(); desenharRelatorio(); desenharOrigem(n);
    grafComp(n); grafCirc(n);
    ligar(n);
  };

  // ---------- Peso ----------
  function cardPeso(tAtual, ritmo) {
    const alvo = estado.config.alvo, perfil = estado.perfil;
    const ritmoPlan = perfil?.objetivo === 'manter' ? 0 : (perfil?.objetivo === 'ganhar' ? 1 : -1) * (perfil?.ritmo || 0);
    let blocoAlvo = '<button class="btn peq suave" data-alvo style="margin-top:10px">' + ic('target') + ' Definir peso-alvo</button>';
    if (alvo && tAtual != null) {
      const frac = P.fracaoAlvo(alvo.inicio.kg, tAtual, alvo.peso);
      const pr = P.projecao(tAtual, alvo.peso, ritmo, hoje);
      const falta = alvo.peso - tAtual;
      blocoAlvo = `<div style="margin-top:12px"><div class="linha" style="justify-content:space-between">
          <span><b>Alvo: ${f1(alvo.peso)} kg</b> <span class="mudo">· início ${f1(alvo.inicio.kg)} kg em ${fmtData(alvo.inicio.data)}</span></span>
          <button class="btn peq suave" data-alvo>Editar</button></div>
        <div class="progresso-alvo" role="progressbar" aria-valuenow="${Math.round(frac * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${frac * 100}%"></div></div>
        <p class="mudo" style="margin:0">${Math.round(frac * 100)}% do caminho · ${pr?.atingido ? 'alvo atingido!' : `faltam ${f1(Math.abs(falta))} kg`}${
          pr && !pr.atingido ? ` · no ritmo atual, por volta de <b>${fmtData(pr.data)}</b> (${fmtNum(Math.round(pr.semanas))} semanas)` : ''}${
          !pr && Math.abs(falta) >= 0.05 ? ' · no ritmo atual o alvo ainda não se aproxima' : ''}</p></div>`;
    }
    return `<div class="card" data-bloco="peso"><div class="card-tit"><h2>Peso</h2>${tAtual != null ? `<span class="num mudo">tendência <b style="color:var(--txt)">${f1(tAtual)} kg</b></span>` : ''}</div>
      <div id="g-peso"></div>
      ${ritmo != null ? `<div class="sub-num num"><span>Ritmo real (4 semanas): <b>${sinal(ritmo, f2)} kg/sem</b></span>
        <span>Planejado: <b>${sinal(ritmoPlan, f2)} kg/sem</b></span></div>` : ''}
      ${blocoAlvo}
      <p class="mudo" style="margin-bottom:0">A tendência suaviza as oscilações diárias de água e sal (média exponencial, método do <i>The Hacker's Diet</i>). Pese-se de manhã, em jejum, de preferência todo dia.</p></div>`;
  }

  // ---------- Gasto real ----------
  function cardGasto() {
    const g = P.tdeeAdaptativo(dias, tend, hoje);
    const p = estado.perfil;
    const mc = metaCalorica({ ...p, idade: idadePerfil(p) });
    if (!g) {
      const ini = somarDias(hoje, -27);
      const reg = dias.filter((d) => d.data >= ini).length, dPeso = P.noPeriodo(tend, 28, hoje).length;
      return `<div class="card" data-bloco="gasto"><h2 style="margin-bottom:6px">Gasto real estimado</h2>
        <p class="mudo" style="margin-top:0">Com 2 a 4 semanas de pesagens e alimentação registradas, o app calcula quanto você <b>realmente</b> gasta por dia
        — cruzando o que comeu com a tendência do peso — e sugere a meta certa para o seu objetivo.</p>
        <div class="sub-num num"><span>Dias com registro (28 d): <b>${reg}</b> de 14+</span><span>Dias de tendência de peso: <b>${dPeso}</b> de ${P.TDEE_MIN_DIAS}+</span></div>
        <p class="mudo" style="margin-bottom:0">Pela fórmula (Mifflin-St Jeor × atividade), seu gasto seria <b>${fk(mc.tdee)} kcal</b>.</p></div>`;
    }
    const sug = P.metaSugerida(g.tdee, mc.ajuste, mc.piso);
    const m = estado.metas;
    const atual = m.modo === 'semana' ? m.semana.reduce((s, c) => s + c.kcal, 0) / 7 : m.base.kcal;
    const emGramas = (m.modo === 'semana' ? m.semana : [m.base]).some((c) => c.macroModo !== 'pct');
    const dif = sug - atual;
    const obj = p.objetivo === 'perder' ? `perder ${f2(p.ritmo)} kg/semana` : p.objetivo === 'ganhar' ? `ganhar ${f2(p.ritmo)} kg/semana` : 'manter o peso';
    return `<div class="card" data-bloco="gasto"><div class="card-tit"><h2>Gasto real estimado</h2><span class="selo ${g.confianca === 'alta' ? 'alta' : g.confianca === 'baixa' ? 'baixa' : ''}">confiança ${g.confianca}</span></div>
      <p class="destaque num">${fk(g.tdee)} <span class="mudo" style="font-size:1rem;font-weight:500">kcal/dia</span></p>
      <div class="sub-num num"><span>Comeu em média <b>${fk(g.mediaKcal)}</b></span><span>Tendência <b>${sinal(g.deltaKg, f2)} kg</b> em ${g.periodo} dias</span>
        <span>Fórmula previa <b>${fk(mc.tdee)}</b> (${sinal(g.tdee - mc.tdee, fk)})</span></div>
      <div class="nota" style="margin-top:10px">Para <b>${obj}</b>, a meta sugerida é <b class="num">${fk(sug)} kcal</b>
        (atual ${fk(atual)}${Math.abs(dif) >= 1 ? `, ${sinal(dif, fk)}` : ''}).${sug === mc.piso ? ' Limitada ao piso de segurança.' : ''}
        <span class="mudo">Objetivo e ritmo vêm do seu <a href="#perfil">perfil</a>.</span></div>
      ${Math.abs(dif) < 50 ? '<p class="mudo" style="margin-bottom:0">Sua meta já está alinhada ao seu gasto real.</p>'
        : emGramas ? '<p class="mudo" style="margin-bottom:0">Seus macros estão em gramas (as kcal derivam deles): ajuste os gramas em <a href="#metas">Metas</a>.</p>'
        : `<button class="btn prim bloco" data-aplicar="${sug}" style="margin-top:8px">Aplicar ${fk(sug)} kcal como meta</button>`}
      <p class="mudo" style="margin-bottom:0">Base: ${g.registrados} dia(s) com registro de ${g.periodo} (${fmtNum(Math.round(g.cobertura * 100))}%). 1 kg ≈ 7700 kcal.
        Dias sem registro não entram: registre tudo, inclusive os “dias livres”, para a estimativa ser fiel.</p></div>`;
  }

  // ---------- Calendário ----------
  function desenharCalendario() {
    const [a, m] = mesCal.split('-').map(Number);
    const cel = P.gradeMes(a, m);
    const sit = cel.filter(Boolean).map((c) => P.situacaoDia(porData.get(c)));
    const cont = (s) => sit.filter((x) => x === s).length;
    $('#c-cal', tela).innerHTML = `<div class="nav-mes"><button class="ico" data-mes="-1" aria-label="Mês anterior">${ICONES.voltar}</button>
        <h2>${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} de ${a}</h2>
        <button class="ico" data-mes="1" aria-label="Próximo mês" ${mesCal >= hoje.slice(0, 7) ? 'disabled' : ''}>${ICONES.avancar}</button></div>
      <div class="cal">${DIAS_CURTOS.map((d) => `<span class="cab">${d[0].toUpperCase()}</span>`).join('')}
        ${cel.map((c) => {
          if (!c) return '<span></span>';
          const d = porData.get(c), s = P.situacaoDia(d);
          const an = anotEm.get(c);
          return `<button class="${s || ''} ${c === hoje ? 'hoje' : ''} ${an ? 'anot' : ''}" data-dia="${c}" ${c > hoje ? 'disabled' : ''}
            aria-label="${fmtData(c)}${d ? `: ${fk(d.tot.kcal)} de ${fk(d.meta.kcal)} kcal` : ': sem registro'}${an ? ' · ' + esc([...(an.tags || []).map(rotTag), an.nota || ''].filter(Boolean).join(', ')) : ''}">${Number(c.slice(8))}</button>`;
        }).join('')}</div>
      <div class="cal-leg"><span><i style="background:var(--acento)"></i>na meta ${cont('meta')}</span>
        <span><i style="background:var(--alerta)"></i>acima ${cont('acima')}</span>
        <span><i style="background:var(--agua)"></i>abaixo ${cont('abaixo')}</span>
        <span><i style="background:var(--sup2)"></i>sem registro</span><span>• com nota/etiqueta</span></div>
      <p class="mudo" style="margin-bottom:0">Faixa de ±10% da meta do dia. Toque num dia para abrir o diário.</p>`;
  }

  // ---------- Relatório semanal ----------
  function desenharRelatorio() {
    const r = P.relatorioSemana(dias, tend, semRel);
    const prox = somarDias(semRel, 7) <= hoje;
    const m = r.medias;
    const dif = (d) => `${dd5(d.data)} · ${fk(d.tot.kcal)} kcal (${sinal(d.tot.kcal - d.meta.kcal, fk)})`;
    $('#c-rel', tela).innerHTML = `<div class="nav-mes"><button class="ico" data-sem="-7" aria-label="Semana anterior">${ICONES.voltar}</button>
        <h2 style="text-align:center">Semana ${dd5(r.inicio)} a ${dd5(r.fim)}</h2>
        <button class="ico" data-sem="7" aria-label="Próxima semana" ${prox ? '' : 'disabled'}>${ICONES.avancar}</button></div>
      ${r.registrados ? `<div class="rel-grade num">
          <div><b>${fk(m.consumo.kcal)}</b><span>kcal/dia (meta ${fk(m.meta.kcal)})</span></div>
          <div><b>${r.aderencia.dentro} de ${r.registrados}</b><span>dias na meta</span></div>
          <div><b>${fmtNum(Math.round(m.consumo.prot))} g</b><span>proteína/dia (meta ${fmtNum(Math.round(m.meta.prot))})</span></div>
          <div><b>${r.deltaPeso != null ? sinal(r.deltaPeso) + ' kg' : '—'}</b><span>${r.pesoFim != null ? `tendência ${f1(r.pesoFim)} kg` : 'sem pesagens'}</span></div></div>
        ${r.melhor ? `<p class="mudo" style="margin:4px 0">${ic('circle-check', 'p')} Mais perto da meta: ${dif(r.melhor)}</p>` : ''}
        ${r.pior ? `<p class="mudo" style="margin:4px 0">${ic('triangle-alert', 'p')} Mais longe: ${dif(r.pior)}</p>` : ''}
        ${P.anotacoesEntre(todosDiarios, r.inicio, r.fim).map((a) => `<p class="mudo" style="margin:4px 0">${ic('notebook-pen', 'p')} ${dd5(a.data)}: ${esc([...a.tags.map(rotTag), a.nota].filter(Boolean).join(' · '))}</p>`).join('')}
        <p class="mudo" style="margin:4px 0">${r.registrados} de 7 dias registrados · P ${fmtNum(Math.round(m.pct.prot))}% · C ${fmtNum(Math.round(m.pct.carb))}% · G ${fmtNum(Math.round(m.pct.gord))}% das kcal</p>
        <button class="btn bloco" data-compartilhar style="margin-top:8px">Compartilhar resumo (imagem)</button>`
      : '<p class="mudo">Nenhum dia registrado nesta semana.</p>'}`;
    desenharCoach(r);
    const b = $('[data-compartilhar]', tela);
    if (b) b.onclick = async () => {
      b.disabled = true;
      try { await compartilharRelatorio(r); } catch (e) { console.error(e); aviso('Não foi possível gerar a imagem: ' + e.message); }
      b.disabled = false;
    };
  }

  // ---------- Coach semanal (IA) ----------
  // Uma chamada por semana (resposta guardada); só números agregados saem do aparelho. Sem motor de IA → cartão escondido.
  async function desenharCoach(r) {
    const el = $('#c-coach', tela);
    if (!el) return;
    const cache = (await kvGet('coach', {})) || {};
    const salvo = cache[r.inicio];
    const motor = salvo ? null : await motorIA();
    if (!salvo && !motor) { el.hidden = true; return; }
    if (!visivel('progresso', 'coach')) return;   // escondido em "Organizar"
    el.hidden = false;
    const terminou = r.fim < hoje;
    el.innerHTML = `<h2 style="margin-bottom:6px">${ic('sparkles')} Coach da semana (IA)</h2>
      ${salvo ? `<ul class="coach-obs">${salvo.observacoes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
          <p class="nota" style="margin:8px 0 4px"><b>Ação da semana:</b> ${esc(salvo.acao)}</p>
          <p class="mudo" style="margin:0;font-size:.76rem">Gerado em ${fmtData(salvo.data)} · ${salvo.motor === 'local' ? 'IA do Chrome' : 'Gemini'} · uma análise por semana.</p>`
        : !r.registrados ? '<p class="mudo">Sem dias registrados nesta semana.</p>'
        : !terminou ? '<p class="mudo">Disponível depois do domingo, com a semana completa.</p>'
        : `<p class="mudo" style="margin-top:0">3 observações e 1 ação prática a partir dos números desta semana. Vão só médias, metas, aderência,
            peso e etiquetas — nenhum alimento ou nota.</p>
          <button class="btn prim bloco" data-coach>Analisar semana ${dd5(r.inicio)} a ${dd5(r.fim)}</button>
          <p class="mudo" id="coach-st" style="margin:6px 0 0;font-size:.76rem">${esc(await rotuloCota())}</p>`}`;
    const b = $('[data-coach]', el);
    if (b) b.onclick = async () => {
      b.disabled = true; b.textContent = 'Analisando…';
      try {
        const relAnt = P.relatorioSemana(dias, tend, somarDias(r.inicio, -7));
        const nums = numerosCoach({ rel: r, relAnt, perfil: estado.perfil || {}, pesoKg: tendEm.get(r.fim) ?? pesoEm(r.fim),
          tags: contarEtiquetas(P.anotacoesEntre(todosDiarios, r.inicio, r.fim)) });
        const motorUsado = await motorIA();
        const resp = await coachSemanal(nums);
        if (!resp) throw new Error('A IA não devolveu uma análise utilizável. Tente de novo mais tarde.');
        await kvSet('coach', guardarResposta(cache, r.inicio, { ...resp, data: hoje, motor: motorUsado }));
        desenharCoach(r);
      } catch (e) {
        b.disabled = false; b.textContent = 'Tentar de novo';
        const st = $('#coach-st', el);
        if (st) st.innerHTML = `<span class="erro">${esc(e.message)}</span>`;
      }
    };
  }

  // ---------- Macros ----------
  function cardMacros(mm) {
    if (!mm.n) return '<div class="card" data-bloco="macros"><h2 style="margin-bottom:6px">Médias diárias × meta</h2><p class="mudo">Sem dias registrados no período.</p></div>';
    const fmt = (v, un) => (un === 'kcal' ? fk(v) : un === 'mg' ? fmtMg(v) : fmtMacro(v));
    const linha = (cls, nome, v, meta, un = 'g') => `<div class="dist ${cls}"><div class="rot"><span>${nome}</span>
      <span class="num"><b>${fmt(v, un)}</b> / ${fmt(meta, un)} ${un} <span class="mudo">(${fmtNum(Math.round(meta ? (v / meta) * 100 : 0))}%)</span></span></div>
      <div class="trilho"><div class="enche" style="width:${meta ? Math.min(100, (v / meta) * 100) : 0}%"></div></div></div>`;
    const pesoRef = tend.at(-1)?.y || estado.perfil?.peso;
    return `<div class="card" data-bloco="macros"><h2 style="margin-bottom:6px">Médias diárias × meta</h2>
      ${linha('', 'Calorias', mm.consumo.kcal, mm.meta.kcal, 'kcal')}
      ${linha('p', 'Proteína', mm.consumo.prot, mm.meta.prot)}
      ${linha('c', 'Carboidrato', mm.consumo.carb, mm.meta.carb)}
      ${linha('g', 'Gordura', mm.consumo.gord, mm.meta.gord)}
      ${linha('', 'Fibra', mm.consumo.fibra, estado.metas.base.fibra)}
      ${linha('g', 'Sódio', mm.consumo.sodio_mg, estado.metas.base.sodio, 'mg')}
      <div class="sub-num num"><span>Kcal vindas de:</span><span>P <b>${fmtNum(Math.round(mm.pct.prot))}%</b></span>
        <span>C <b>${fmtNum(Math.round(mm.pct.carb))}%</b></span><span>G <b>${fmtNum(Math.round(mm.pct.gord))}%</b></span>
        ${pesoRef ? `<span>Proteína <b>${f1(mm.consumo.prot / pesoRef)} g/kg</b></span>` : ''}</div>
      <p class="mudo" style="margin-bottom:0">Base: ${mm.n} dia(s) com registro.</p>
      ${microsPeriodo()}</div>`;
  }

  function microsPeriodo() {
    const n = Number(estado.periodoProg) || null;
    const ini = n ? somarDias(hoje, -(n - 1)) : '0000';
    const ds = brutos.filter((d) => d.data >= ini && d.data <= hoje);
    return ds.length ? tabelaMicros(ds.flatMap((d) => Object.values(d.refeicoes).flat()), ds.length, baseAlim) : '';
  }

  // ---------- Origem das calorias ----------
  function desenharOrigem(n) {
    const ini = n ? somarDias(hoje, -(n - 1)) : '0000';
    const o = P.origemCalorias(brutos.filter((d) => d.data >= ini && d.data <= hoje),
      Object.fromEntries(estado.config.refeicoes.map((r) => [r.id, r.nome])));
    const lista = topModo === 'kcal' ? o.topKcal : o.topProt;
    $('#c-orig', tela).innerHTML = `<h2 style="margin-bottom:6px">De onde vêm as calorias</h2>
      ${o.dias ? `${o.porRefeicao.map((r) => `<div class="dist"><div class="rot"><span>${esc(r.nome)}</span>
          <span class="num"><b>${fk(r.kcal)}</b> kcal/dia <span class="mudo">(${fmtNum(Math.round(r.pct))}%)</span></span></div>
          <div class="trilho"><div class="enche" style="width:${r.pct}%"></div></div></div>`).join('')}
        ${protRef(n)}
        <div style="margin:14px 0 4px">${seg('top', [['kcal', 'Top calorias'], ['prot', 'Top proteína']], topModo)}</div>
        <ol class="top-lista num">${lista.map((a) => `<li><span>${esc(a.nome)}</span><span class="mudo">${a.vezes}×</span>
          <span><b>${topModo === 'kcal' ? fk(a.kcal) + ' kcal' : fmtMacro(a.prot) + ' g'}</b>/dia</span></li>`).join('')}</ol>
        <p class="mudo" style="margin-bottom:0">Médias por dia registrado (${o.dias} dia(s)).</p>`
      : '<p class="mudo">Sem dias registrados no período.</p>'}`;
  }

  /** Proteína média por refeição × alvo de 0,4 g/kg por refeição. */
  function protRef(n) {
    const ini = n ? somarDias(hoje, -(n - 1)) : '0000';
    const l = P.proteinaPorRefeicao(brutos.filter((d) => d.data >= ini && d.data <= hoje),
      Object.fromEntries(estado.config.refeicoes.map((r) => [r.id, r.nome])));
    const alvo = alvoProteinaRefeicao(tend.at(-1)?.y || estado.perfil?.peso);
    if (!l.length || !alvo) return '';
    const ordem = estado.config.refeicoes.map((r) => r.id);
    l.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
    return `<h2 style="margin:16px 0 4px;font-size:1rem">Proteína por refeição</h2>
      <p class="mudo" style="margin:0 0 4px">Alvo ≈ ${alvo} g por refeição (0,4 g/kg; Schoenfeld & Aragon, 2018).</p>
      ${l.map((r) => `<div class="dist p"><div class="rot"><span>${esc(r.nome)}</span><span class="num"><b>${fmtNum(Math.round(r.prot))} g</b>${r.prot >= alvo ? ' ' + ic('check', 'p') : ''}
        <span class="mudo">(${r.dias} dia(s))</span></span></div><div class="trilho"><div class="enche" style="width:${Math.min(100, (r.prot / alvo) * 100)}%"></div></div></div>`).join('')}`;
  }

  // ---------- Composição corporal ----------
  function grafComp(n) {
    const l = P.noPeriodo(dobras, n, hoje).filter((r) => r.protocolo === protSel);
    const pers = protSel === 'personalizado';
    graficoLinha($('#g-dobra', tela), l.map((r) => ({ data: r.data, y: pers ? r.soma : r.pct })), { unidade: pers ? 'mm' : '% gordura' });
    const cm = l.filter((r) => r.mMagra != null && r.mGorda != null);
    if (pers) $('#g-comp', tela).innerHTML = '';
    else graficoEmpilhado($('#g-comp', tela), cm.map((r) => ({
      rotulo: dd5(r.data), a: r.mMagra, b: r.mGorda,
      dica: `${fmtData(r.data)}: magra ${f1(r.mMagra)} kg + gorda ${f1(r.mGorda)} kg = ${f1(r.mMagra + r.mGorda)} kg (${f1(r.pct)}%)`,
    })), { rotuloA: 'massa magra (kg)', rotuloB: 'massa gorda (kg)' });
    const a = cm[0], b = cm.at(-1);
    $('#comp-resumo', tela).innerHTML = !pers && cm.length >= 2 ? `<div class="sub-num num" style="margin:0 0 8px">
        <span>Gordura <b>${sinal(b.pct - a.pct)} pontos</b></span><span>Massa gorda <b>${sinal(b.mGorda - a.mGorda)} kg</b></span>
        <span>Massa magra <b>${sinal(b.mMagra - a.mMagra)} kg</b></span></div>
      ${b.mGorda < a.mGorda && b.mMagra >= a.mMagra - 0.3 ? '<p class="mudo" style="margin:0 0 8px">' + ic('circle-check', 'p') + ' Perdendo gordura e preservando massa magra.</p>'
        : b.mMagra < a.mMagra - 0.5 ? '<p class="mudo" style="margin:0 0 8px">' + ic('triangle-alert', 'p') + ' A massa magra caiu: confira a proteína e o treino de força.</p>' : ''}` : '';
  }

  function grafCirc(n) {
    const l = P.noPeriodo(circ, n, hoje).filter((c) => c.valores[circSel] != null);
    graficoLinha($('#g-circ', tela), l.map((c) => ({ data: c.data, y: c.valores[circSel] })), { unidade: 'cm' });
    $('#circ-resumo', tela).innerHTML = l.length >= 2
      ? `<div class="sub-num num" style="margin:0 0 8px"><span>${fmtData(l[0].data)} → ${fmtData(l.at(-1).data)}: <b>${sinal(l.at(-1).valores[circSel] - l[0].valores[circSel])} cm</b></span></div>` : '';
  }

  // ---------- Eventos ----------
  function ligar(n) {
    $('#s-prot', tela).onchange = (e) => { protSel = e.target.value; grafComp(n); };
    $('#s-circ', tela).onchange = (e) => { circSel = e.target.value; grafCirc(n); };
    tela.onclick = (e) => {
      const per = e.target.closest('[data-seg=periodo] button');
      if (per) { estado.periodoProg = per.dataset.v; return desenhar(); }
      const top = e.target.closest('[data-seg=top] button');
      if (top) { topModo = top.dataset.v; return desenharOrigem(n); }
      const mes = e.target.closest('[data-mes]');
      if (mes) {
        const [a, m] = mesCal.split('-').map(Number);
        const d = new Date(a, m - 1 + Number(mes.dataset.mes), 1);
        mesCal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return desenharCalendario();
      }
      const dia = e.target.closest('[data-dia]');
      if (dia) { estado.dataAtual = dia.dataset.dia; location.hash = '#diario'; return; }
      const sem = e.target.closest('[data-sem]');
      if (sem) { semRel = somarDias(semRel, Number(sem.dataset.sem)); return desenharRelatorio(); }
      if (e.target.closest('[data-pdf]')) return gerarRelatorioPDF(Number(estado.periodoProg) || null).catch((err) => { console.error(err); aviso('Não foi possível gerar o relatório: ' + err.message); });
      if (e.target.closest('[data-alvo]')) return folhaAlvo();
      const ap = e.target.closest('[data-aplicar]');
      if (ap) return aplicarMeta(Number(ap.dataset.aplicar));
    };
  }

  function folhaAlvo() {
    const alvo = estado.config.alvo;
    const p = abrirFolha('Peso-alvo', `<form id="fa" novalidate>
      <label class="campo"><span>Peso-alvo (kg)</span><input type="text" inputmode="decimal" name="kg" value="${alvo ? fmtNum(alvo.peso) : ''}"></label>
      <p class="mudo">O ponto de partida é a sua tendência de peso de hoje${tend.length ? ` (${f1(tend.at(-1).y)} kg)` : ''}. A projeção usa o ritmo real das últimas 4 semanas.</p>
      <p class="erro" id="erro"></p><button class="btn prim bloco">Salvar</button>
      ${alvo ? '<button type="button" class="btn bloco" data-remover style="margin-top:8px">Remover alvo</button>' : ''}</form>`);
    $('#fa', p).onsubmit = async (e) => {
      e.preventDefault();
      const kg = lerNumero(e.target.kg.value);
      if (!(kg >= 30 && kg <= 300)) { $('#erro', p).textContent = 'Informe um peso entre 30 e 300 kg.'; return; }
      const ini = tend.at(-1)?.y ?? estado.perfil.peso;
      estado.config.alvo = { peso: kg, inicio: alvo && alvo.peso === kg ? alvo.inicio : { data: hoje, kg: Math.round(ini * 10) / 10 } };
      await salvarConfig(); fecharFolha(); desenhar();
    };
    const rem = $('[data-remover]', p);
    if (rem) rem.onclick = async () => { delete estado.config.alvo; await salvarConfig(); fecharFolha(); desenhar(); };
  }

  /** Aplica a meta sugerida: soma a diferença a todos os conjuntos (preserva diferenças entre dias), vale a partir de hoje. */
  async function aplicarMeta(sug) {
    const m = structuredClone(estado.metas);
    const media = (x) => (x.modo === 'semana' ? x.semana.reduce((s, c) => s + c.kcal, 0) / 7 : x.base.kcal);
    const delta = Math.round(sug - media(m));
    if (!(await confirmar(`Mudar a meta calórica em ${sinal(delta, fk)} kcal (para ~${fk(sug)}), a partir de hoje? Os dias anteriores mantêm a meta da época.`, { titulo: 'Aplicar meta sugerida', ok: 'Aplicar' }))) return;
    const antes = estado.metas;
    m.base.kcal = Math.round(m.base.kcal + delta);
    m.semana.forEach((c) => { c.kcal = Math.round(c.kcal + delta); });
    await salvarMetas(registrarHistorico(m, hoje));
    await render(tela);
    aviso(`Meta ajustada para ${fk(media(m))} kcal`, { acao: async () => { await salvarMetas(antes); render(tela); } });
  }

  desenhar();
}
