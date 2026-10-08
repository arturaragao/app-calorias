// views/reg-medidas.js — circunferências: lista editável, registro por data, diferença e gráfico.

import { db } from '../db.js';
import { estado, salvarConfig } from '../state.js';
import { CIRC_PADRAO, diferencas, foraDaFaixa } from '../body.js';
import { graficoLinha } from '../chart.js';
import { $, esc, aviso, abrirFolha, ICONES } from '../ui.js';
import { chaveData, fmtData, fmtNum, lerNumero, uid } from '../utils.js';

const defs = () => (estado.config.circDef ||= structuredClone(CIRC_PADRAO));
let sel = null;

async function lerMedidas() {
  return (await db.getAll('circumferences')).map(([data, v]) => ({ data, valores: v.valores }))
    .sort((a, b) => (a.data < b.data ? -1 : 1));
}

const difTxt = (d) => (d == null ? '' : `<span class="mudo">${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtNum(Math.abs(Math.round(d * 10) / 10))}</span>`);

export async function render(el) {
  const D = defs();
  const regs = diferencas(await lerMedidas());
  const ult = regs.at(-1);
  sel = D.some((d) => d.id === sel) ? sel : (D.find((d) => regs.some((r) => r.valores[d.id] != null)) || D[0])?.id;
  el.innerHTML = `
    <form class="card" id="fm" novalidate>
      <div class="card-tit"><h2>Nova medição (cm)</h2><button type="button" class="btn peq" data-lista>Editar lista</button></div>
      <label class="campo"><span>Data</span><input type="date" name="data" value="${chaveData()}" max="${chaveData()}"></label>
      <div class="grade2">${D.map((d) => `<label class="campo"><span>${esc(d.nome)}</span>
        <input type="text" inputmode="decimal" name="m_${d.id}" placeholder="${ult?.valores[d.id] != null ? fmtNum(ult.valores[d.id]) : ''}"></label>`).join('')}</div>
      <p class="mudo">Preencha só o que medir. Mesma data: os valores se juntam ao registro existente.</p>
      <p class="erro" id="erro"></p><button class="btn prim bloco">Salvar medição</button>
    </form>
    <div class="card"><div class="card-tit"><h2>Gráfico</h2>
      <select id="sel" style="width:auto;min-height:40px">${D.map((d) => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></div>
      <div id="graf"></div></div>
    <div class="card"><h2 style="margin-bottom:6px">Histórico</h2><ul class="itens">${regs.slice().reverse().map((r) => `<li class="item" data-data="${r.data}">
      <div class="info" data-ver><div class="nome">${fmtData(r.data)}</div><div class="mudo">${Object.keys(r.valores).length} medida(s) · tocar para ver</div></div>
      <button class="ico" data-apagar aria-label="Apagar medição de ${fmtData(r.data)}">${ICONES.lixo}</button></li>`).join('') || '<li class="mudo" style="padding:8px 0">Nenhuma medição.</li>'}</ul></div>`;

  const desenharGraf = () => graficoLinha($('#graf', el), regs.filter((r) => r.valores[sel] != null).map((r) => ({ data: r.data, y: r.valores[sel] })), { unidade: 'cm' });
  desenharGraf();
  $('#sel', el).onchange = (e) => { sel = e.target.value; desenharGraf(); };

  $('#fm', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, data = f.data.value, novos = {};
    for (const d of D) {
      const t = f[`m_${d.id}`].value.trim();
      if (!t) continue;
      const v = lerNumero(t);
      if (!(v > 0)) { $('#erro', el).textContent = `${d.nome}: valor inválido.`; return; }
      novos[d.id] = v;
    }
    if (!data || data > chaveData()) { $('#erro', el).textContent = 'Data inválida.'; return; }
    if (!Object.keys(novos).length) { $('#erro', el).textContent = 'Preencha ao menos uma medida.'; return; }
    const fora = D.filter((d) => novos[d.id] != null && foraDaFaixa('circ', novos[d.id]));
    if (fora.length && !confirm(`Valor fora da faixa usual (10–250 cm): ${fora.map((d) => `${d.nome} ${fmtNum(novos[d.id])}`).join(', ')}. Salvar mesmo assim?`)) return;
    const atual = (await db.get('circumferences', data)) || { valores: {} };
    await db.put('circumferences', data, { valores: { ...atual.valores, ...novos } });
    aviso('Medição salva');
    render(el);
  };

  el.onclick = async (e) => {
    if (e.target.closest('[data-lista]')) return editarLista(() => render(el));
    const li = e.target.closest('[data-data]');
    if (!li) return;
    const r = regs.find((x) => x.data === li.dataset.data);
    if (e.target.closest('[data-apagar]')) {
      const antes = await db.get('circumferences', r.data);
      await db.del('circumferences', r.data);
      render(el);
      return aviso(`Medição de ${fmtData(r.data)} apagada`, { acao: async () => { await db.put('circumferences', r.data, antes); render(el); } });
    }
    if (e.target.closest('[data-ver]')) {
      const nome = (id) => D.find((d) => d.id === id)?.nome || id;
      abrirFolha(`Medidas de ${fmtData(r.data)}`, `<table class="tabela num"><tr><th>Medida</th><th>cm</th><th>vs anterior</th></tr>
        ${Object.entries(r.valores).map(([k, v]) => `<tr><td>${esc(nome(k))}</td><td>${fmtNum(v)}</td><td>${difTxt(r.dif[k])}</td></tr>`).join('')}</table>`);
    }
  };
}

/** Adicionar, renomear, remover e reordenar as circunferências (medições antigas são mantidas). */
function editarLista(aoMudar) {
  const D = defs();
  const p = abrirFolha('Lista de circunferências', '<ul class="lista" id="ld"></ul><button class="btn bloco" data-nova style="margin-top:8px">+ Nova medida</button>');
  const desenhar = () => {
    $('#ld', p).innerHTML = D.map((d, i) => `<li class="linha" data-i="${i}" style="gap:0">
      <input type="text" value="${esc(d.nome)}" data-nome="${i}" aria-label="Nome" maxlength="30" style="flex:1">
      <button class="ico" data-cima ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ICONES.cima}</button>
      <button class="ico" data-baixo ${i === D.length - 1 ? 'disabled' : ''} aria-label="Descer">${ICONES.baixo}</button>
      <button class="ico" data-rem aria-label="Remover">${ICONES.lixo}</button></li>`).join('');
  };
  desenhar();
  const salvar = async () => { await salvarConfig(); aoMudar(); };
  p.addEventListener('change', (e) => {
    const i = e.target.dataset.nome;
    if (i == null) return;
    const v = e.target.value.trim();
    if (v) { D[i].nome = v; salvar(); }
  });
  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('nova' in b.dataset) { D.push({ id: 'c' + uid(), nome: 'Nova medida' }); desenhar(); return salvar(); }
    const i = Number(b.closest('[data-i]')?.dataset.i);
    if (Number.isNaN(i)) return;
    if ('cima' in b.dataset) [D[i - 1], D[i]] = [D[i], D[i - 1]];
    else if ('baixo' in b.dataset) [D[i + 1], D[i]] = [D[i], D[i + 1]];
    else if ('rem' in b.dataset) {
      if (!confirm(`Remover "${D[i].nome}" da lista? Os valores já registrados continuam salvos.`)) return;
      D.splice(i, 1);
    }
    desenhar(); salvar();
  });
}
