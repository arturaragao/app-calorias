// views/reg-dobras.js — dobras cutâneas e % de gordura (protocolos selecionáveis; o último usado é o padrão).

import { db } from '../db.js';
import { estado, salvarConfig, pesoAtual } from '../state.js';
import { PROTOCOLOS, SITIOS, calcularDobras, foraDaFaixa } from '../body.js';
import { graficoLinha } from '../chart.js';
import { idadePerfil } from './onboarding.js';
import { $, esc, aviso, abrirFolha, fecharFolha, ICONES, confirmar } from '../ui.js';
import { chaveData, fmtData, fmtNum, lerNumero, uid, dataDeChave } from '../utils.js';

const cfg = () => (estado.config.dobras ||= { protocolo: 'parrillo', sitiosPers: [], lembrete: true });
const nomeSitio = (id) => SITIOS[id] || cfg().sitiosPers.find((s) => s.id === id)?.nome || id;
const f1 = (v) => (v == null ? '—' : fmtNum(Math.round(v * 10) / 10));

export async function lerDobras() {
  return (await db.getAll('skinfolds')).map(([, v]) => v).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.ts - b.ts));
}

/** Dias desde a última avaliação (null se nunca). Usado também pelo lembrete no diário. */
export async function diasDesdeUltima() {
  const l = await lerDobras();
  if (!l.length) return null;
  return Math.round((dataDeChave(chaveData()) - dataDeChave(l.at(-1).data)) / 86400000);
}

