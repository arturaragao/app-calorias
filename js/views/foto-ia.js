// views/foto-ia.js — estimar calorias por foto do prato (Gemini) e lançar como Adição rápida.

import { estado, lerDia, gravarDia } from '../state.js';
import { criarItemRapido, adicionarItem } from '../diary.js';
import { comprimir, fotosDe, gravarFotos } from '../photos.js';
import { estimarFoto, lerChave, salvarChave } from '../ia.js';
import { abrirFolha, fecharFolha, aviso, esc, $, $$, ICONES } from '../ui.js';
import { fmtKcal, fmtMacro, fmtNum, lerNumero, uid } from '../utils.js';

const MACROS = [['kcal', 'kcal'], ['prot', 'P'], ['carb', 'C'], ['gord', 'G']];

/** Abre a folha. `aoLancar` redesenha a tela de origem depois de lançar (ou desfazer). */
export function folhaFotoIA({ data = estado.dataAtual, refId = estado.refeicaoAlvo, aoLancar } = {}) {
  if (!lerChave()) return folhaChave(() => folhaFotoIA({ data, refId, aoLancar }));
  const p = abrirFolha('Estimar por foto (IA)', `
    <div class="grade2"><label class="btn prim">${ICONES.camera} Tirar foto<input type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn">Da galeria<input type="file" accept="image/*" hidden></label></div>
    <label class="campo"><span>Dica (opcional)</span><input type="text" name="dica" maxlength="120" placeholder="ex.: 2 ovos mexidos com manteiga, pão francês"></label>
    <label class="linha"><input type="checkbox" name="guardar" checked style="flex:0;width:22px;height:22px"><span>Guardar a foto na refeição</span></label>
    <p class="mudo">A foto vai para o Gemini (cota gratuita). Resultado aproximado: confira e ajuste antes de lançar.</p>`, { foco: false });
  $$('input[type=file]', p).forEach((inp) => {
    inp.onchange = async () => {
      const arq = inp.files[0];
      if (!arq) return;
      const dica = $('[name=dica]', p).value.trim(), guardar = $('[name=guardar]', p).checked;
      let blob;
      try { blob = await comprimir(arq); } catch { return aviso('Não consegui ler essa imagem.'); }
      const url = URL.createObjectURL(blob);
      p.innerHTML = p.innerHTML.split('</h2>')[0] + `</h2><img src="${url}" alt="" class="ia-foto">
        <p class="mudo" id="ia-st" role="status">Estimando com o Gemini…</p>`;
      try {
        const r = await estimarFoto(blob, dica);
        revisar(p, { ...r, blob, url, guardar, data, refId, aoLancar });
      } catch (e) {
        $('#ia-st', p).innerHTML = `<span class="erro">${esc(e.message)}</span>`;
        p.insertAdjacentHTML('beforeend', '<button class="btn bloco" data-de-novo>Tentar outra foto</button>');
        p.querySelector('[data-de-novo]').onclick = () => { URL.revokeObjectURL(url); fecharFolha(); setTimeout(() => folhaFotoIA({ data, refId, aoLancar }), 350); };
      }
    };
  });
}

function folhaChave(depois) {
  const p = abrirFolha('Chave do Gemini', `<form id="fk" novalidate>
    <p class="mudo" style="margin-top:0">Uma vez só: crie uma chave gratuita em
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>
      (login Google › “Create API key”), copie e cole aqui. <b>Não ative faturamento</b>: assim nunca há cobrança.</p>
    <label class="campo"><span>Chave</span><input type="password" name="chave" autocomplete="off" placeholder="AIza…"></label>
    <p class="erro" id="erro"></p><button class="btn prim bloco">Salvar e continuar</button></form>`);
  $('#fk', p).onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.chave.value.trim();
    if (!/^[\w-]{30,}$/.test(c)) { $('#erro', p).textContent = 'Copie a chave inteira do AI Studio.'; return; }
    salvarChave(c);
    fecharFolha();
    setTimeout(depois, 350);
  };
}

