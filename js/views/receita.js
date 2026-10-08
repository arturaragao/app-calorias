// views/receita.js — criar/editar receita: ingredientes em gramas, nº de porções e peso final opcional.

import { catalogo, salvarReceita, apagarReceita, alimentoDaReceita } from '../custom.js';
import { buscar, rotuloFonte } from '../foods.js';
import { NUTRIENTES } from '../diary.js';
import { db } from '../db.js';
import { topo, esc, $, aviso, abrirFolha, fecharFolha, ICONES } from '../ui.js';
import { fmtKcal, fmtMacro, fmtNum, lerNumero } from '../utils.js';

let rec, cat, tela;

export async function render(t) {
  tela = t;
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  cat = await catalogo();
  rec = id ? structuredClone(await db.get('recipes', id)) : null;
  rec ||= { nome: '', ingredientes: [], porcoes: 1, pesoFinal: null };
  topo(`<a class="ico" href="#adicionar?aba=receitas" aria-label="Voltar">${ICONES.voltar}</a>
    <h1>${rec.id ? 'Editar receita' : 'Nova receita'}</h1><span style="width:44px"></span>`);
  tela.innerHTML = `
    <form class="card" id="fr" novalidate>
      <label class="campo"><span>Nome da receita</span><input type="text" name="nome" maxlength="80" value="${esc(rec.nome)}"></label>
      <div class="grade2">
        <label class="campo"><span>Rende (porções)</span><input type="text" inputmode="decimal" name="porcoes" value="${fmtNum(rec.porcoes)}"></label>
        <label class="campo"><span>Peso final pronto (g, opcional)</span><input type="text" inputmode="decimal" name="pesoFinal" value="${fmtNum(rec.pesoFinal)}" placeholder="pese a panela pronta"></label>
      </div>
      <p class="mudo" style="margin-top:-4px">Com o peso final, dá para lançar por grama do preparo (a água que evapora ou é absorvida é levada em conta).</p>
    </form>
    <div class="card"><div class="card-tit"><h2>Ingredientes</h2><button class="btn peq" data-add-ing>+ Ingrediente</button></div>
      <ul class="itens" id="ings"></ul></div>
    <div class="card" id="tot"></div>
    <p class="erro" id="erro"></p>
    <div class="linha">${rec.id ? '<button class="btn perigo" data-apagar>Excluir</button>' : ''}<button class="btn prim" data-salvar>Salvar receita</button></div>`;
  desenharIngs();
  const f = $('#fr', tela);
  f.addEventListener('input', () => { lerCabecalho(); desenharTotais(); });
  $('#ings', tela).addEventListener('input', (e) => {
    const i = e.target.dataset.g;
    if (i == null) return;
    const v = lerNumero(e.target.value);
    rec.ingredientes[i].g = v > 0 ? v : 0;
    desenharTotais();
  });
  tela.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('addIng' in b.dataset) return escolherIngrediente();
    if (b.dataset.rem != null) { rec.ingredientes.splice(Number(b.dataset.rem), 1); return desenharIngs(); }
    if ('salvar' in b.dataset) return salvar();
    if ('apagar' in b.dataset) {
      if (!confirm(`Excluir a receita "${rec.nome}"? Itens já lançados no diário não mudam.`)) return;
      const antes = await apagarReceita(rec.id);
      aviso('Receita excluída', { acao: async () => { await salvarReceita(antes); } });
      location.hash = '#adicionar?aba=receitas';
    }
  };
}

function lerCabecalho() {
  const f = $('#fr', tela);
  rec.nome = f.nome.value.trim();
  rec.porcoes = lerNumero(f.porcoes.value);
  const pf = f.pesoFinal.value.trim();
  rec.pesoFinal = pf === '' ? null : lerNumero(pf);
}

function desenharIngs() {
  $('#ings', tela).innerHTML = rec.ingredientes.length ? rec.ingredientes.map((ing, i) => `<li class="item">
      <div class="info"><div class="nome">${esc(ing.nome)}</div>
        <div class="mudo num">${fmtKcal(((ing.por100.kcal || 0) * ing.g) / 100)} kcal</div></div>
      <input type="text" inputmode="decimal" data-g="${i}" value="${fmtNum(ing.g)}" style="width:84px;flex:0 0 84px" aria-label="Gramas de ${esc(ing.nome)}">
      <span class="mudo">g</span>
      <button class="ico" data-rem="${i}" aria-label="Remover ${esc(ing.nome)}">${ICONES.lixo}</button></li>`).join('')
    : '<li class="mudo" style="padding:8px 0">Nenhum ingrediente ainda.</li>';
  desenharTotais();
}

