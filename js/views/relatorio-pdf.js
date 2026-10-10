// views/relatorio-pdf.js — relatório de acompanhamento para nutricionista/médico: monta uma página de impressão
// (A4) e abre a impressão do Chrome, onde se escolhe "Salvar como PDF". Sem biblioteca.

import { db } from '../db.js';
import { estado } from '../state.js';
import { totalDia, ehTreino, ETIQUETAS } from '../diary.js';
import { metaDoDia, metaCalorica, FATORES_ATIVIDADE } from '../goals.js';
import { PROTOCOLOS, CIRC_PADRAO } from '../body.js';
import * as P from '../progress.js';
import { graficoLinha, graficoBarras } from '../chart.js';
import { lerPesos } from './reg-peso.js';
import { lerDobras } from './reg-dobras.js';
import { idadePerfil } from './onboarding.js';
import { tabelaMicros } from './micros-ui.js';
import { carregarBase } from '../foods.js';
import { esc } from '../ui.js';
import { chaveData, fmtData, fmtKcal, fmtMacro, fmtMg, fmtNum, somarDias } from '../utils.js';

const f1 = (v) => (v == null ? '—' : fmtNum(Math.round(v * 10) / 10));
const f2 = (v) => fmtNum(Math.round(v * 100) / 100);
const sinal = (v, f = f1) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));

