// views/importar.js — importar alimentos de CSV para "Meus alimentos" (pré-visualização e validação).

import { analisarCSV, MODELO_CSV } from '../csv.js';
import { ic } from '../icones.js';
import { salvarAlimento, nomesExistentes } from '../custom.js';
import { topo, esc, $, aviso, ICONES } from '../ui.js';
import { fmtKcal, fmtMacro, fmtMg } from '../utils.js';

export async function render(tela) {
  topo(`<a class="ico" href="#config" aria-label="Voltar">${ICONES.voltar}</a><h1>Importar CSV</h1><span style="width:48px"></span>`);
  const modelo = URL.createObjectURL(new Blob(['﻿' + MODELO_CSV], { type: 'text/csv;charset=utf-8' }));
  tela.innerHTML = `
    <div class="card">
      <p class="mudo" style="margin-top:0">Colunas (valores por 100 g): <b>nome; kcal; proteina; carboidrato; gordura; fibra; sodio</b> (mg)
        e, opcionais, <b>porcoes</b> (ex.: <code>fatia=25|unidade=50</code>) e <b>fonte</b>. Aceita “;” ou “,” e vírgula decimal.</p>
      <a class="btn peq" href="${modelo}" download="modelo-alimentos.csv">Baixar modelo CSV</a>
    </div>
    <div class="card">
      <label class="btn bloco" style="margin-bottom:8px">Escolher arquivo .csv<input type="file" accept=".csv,text/csv,text/plain" id="arq" hidden></label>
      <label class="campo"><span>ou cole o conteúdo</span><textarea id="txt" rows="6" style="width:100%;border:1px solid var(--borda);border-radius:10px;background:var(--sup);padding:8px;font:inherit"></textarea></label>
      <button class="btn prim bloco" id="analisar">Pré-visualizar</button>
    </div>
    <div id="prev"></div>`;
  let analise = null;
  $('#arq', tela).onchange = async (e) => { const f = e.target.files[0]; if (f) { $('#txt', tela).value = await f.text(); analisar(); } };
  $('#analisar', tela).onclick = analisar;

  async function analisar() {
    analise = analisarCSV($('#txt', tela).value, await nomesExistentes());
    const L = analise.linhas;
    const validas = L.filter((l) => !l.erros.length), dup = validas.filter((l) => l.duplicata);
    $('#prev', tela).innerHTML = !L.length ? '<p class="erro">Nenhuma linha encontrada.</p>' : `<div class="card">
      <p><b>${validas.length}</b> válida(s) · <b>${L.length - validas.length}</b> com erro · <b>${dup.length}</b> duplicata(s)</p>
      <div style="overflow-x:auto"><table class="tabela num"><tr><th>Nome</th><th>kcal</th><th>P</th><th>C</th><th>G</th><th>Fibra</th><th>Na</th><th>Status</th></tr>
      ${L.slice(0, 200).map((l) => `<tr><td>${esc(l.food.nome || '—')}</td><td>${fmtKcal(l.food.kcal)}</td><td>${fmtMacro(l.food.prot)}</td><td>${fmtMacro(l.food.carb)}</td>
        <td>${fmtMacro(l.food.gord)}</td><td>${fmtMacro(l.food.fibra)}</td><td>${fmtMg(l.food.sodio_mg)}</td>
        <td style="text-align:left">${l.erros.length ? `<span class="erro">${ic('x', 'p')} ${esc(l.erros.join(', '))}</span>` : l.avisos.length ? `<span class="alerta">${ic('triangle-alert', 'p')} ${esc(l.avisos.join(', '))}</span>` : ic('check', 'p')}</td></tr>`).join('')}
      </table></div>${L.length > 200 ? `<p class="mudo">Mostrando 200 de ${L.length}.</p>` : ''}
      ${dup.length ? '<label class="linha" style="margin:10px 0"><input type="checkbox" id="incluirDup" style="flex:0;width:22px;height:22px"><span>Importar também as duplicatas</span></label>' : ''}
      <button class="btn prim bloco" id="salvar" ${validas.length ? '' : 'disabled'}>Salvar em Meus alimentos</button></div>`;
    const s = $('#salvar', tela);
    if (s) s.onclick = salvar;
  }

  async function salvar() {
    const incluirDup = $('#incluirDup', tela)?.checked;
    const lista = analise.linhas.filter((l) => !l.erros.length && (incluirDup || !l.duplicata));
    if (!lista.length) return aviso('Nada para importar (só duplicatas).');
    for (const l of lista) {
      const p = l.food.porcoes.length ? l.food.porcoes : undefined;
      await salvarAlimento({ ...l.food, porcoes: p });
    }
    aviso(`${lista.length} alimento(s) importado(s)`);
    location.hash = '#adicionar?aba=meus';
  }
}
