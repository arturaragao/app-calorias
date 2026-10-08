// views/onboarding.js — perfil (primeiro uso e edição) e meta calórica sugerida.

import { estado, salvarPerfil, salvarMetas } from '../state.js';
import { FATORES_ATIVIDADE, metaCalorica, metasIniciais, registrarHistorico } from '../goals.js';
import { topo, esc, seg, $, $$, aviso, valorDe } from '../ui.js';
import { chaveData, fmtKcal, fmtNum, idadeEm } from '../utils.js';
import { blocoRestaurarInicio, ligarRestaurarInicio } from './drive-ui.js';

export function idadePerfil(p) {
  return p.nascimento ? idadeEm(p.nascimento) : p.idade;
}

export async function render(tela) {
  const p = estado.perfil || { sexo: 'M', altura: '', peso: '', atividade: 'moderado', objetivo: 'manter', ritmo: 0.5 };
  const primeiro = !estado.perfil;
  topo(primeiro ? '<h1>Bem-vindo</h1>' : '<a class="ico" href="#config" aria-label="Voltar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a><h1>Perfil</h1><span style="width:44px"></span>');
  tela.innerHTML = `
    ${primeiro ? blocoRestaurarInicio() + '<p class="mudo">Preencha seu perfil para calcular a meta inicial. Tudo pode ser ajustado depois.</p>' : ''}
    <form class="card" id="f" novalidate>
      <span class="mudo">Sexo</span>${seg('sexo', [['M', 'Masculino'], ['F', 'Feminino']], p.sexo)}
      <div class="grade2">
        <label class="campo"><span>Data de nascimento</span><input type="date" name="nascimento" value="${p.nascimento || ''}"></label>
        <label class="campo"><span>ou idade (anos)</span><input type="text" inputmode="numeric" name="idade" value="${p.nascimento ? '' : fmtNum(p.idade)}"></label>
        <label class="campo"><span>Altura (cm)</span><input type="text" inputmode="decimal" name="altura" value="${fmtNum(p.altura)}"></label>
        <label class="campo"><span>Peso (kg)</span><input type="text" inputmode="decimal" name="peso" value="${fmtNum(p.peso)}"></label>
      </div>
      <label class="campo"><span>Nível de atividade</span><select name="atividade">
        ${Object.entries(FATORES_ATIVIDADE).map(([k, v]) => `<option value="${k}" ${k === p.atividade ? 'selected' : ''}>${esc(v.nome)} — ×${fmtNum(v.fator)}</option>`).join('')}
      </select></label>
      <span class="mudo">Objetivo</span>${seg('objetivo', [['perder', 'Perder'], ['manter', 'Manter'], ['ganhar', 'Ganhar']], p.objetivo)}
      <label class="campo" id="campo-ritmo"><span>Ritmo (kg por semana)</span>
        <input type="text" inputmode="decimal" name="ritmo" value="${fmtNum(p.ritmo)}"></label>
      <div id="calc" class="nota"></div>
      ${primeiro ? '' : `<label class="linha" style="margin:10px 0"><input type="checkbox" name="aplicar" style="flex:0;width:22px;height:22px"> <span>Aplicar a nova meta calórica às metas atuais (a partir de hoje)</span></label>`}
      <p class="erro" id="erro"></p>
      <button class="btn prim bloco" type="submit">${primeiro ? 'Começar' : 'Salvar perfil'}</button>
    </form>`;

  ligarRestaurarInicio(tela);
  const f = $('#f', tela);
  const lerForm = () => ({
    sexo: $('[data-seg=sexo] [aria-pressed=true]', f).dataset.v,
    nascimento: f.nascimento.value || null,
    idade: f.nascimento.value ? null : valorDe(f, 'idade'),
    altura: valorDe(f, 'altura'), peso: valorDe(f, 'peso'),
    atividade: f.atividade.value,
    objetivo: $('[data-seg=objetivo] [aria-pressed=true]', f).dataset.v,
    ritmo: valorDe(f, 'ritmo') || 0,
  });
  const validar = (d) => {
    const idade = idadePerfil(d);
    if (!(idade >= 14 && idade <= 100)) return 'Informe a data de nascimento ou uma idade entre 14 e 100 anos.';
    if (!(d.altura >= 100 && d.altura <= 250)) return 'Altura deve estar entre 100 e 250 cm.';
    if (!(d.peso > 0)) return 'Informe o peso em kg.';
    if (d.objetivo !== 'manter' && !(d.ritmo > 0 && d.ritmo <= 1.5)) return 'Ritmo deve ficar entre 0,1 e 1,5 kg/semana.';
    return '';
  };
  const atualizar = () => {
    const d = lerForm();
    $('#campo-ritmo', f).hidden = d.objetivo === 'manter';
    const erro = validar(d);
    if (erro) { $('#calc', f).innerHTML = 'Preencha os campos para ver o cálculo.'; return; }
    const m = metaCalorica({ ...d, idade: idadePerfil(d) });
    $('#calc', f).innerHTML = `TMB (Mifflin-St Jeor): <b>${fmtKcal(m.tmb)}</b> kcal · Gasto (TDEE): <b>${fmtKcal(m.tdee)}</b> kcal<br>
      Ajuste: ${m.ajuste >= 0 ? '+' : '−'}${fmtKcal(Math.abs(m.ajuste))} kcal/dia → <b>Meta: ${fmtKcal(m.kcal)} kcal</b>
      ${m.abaixoPiso ? `<br><span class="alerta">⚠ O cálculo daria ${fmtKcal(m.bruta)} kcal; ajustado ao piso de segurança de ${fmtKcal(m.piso)} kcal. Considere um ritmo menor.</span>` : ''}`;
  };
  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    $$('button', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', x === b));
    atualizar();
  });
  f.addEventListener('input', atualizar);
  atualizar();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = lerForm();
    const erro = validar(d);
    $('#erro', f).textContent = erro;
    if (erro) return;
    if ((d.peso < 30 || d.peso > 300) && !confirm(`Peso de ${fmtNum(d.peso)} kg parece incomum. Confirmar?`)) return;
    await salvarPerfil(d);
    const hoje = chaveData();
    const kcal = Math.round(metaCalorica({ ...d, idade: idadePerfil(d) }).kcal);
    if (!estado.metas) {
      await salvarMetas(metasIniciais({ ...d, idade: idadePerfil(d) }, hoje));
      location.hash = '#diario';
      return;
    }
    if (f.aplicar?.checked) {
      const m = structuredClone(estado.metas);
      m.base = { ...m.base, kcal };
      m.semana = m.semana.map((c) => ({ ...c, kcal }));
      await salvarMetas(registrarHistorico(m, hoje));
      aviso(`Meta calórica atualizada para ${fmtKcal(kcal)} kcal`);
    } else aviso('Perfil salvo');
    location.hash = '#config';
  });
}
