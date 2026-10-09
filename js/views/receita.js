// views/receita.js — criar/editar receita: ingredientes em gramas, nº de porções e peso final opcional.

import { catalogo, salvarReceita, apagarReceita, alimentoDaReceita } from '../custom.js';
import { buscar, rotuloFonte } from '../foods.js';
import { NUTRIENTES } from '../diary.js';
import { db } from '../db.js';
import { topo, esc, $, aviso, abrirFolha, fecharFolha, ICONES, confirmar } from '../ui.js';
import { fmtKcal, fmtMacro, fmtNum, lerNumero } from '../utils.js';
import { ic } from '../icones.js';
import { paresCoccao, pesoProntoEstimado } from '../planejamento.js';
import { comprimir, fotosDe, gravarFotos } from '../photos.js';
import { correspondencias } from '../foods.js';

let rec, cat, tela, pares, fotoPendente = null;

export async function render(t) {
  tela = t;
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  cat = await catalogo();
  pares ||= paresCoccao(cat.base.foods);
  fotoPendente = null;
  rec = id ? structuredClone(await db.get('recipes', id)) : null;
  rec ||= { nome: '', ingredientes: [], porcoes: 1, pesoFinal: null };
  topo(`<a class="ico" href="#adicionar?aba=receitas" aria-label="Voltar">${ICONES.voltar}</a>
    <h1>${rec.id ? 'Editar receita' : 'Nova receita'}</h1><span style="width:48px"></span>`);
  tela.innerHTML = `
    <form class="card" id="fr" novalidate>
      <label class="campo"><span>Nome da receita</span><input type="text" name="nome" maxlength="80" value="${esc(rec.nome)}"></label>
      <div class="grade2">
        <label class="campo"><span>Rende (porções)</span><input type="text" inputmode="decimal" name="porcoes" value="${fmtNum(rec.porcoes)}"></label>
        <label class="campo"><span>Peso final pronto (g, opcional)</span><input type="text" inputmode="decimal" name="pesoFinal" value="${fmtNum(rec.pesoFinal)}" placeholder="pese a panela pronta"></label>
      </div>
      <p class="mudo" style="margin-top:-4px">Com o peso final, dá para lançar por grama do preparo (a água que evapora ou é absorvida é levada em conta).</p>
      <div class="rec-foto" id="rec-foto"></div>
    </form>
    <div class="acoes-rolar" role="group" aria-label="Ações da receita">
      <button class="btn peq suave" data-importar>${ic('clipboard-paste')} Importar texto ou link</button>
      <label class="btn peq suave">${ic('camera')} Foto da receita<input type="file" accept="image/*" data-foto-rec hidden></label>
      ${rec.id ? `<button class="btn peq" data-escalar>${ic('scaling')} Escalar</button><button class="btn peq" data-duplicar-rec>${ic('copy')} Duplicar</button>` : ''}</div>
    <div class="card"><div class="card-tit"><h2>Ingredientes</h2><button class="btn peq" data-add-ing>+ Ingrediente</button></div>
      <ul class="itens" id="ings"></ul></div>
    <div class="card" id="tot"></div>
    <p class="erro" id="erro"></p>
    <div class="linha">${rec.id ? '<button class="btn perigo" data-apagar>Excluir</button>' : ''}<button class="btn prim" data-salvar>Salvar receita</button></div>`;
  desenharIngs();
  desenharFoto();
  tela.onchange = async (e) => {
    if (!e.target.matches('[data-foto-rec]')) return;
    const arq = e.target.files[0];
    if (!arq) return;
    try { fotoPendente = await comprimir(arq); } catch { return aviso('Não consegui ler essa imagem.'); }
    if (rec.id) { await gravarFotos('receita', rec.id, [{ id: 'capa', blob: fotoPendente, ts: Date.now() }]); fotoPendente = null; }
    desenharFoto();
  };
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
    if ('importar' in b.dataset) return folhaImportar();
    if ('escalar' in b.dataset) return folhaEscalar();
    if ('duplicarRec' in b.dataset) return duplicar();
    if ('usarPeso' in b.dataset) { $('#fr', tela).pesoFinal.value = fmtNum(Number(b.dataset.usarPeso)); lerCabecalho(); return desenharTotais(); }
    if (b.dataset.rem != null) { rec.ingredientes.splice(Number(b.dataset.rem), 1); return desenharIngs(); }
    if ('salvar' in b.dataset) return salvar();
    if ('apagar' in b.dataset) {
      if (!(await confirmar(`Excluir a receita "${rec.nome}"? Itens já lançados no diário não mudam.`, { titulo: 'Excluir receita', ok: 'Excluir', perigo: true }))) return;
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
    ${notaPesoPronto()}
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
  const salva = await salvarReceita(rec);
  if (fotoPendente && (salva?.id || rec.id)) await gravarFotos('receita', salva?.id || rec.id, [{ id: 'capa', blob: fotoPendente, ts: Date.now() }]);
  aviso('Receita salva');
  location.hash = '#adicionar?aba=receitas';
}

// ---------- Receitas 2.0: peso pronto estimado, foto, importar (texto/link), escalar e duplicar ----------

/** Peso pronto ≈ soma dos ingredientes crus × rendimento do par cru/cozido da TACO (só quando não há peso final). */
function notaPesoPronto() {
  if (rec.pesoFinal > 0) return '';
  const e = pesoProntoEstimado(rec.ingredientes, (id) => cat.porId.get(id), pares);
  if (!e.comPar) return '';
  return `<p class="nota">Peso pronto estimado ≈ <b class="num">${fmtNum(e.g)} g</b> (${e.comPar} de ${e.n} ingrediente(s) com o par cru/cozido da TACO;
    os demais contam o peso cru). Pese a panela para ter o valor real.
    <button type="button" class="btn texto peq" data-usar-peso="${e.g}">Usar ${fmtNum(e.g)} g</button></p>`;
}

async function desenharFoto() {
  const el = $('#rec-foto', tela);
  if (!el) return;
  const blob = fotoPendente || (rec.id ? (await fotosDe('receita', rec.id).catch(() => []))[0]?.blob : null);
  el.innerHTML = blob ? `<img src="${URL.createObjectURL(blob)}" alt="Foto da receita">` : '';
}

/** Ingredientes vindos de texto (interpretador local, sem IA) ou de link (Gemini) entram na lista para conferir. */
function folhaImportar() {
  const p = abrirFolha('Importar receita', `<div class="seg" role="group"><button type="button" data-modo="texto" aria-pressed="true">Colar texto</button>
      <button type="button" data-modo="link" aria-pressed="false">Link</button></div>
    <form id="fi" novalidate>
      <label class="campo" data-so="texto"><span>Texto da receita (ingredientes com quantidades)</span><textarea name="txt" rows="6"
        placeholder="Bolo de banana&#10;3 bananas&#10;2 ovos&#10;1 xícara de aveia&#10;Rende 8 porções"></textarea></label>
      <label class="campo" data-so="link" hidden><span>Link da receita</span><input type="url" name="url" placeholder="https://…"></label>
      <p class="mudo" data-so="link" hidden>O Gemini lê a página (1 chamada da cota gratuita). Sem chave, cole o texto.</p>
      <div id="imp-res"></div><p class="erro" id="erro"></p>
      <button class="btn prim bloco">Ler ingredientes</button></form>`, { foco: false });
  let modo = 'texto', achados = null;
  p.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b) return;
    modo = b.dataset.modo; achados = null;
    p.querySelectorAll('[data-modo]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    p.querySelectorAll('[data-so]').forEach((x) => { x.hidden = x.dataset.so !== modo; });
  });
  const semReceitas = (indice) => indice.filter((x) => !String(x.f.id).startsWith('r-'));   // sem receita dentro de receita
  $('#fi', p).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, erro = $('#erro', p);
    erro.textContent = '';
    if (achados) {                                                   // 2º toque: adiciona os reconhecidos
      for (const a of achados.itens) rec.ingredientes.push({ foodId: a.food.id, nome: a.food.nome, g: Math.round(a.g), por100: Object.fromEntries(NUTRIENTES.map((k) => [k, a.food[k] ?? null])) });
      const fr = $('#fr', tela);
      if (achados.porcoes) fr.porcoes.value = fmtNum(achados.porcoes);
      if (achados.nome && !fr.nome.value.trim()) fr.nome.value = achados.nome;
      lerCabecalho(); fecharFolha(); desenharIngs();
      return aviso(`${achados.itens.length} ingrediente(s) adicionado(s). Confira os gramas.`);
    }
    try {
      if (modo === 'texto') {
        const txt = f.txt.value.trim();
        if (txt.length < 3) { erro.textContent = 'Cole o texto da receita.'; return; }
        const { contextoFrase } = await import('./frase-ui.js');
        const { interpretar } = await import('../frase.js');
        const ctx = await contextoFrase();
        ctx.indice = semReceitas(ctx.indice);
        ctx.preferirCru = true;                                      // ingrediente de receita: cru (o hábito do pronto passa para o cru)
        const linhas = txt.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        const ingred = linhas.filter((l) => !/^(modo de preparo|preparo|rende)/i.test(l));
        const titulo = ingred.length > 1 && !/\d/.test(ingred[0]) ? ingred.shift() : '';
        const its = ingred.flatMap((l) => interpretar(l, ctx));
        const rende = Number(txt.match(/rende\s*(?:cerca de\s*)?(\d+)/i)?.[1]);
        achados = { itens: its.filter((i) => i.food && i.g > 0), fora: its.filter((i) => !i.food).map((i) => i.texto),
          porcoes: rende > 0 && rende <= 100 ? rende : null, nome: titulo.slice(0, 80) };
      } else {
        const url = f.url.value.trim();
        if (!/^https?:\/\//.test(url)) { erro.textContent = 'Informe um link começando com http.'; return; }
        $('#imp-res', p).innerHTML = '<p class="mudo">Lendo a página…</p>';
        const { lerReceitaLink } = await import('../ia.js');
        const r = await lerReceitaLink(url);
        const ind = semReceitas(cat.indice);
        const its = r.itens.map((it) => ({ food: correspondencias(ind, it).opcoes[0], g: it.g, texto: it.nome }));
        achados = { itens: its.filter((i) => i.food && i.g > 0), fora: its.filter((i) => !i.food).map((i) => i.texto), porcoes: r.porcoes, nome: r.nome };
      }
    } catch (err) { $('#imp-res', p).innerHTML = ''; erro.textContent = err.message; return; }
    $('#imp-res', p).innerHTML = `<p class="secao" style="margin:8px 0 4px">Reconhecidos (${achados.itens.length})</p>
      <ul class="lista-simples">${achados.itens.map((i) => `<li><span>${esc(i.food.nome)}${i.incerto ? ' <span class="alerta">(confira)</span>' : ''}</span><b class="num">${fmtNum(Math.round(i.g))} g</b></li>`).join('')}</ul>
      ${achados.itens.some((i) => i.incerto) ? '<p class="mudo">“Confira”: a medida ou o alimento era ambíguo; ajuste os gramas depois de adicionar.</p>' : ''}
      ${achados.fora.length ? `<p class="mudo">Ficaram de fora (adicione à mão): ${achados.fora.map(esc).join(', ')}</p>` : ''}
      ${achados.porcoes ? `<p class="mudo">Rende ${achados.porcoes} porções.</p>` : ''}`;
    p.querySelector('#fi button.prim').textContent = achados.itens.length ? `Adicionar ${achados.itens.length} ingrediente(s)` : 'Ler ingredientes';
    if (!achados.itens.length) achados = null;
  };
}