/** n = dias do período (null = tudo). */
export async function gerarRelatorioPDF(n) {
  const hoje = chaveData();
  const p = estado.perfil;
  const pesos = await lerPesos();
  const pesoEm = (data) => { let kg = p.peso; for (const x of pesos) { if (x.data <= data) kg = x.kg; else break; } return kg; };
  const brutos = (await db.getAll('diary')).map(([, d]) => d);
  const comItens = brutos.filter((d) => Object.values(d.refeicoes).some((l) => l.length));
  const dias = comItens.map((d) => ({ data: d.data, tot: totalDia(d), meta: metaDoDia(estado.metas, d.data, pesoEm(d.data), { treino: ehTreino(d) }) }))
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const ini = n ? somarDias(hoje, -(n - 1)) : (dias[0]?.data || pesos[0]?.data || hoje);
  const dP = P.noPeriodo(dias, n, hoje), pP = P.noPeriodo(pesos, n, hoje);
  const brP = comItens.filter((d) => d.data >= ini && d.data <= hoje);
  const tend = P.tendenciaPeso(pesos), tP = P.noPeriodo(tend, n, hoje);
  const ritmo = P.ritmoSemanal(tend, hoje), gasto = P.tdeeAdaptativo(dias, tend, hoje);
  const mm = P.mediasMacros(dP), ad = P.aderencia(dP);
  const mc = metaCalorica({ ...p, idade: idadePerfil(p) });
  const metaHoje = metaDoDia(estado.metas, hoje, pesoEm(hoje));
  const nomesRef = Object.fromEntries(estado.config.refeicoes.map((r) => [r.id, r.nome]));
  const orig = P.origemCalorias(brP, nomesRef);
  const dobras = (await lerDobras()).filter((r) => r.data >= ini && r.data <= hoje);
  const circ = (await db.getAll('circumferences')).map(([data, v]) => ({ data, valores: v.valores }))
    .filter((c) => c.data >= ini && c.data <= hoje).sort((a, b) => (a.data < b.data ? -1 : 1));
  const defsCirc = estado.config.circDef || CIRC_PADRAO;
  const anot = P.anotacoesEntre(brutos, ini, hoje);
  const rotTag = (t) => ETIQUETAS.find(([id]) => id === t)?.[1] || t;
  const base = await carregarBase().catch(() => null);
  const totalDiasPeriodo = P.diasEntre(ini, hoje) + 1;
  const idade = idadePerfil(p);

  const linhaMacro = (nome, v, m, f, un) => `<tr><td>${nome}</td><td>${f(v)} ${un}</td><td>${m ? f(m) + ' ' + un : '—'}</td><td>${m ? Math.round((v / m) * 100) + '%' : ''}</td></tr>`;
  const circLinhas = defsCirc.map((d) => {
    const l = circ.filter((c) => c.valores[d.id] != null);
    if (!l.length) return '';
    const a = l[0], b = l.at(-1);
    return `<tr><td>${esc(d.nome)}</td><td>${f1(a.valores[d.id])} (${fmtData(a.data).slice(0, 5)})</td><td>${l.length > 1 ? `${f1(b.valores[d.id])} (${fmtData(b.data).slice(0, 5)})` : '—'}</td>
      <td>${l.length > 1 ? sinal(b.valores[d.id] - a.valores[d.id]) : ''}</td></tr>`;
  }).join('');

  const div = document.createElement('div');
  div.id = 'impressao';
  div.innerHTML = `
    <header><h1>Relatório de acompanhamento nutricional</h1>
      <p>Período: <b>${fmtData(ini)} a ${fmtData(hoje)}</b> (${totalDiasPeriodo} dias) · emitido em ${fmtData(hoje)} · app Calorias e Macros</p></header>
    <section><h2>Perfil</h2>
      <p>${p.sexo === 'F' ? 'Feminino' : 'Masculino'}, ${idade} anos, ${f1(p.altura)} cm · peso atual ${f1(tend.at(-1)?.y ?? p.peso)} kg (tendência)
      · atividade: ${esc(FATORES_ATIVIDADE[p.atividade]?.nome || p.atividade)} · objetivo: ${p.objetivo === 'perder' ? `perder ${f2(p.ritmo)} kg/sem` : p.objetivo === 'ganhar' ? `ganhar ${f2(p.ritmo)} kg/sem` : 'manter'}</p>
      <p>Meta vigente: <b>${fmtKcal(metaHoje.kcal)} kcal</b> · P ${fmtMacro(metaHoje.prot)} g (${f1(metaHoje.prot / (tend.at(-1)?.y || p.peso))} g/kg) · C ${fmtMacro(metaHoje.carb)} g · G ${fmtMacro(metaHoje.gord)} g
      · fibra ${fmtNum(metaHoje.fibra)} g · sódio ${fmtMg(metaHoje.sodio)} mg${estado.metas.treinoExtra ? ` · dias de treino +${fmtKcal(estado.metas.treinoExtra)} kcal` : ''}</p></section>
    <section><h2>Consumo médio × meta</h2>
      ${mm.n ? `<table><tr><th>Nutriente</th><th>Média/dia</th><th>Meta média</th><th>%</th></tr>
        ${linhaMacro('Calorias', mm.consumo.kcal, mm.meta.kcal, fmtKcal, 'kcal')}
        ${linhaMacro('Proteína', mm.consumo.prot, mm.meta.prot, fmtMacro, 'g')}
        ${linhaMacro('Carboidrato', mm.consumo.carb, mm.meta.carb, fmtMacro, 'g')}
        ${linhaMacro('Gordura', mm.consumo.gord, mm.meta.gord, fmtMacro, 'g')}
        ${linhaMacro('Fibra', mm.consumo.fibra, metaHoje.fibra, fmtMacro, 'g')}
        ${linhaMacro('Sódio', mm.consumo.sodio_mg, metaHoje.sodio, fmtMg, 'mg')}</table>
        <p>${mm.n} de ${totalDiasPeriodo} dias registrados · na meta (±10%): ${ad.dentro} dia(s) (${fmtNum(Math.round(ad.pct))}%), acima ${ad.acima}, abaixo ${ad.abaixo}
        · distribuição das kcal: P ${fmtNum(Math.round(mm.pct.prot))}% / C ${fmtNum(Math.round(mm.pct.carb))}% / G ${fmtNum(Math.round(mm.pct.gord))}%</p>`
      : '<p>Sem dias registrados no período.</p>'}
      <div id="pdf-sem" class="graf"></div></section>
    <section><h2>Peso</h2>
      ${pP.length ? `<p>${f1(pP[0].kg)} kg (${fmtData(pP[0].data)}) → ${f1(pP.at(-1).kg)} kg (${fmtData(pP.at(-1).data)})
        · tendência ${tP.length > 1 ? sinal(tP.at(-1).y - tP[0].y) + ' kg' : '—'} · ritmo atual ${ritmo != null ? sinal(ritmo, f2) + ' kg/semana' : '—'}
        ${estado.config.alvo ? ` · peso-alvo ${f1(estado.config.alvo.peso)} kg` : ''}</p><div id="pdf-peso" class="graf"></div>` : '<p>Sem pesagens no período.</p>'}
      ${gasto ? `<p><b>Gasto energético estimado (balanço, ${gasto.periodo} dias):</b> ${fmtKcal(gasto.tdee)} kcal/dia
        (consumo médio ${fmtKcal(gasto.mediaKcal)} kcal; variação da tendência ${sinal(gasto.deltaKg, f2)} kg; 1 kg ≈ 7700 kcal; confiança ${gasto.confianca})
        · estimativa por fórmula (Mifflin-St Jeor × atividade): ${fmtKcal(mc.tdee)} kcal.</p>` : ''}</section>
    ${dobras.length ? `<section><h2>Composição corporal (dobras cutâneas)</h2><table><tr><th>Data</th><th>Protocolo</th><th>Soma (mm)</th><th>% gordura</th><th>Massa gorda</th><th>Massa magra</th></tr>
      ${dobras.map((r) => `<tr><td>${fmtData(r.data)}</td><td>${esc(PROTOCOLOS[r.protocolo]?.nome || r.protocolo)}</td><td>${f1(r.soma)}</td>
        <td>${r.pct != null ? f1(r.pct) + '%' : '—'}</td><td>${r.mGorda != null ? f1(r.mGorda) + ' kg' : '—'}</td><td>${r.mMagra != null ? f1(r.mMagra) + ' kg' : '—'}</td></tr>`).join('')}</table></section>` : ''}
    ${circLinhas ? `<section><h2>Circunferências (cm)</h2><table><tr><th>Medida</th><th>Primeira</th><th>Última</th><th>Diferença</th></tr>${circLinhas}</table></section>` : ''}
    ${orig.dias ? `<section><h2>Distribuição e alimentos mais consumidos</h2>
      <p>${orig.porRefeicao.map((r) => `${esc(r.nome)} ${fmtNum(Math.round(r.pct))}%`).join(' · ')}</p>
      <table><tr><th>Alimento</th><th>Vezes</th><th>kcal/dia</th><th>Proteína/dia</th></tr>
      ${orig.topKcal.map((a) => `<tr><td>${esc(a.nome)}</td><td>${a.vezes}</td><td>${fmtKcal(a.kcal)}</td><td>${fmtMacro(a.prot)} g</td></tr>`).join('')}</table></section>` : ''}
    ${brP.length ? `<section class="micros-pdf">${tabelaMicros(brP.flatMap((d) => Object.values(d.refeicoes).flat()), brP.length, base).replace('<details class="micros">', '<div>').replace('</details>', '</div>').replace(/<summary>(.*?)<\/summary>/, '<h2>$1</h2>')}</section>` : ''}
    ${anot.length ? `<section><h2>Anotações</h2><ul>${anot.map((a) => `<li>${fmtData(a.data)}: ${esc([...a.tags.map(rotTag), a.nota].filter(Boolean).join(' · '))}</li>`).join('')}</ul></section>` : ''}
    <footer>Composição dos alimentos: TACO 4ª ed. (NEPA/UNICAMP, 2011), TBCA (USP/FoRC), Open Food Facts e rótulos. Valores registrados pelo próprio paciente;
      estimativas por foto/texto feitas com IA e conferidas por ele. Tendência de peso: média móvel exponencial (α = 0,1).</footer>`;
  document.body.appendChild(div);
  graficoBarras(div.querySelector('#pdf-sem'), P.semanas(dP).map((s) => ({ rotulo: fmtData(s.inicio).slice(0, 5), y: s.kcal, meta: s.meta })), { unidade: 'kcal' });
  const tendEm = new Map(tend.map((x) => [x.data, x.y]));
  if (pP.length) graficoLinha(div.querySelector('#pdf-peso'), pP.map((x) => ({ data: x.data, y: x.kg })), { unidade: 'kg', linha2: pP.map((x) => tendEm.get(x.data) ?? x.kg), rotulo2: 'tendência', alvo: estado.config.alvo?.peso ?? null });
  div.querySelectorAll('.legenda#dica-b').forEach((e) => e.remove());
  const tituloAntes = document.title;
  document.title = `relatorio-nutricional-${hoje}`;      // vira o nome sugerido do PDF
  const limpar = () => { div.remove(); document.title = tituloAntes; window.removeEventListener('afterprint', limpar); };
  window.addEventListener('afterprint', limpar);
  setTimeout(() => window.print(), 150);
}
