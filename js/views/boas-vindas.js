// views/boas-vindas.js — onboarding 2.0: uma pergunta por tela, barra de progresso, explicação curta de cada cálculo
// e, no fim, a meta e uma projeção até o peso-alvo (estilo Cal AI). "Restaurar backup" continua na 1ª tela.

import { estado, salvarPerfil, salvarMetas, salvarConfig } from '../state.js';
import { FATORES_ATIVIDADE, metaCalorica, metasIniciais, pctParaGramas } from '../goals.js';
import { topo, esc, ic, $, $$, aviso } from '../ui.js';
import { chaveData, somarDias, fmtKcal, fmtNum, fmtData, lerNumero, idadeEm } from '../utils.js';
import { blocoRestaurarInicio, ligarRestaurarInicio } from './drive-ui.js';
import { projecaoInicial } from '../progress.js';

const PASSOS = ['inicio', 'sexo', 'idade', 'altura', 'peso', 'atividade', 'objetivo', 'ritmo', 'resultado'];
const idadeDe = (d) => (d.nascimento ? idadeEm(d.nascimento) : d.idade);

/** Gráfico da projeção: linha do peso atual ao alvo (SVG próprio, decorativo + texto ao lado). */
function graficoProjecao(peso, alvo, pr, hoje) {
  const W = 320, H = 150, m = 28;
  const pts = 8, sem = pr.semanas;
  const y = (kg) => { const lo = Math.min(peso, alvo) - 1, hi = Math.max(peso, alvo) + 1; return m / 2 + (H - m) * (1 - (kg - lo) / (hi - lo)); };
  const xy = Array.from({ length: pts + 1 }, (_, i) => [m + ((W - 2 * m) * i) / pts, y(peso + ((alvo - peso) * i) / pts)]);
  return `<svg class="proj" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção de ${fmtNum(peso)} kg hoje para ${fmtNum(alvo)} kg em ${fmtData(pr.data)}">
    <defs><linearGradient id="proj-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acento)" stop-opacity=".35"/><stop offset="1" stop-color="var(--acento)" stop-opacity="0"/></linearGradient></defs>
    <path d="M${xy.map((p) => p.join(',')).join(' L')} L${xy.at(-1)[0]},${H - 6} L${xy[0][0]},${H - 6} Z" fill="url(#proj-g)"/>
    <polyline points="${xy.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--acento)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${xy[0][0]}" cy="${xy[0][1]}" r="5" fill="var(--sup)" stroke="var(--acento)" stroke-width="3"/>
    <circle cx="${xy.at(-1)[0]}" cy="${xy.at(-1)[1]}" r="6" fill="var(--acento)"/>
    <text x="${xy[0][0]}" y="${xy[0][1] - 10}" text-anchor="start">${fmtNum(peso)} kg</text>
    <text x="${xy.at(-1)[0]}" y="${xy.at(-1)[1] - 12}" text-anchor="end">${fmtNum(alvo)} kg</text>
    <text x="${m}" y="${H - 8}" text-anchor="start" class="eixo">hoje</text>
    <text x="${W - m}" y="${H - 8}" text-anchor="end" class="eixo">${fmtData(pr.data).slice(0, 5)} · ${Math.round(sem)} sem.</text></svg>`;
}

