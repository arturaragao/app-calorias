// views/reg-agua.js — água do dia: botões rápidos (copo, 500 ml, valor livre), meta e copo editáveis.

import { db } from '../db.js';
import { estado, salvarConfig } from '../state.js';
import { $, aviso, abrirFolha, fecharFolha } from '../ui.js';
import { chaveData, somarDias, fmtData, fmtNum, lerNumero } from '../utils.js';

export const AGUA_PADRAO = { copoMl: 250, metaMl: 2000 };
const cfg = () => ({ ...AGUA_PADRAO, ...(estado.config.agua || {}) });
let data = chaveData();

export const totalAgua = (reg) => (reg?.itens || []).reduce((s, i) => s + i.ml, 0);

export async function render(el) {
  const c = cfg();
  const reg = (await db.get('water', data)) || { itens: [] };
  const total = totalAgua(reg);
  const pct = Math.min(100, (total / c.metaMl) * 100);
  const copos = total / c.copoMl;
  el.innerHTML = `
    <div class="card">
      <div class="linha" style="margin-bottom:8px">
        <button class="ico" data-dia="-1" aria-label="Dia anterior" style="flex:0 0 44px">‹</button>
        <b style="text-align:center">${data === chaveData() ? 'Hoje' : fmtData(data)}</b>
        <button class="ico" data-dia="1" aria-label="Próximo dia" style="flex:0 0 44px" ${data >= chaveData() ? 'disabled' : ''}>›</button></div>
      <p class="num" style="font-size:1.8rem;font-weight:700;margin:4px 0;text-align:center">${fmtNum(total)} <span class="mudo" style="font-size:1rem">/ ${fmtNum(c.metaMl)} ml</span></p>
      <p class="mudo" style="text-align:center;margin:0 0 8px">${fmtNum(Math.round(copos * 10) / 10)} copo(s) de ${fmtNum(c.copoMl)} ml</p>
      <div class="barra"><div class="trilho" style="height:12px"><div class="enche" style="width:${pct}%;background:var(--agua)"></div></div></div>
      <div class="grade2" style="margin-top:10px">
        <button class="btn prim" data-add="${c.copoMl}">+ 1 copo (${fmtNum(c.copoMl)} ml)</button>
        <button class="btn" data-add="500">+ 500 ml</button>
        <button class="btn" data-livre>+ Outro valor</button>
        <button class="btn" data-desfazer ${reg.itens.length ? '' : 'disabled'}>Desfazer último</button>
      </div>
    </div>
    <form class="card" id="fc" novalidate><h2 style="margin-bottom:8px">Ajustes</h2><div class="grade2">
      <label class="campo"><span>Tamanho do copo (ml)</span><input type="text" inputmode="numeric" name="copo" value="${c.copoMl}"></label>
      <label class="campo"><span>Meta diária (ml)</span><input type="text" inputmode="numeric" name="meta" value="${c.metaMl}"></label></div>
      <p class="erro" id="erro"></p><button class="btn bloco">Salvar ajustes</button></form>`;

  const adicionar = async (ml) => {
    const r = (await db.get('water', data)) || { itens: [] };
    r.itens.push({ ts: Date.now(), ml });
    await db.put('water', data, r);
    render(el);
  };
  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dia) { data = somarDias(data, Number(b.dataset.dia)); if (data > chaveData()) data = chaveData(); return render(el); }
    if (b.dataset.add) return adicionar(Number(b.dataset.add));
    if ('desfazer' in b.dataset) {
      const r = await db.get('water', data);
      const rem = r.itens.pop();
      await db.put('water', data, r);
      aviso(`${fmtNum(rem.ml)} ml removidos`);
      return render(el);
    }
    if ('livre' in b.dataset) {
      const p = abrirFolha('Adicionar água', `<form id="fl"><label class="campo"><span>Quantidade (ml)</span>
        <input type="text" inputmode="numeric" name="ml"></label><p class="erro" id="erro"></p><button class="btn prim bloco">Adicionar</button></form>`);
      $('#fl', p).onsubmit = (ev) => {
        ev.preventDefault();
        const ml = lerNumero(ev.target.ml.value);
        if (!(ml > 0 && ml <= 5000)) { $('#erro', p).textContent = 'Informe de 1 a 5000 ml.'; return; }
        fecharFolha(); adicionar(ml);
      };
    }
  };
  $('#fc', el).onsubmit = async (e) => {
    e.preventDefault();
    const copo = lerNumero(e.target.copo.value), meta = lerNumero(e.target.meta.value);
    if (!(copo >= 20 && copo <= 2000) || !(meta >= 250 && meta <= 10000)) { $('#erro', el).textContent = 'Copo: 20–2000 ml; meta: 250–10000 ml.'; return; }
    estado.config.agua = { copoMl: copo, metaMl: meta };
    await salvarConfig();
    aviso('Ajustes de água salvos');
    render(el);
  };
}
