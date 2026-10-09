// views/copiar-dias.js — copiar uma refeição ou o dia inteiro para um intervalo de datas (marmitas, semana repetida).
// Acrescenta (não substitui) em cada data; datas futuras entram como planejadas por padrão. Desfazer volta todos os dias.

import { lerDia, gravarDia } from '../state.js';
import { copiarPara, datasNoIntervalo } from '../diary.js';
import { abrirFolha, fecharFolha, aviso, esc, $, $$, vibrar, ic } from '../ui.js';
import { chaveData, somarDias, fmtData, DIAS_CURTOS } from '../utils.js';

/** origem: dia de onde copiar; refId: refeição (ou null = dia inteiro); nomeRef para o título. */
export function folhaCopiarDias(origem, { refId = null, nomeRef = '', aoTerminar } = {}) {
  const n = refId ? (origem.refeicoes[refId] || []).length : Object.values(origem.refeicoes).flat().length;
  if (!n) return aviso(refId ? 'Essa refeição está vazia.' : 'O dia está vazio.');
  const ini = somarDias(origem.data, 1), fim = somarDias(origem.data, 5);
  const p = abrirFolha(refId ? `Copiar ${nomeRef}` : 'Copiar o dia', `<form id="fcd" novalidate>
    <p class="mudo" style="margin-top:-4px">${n} item(ns) de ${esc(fmtData(origem.data))}. Os itens são acrescentados em cada dia.</p>
    <div class="grade2"><label class="campo"><span>De</span><input type="date" name="ini" value="${ini}"></label>
      <label class="campo"><span>Até</span><input type="date" name="fim" value="${fim}"></label></div>
    <span class="mudo">Dias da semana</span>
    <div class="etiquetas-dia" style="margin-top:6px">${DIAS_CURTOS.map((d, i) =>
      `<button type="button" class="chip-tog" data-dsem="${i}" aria-pressed="true">${d}</button>`).join('')}</div>
    <label class="linha-chave"><span>Como planejado<small>Não soma até você confirmar "comi" no dia</small></span>
      <span class="chave"><input type="checkbox" name="plan" ${ini > chaveData() ? 'checked' : ''}><i></i></span></label>
    <p class="mudo num" id="cd-res"></p><p class="erro" id="erro"></p>
    <button class="btn prim bloco">${ic('copy')} Copiar</button></form>`, { foco: false });
  const dias = () => $$('[data-dsem]', p).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => Number(b.dataset.dsem));
  const datas = () => {
    const f = $('#fcd', p);
    return f.ini.value && f.fim.value && f.ini.value <= f.fim.value ? datasNoIntervalo(f.ini.value, f.fim.value, dias()).filter((d) => d !== origem.data) : [];
  };
  const atualizar = () => {
    const ds = datas();
    $('#cd-res', p).textContent = ds.length ? `${n} item(ns) × ${ds.length} dia(s): ${ds.slice(0, 4).map((d) => fmtData(d).slice(0, 5)).join(', ')}${ds.length > 4 ? '…' : ''}` : 'Nenhum dia no intervalo.';
  };
  p.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dsem]');
    if (!b) return;
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    atualizar();
  });
  p.addEventListener('change', atualizar);
  $('#fcd', p).onsubmit = async (e) => {
    e.preventDefault();
    const ds = datas();
    if (!ds.length) { $('#erro', p).textContent = 'Escolha um intervalo com pelo menos um dia.'; return; }
    const planejado = e.target.plan.checked;
    const antes = [];
    for (const d of ds) {
      const dia = await lerDia(d);
      antes.push(dia);
      await gravarDia(copiarPara(dia, origem, refId, { planejado }).dia);
    }
    vibrar(15);
    fecharFolha();
    await aoTerminar?.();
    aviso(`Copiado para ${ds.length} dia(s)${planejado ? ' (planejado)' : ''}`, { ms: 7000, acao: async () => {
      for (const d of antes) await gravarDia(d);
      aoTerminar?.();
    } });
  };
  atualizar();
}
