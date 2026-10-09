// views/foto-ia.js — IA (Gemini): estimar prato por foto ou por texto e lançar; ler rótulo para "Meus alimentos".
// A IA identifica os alimentos e estima o peso; quando há correspondência na base (TACO/Meus alimentos),
// os nutrientes vêm da tabela (item normal, com gramas editáveis no diário). Sem correspondência, usa os valores da IA.

import { estado, lerDia, gravarDia } from '../state.js';
import { criarItem, criarItemRapido, adicionarItem, nutrientesPorGramas } from '../diary.js';
import { comprimir, fotosDe, gravarFotos } from '../photos.js';
import { estimarFoto, estimarTexto, lerRotulo, lerChave, salvarChave, chaveValida } from '../ia.js';
import { catalogo, registrarRecente } from '../custom.js';
import { correspondencias } from '../foods.js';
import { folhaAlimento } from './alimento-form.js';
import { abrirFolha, fecharFolha, aviso, esc, $, $$, ICONES } from '../ui.js';
import { fmtKcal, fmtMacro, fmtNum, lerNumero, uid } from '../utils.js';
import { suportaVoz, ditar } from '../voz.js';

const IA = 'ia';   // valor do seletor de fonte = "estimativa da IA"

// ---------- Entradas ----------

/** Foto do prato. `aoLancar` redesenha a tela de origem depois de lançar (ou desfazer). */
export function folhaFotoIA({ data = estado.dataAtual, refId = estado.refeicaoAlvo, aoLancar } = {}) {
  if (!lerChave()) return folhaChave(() => folhaFotoIA({ data, refId, aoLancar }));
  const p = abrirFolha('Estimar por foto (IA)', `
    <div class="grade2"><label class="btn prim">${ICONES.camera} Tirar foto<input type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn">Da galeria<input type="file" accept="image/*" hidden></label></div>
    <label class="campo"><span>Dica (opcional)</span><input type="text" name="dica" maxlength="120" placeholder="ex.: 2 ovos mexidos com manteiga, pão francês"></label>
    <label class="linha"><input type="checkbox" name="guardar" checked style="flex:0;width:22px;height:22px"><span>Guardar a foto na refeição</span></label>
    <p class="mudo">A IA identifica e estima o peso; os nutrientes vêm da TACO quando houver correspondência. Confira antes de lançar.</p>`, { foco: false });
  $$('input[type=file]', p).forEach((inp) => {
    inp.onchange = async () => {
      const arq = inp.files[0];
      if (!arq) return;
      const dica = $('[name=dica]', p).value.trim(), guardar = $('[name=guardar]', p).checked;
      let blob;
      try { blob = await comprimir(arq); } catch { return aviso('Não consegui ler essa imagem.'); }
      const url = URL.createObjectURL(blob);
      await processar(p, () => estimarFoto(blob, dica), { blob, url, guardar, data, refId, aoLancar, origem: 'Foto (IA)',
        deNovo: () => folhaFotoIA({ data, refId, aoLancar }) });
    };
  });
}

/** Descrever o que comeu em texto livre (pode usar o microfone do teclado). */
export function folhaTextoIA({ data = estado.dataAtual, refId = estado.refeicaoAlvo, aoLancar } = {}) {
  if (!lerChave()) return folhaChave(() => folhaTextoIA({ data, refId, aoLancar }));
  const p = abrirFolha('Descrever o que comeu (IA)', `<form id="ft" novalidate>
    <label class="campo"><span>O que você comeu?</span><textarea name="txt" rows="3" maxlength="400"
      placeholder="ex.: 2 ovos mexidos, 1 pão francês com manteiga e café com leite"></textarea></label>
    ${suportaVoz() ? '<button type="button" class="btn bloco" data-ditar>🎤 Ditar</button>' : ''}
    <p class="mudo">${suportaVoz() ? 'Toque em 🎤 Ditar e fale; toque de novo para parar.' : 'Dica: toque no microfone do teclado para ditar.'} Quantidades ajudam (“200 g de arroz”, “2 colheres”).</p>
    <p class="erro" id="erro"></p><button class="btn prim bloco">Estimar</button></form>`);
  // ditado (Web Speech API): acrescenta ao que já estiver escrito
  let parar = null;
  const bDitar = $('[data-ditar]', p);
  if (bDitar) bDitar.onclick = () => {
    if (parar) return parar();
    const campo = $('[name=txt]', p), antes = campo.value.trim();
    bDitar.classList.add('gravando'); bDitar.textContent = '■ Parar (ouvindo…)';
    navigator.vibrate?.(10);
    parar = ditar((final, parcial) => { campo.value = [antes, final, parcial].filter(Boolean).join(' ').slice(0, 400); }, (erro) => {
      parar = null;
      bDitar.classList.remove('gravando'); bDitar.textContent = '🎤 Ditar';
      if (erro) $('#erro', p).textContent = erro;
    });
  };
  $('#ft', p).onsubmit = async (e) => {
    e.preventDefault();
    parar?.();
    const txt = e.target.txt.value.trim();
    if (txt.length < 3) { $('#erro', p).textContent = 'Descreva o que comeu.'; return; }
    await processar(p, () => estimarTexto(txt), { data, refId, aoLancar, origem: 'Texto (IA)',
      deNovo: () => folhaTextoIA({ data, refId, aoLancar }) });
  };
}