/** Escala a receita (ingredientes, porções e peso final) por um fator. */
function folhaEscalar() {
  const p = abrirFolha('Escalar receita', `<p class="mudo" style="margin-top:0">Multiplica os gramas de todos os ingredientes, as porções e o peso final.</p>
    <div class="fr-chips">${[0.5, 1.5, 2, 3].map((k) => `<button type="button" class="chip-tog" data-fator="${k}">× ${fmtNum(k)}</button>`).join('')}</div>`, { foco: false });
  p.onclick = (e) => {
    const b = e.target.closest('[data-fator]');
    if (!b) return;
    const k = Number(b.dataset.fator);
    lerCabecalho();
    rec.ingredientes.forEach((i) => { i.g = Math.round(i.g * k); });
    rec.porcoes = Math.max(1, Math.round(rec.porcoes * k * 10) / 10);
    if (rec.pesoFinal > 0) rec.pesoFinal = Math.round(rec.pesoFinal * k);
    const f = $('#fr', tela);
    f.porcoes.value = fmtNum(rec.porcoes); f.pesoFinal.value = rec.pesoFinal ? fmtNum(rec.pesoFinal) : '';
    fecharFolha(); desenharIngs();
    aviso(`Receita × ${fmtNum(k)} (toque em Salvar para manter)`);
  };
}

/** Cria uma cópia (" (cópia)") e abre para editar. */
async function duplicar() {
  lerCabecalho();
  const { id, ...resto } = structuredClone(rec);
  const nova = await salvarReceita({ ...resto, nome: `${rec.nome || 'Receita'} (cópia)`.slice(0, 80) });
  aviso('Receita duplicada');
  location.hash = '#receita?id=' + encodeURIComponent(nova.id);
}
