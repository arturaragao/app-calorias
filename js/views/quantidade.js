// views/quantidade.js — folha para escolher quantidade (gramas ou porção caseira) e refeição.
// Usada ao adicionar um alimento e ao editar um item do diário.

import { estado, salvarConfig } from '../state.js';
import { carregarBase, porcoesDe, rotuloFonte } from '../foods.js';
import { nutrientesPorGramas } from '../diary.js';
import { abrirFolha, fecharFolha, esc, aviso } from '../ui.js';
import { ehFavorito, alternarFavorito, catalogo } from '../custom.js';
import { folhaAlimento } from './alimento-form.js';
import { fmtKcal, fmtMacro, fmtNum, lerNumero } from '../utils.js';

/**
 * food: objeto com valores por 100 g (alimento da base ou snapshot por100 do item).
 * opcoes: { titulo, g, porcao, refId, botao, aoConfirmar({g, porcao, refId}), aoApagar }
 */
export async function folhaQuantidade(food, opcoes) {
  const { porcoes: tabela } = await carregarBase();
  const porcoes = porcoesDe(food, tabela, estado.config.porcoesUsuario);
  const ultima = estado.config.ultimaQtd[food.id];
  let modo = opcoes.porcao ? 'porcao' : (ultima?.porcao && !opcoes.g ? 'porcao' : 'g');
  const porcaoIni = opcoes.porcao || ultima?.porcao || null;
  const gIni = opcoes.g ?? ultima?.g ?? 100;
  const refs = estado.config.refeicoes;
  const refIni = opcoes.refId || refs[0]?.id;
  const falta = ['kcal', 'prot', 'carb', 'gord'].filter((k) => food[k] == null);

  const painel = abrirFolha(opcoes.titulo || food.nome, `
    <p class="mudo" style="margin-top:-6px">${opcoes.titulo ? esc(food.nome) + '<br>' : ''}${esc(rotuloFonte(food))} · por 100 g: ${fmtKcal(food.kcal)} kcal</p>
    ${opcoes.semAcoes ? '' : `<div class="linha" style="flex-wrap:wrap;margin-bottom:10px">
      <button type="button" class="btn peq" data-fav aria-pressed="${ehFavorito(food.id)}">${ehFavorito(food.id) ? '★ Favorito' : '☆ Favoritar'}</button>
      ${String(food.id).startsWith('c-') ? '<button type="button" class="btn peq" data-editar-alim>Editar alimento</button>'
        : String(food.id).startsWith('r-') ? '<button type="button" class="btn peq" data-editar-rec>Editar receita</button>'
        : '<button type="button" class="btn peq" data-duplicar>Duplicar e editar</button>'}</div>`}
    ${falta.length ? '<p class="nota alerta">Alguns nutrientes não constam na fonte (contam como 0).</p>' : ''}
    <div class="seg" role="group"><button type="button" data-modo="g" aria-pressed="${modo === 'g'}">Gramas</button>
      <button type="button" data-modo="porcao" aria-pressed="${modo === 'porcao'}" ${porcoes.length ? '' : 'disabled'}>Porção caseira</button></div>
    <div id="m-g" class="passo">
      <button type="button" class="btn" data-d="-10" aria-label="Menos 10 g">−</button>
      <input type="text" inputmode="decimal" name="g" value="${fmtNum(gIni)}" aria-label="Gramas">
      <button type="button" class="btn" data-d="10" aria-label="Mais 10 g">+</button><span class="mudo">g</span>
    </div>
    <div id="m-p">
      <select name="porcao" aria-label="Porção">${porcoes.map((p, i) =>
        `<option value="${i}" ${porcaoIni && p.nome === porcaoIni.nome ? 'selected' : ''}>${esc(p.nome)} (${fmtNum(p.g)} g)</option>`).join('')}</select>
      <div class="passo" style="margin-top:8px"><button type="button" class="btn" data-q="-0.5" aria-label="Menos meia porção">−</button>
        <input type="text" inputmode="decimal" name="qtd" value="${fmtNum(porcaoIni?.qtd ?? 1)}" aria-label="Quantidade">
        <button type="button" class="btn" data-q="0.5" aria-label="Mais meia porção">+</button><span class="mudo">porção(ões)</span></div>
      <p class="mudo" style="margin:6px 0 0">${porcoes.some((p) => p.aprox) ? 'Porções aproximadas · ' : ''}<button type="button" class="btn peq" data-editar-porcoes>Editar porções</button></p>
    </div>
    <label class="campo" style="margin-top:12px"><span>Refeição</span><select name="ref">${refs.map((r) =>
      `<option value="${r.id}" ${r.id === refIni ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <table class="tabela num" id="calc"></table>
    <p class="erro" id="erro"></p>
    <div class="linha" style="margin-top:8px">
      ${opcoes.aoApagar ? '<button type="button" class="btn perigo" data-apagar>Apagar</button>' : ''}
      <button type="button" class="btn prim" data-ok>${esc(opcoes.botao || 'Adicionar')}</button></div>`);

  const ler = () => {
    if (modo === 'g') return { g: lerNumero(painel.querySelector('[name=g]').value), porcao: null };
    const p = porcoes[Number(painel.querySelector('[name=porcao]').value)];
    const qtd = lerNumero(painel.querySelector('[name=qtd]').value);
    return { g: p.g * qtd, porcao: { nome: p.nome, g: p.g, qtd } };
  };
  const erroDe = ({ g }) => (isNaN(g) || g <= 0 ? 'Informe uma quantidade maior que zero.' : g > 5000 ? 'Quantidade acima de 5000 g.' : '');
  const atualizar = () => {
    painel.querySelector('#m-g').hidden = modo !== 'g';
    painel.querySelector('#m-p').hidden = modo !== 'porcao';
    const q = ler(), erro = erroDe(q);
    painel.querySelector('#erro').textContent = erro;
    if (erro) return;
    const { n } = nutrientesPorGramas(food, q.g);
    painel.querySelector('#calc').innerHTML = `<tr><th>${fmtNum(Math.round(q.g * 10) / 10)} g</th><th>kcal</th><th>P</th><th>C</th><th>G</th></tr>
      <tr><td></td><td><b>${fmtKcal(n.kcal)}</b></td><td>${fmtMacro(n.prot)}</td><td>${fmtMacro(n.carb)}</td><td>${fmtMacro(n.gord)}</td></tr>`;
  };
  painel.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.modo) {
      modo = t.dataset.modo;
      painel.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', b === t));
    } else if (t.dataset.d || t.dataset.q) {
      const inp = painel.querySelector(t.dataset.d ? '[name=g]' : '[name=qtd]');
      const v = lerNumero(inp.value);
      inp.value = fmtNum(Math.max(0, (isNaN(v) ? 0 : v) + Number(t.dataset.d || t.dataset.q)));
    } else if ('fav' in t.dataset) {
      const fav = alternarFavorito(food.id);
      t.textContent = fav ? '★ Favorito' : '☆ Favoritar';
      t.setAttribute('aria-pressed', fav);
      return;
    } else if ('editarAlim' in t.dataset || 'duplicar' in t.dataset) {
      const c = await catalogo();
      const atual = c.porId.get(food.id) || food;
      const reabrir = (novo) => folhaQuantidade(novo, { ...opcoes, g: undefined, porcao: null });
      return 'duplicar' in t.dataset
        ? folhaAlimento(null, { duplicarDe: atual, aoSalvar: reabrir })
        : folhaAlimento(atual, { aoSalvar: reabrir, aoApagar: opcoes.aoMudarCatalogo });
    } else if ('editarRec' in t.dataset) {
      fecharFolha();
      location.hash = '#receita?id=' + encodeURIComponent(food.id);
      return;
    } else if ('editarPorcoes' in t.dataset) {
      return editarPorcoes(food, porcoes, () => folhaQuantidade(food, opcoes));
    } else if ('apagar' in t.dataset) {
      fecharFolha(); return opcoes.aoApagar();
    } else if ('ok' in t.dataset) {
      const q = ler();
      if (erroDe(q)) return;
      const refId = painel.querySelector('[name=ref]').value;
      estado.config.ultimaQtd[food.id] = { g: q.g, porcao: q.porcao };
      salvarConfig();
      fecharFolha();
      return opcoes.aoConfirmar({ ...q, refId });
    }
    atualizar();
  });
  painel.addEventListener('input', atualizar);
  painel.addEventListener('change', atualizar);
  atualizar();
}

/** Edita as porções deste alimento (ficam salvas por alimento, substituindo as sugeridas). */
function editarPorcoes(food, atuais, voltar) {
  const linhas = (ps) => ps.map((p, i) => `<div class="linha" style="margin-bottom:8px" data-i="${i}">
      <input type="text" name="n${i}" value="${esc(p.nome)}" aria-label="Nome da porção">
      <input type="text" inputmode="decimal" name="g${i}" value="${fmtNum(p.g)}" style="flex:0 0 90px" aria-label="Gramas">
      <button type="button" class="ico" data-rem="${i}" aria-label="Remover">✕</button></div>`).join('');
  let lista = atuais.map((p) => ({ nome: p.nome, g: p.g }));
  const painel = abrirFolha('Porções de ' + food.nome, `<p class="mudo">Nome e gramas de cada porção. Vale só para este alimento.</p>
    <div id="ps">${linhas(lista)}</div>
    <button type="button" class="btn bloco" data-novo>+ Nova porção</button>
    <p class="erro" id="erro"></p>
    <div class="linha"><button type="button" class="btn" data-restaurar>Restaurar sugeridas</button><button type="button" class="btn prim" data-salvar>Salvar</button></div>`,
  );
  const ler = () => lista.map((_, i) => ({ nome: painel.querySelector(`[name=n${i}]`).value.trim(), g: lerNumero(painel.querySelector(`[name=g${i}]`).value) }));
  painel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.rem) { lista = ler(); lista.splice(Number(t.dataset.rem), 1); painel.querySelector('#ps').innerHTML = linhas(lista); }
    if ('novo' in t.dataset) { lista = ler(); lista.push({ nome: '', g: '' }); painel.querySelector('#ps').innerHTML = linhas(lista); }
    if ('restaurar' in t.dataset) { delete estado.config.porcoesUsuario[food.id]; salvarConfig(); voltar(); }
    if ('salvar' in t.dataset) {
      const ps = ler().filter((p) => p.nome || !isNaN(p.g));
      if (ps.some((p) => !p.nome || !(p.g > 0 && p.g <= 5000))) { painel.querySelector('#erro').textContent = 'Cada porção precisa de nome e gramas (0–5000).'; return; }
      estado.config.porcoesUsuario[food.id] = ps; salvarConfig();
      aviso('Porções salvas'); voltar();
    }
  });
}