export function render(tela) {
  const d = { sexo: 'M', nascimento: null, idade: null, altura: null, peso: null, atividade: 'moderado', objetivo: 'perder', ritmo: 0.5, alvo: null };
  let i = 0;
  topo('<h1>Bem-vindo</h1>');

  const corpo = {
    inicio: () => `<div class="bv-hero">${ic('notebook-text', 'g')}<h2>Calorias e macros, do seu jeito</h2>
      <p class="mudo">Base TACO, tudo no seu celular, sem conta e sem anúncio. São 7 perguntas rápidas para calcular a sua meta.</p></div>
      ${blocoRestaurarInicio()}`,
    sexo: () => `<h2>Sexo</h2><p class="mudo">A fórmula do gasto (Mifflin-St Jeor) muda um pouco entre homens e mulheres.</p>
      <div class="bv-opcoes">${[['M', 'Masculino'], ['F', 'Feminino']].map(([v, r]) => `<button type="button" class="bv-op" data-v="sexo:${v}" aria-pressed="${d.sexo === v}">${r}</button>`).join('')}</div>`,
    idade: () => `<h2>Idade</h2><p class="mudo">O gasto em repouso cai um pouco com a idade.</p>
      <label class="campo"><span>Data de nascimento</span><input type="date" name="nascimento" value="${d.nascimento || ''}"></label>
      <label class="campo"><span>ou idade (anos)</span><input type="text" inputmode="numeric" name="idade" value="${d.idade ?? ''}"></label>`,
    altura: () => `<h2>Altura</h2><p class="mudo">Em centímetros.</p>
      <label class="campo bv-num"><input type="text" inputmode="decimal" name="altura" value="${fmtNum(d.altura)}" aria-label="Altura em cm"><span>cm</span></label>`,
    peso: () => `<h2>Peso atual</h2><p class="mudo">Em kg. Depois você registra o peso em Registros e o app acompanha a tendência.</p>
      <label class="campo bv-num"><input type="text" inputmode="decimal" name="peso" value="${fmtNum(d.peso)}" aria-label="Peso em kg"><span>kg</span></label>`,
    atividade: () => `<h2>Nível de atividade</h2><p class="mudo">Multiplica o gasto em repouso (TMB) para chegar ao gasto do dia (TDEE). Exercício não é somado à parte.</p>
      <div class="bv-opcoes col">${Object.entries(FATORES_ATIVIDADE).map(([k, v]) => `<button type="button" class="bv-op" data-v="atividade:${k}" aria-pressed="${d.atividade === k}">
        <b>${esc(v.nome)}</b><span class="mudo">× ${fmtNum(v.fator)}</span></button>`).join('')}</div>`,
    objetivo: () => `<h2>Objetivo</h2><p class="mudo">Define se a meta fica abaixo, igual ou acima do seu gasto.</p>
      <div class="bv-opcoes col">${[['perder', 'Perder peso'], ['manter', 'Manter'], ['ganhar', 'Ganhar peso']].map(([v, r]) => `<button type="button" class="bv-op" data-v="objetivo:${v}" aria-pressed="${d.objetivo === v}">${r}</button>`).join('')}</div>`,
    ritmo: () => `<h2>Ritmo e peso-alvo</h2><p class="mudo">Cada kg corresponde a cerca de 7700 kcal: ${d.objetivo === 'perder' ? 'perder' : 'ganhar'} 0,5 kg/semana ≈ ${fmtKcal(0.5 * 7700 / 7)} kcal/dia de diferença.</p>
      <div class="bv-opcoes">${[0.25, 0.5, 0.75, 1].map((r) => `<button type="button" class="bv-op" data-v="ritmo:${r}" aria-pressed="${d.ritmo === r}">${fmtNum(r)} kg<span class="mudo">/semana</span></button>`).join('')}</div>
      <label class="campo" style="margin-top:12px"><span>Peso-alvo (opcional, kg)</span><input type="text" inputmode="decimal" name="alvo" value="${fmtNum(d.alvo)}"></label>`,
    resultado: () => {
      const p = { ...d, idade: idadeDe(d) };
      const m = metaCalorica(p);
      const g = pctParaGramas(m.kcal, { prot: 25, carb: 45, gord: 30 });
      const pr = projecaoInicial(d.peso, d.alvo, d.objetivo, d.ritmo, chaveData());
      return `<h2>Sua meta</h2>
        <div class="bv-meta"><b class="num">${fmtKcal(m.kcal)}</b><span>kcal por dia</span></div>
        <div class="bv-calc num"><div><b>${fmtKcal(m.tmb)}</b><span>gasto em repouso (TMB)</span></div><div><b>${fmtKcal(m.tdee)}</b><span>gasto do dia (TDEE)</span></div>
          <div><b>${m.ajuste >= 0 ? '+' : '−'}${fmtKcal(Math.abs(m.ajuste))}</b><span>ajuste do objetivo</span></div></div>
        ${m.abaixoPiso ? `<p class="nota alerta">${ic('triangle-alert', 'p')} O cálculo daria ${fmtKcal(m.bruta)} kcal; ficou no piso de segurança (${fmtKcal(m.piso)} kcal). Considere um ritmo menor.</p>` : ''}
        <p class="mudo num">Macros iniciais: P ${Math.round(g.prot)} g · C ${Math.round(g.carb)} g · G ${Math.round(g.gord)} g (25/45/30%). Tudo editável em Metas.</p>
        ${pr ? `<div class="card bv-proj">${graficoProjecao(d.peso, d.alvo, pr, chaveData())}
          <p class="mudo" style="margin:4px 0 0">No ritmo de ${fmtNum(d.ritmo)} kg/semana, <b>${fmtNum(d.alvo)} kg</b> por volta de <b>${fmtData(pr.data)}</b>. É uma projeção: o app recalcula pelo seu gasto real depois de algumas semanas (check-in de segunda).</p></div>`
          : d.alvo ? '<p class="mudo">O peso-alvo não combina com o objetivo escolhido; sem projeção.</p>' : ''}
        <p class="mudo" style="font-size:var(--fs-12)">TMB por Mifflin-St Jeor (Am J Clin Nutr 1990;51:241-7) × fator de atividade.</p>`;
    },
  };

  const lerCampos = () => {
    const q = (n) => $(`[name=${n}]`, tela);
    if (q('nascimento')) { d.nascimento = q('nascimento').value || null; d.idade = d.nascimento ? null : lerNumero(q('idade').value); }
    if (q('altura')) d.altura = lerNumero(q('altura').value);
    if (q('peso')) d.peso = lerNumero(q('peso').value);
    if (q('alvo')) { const a = lerNumero(q('alvo').value); d.alvo = a > 0 ? a : null; }
  };
  const erroDo = (passo) => {
    if (passo === 'idade') { const id = idadeDe(d); return id >= 14 && id <= 100 ? '' : 'Informe a data de nascimento ou uma idade entre 14 e 100 anos.'; }
    if (passo === 'altura') return d.altura >= 100 && d.altura <= 250 ? '' : 'Altura entre 100 e 250 cm.';
    if (passo === 'peso') return d.peso >= 30 && d.peso <= 300 ? '' : 'Peso entre 30 e 300 kg.';
    if (passo === 'ritmo') return d.alvo == null || (d.alvo >= 30 && d.alvo <= 300) ? '' : 'Peso-alvo entre 30 e 300 kg.';
    return '';
  };
  const passos = () => PASSOS.filter((p) => p !== 'ritmo' || d.objetivo !== 'manter');

  const desenhar = () => {
    const ps = passos(), passo = ps[i];
    tela.innerHTML = `<div class="bv">
      ${i > 0 ? `<div class="bv-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${ps.length - 1}" aria-valuenow="${i}" aria-label="Passo ${i} de ${ps.length - 1}"><i style="width:${(i / (ps.length - 1)) * 100}%"></i></div>` : ''}
      <div class="bv-corpo">${corpo[passo]()}</div>
      <p class="erro" id="erro"></p>
      <div class="bv-nav">${i > 0 ? `<button type="button" class="btn texto" data-voltar>${ic('chevron-left')} Voltar</button>` : '<span></span>'}
        <button type="button" class="btn prim" data-proximo>${passo === 'inicio' ? 'Começar' : passo === 'resultado' ? 'Usar esta meta' : 'Continuar'}</button></div></div>`;
    if (passo === 'inicio') ligarRestaurarInicio(tela);
    const campo = $('input[type=text], input[type=date]', tela);
    if (campo && passo !== 'idade') setTimeout(() => campo.focus({ preventScroll: true }), 60);
  };

  tela.onclick = async (e) => {
    const op = e.target.closest('[data-v]');
    if (op) {
      const [k, v] = op.dataset.v.split(':');
      d[k] = k === 'ritmo' ? Number(v) : v;
      $$('[data-v]', tela).filter((b) => b.dataset.v.startsWith(k + ':')).forEach((b) => b.setAttribute('aria-pressed', b === op));
      return;
    }
    if (e.target.closest('[data-voltar]')) { lerCampos(); i = Math.max(0, i - 1); return desenhar(); }
    if (!e.target.closest('[data-proximo]')) return;
    lerCampos();
    const ps = passos(), passo = ps[i];
    const erro = erroDo(passo);
    $('#erro', tela).textContent = erro;
    if (erro) return;
    if (passo !== 'resultado') { i++; return desenhar(); }
    // salvar: perfil, metas iniciais e (se houver) peso-alvo
    const hoje = chaveData();
    const perfil = { sexo: d.sexo, nascimento: d.nascimento, idade: d.nascimento ? null : d.idade, altura: d.altura, peso: d.peso,
      atividade: d.atividade, objetivo: d.objetivo, ritmo: d.objetivo === 'manter' ? 0 : d.ritmo };
    await salvarPerfil(perfil);
    await salvarMetas(metasIniciais({ ...perfil, idade: idadeDe(perfil) }, hoje));
    if (d.alvo) { estado.config.alvo = { peso: d.alvo, inicio: { data: hoje, kg: d.peso } }; await salvarConfig(); }
    aviso('Tudo pronto. Bom registro!');
    location.hash = '#diario';
  };
  tela.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); $('[data-proximo]', tela)?.click(); } };
  desenhar();
}