function desenharTotais() {
  if (!rec.ingredientes.length) { $('#tot', tela).innerHTML = '<p class="mudo">Os totais aparecem ao adicionar ingredientes.</p>'; return; }
  const food = alimentoDaReceita({ ...rec, porcoes: rec.porcoes > 0 ? rec.porcoes : 1 }, (id) => cat.porId.get(id));
  const n = rec.porcoes > 0 ? rec.porcoes : 1;
  const linha = (rot, fator) => `<tr><td>${rot}</td><td>${fmtKcal(food.total.kcal * fator)}</td><td>${fmtMacro(food.total.prot * fator)}</td>
    <td>${fmtMacro(food.total.carb * fator)}</td><td>${fmtMacro(food.total.gord * fator)}</td></tr>`;
  $('#tot', tela).innerHTML = `<h2 style="margin-bottom:6px">Totais</h2><table class="tabela num">
    <tr><th></th><th>kcal</th><th>P</th><th>C</th><th>G</th></tr>
    ${linha('Receita inteira', 1)}${linha(`1 porção (${fmtNum(Math.round(food.peso / n))} g)`, 1 / n)}${linha('100 g', food.peso ? 100 / food.peso : 0)}
    </table><p class="mudo">Peso usado: ${fmtNum(Math.round(food.peso))} g ${rec.pesoFinal > 0 ? '(peso final pronto)' : '(soma dos ingredientes)'}.</p>
    ${food.falta ? '<p class="nota alerta">Algum ingrediente não tem todos os nutrientes na fonte (contam como 0).</p>' : ''}`;
}

function escolherIngrediente() {
  const p = abrirFolha('Adicionar ingrediente', `<input type="search" id="qi" placeholder="Buscar alimento" autocomplete="off">
    <ul class="lista" id="ri" style="margin-top:8px"></ul>`);
  const indice = cat.indice.filter((e) => !String(e.f.id).startsWith('r-'));    // sem receita dentro de receita
  const qi = $('#qi', p), ri = $('#ri', p);
  qi.oninput = () => {
    ri.innerHTML = buscar(indice, qi.value, { limite: 40 }).map((f) => `<li><button data-id="${esc(f.id)}"><span><span class="nome">${esc(f.nome)}</span>
      <span class="mudo">${esc(rotuloFonte(f))}</span></span><span class="num">${fmtKcal(f.kcal)}</span></button></li>`).join('');
  };
  ri.onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const food = cat.porId.get(b.dataset.id);
    const pg = abrirFolha(food.nome, `<form id="fg"><label class="campo"><span>Quantidade crua/usada na receita (g)</span>
      <input type="text" inputmode="decimal" name="g" value="100"></label><p class="erro" id="erro"></p><button class="btn prim bloco">Adicionar</button></form>`);
    $('#fg', pg).onsubmit = (ev) => {
      ev.preventDefault();
      const g = lerNumero(ev.target.g.value);
      if (!(g > 0 && g <= 5000)) { $('#erro', pg).textContent = 'Informe de 1 a 5000 g.'; return; }
      rec.ingredientes.push({ foodId: food.id, nome: food.nome, g, por100: Object.fromEntries(NUTRIENTES.map((k) => [k, food[k] ?? null])) });
      fecharFolha();
      desenharIngs();
    };
  };
}

async function salvar() {
  lerCabecalho();
  const erro = !rec.nome ? 'Informe o nome da receita.'
    : !rec.ingredientes.length ? 'Adicione ao menos um ingrediente.'
    : rec.ingredientes.some((i) => !(i.g > 0)) ? 'Todo ingrediente precisa de gramas.'
    : !(rec.porcoes > 0 && rec.porcoes <= 100) ? 'Porções: de 1 a 100.'
    : rec.pesoFinal != null && !(rec.pesoFinal > 0 && rec.pesoFinal <= 20000) ? 'Peso final inválido.' : '';
  $('#erro', tela).textContent = erro;
  if (erro) return;
  await salvarReceita(rec);
  aviso('Receita salva');
  location.hash = '#adicionar?aba=receitas';
}
