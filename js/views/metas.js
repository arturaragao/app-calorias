// views/metas.js — editor de metas: kcal, macros (% / g / g/kg), fibra, sódio, modo por dia da semana.

import { estado, salvarMetas, salvarConfig, pesoAtual } from '../state.js';
import {
  resolverConjunto, gramasParaGkg, gramasParaPct,
  somaPct, metaCalorica, registrarHistorico, MACROS,
} from '../goals.js';
import { topo, esc, $, $$, aviso, campoPasso, ligarPassos, valorDe, seg } from '../ui.js';
import { chaveData, fmtKcal, fmtMacro, fmtNum, DIAS_CURTOS, DIAS_SEMANA, diaSemana } from '../utils.js';
import { idadePerfil } from './onboarding.js';

const NOMES = { prot: 'Proteína', carb: 'Carboidrato', gord: 'Gordura' };
const PASSO = { pct: 1, g: 1, gkg: 0.1 };
const SUF = { pct: '%', g: 'g', gkg: 'g/kg' };

let m, diaSel, peso, tela;

export async function render(t) {
  tela = t;
  m = structuredClone(estado.metas);
  diaSel = diaSemana(chaveData());
  peso = await pesoAtual();
  topo('<a class="ico" href="#config" aria-label="Voltar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a><h1>Metas</h1><span style="width:44px"></span>');
  desenhar();
}

const atual = () => (m.modo === 'semana' ? m.semana[diaSel] : m.base);

function desenhar() {
  const c = atual();
  const mm = c.macroModo;
  tela.innerHTML = `
    <div class="card">
      ${seg('modo', [['iguais', 'Todos os dias iguais'], ['semana', 'Por dia da semana']], m.modo)}
      ${m.modo === 'semana' ? `<div class="dias" role="group" aria-label="Dia da semana">${DIAS_CURTOS.map((d, i) =>
        `<button type="button" data-diasel="${i}" aria-pressed="${i === diaSel}" aria-label="${DIAS_SEMANA[i]}">${d}</button>`).join('')}</div>
        <button type="button" class="btn peq" data-copiar>Copiar ${DIAS_SEMANA[diaSel].toLowerCase()} para todos os dias</button>` : ''}
    </div>
    <form class="card" id="f" novalidate>
      <div class="card-tit"><h2>Calorias ${m.modo === 'semana' ? '— ' + DIAS_SEMANA[diaSel] : ''}</h2>
        <button type="button" class="btn peq" data-sugerir>Usar cálculo do perfil</button></div>
      ${campoPasso('kcal', c.kcal, { passo: 10, rotulo: mm === 'pct' ? 'Meta de calorias (kcal) — os macros derivam dela' : 'Calorias planejadas (kcal) — referência; a meta efetiva vem dos macros', sufixo: 'kcal' })}
      <h2 style="margin:6px 0">Macronutrientes</h2>
      ${seg('macroModo', [['pct', '% das kcal'], ['g', 'Gramas'], ['gkg', 'g/kg']], mm)}
      ${mm === 'gkg' ? `<p class="mudo" style="margin-top:-6px">Peso usado: ${peso ? fmtNum(peso) + ' kg (mais recente)' : '— cadastre o peso no perfil'}</p>` : ''}
      ${MACROS.map((k) => campoPasso(k, c[mm][k], { passo: PASSO[mm], rotulo: NOMES[k], sufixo: SUF[mm] })).join('')}
      <div id="resumo" class="nota"></div>
      <h2 style="margin:12px 0 6px">Fibra e sódio</h2>
      <div class="grade2">${campoPasso('fibra', c.fibra, { passo: 1, rotulo: 'Fibra (g)' })}${campoPasso('sodio', c.sodio, { passo: 100, rotulo: 'Sódio (mg)' })}</div>
      <p class="erro" id="erro"></p>
      <button class="btn prim bloco" type="submit">Salvar metas</button>
      <p class="mudo">As metas novas valem a partir de hoje; dias anteriores mantêm a meta que tinham.</p>
    </form>
    <div class="card"><label class="linha"><input type="checkbox" id="recalc" ${estado.config.recalcularComPeso ? 'checked' : ''} style="flex:0;width:22px;height:22px">
      <span>Recalcular a meta calórica quando o peso mudar</span></label></div>`;

  const f = $('#f', tela);
  ligarPassos(f, () => { lerParaConjunto(); resumo(); });
  resumo();

  tela.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const s = b.closest('[data-seg]');
    if (s?.dataset.seg === 'modo') {
      lerParaConjunto();
      // ao entrar no modo semanal pela 1ª vez (7 dias ainda idênticos), parte da meta atual
      const iguais = m.semana.every((c) => JSON.stringify(c) === JSON.stringify(m.semana[0]));
      if (b.dataset.v === 'semana' && m.modo === 'iguais' && iguais) m.semana = m.semana.map(() => structuredClone(m.base));
      m.modo = b.dataset.v;
      return desenhar();
    }
    if (s?.dataset.seg === 'macroModo') { lerParaConjunto(); trocarMacroModo(b.dataset.v); return desenhar(); }
    if (b.dataset.diasel) { lerParaConjunto(); diaSel = Number(b.dataset.diasel); return desenhar(); }
    if ('copiar' in b.dataset) {
      lerParaConjunto();
      m.semana = m.semana.map(() => structuredClone(atual()));
      aviso('Copiado para todos os dias (salve para confirmar)');
      return desenhar();
    }
    if ('sugerir' in b.dataset) {
      const p = estado.perfil;
      const k = Math.round(metaCalorica({ ...p, idade: idadePerfil(p) }).kcal);
      f.kcal.value = fmtNum(k); lerParaConjunto(); resumo();
    }
  };
  $('#recalc', tela).onchange = (e) => { estado.config.recalcularComPeso = e.target.checked; salvarConfig(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    lerParaConjunto();
    const erro = validar();
    $('#erro', f).textContent = erro;
    if (erro) return;
    await salvarMetas(registrarHistorico(m, chaveData()));
    aviso('Metas salvas');
    location.hash = '#diario';
  };
}