function revisar(p, { itens, obs, blob, url, guardar, data, refId, aoLancar }) {
  const refs = estado.config.refeicoes;
  const linha = (it, i) => `<div class="ia-item" data-i="${i}">
    <label class="linha"><input type="checkbox" data-usar checked style="flex:0;width:22px;height:22px">
      <input type="text" name="nome" value="${esc(it.nome)}" maxlength="50" aria-label="Nome" style="flex:1">
      <span class="mudo num">${it.g != null ? '≈' + fmtNum(Math.round(it.g)) + ' g' : ''}</span></label>
    <div class="grade4">${MACROS.map(([k, r]) => `<label class="campo"><span>${r}</span><input type="text" inputmode="decimal" name="${k}"
      value="${fmtNum(k === 'kcal' ? Math.round(it[k]) : Math.round(it[k] * 10) / 10)}"></label>`).join('')}</div></div>`;
  p.innerHTML = p.innerHTML.split('</h2>')[0] + `</h2><img src="${url}" alt="" class="ia-foto">
    ${obs ? `<p class="nota">${esc(obs)}</p>` : ''}
    ${itens.length ? itens.map(linha).join('') : '<p class="erro">Nenhum alimento reconhecido. Tente outra foto ou use a Adição rápida.</p>'}
    <p class="num" id="ia-tot" style="font-weight:600"></p>
    <label class="campo"><span>Refeição</span><select name="ref">${refs.map((r) => `<option value="${r.id}" ${r.id === refId ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <p class="erro" id="erro"></p>
    <button class="btn prim bloco" data-lancar ${itens.length ? '' : 'disabled'}>Lançar</button>
    <p class="mudo">Cada alimento entra como Adição rápida (editável depois no diário).</p>`;
  const ler = () => $$('.ia-item', p).map((el) => {
    const it = itens[Number(el.dataset.i)];
    const v = Object.fromEntries(MACROS.map(([k]) => [k, lerNumero($(`[name=${k}]`, el).value)]));
    return { usar: $('[data-usar]', el).checked, nome: $('[name=nome]', el).value.trim() || it.nome, g: it.g, fibra: it.fibra, ...v };
  });
  const atualizar = () => {
    const sel = ler().filter((x) => x.usar);
    const s = (k) => sel.reduce((a, x) => a + (Number.isNaN(x[k]) ? 0 : x[k]), 0);
    $('#ia-tot', p).textContent = `Total: ${fmtKcal(s('kcal'))} kcal · P ${fmtMacro(s('prot'))} · C ${fmtMacro(s('carb'))} · G ${fmtMacro(s('gord'))}`;
    const b = $('[data-lancar]', p);
    if (b) b.textContent = sel.length ? `Lançar ${sel.length} ${sel.length === 1 ? 'item' : 'itens'}` : 'Lançar';
  };
  p.oninput = atualizar; p.onchange = atualizar;
  atualizar();
  $('[data-lancar]', p).onclick = async () => {
    const sel = ler().filter((x) => x.usar);
    const erro = !sel.length ? 'Marque ao menos um alimento.'
      : sel.some((x) => MACROS.some(([k]) => Number.isNaN(x[k]) || x[k] < 0)) ? 'Há um número inválido.'
      : sel.some((x) => x.kcal > 10000) ? 'Mais de 10000 kcal num item parece engano.' : '';
    $('#erro', p).textContent = erro;
    if (erro) return;
    const novaRef = $('[name=ref]', p).value, nomeRef = refs.find((r) => r.id === novaRef)?.nome;
    const antes = await lerDia(data);
    let d = antes;
    for (const x of sel) {
      const nome = x.g ? `${x.nome} (≈${fmtNum(Math.round(x.g))} g)` : x.nome;
      const item = { ...criarItemRapido({ nome, kcal: x.kcal, prot: x.prot, carb: x.carb, gord: x.gord, fibra: x.fibra, sodio_mg: null }), fonte: 'Foto (IA)' };
      d = adicionarItem(d, novaRef, nomeRef, item);
    }
    await gravarDia(d);
    let fotoId = null;
    if (guardar) {
      try {
        const fotos = await fotosDe(data, novaRef);
        fotoId = uid();
        fotos.push({ id: fotoId, blob, obs: `Estimativa IA: ${fmtKcal(sel.reduce((a, x) => a + x.kcal, 0))} kcal`, ts: Date.now() });
        await gravarFotos(data, novaRef, fotos);
      } catch (e) { console.warn('Foto não guardada', e); fotoId = null; }
    }
    URL.revokeObjectURL(url);
    fecharFolha();
    await aoLancar?.();
    aviso(`${sel.length} item(ns) → ${nomeRef}`, { acao: async () => {
      await gravarDia(antes);
      if (fotoId) await gravarFotos(data, novaRef, (await fotosDe(data, novaRef)).filter((f) => f.id !== fotoId));
      aoLancar?.();
    } });
  };
}