/** Foto da tabela nutricional → revisar e salvar em "Meus alimentos". */
export function folhaRotulo({ aoSalvar } = {}) {
  if (!lerChave()) return folhaChave(() => folhaRotulo({ aoSalvar }));
  const p = abrirFolha('Ler rótulo (IA)', `
    <div class="grade2"><label class="btn prim">${ICONES.camera} Fotografar<input type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn">Da galeria<input type="file" accept="image/*" hidden></label></div>
    <p class="mudo">Fotografe de perto a <b>tabela nutricional</b>, reta e sem reflexo. Você confere os valores antes de salvar em Meus alimentos.</p>`, { foco: false });
  $$('input[type=file]', p).forEach((inp) => {
    inp.onchange = async () => {
      const arq = inp.files[0];
      if (!arq) return;
      let blob;
      try { blob = await comprimir(arq); } catch { return aviso('Não consegui ler essa imagem.'); }
      p.innerHTML = p.innerHTML.split('</h2>')[0] + '</h2><p class="mudo" role="status">Lendo a tabela nutricional…</p>';
      try {
        const { food, obs } = await lerRotulo(blob);
        if (!food) throw new Error(obs || 'Não encontrei uma tabela nutricional legível. Tente outra foto.');
        fecharFolha();
        const porc = food.porcoes[0];
        setTimeout(() => folhaAlimento(null, {
          prefill: food, titulo: 'Revisar e salvar', baseG: porc?.g,
          nota: `Valores lidos do rótulo pela IA${porc ? `, mostrados pela <b>porção de ${fmtNum(porc.g)} g</b> (${esc(porc.nome)}) como na tabela` : ' (por 100 g)'}.
            Confira com a embalagem; o app guarda por 100 g e lança pela porção.${obs ? ' ' + esc(obs) : ''}`,
          aoSalvar,
        }), 350);
      } catch (e) {
        p.insertAdjacentHTML('beforeend', `<p class="erro">${esc(e.message)}</p><button class="btn bloco" data-de-novo>Tentar outra foto</button>`);
        p.querySelector('[data-de-novo]').onclick = () => { fecharFolha(); setTimeout(() => folhaRotulo({ aoSalvar }), 350); };
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
    if (!chaveValida(c)) { $('#erro', p).textContent = 'Isso não parece uma chave do Gemini: copie de novo no AI Studio.'; return; }
    salvarChave(c);
    fecharFolha();
    setTimeout(depois, 350);
  };
}

// ---------- Estimar e revisar ----------

async function processar(p, chamada, ctx) {
  p.innerHTML = p.innerHTML.split('</h2>')[0] + `</h2>${ctx.url ? `<img src="${ctx.url}" alt="" class="ia-foto">` : ''}
    <p class="mudo" id="ia-st" role="status">Estimando com o Gemini…</p>`;
  try {
    const [r, cat] = await Promise.all([chamada(), catalogo()]);
    revisar(p, { ...r, cat, ...ctx });
  } catch (e) {
    $('#ia-st', p).innerHTML = `<span class="erro">${esc(e.message)}</span>`;
    p.insertAdjacentHTML('beforeend', '<button class="btn bloco" data-de-novo>Tentar de novo</button>');
    p.querySelector('[data-de-novo]').onclick = () => { if (ctx.url) URL.revokeObjectURL(ctx.url); fecharFolha(); setTimeout(ctx.deNovo, 350); };
  }
}

/** Nutrientes de um item na revisão: da base (food por 100 g) ou da IA (escalados pelos gramas). */
export function nutrientesRevisao(it, food, g) {
  if (food) return nutrientesPorGramas(food, g).n;
  const f = it.g > 0 ? g / it.g : 1;
  return { kcal: it.kcal * f, prot: it.prot * f, carb: it.carb * f, gord: it.gord * f, fibra: it.fibra != null ? it.fibra * f : null };
}

function revisar(p, { itens, obs, cat, blob, url, guardar, data, refId, aoLancar, origem }) {
  const refs = estado.config.refeicoes;
  const corresp = itens.map((it) => correspondencias(cat.indice, it));
  const linha = (it, i) => {
    const c = corresp[i];
    return `<div class="ia-item" data-i="${i}">
      <label class="linha"><input type="checkbox" data-usar checked style="flex:0;width:22px;height:22px"><b style="flex:1">${esc(it.nome)}</b></label>
      <div class="ia-linha2"><select name="fonte" aria-label="De onde vêm os nutrientes">
          ${c.opcoes.map((f, k) => `<option value="${esc(f.id)}" ${c.exata && k === 0 ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}
          <option value="${IA}" ${c.exata ? '' : 'selected'}>Valores estimados pela IA</option></select>
        <label class="ia-g"><input type="text" inputmode="decimal" name="g" value="${fmtNum(Math.round(it.g || 100))}" aria-label="Gramas"><span>g</span></label></div>
      <div class="mudo num ia-n"></div></div>`;
  };
  p.innerHTML = p.innerHTML.split('</h2>')[0] + `</h2>${url ? `<img src="${url}" alt="" class="ia-foto">` : ''}
    ${obs ? `<p class="nota">${esc(obs)}</p>` : ''}
    ${itens.length ? itens.map(linha).join('') : '<p class="erro">Nenhum alimento reconhecido. Tente de novo ou use a Adição rápida.</p>'}
    <p class="num" id="ia-tot" style="font-weight:600"></p>
    <label class="campo"><span>Refeição</span><select name="ref">${refs.map((r) => `<option value="${r.id}" ${r.id === refId ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <p class="erro" id="erro"></p>
    <button class="btn prim bloco" data-lancar ${itens.length ? '' : 'disabled'}>Lançar</button>
    <p class="mudo">Da TACO: entra como alimento normal (dá para mudar os gramas no diário). Da IA: entra como Adição rápida.</p>`;
  const ler = () => $$('.ia-item', p).map((el) => {
    const it = itens[Number(el.dataset.i)];
    const fonte = $('[name=fonte]', el).value;
    const food = fonte === IA ? null : cat.porId.get(fonte);
    const g = lerNumero($('[name=g]', el).value);
    return { el, it, food, g, usar: $('[data-usar]', el).checked, n: Number.isNaN(g) ? null : nutrientesRevisao(it, food, g) };
  });
  const atualizar = () => {
    const l = ler();
    for (const x of l) x.el.querySelector('.ia-n').textContent = x.n
      ? `${fmtKcal(x.n.kcal)} kcal · P ${fmtMacro(x.n.prot)} · C ${fmtMacro(x.n.carb)} · G ${fmtMacro(x.n.gord)}${x.food ? '' : ' · estimativa'}` : 'Peso inválido';
    const sel = l.filter((x) => x.usar && x.n);
    const s = (k) => sel.reduce((a, x) => a + (x.n[k] || 0), 0);
    $('#ia-tot', p).textContent = `Total: ${fmtKcal(s('kcal'))} kcal · P ${fmtMacro(s('prot'))} · C ${fmtMacro(s('carb'))} · G ${fmtMacro(s('gord'))}`;
    const b = $('[data-lancar]', p);
    if (b) b.textContent = sel.length ? `Lançar ${sel.length} ${sel.length === 1 ? 'item' : 'itens'}` : 'Lançar';
  };
  p.oninput = atualizar; p.onchange = atualizar;
  atualizar();
  $('[data-lancar]', p).onclick = async () => {
    const sel = ler().filter((x) => x.usar);
    const erro = !sel.length ? 'Marque ao menos um alimento.'
      : sel.some((x) => !(x.g > 0) || x.g > 5000) ? 'Confira os pesos (entre 1 e 5000 g).' : '';
    $('#erro', p).textContent = erro;
    if (erro) return;
    const novaRef = $('[name=ref]', p).value, nomeRef = refs.find((r) => r.id === novaRef)?.nome;
    const antes = await lerDia(data);
    let d = antes, kcal = 0;
    for (const x of sel) {
      const item = x.food ? criarItem(x.food, x.g)
        : { ...criarItemRapido({ nome: `${x.it.nome} (≈${fmtNum(Math.round(x.g))} g)`, kcal: x.n.kcal, prot: x.n.prot, carb: x.n.carb, gord: x.n.gord, fibra: x.n.fibra, sodio_mg: null }), fonte: origem };
      if (x.food) registrarRecente(x.food.id);
      kcal += x.n.kcal;
      d = adicionarItem(d, novaRef, nomeRef, item);
    }
    await gravarDia(d);
    let fotoId = null;
    if (guardar && blob) {
      try {
        const fotos = await fotosDe(data, novaRef);
        fotoId = uid();
        fotos.push({ id: fotoId, blob, obs: `Estimativa IA: ${fmtKcal(kcal)} kcal`, ts: Date.now() });
        await gravarFotos(data, novaRef, fotos);
      } catch (e) { console.warn('Foto não guardada', e); fotoId = null; }
    }
    if (url) URL.revokeObjectURL(url);
    fecharFolha();
    await aoLancar?.();
    aviso(`${sel.length} item(ns) → ${nomeRef}`, { acao: async () => {
      await gravarDia(antes);
      if (fotoId) await gravarFotos(data, novaRef, (await fotosDe(data, novaRef)).filter((f) => f.id !== fotoId));
      aoLancar?.();
    } });
  };
}