/** Lê o formulário para o conjunto em edição (sem validar). */
function lerParaConjunto() {
  const f = $('#f', tela);
  if (!f) return;
  const c = atual();
  const num = (n, padrao) => { const v = valorDe(f, n); return isNaN(v) ? padrao : v; };
  c.kcal = num('kcal', c.kcal);
  for (const k of MACROS) c[c.macroModo][k] = num(k, c[c.macroModo][k]);
  c.fibra = num('fibra', c.fibra);
  c.sodio = num('sodio', c.sodio);
}

/** Converte os valores atuais para o novo modo, mantendo os mesmos gramas. */
function trocarMacroModo(novo) {
  const c = atual();
  const g = resolverConjunto(c, peso);
  const gramas = { prot: g.prot, carb: g.carb, gord: g.gord };
  const arred = (o, casas) => Object.fromEntries(MACROS.map((k) => [k, Math.round(o[k] * 10 ** casas) / 10 ** casas]));
  if (novo === 'g') c.g = arred(gramas, 0);
  if (novo === 'gkg' && peso) c.gkg = arred(gramasParaGkg(gramas, peso), 1);
  if (novo === 'pct') c.pct = arred(gramasParaPct(gramas), 0);
  c.macroModo = novo;
}

function validar() {
  const lista = m.modo === 'semana' ? m.semana : [m.base];
  for (const [i, c] of lista.entries()) {
    const onde = m.modo === 'semana' ? ` (${DIAS_SEMANA[i]})` : '';
    if (!(c.kcal >= 800 && c.kcal <= 10000)) return `Calorias devem ficar entre 800 e 10000${onde}.`;
    if (c.macroModo === 'pct' && Math.abs(somaPct(c.pct) - 100) > 0.01) return `A soma dos percentuais deve ser 100%${onde}.`;
    if (MACROS.some((k) => !(c[c.macroModo][k] >= 0))) return `Macros não podem ser negativos${onde}.`;
    if (c.macroModo === 'gkg' && !peso) return 'Para g/kg, informe o peso no perfil.';
    if (!(c.fibra >= 0) || !(c.sodio >= 0)) return `Fibra e sódio não podem ser negativos${onde}.`;
  }
  return '';
}

function resumo() {
  const c = atual();
  const r = resolverConjunto(c, peso);
  const pct = gramasParaPct(r);
  const soma = somaPct(c.pct);
  let txt = `${MACROS.map((k) => `${NOMES[k]}: <b>${fmtMacro(r[k])} g</b> (${fmtNum(Math.round(pct[k]))}%${peso ? `, ${fmtNum(Math.round((r[k] / peso) * 10) / 10)} g/kg` : ''})`).join('<br>')}`;
  if (c.macroModo === 'pct') {
    txt += `<br>Soma: <b class="${Math.abs(soma - 100) > 0.01 ? 'alerta' : ''}">${fmtNum(soma)}%</b>${Math.abs(soma - 100) > 0.01 ? ' — precisa dar 100%' : ''}`;
  } else {
    const dif = r.diferenca;
    txt += `<br>Meta efetiva: <b>${fmtKcal(r.kcal)} kcal</b> (4/4/9 kcal/g)` +
      (Math.abs(dif) >= 1 ? `<br><span class="alerta">Diferença de ${dif > 0 ? '+' : '−'}${fmtKcal(Math.abs(dif))} kcal em relação às ${fmtKcal(c.kcal)} kcal planejadas.</span>` : '<br>Bate com as calorias planejadas.');
  }
  $('#resumo', tela).innerHTML = txt;
}