export async function render(el) {
  const c = cfg();
  const perfil = estado.perfil;
  const idade = idadePerfil(perfil);
  const peso = await pesoAtual();
  const regs = await lerDobras();
  const prot = c.protocolo;
  const sitios = prot === 'personalizado' ? c.sitiosPers.map((s) => s.id) : PROTOCOLOS[prot].sitios(perfil.sexo);
  const dias = regs.length ? Math.round((dataDeChave(chaveData()) - dataDeChave(regs.at(-1).data)) / 86400000) : null;

  el.innerHTML = `
    ${c.lembrete && dias != null && dias > 30 ? `<p class="nota alerta">Última avaliação há ${dias} dias — hora da medição mensal.</p>` : ''}
    <form class="card" id="fd" novalidate>
      <label class="campo"><span>Protocolo</span><select name="prot">${Object.entries(PROTOCOLOS).map(([k, p]) =>
        `<option value="${k}" ${k === prot ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
      <p class="mudo" style="margin-top:-6px">${perfil.sexo === 'F' ? 'Mulher' : 'Homem'}, ${idade} anos (do perfil)</p>
      <div class="grade2">
        <label class="campo"><span>Data</span><input type="date" name="data" value="${chaveData()}" max="${chaveData()}"></label>
        <label class="campo"><span>Peso (kg)</span><input type="text" inputmode="decimal" name="peso" value="${fmtNum(peso)}"></label>
      </div>
      ${prot === 'personalizado' ? '<button type="button" class="btn peq" data-sitios style="margin-bottom:10px">Escolher dobras</button>' : ''}
      <div class="grade2">${sitios.map((s) => `<label class="campo"><span>${esc(nomeSitio(s))} (mm)</span>
        <input type="text" inputmode="decimal" name="s_${s}"></label>`).join('') || '<p class="mudo">Escolha as dobras do protocolo personalizado.</p>'}</div>
      <div class="nota" id="res">Preencha as dobras para ver o resultado.</div>
      <p class="erro" id="erro"></p>
      <button class="btn prim bloco">Salvar avaliação</button>
      <p class="mudo" style="font-size:.78rem">${prot === 'parrillo' ? 'O 9 dobras (Parrillo) é menos validado que o Pollock 7. ' : ''}Para comparar ao longo do tempo, use sempre o mesmo protocolo e o mesmo avaliador.</p>
    </form>
    <div class="card"><h2 style="margin-bottom:4px">${prot === 'personalizado' ? 'Soma das dobras' : '% de gordura'} — ${esc(PROTOCOLOS[prot].nome)}</h2>
      ${regs.some((r) => r.protocolo !== prot) ? '<p class="mudo" style="margin:0 0 6px">O gráfico mostra só este protocolo (protocolos diferentes não são comparáveis).</p>' : ''}
      <div id="graf"></div></div>
    <div class="card"><h2 style="margin-bottom:6px">Histórico</h2><div style="overflow-x:auto"><table class="tabela num">
      <tr><th>Data</th><th>Protocolo</th><th>Soma</th><th>%G</th><th>MG</th><th>MM</th><th></th></tr>
      ${regs.slice().reverse().map((r) => `<tr data-id="${r.id}"><td>${fmtData(r.data).slice(0, 5)}</td><td style="text-align:left">${esc(PROTOCOLOS[r.protocolo]?.nome.split(' ')[0] || r.protocolo)}${r.protocolo === 'pollock7' || r.protocolo === 'pollock3' ? ' ' + r.protocolo.slice(-1) : ''}</td>
        <td>${f1(r.soma)}</td><td>${f1(r.pct)}</td><td>${f1(r.mGorda)}</td><td>${f1(r.mMagra)}</td>
        <td><button class="ico" data-apagar aria-label="Apagar avaliação de ${fmtData(r.data)}">${ICONES.lixo}</button></td></tr>`).join('') || '<tr><td colspan="7" class="mudo">Nenhuma avaliação.</td></tr>'}
    </table></div><p class="mudo">MG = massa gorda, MM = massa magra (kg).</p></div>
    <div class="card"><label class="linha"><input type="checkbox" id="lemb" ${c.lembrete ? 'checked' : ''} style="flex:0;width:22px;height:22px">
      <span>Lembrete mensal de avaliação (aviso discreto após 30 dias)</span></label></div>`;

  const dosProt = regs.filter((r) => r.protocolo === prot);
  graficoLinha($('#graf', el), dosProt.map((r) => ({ data: r.data, y: prot === 'personalizado' ? r.soma : r.pct })), { unidade: prot === 'personalizado' ? 'mm' : '%' });

  const f = $('#fd', el);
  const ler = () => {
    const valores = {};
    for (const s of sitios) { const v = lerNumero(f[`s_${s}`].value); if (v > 0) valores[s] = v; }
    return { valores, peso: lerNumero(f.peso.value), data: f.data.value };
  };
  const atualizar = () => {
    const d = ler();
    try {
      const r = calcularDobras(prot, d.valores, { sexo: perfil.sexo, idade, peso: d.peso }, sitios);
      $('#res', el).innerHTML = `Soma: <b>${f1(r.soma)} mm</b>${r.pct != null ? ` · Gordura: <b>${f1(r.pct)}%</b><br>
        Massa gorda: ${f1(r.mGorda)} kg · Massa magra: ${f1(r.mMagra)} kg${r.dc ? ` · Densidade: ${r.dc.toFixed(4).replace('.', ',')} g/ml` : ''}` : ''}`;
      return r;
    } catch (e) { $('#res', el).textContent = e.message; return null; }
  };
  f.addEventListener('input', atualizar);
  f.prot.onchange = async () => { c.protocolo = f.prot.value; await salvarConfig(); render(el); };
  $('#lemb', el).onchange = async (e) => { c.lembrete = e.target.checked; await salvarConfig(); };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = ler();
    const r = atualizar();
    const erro = !d.data || d.data > chaveData() ? 'Data inválida.' : !(d.peso > 0) ? 'Informe o peso.' : !sitios.length ? 'Escolha as dobras.' : !r ? 'Preencha todas as dobras do protocolo.' : '';
    $('#erro', el).textContent = erro;
    if (erro) return;
    const altas = sitios.filter((s) => foraDaFaixa('dobra', d.valores[s]));
    if (altas.length && !(await confirmar(`Dobra acima de 80 mm (ou abaixo de 1): ${altas.map((s) => nomeSitio(s)).join(', ')}. Salvar mesmo assim?`, { titulo: 'Valor incomum', ok: 'Salvar' }))) return;
    if (foraDaFaixa('peso', d.peso) && !(await confirmar(`Peso de ${fmtNum(d.peso)} kg fora da faixa usual. Salvar mesmo assim?`, { titulo: 'Peso incomum', ok: 'Salvar' }))) return;
    const reg = { id: uid(), ts: Date.now(), data: d.data, protocolo: prot, valores: d.valores, sexo: perfil.sexo, idade, peso: d.peso,
      soma: r.soma, dc: r.dc, pct: r.pct, mGorda: r.mGorda, mMagra: r.mMagra, sitios: r.sitios,
      nomes: Object.fromEntries(r.sitios.map((s) => [s, nomeSitio(s)])) };
    await db.put('skinfolds', reg.id, reg);
    aviso(r.pct != null ? `Avaliação salva: ${f1(r.pct)}% de gordura` : `Avaliação salva: soma ${f1(r.soma)} mm`);
    render(el);
  };

  el.onclick = async (e) => {
    if (e.target.closest('[data-sitios]')) return escolherSitios(() => render(el));
    const tr = e.target.closest('[data-id]');
    if (tr && e.target.closest('[data-apagar]')) {
      const antes = await db.get('skinfolds', tr.dataset.id);
      await db.del('skinfolds', tr.dataset.id);
      render(el);
      aviso('Avaliação apagada', { acao: async () => { await db.put('skinfolds', antes.id, antes); render(el); } });
    }
  };
}

/** Protocolo personalizado: escolher dobras conhecidas e/ou criar novas (só soma, sem %G). */
function escolherSitios(aoMudar) {
  const c = cfg();
  const marcados = new Set(c.sitiosPers.map((s) => s.id));
  const extras = c.sitiosPers.filter((s) => !SITIOS[s.id]);
  const p = abrirFolha('Dobras do protocolo personalizado', `<form id="fs">
    ${[...Object.entries(SITIOS), ...extras.map((s) => [s.id, s.nome])].map(([id, nome]) => `<label class="linha" style="min-height:44px">
      <input type="checkbox" name="${id}" ${marcados.has(id) ? 'checked' : ''} style="flex:0;width:22px;height:22px"><span>${esc(nome)}</span></label>`).join('')}
    <div class="linha" style="margin:8px 0"><input type="text" name="nova" placeholder="Nova dobra (nome)" maxlength="30"><button type="button" class="btn" data-nova style="flex:0 0 auto">Adicionar</button></div>
    <button class="btn prim bloco">Salvar</button></form>`);
  const f = $('#fs', p);
  p.querySelector('[data-nova]').onclick = () => {
    const nome = f.nova.value.trim();
    if (!nome) return;
    c.sitiosPers.push({ id: 'x' + uid(), nome });
    salvarConfig(); escolherSitios(aoMudar);
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const todos = [...Object.entries(SITIOS).map(([id, nome]) => ({ id, nome })), ...extras];
    c.sitiosPers = todos.filter((s) => f[s.id]?.checked);
    await salvarConfig();
    fecharFolha();
    aoMudar();
  };
}
