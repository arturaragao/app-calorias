// views/quantidade.js — folha para escolher quantidade (gramas ou porção caseira) e refeição.
// Usada ao adicionar um alimento e ao editar um item do diário.

import { estado, salvarConfig } from '../state.js';
import { ic } from '../icones.js';
import { carregarBase, porcoesDe, rotuloFonte, ehLiquido, densidadeDe } from '../foods.js';
import { nutrientesPorGramas } from '../diary.js';
import { abrirFolha, fecharFolha, esc, aviso, vibrar } from '../ui.js';
import { ehFavorito, alternarFavorito, catalogo } from '../custom.js';
import { folhaAlimento } from './alimento-form.js';
import { avaliarSuspeito } from '../inteligencia.js';
import { contextoSuspeito } from './sugestao.js';
import { fmtKcal, fmtMacro, fmtNum, lerNumero } from '../utils.js';

/**
 * food: objeto com valores por 100 g (alimento da base ou snapshot por100 do item).
 * opcoes: { titulo, g, porcao, refId, botao, aoConfirmar({g, porcao, refId}), aoApagar }
 */
export async function folhaQuantidade(food, opcoes) {
  const { porcoes: tabela } = await carregarBase();
  const porcoes = porcoesDe(food, tabela, estado.config.porcoesUsuario);
  // "1 grama" sempre disponível como porção: quantidade conta gramas, de 1 em 1
  const lista = [...porcoes, { nome: 'grama', g: 1, umG: true }];
  const ultima = estado.config.ultimaQtd[food.id];
  const dens = densidadeDe(food, tabela);   // g/mL (1 se não houver valor com fonte)
  // porção própria do produto (rótulo/receita) vira o padrão quando não há última quantidade
  const porcaoPropria = !ultima && !opcoes.g && food.porcoes?.length && !porcoes[0]?.aprox;
  // mL (líquidos): g = mL × densidade; vem em mL se o item já era em mL, se a última vez foi em mL ou se é bebida
  const ref = opcoes.porcao || (!opcoes.g ? ultima?.porcao : null);
  let modo = ref?.ml ? 'ml' : opcoes.porcao || porcaoPropria ? 'porcao' : (ultima?.porcao && !opcoes.g ? 'porcao'
    : !ultima && !opcoes.g && ehLiquido(food) ? 'ml' : 'g');
  const porcaoIni = ref?.ml ? null : opcoes.porcao || ultima?.porcao || null;
  const gIni = ref?.ml ? ref.qtd : opcoes.g ?? ultima?.g ?? (modo === 'ml' ? 200 : 100);
  const refs = estado.config.refeicoes;
  const refIni = opcoes.refId || refs[0]?.id;
  const falta = ['kcal', 'prot', 'carb', 'gord'].filter((k) => food[k] == null);

  const painel = abrirFolha(opcoes.titulo || food.nome, `
    <p class="mudo" style="margin-top:-6px">${opcoes.titulo ? esc(food.nome) + '<br>' : ''}${esc(rotuloFonte(food))} · por 100 g: ${fmtKcal(food.kcal)} kcal</p>
    ${opcoes.semAcoes ? '' : `<div class="linha" style="flex-wrap:wrap;margin-bottom:10px">
      <button type="button" class="btn peq" data-fav aria-pressed="${ehFavorito(food.id)}">${ehFavorito(food.id) ? ic('star', 'cheio') + ' Favorito' : ic('star') + ' Favoritar'}</button>
      ${String(food.id).startsWith('c-') ? '<button type="button" class="btn peq" data-editar-alim>Editar alimento</button>'
        : String(food.id).startsWith('r-') ? '<button type="button" class="btn peq" data-editar-rec>Editar receita</button>'
        : '<button type="button" class="btn peq" data-duplicar>Duplicar e editar</button>'}</div>`}
    ${falta.includes('kcal') ? `<div class="nota alerta"><p style="margin:0 0 8px"><b>Sem dados na ${esc(food.fonte || 'fonte')}</b>: a tabela não traz calorias nem macros deste alimento (lançaria 0 kcal). Use o rótulo da embalagem ou busque no Open Food Facts (botão abaixo da busca).</p>
      <button type="button" class="btn peq" data-criar-rotulo>Criar pelo rótulo</button></div>`
      : falta.length ? '<p class="nota alerta">Alguns nutrientes não constam na fonte (contam como 0).</p>' : ''}
    <div class="seg" role="group"><button type="button" data-modo="g" aria-pressed="${modo === 'g'}">Gramas</button>
      <button type="button" data-modo="ml" aria-pressed="${modo === 'ml'}">mL</button>
      <button type="button" data-modo="porcao" aria-pressed="${modo === 'porcao'}">Porção</button></div>
    <div id="m-g" class="passo passo5">
      <button type="button" class="btn" data-d="-10" aria-label="Menos 10">−10</button>
      <button type="button" class="btn" data-d="-1" aria-label="Menos 1">−1</button>
      <input type="text" inputmode="decimal" name="g" value="${fmtNum(Math.round(gIni * 10) / 10)}" aria-label="Quantidade">
      <button type="button" class="btn" data-d="1" aria-label="Mais 1">+1</button>
      <button type="button" class="btn" data-d="10" aria-label="Mais 10">+10</button><span class="mudo" id="un">${modo === 'ml' ? 'mL' : 'g'}</span>
    </div>
    <p class="mudo" id="nota-ml" style="margin:4px 0 0;font-size:.76rem">${dens === 1 ? 'mL convertido como 1 mL ≈ 1 g (aproximação).' : `1 mL ≈ ${fmtNum(dens)} g (densidade aproximada, FAO/INFOODS).`}</p>
    <div id="m-p">
      <select name="porcao" aria-label="Porção">${lista.map((p, i) =>
        `<option value="${i}" ${porcaoIni && p.nome === porcaoIni.nome ? 'selected' : ''}>${p.umG ? '1 grama (contar de 1 em 1 g)' : `${esc(p.nome)} (${fmtNum(p.g)} g)`}</option>`).join('')}</select>
      <div class="passo" style="margin-top:8px"><button type="button" class="btn" data-q="-0.5" aria-label="Menos meia porção">−</button>
        <input type="text" inputmode="decimal" name="qtd" value="${fmtNum(porcaoIni?.qtd ?? 1)}" aria-label="Quantidade">
        <button type="button" class="btn" data-q="0.5" aria-label="Mais meia porção">+</button><span class="mudo">porção(ões)</span></div>
      <p class="mudo" style="margin:6px 0 0">${porcoes.some((p) => p.aprox) ? 'Porções aproximadas · ' : ''}<button type="button" class="btn peq" data-editar-porcoes>Editar porções</button></p>
    </div>
    <label class="campo" style="margin-top:12px"><span>Refeição</span><select name="ref">${refs.map((r) =>
      `<option value="${r.id}" ${r.id === refIni ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <table class="tabela num" id="calc"></table>
    <p class="erro" id="erro"></p>
    <p class="nota alerta alerta-suspeito" id="suspeito" hidden></p>
    <div class="linha" style="margin-top:8px">
      ${opcoes.aoApagar ? '<button type="button" class="btn perigo" data-apagar>Apagar</button>' : ''}
      <button type="button" class="btn prim" data-ok>${esc(opcoes.botao || 'Adicionar')}</button></div>`);

  const ler = () => {
    if (modo === 'g') return { g: lerNumero(painel.querySelector('[name=g]').value), porcao: null };
    if (modo === 'ml') {
      const ml = lerNumero(painel.querySelector('[name=g]').value);
      return { g: ml * dens, porcao: { nome: 'mL', g: dens, qtd: ml, ml: true } };
    }
    const p = lista[Number(painel.querySelector('[name=porcao]').value)];
    const qtd = lerNumero(painel.querySelector('[name=qtd]').value);
    return { g: p.g * qtd, porcao: { nome: p.nome, g: p.g, qtd } };
  };
  const erroDe = ({ g }) => (isNaN(g) || g <= 0 ? 'Informe uma quantidade maior que zero.' : g > 5000 ? 'Quantidade acima de 5000 g.' : '');
  let confirmado = false;   // lançamento suspeito: 2º toque em "Lançar mesmo assim" confirma
  const atualizar = () => {
    if (confirmado) { confirmado = false; painel.querySelector('#suspeito').hidden = true; painel.querySelector('[data-ok]').textContent = opcoes.botao || 'Adicionar'; }
    painel.querySelector('#m-g').hidden = modo === 'porcao';
    painel.querySelector('#m-p').hidden = modo !== 'porcao';
    painel.querySelector('#nota-ml').hidden = modo !== 'ml';
    painel.querySelector('#un').textContent = modo === 'ml' ? 'mL' : 'g';
    const q = ler(), erro = erroDe(q);
    painel.querySelector('#erro').textContent = erro;
    if (erro) return;
    const { n } = nutrientesPorGramas(food, q.g);
    painel.querySelector('#calc').innerHTML = `<tr><th>${modo === 'ml' ? `${fmtNum(Math.round(q.porcao.qtd))} mL${dens !== 1 ? ` (${fmtNum(Math.round(q.g))} g)` : ''}` : `${fmtNum(Math.round(q.g))} g`}</th><th>kcal</th><th>P</th><th>C</th><th>G</th></tr>
      <tr><td></td><td><b>${fmtKcal(n.kcal)}</b></td><td>${fmtMacro(n.prot)}</td><td>${fmtMacro(n.carb)}</td><td>${fmtMacro(n.gord)}</td></tr>`;
  };
  painel.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.modo) {
      // gramas <-> mL: mantém o número digitado
      modo = t.dataset.modo;
      painel.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', b === t));
    } else if (t.dataset.d || t.dataset.q) {
      const inp = painel.querySelector(t.dataset.d ? '[name=g]' : '[name=qtd]');
      const v = lerNumero(inp.value);
      // na porção "1 grama" o passo é de 1 (em vez de meia porção)
      const umG = t.dataset.q && lista[Number(painel.querySelector('[name=porcao]').value)]?.umG;
      const passo = umG ? Math.sign(Number(t.dataset.q)) : Number(t.dataset.d || t.dataset.q);
      inp.value = fmtNum(Math.max(0, Math.round(((isNaN(v) ? 0 : v) + passo) * 100) / 100));
    } else if ('fav' in t.dataset) {
      const fav = alternarFavorito(food.id);
      t.innerHTML = fav ? ic('star', 'cheio') + ' Favorito' : ic('star') + ' Favoritar';
      t.setAttribute('aria-pressed', fav);
      return;
    } else if ('editarAlim' in t.dataset || 'duplicar' in t.dataset) {
      const c = await catalogo();
      const atual = c.porId.get(food.id) || food;
      const reabrir = (novo) => folhaQuantidade(novo, { ...opcoes, g: undefined, porcao: null });
      return 'duplicar' in t.dataset
        ? folhaAlimento(null, { duplicarDe: atual, aoSalvar: reabrir })
        : folhaAlimento(atual, { aoSalvar: reabrir, aoApagar: opcoes.aoMudarCatalogo });
    } else if ('criarRotulo' in t.dataset) {
      // só o nome vem da base; os valores são digitados do rótulo (nada é inventado)
      return folhaAlimento(null, { prefill: { nome: food.nome, fonte: 'rótulo' },
        aoSalvar: (novo) => folhaQuantidade(novo, { ...opcoes, g: undefined, porcao: null }) });
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
      if (!confirmado) {
        const msg = avaliarSuspeito(food, q.g, await contextoSuspeito(food.id).catch(() => ({})));
        if (msg) {
          const el = painel.querySelector('#suspeito');
          el.innerHTML = ic('triangle-alert', 'p') + ' ' + esc(msg); el.hidden = false;
          t.textContent = 'Lançar mesmo assim';
          vibrar([20, 40, 20]);
          confirmado = true;
          return;
        }
      }
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
      <button type="button" class="ico" data-rem="${i}" aria-label="Remover">${ic('x')}</button></div>`).join('');
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
