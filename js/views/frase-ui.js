// views/frase-ui.js — "Falar ou escrever": frase livre → itens pelo interpretador local (js/frase.js), sem IA e sem rede.
// Ambíguo vira chips para escolher (a escolha fica lembrada para a próxima vez); trecho não reconhecido pode ir para a busca
// ou, só então, para a IA (reserva).

import { estado, salvarConfig, lerDia, gravarDia } from '../state.js';
import { ic } from '../icones.js';
import { porcoesDe, densidadeDe } from '../foods.js';
import { criarItem, adicionarItem } from '../diary.js';
import { catalogo, registrarRecente } from '../custom.js';
import { interpretar, lerTrecho } from '../frase.js';
import { pesosBusca } from '../inteligencia.js';
import { diariosRecentes } from './sugestao.js';
import { abrirFolha, fecharFolha, aviso, esc, $, vibrar } from '../ui.js';
import { chaveData, fmtKcal, fmtNum, fmtG, normalizar } from '../utils.js';
import { suportaVoz, ditar } from '../voz.js';
import { motorIA } from '../ia.js';

/** Contexto do interpretador: base + Meus alimentos + receitas, porções (inclusive as do usuário), histórico e escolhas. */
export async function contextoFrase(refId = estado.refeicaoAlvo) {
  const cat = await catalogo();
  const diarios = await diariosRecentes(60).catch(() => []);
  return {
    indice: cat.indice,
    porcoesDe: (f) => porcoesDe(f, cat.porcoes, estado.config.porcoesUsuario),
    densidade: (f) => densidadeDe(f, cat.porcoes),
    sinonimos: cat.porcoes?.sinonimos,
    escolhas: estado.config.escolhas || {},
    ultimaQtd: estado.config.ultimaQtd || {},
    bonus: pesosBusca(diarios, { refId, hoje: chaveData() }),
  };
}

/** Lembra que "este texto" é "este alimento" (vale para a busca e para as próximas frases). */
export function lembrarEscolha(texto, foodId) {
  const k = normalizar(texto);
  if (!k) return;
  const e = { ...(estado.config.escolhas || {}) };
  delete e[k]; e[k] = foodId;
  const chaves = Object.keys(e);
  if (chaves.length > 300) delete e[chaves[0]];             // mantém as 300 mais recentes
  estado.config.escolhas = e;
  salvarConfig();
}

const nomeCurto = (n) => n.split(',').slice(0, 3).join(',');

export async function folhaFrase({ texto = '', ditarJa = false, data = estado.dataAtual, refId = estado.refeicaoAlvo, aoLancar } = {}) {
  let ctx = await contextoFrase(refId);
  const refs = estado.config.refeicoes;
  const p = abrirFolha('Falar ou escrever', `<form id="ff" novalidate>
    <label class="campo"><span>O que você comeu?</span><textarea name="txt" rows="2" maxlength="400"
      placeholder="ex.: 2 ovos mexidos, 1 pão francês com manteiga e 200 ml de leite">${esc(texto)}</textarea></label>
    ${suportaVoz() ? `<button type="button" class="btn bloco" data-ditar>${ic('mic')} Falar</button>` : ''}
    <div id="fr-itens" aria-live="polite"></div>
    <label class="campo"><span>Refeição</span><select name="ref">${refs.map((r) =>
      `<option value="${r.id}" ${r.id === refId ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <p class="erro" id="erro"></p>
    <button class="btn prim bloco" data-lancar disabled>Lançar</button></form>`, { foco: false });
  const campo = $('[name=txt]', p);
  if (!ditarJa && !texto) setTimeout(() => campo.focus({ preventScroll: true }), 60);
  let itens = [], ajustes = {};      // ajustes por trecho: { qtd, porcao }
  const temIA = await motorIA().catch(() => null);

  const desenhar = () => {
    itens = campo.value.trim() ? interpretar(campo.value, ctx) : [];
    for (const it of itens) {
      const a = ajustes[it.texto];
      if (!a || !it.food) continue;
      if (a.porcao) it.porcao = { ...a.porcao };
      if (a.qtd != null) {
        if (it.porcao) { it.porcao.qtd = a.qtd; it.g = it.porcao.g * a.qtd; }
        else it.g = a.qtd;
      } else if (a.porcao) it.g = a.porcao.g * (a.porcao.qtd ?? 1);
      it.incerto = it.incerto && !a.porcao && !a.ok;
    }
    const ok = itens.filter((i) => i.food);
    const tot = ok.reduce((s, i) => s + ((i.food.kcal || 0) * i.g) / 100, 0);
    $('#fr-itens', p).innerHTML = itens.length ? itens.map((it, i) => it.food ? `
      <div class="fr-item${it.incerto ? ' incerto' : ''}" data-i="${i}">
        <div class="fr-lin"><span class="fr-nome">${esc(it.food.nome)}</span>
          <b class="num">${fmtKcal(((it.food.kcal || 0) * it.g) / 100)} kcal</b>
          <button type="button" class="ico" data-rem aria-label="Tirar ${esc(it.food.nome)}">${ic('x')}</button></div>
        <div class="fr-lin">
          <div class="passo-mini"><button type="button" class="ico" data-q="-1" aria-label="Menos">${ic('minus')}</button>
            <span class="num">${it.porcao?.ml ? `${fmtNum(it.porcao.qtd)} mL` : it.porcao ? `${fmtNum(it.porcao.qtd)} × ${esc(it.porcao.nome)}` : `${fmtG(it.g)} g`}</span>
            <button type="button" class="ico" data-q="1" aria-label="Mais">${ic('plus')}</button></div>
          <span class="mudo num">${it.porcao && !it.porcao.ml ? fmtG(it.g) + ' g' : ''}</span></div>
        ${it.incerto ? `<p class="fr-duvida">${ic('circle-help', 'p')} ${!it.certo ? 'Qual destes?' : esc(it.motivo || 'Confira a medida')}</p>` : ''}
        ${!it.certo && it.opcoes.length > 1 ? `<div class="fr-chips">${it.opcoes.slice(0, 4).map((o) =>
          `<button type="button" class="chip-tog" data-escolher="${esc(o.id)}" aria-pressed="${o.id === it.food.id}">${esc(nomeCurto(o.nome))}</button>`).join('')}</div>` : ''}
        ${it.incerto && it.certo ? `<div class="fr-chips">${ctx.porcoesDe(it.food).slice(0, 4).map((po, k) =>
          `<button type="button" class="chip-tog" data-porcao="${k}">${esc(po.nome)} (${fmtNum(po.g)} g)</button>`).join('')}<button type="button" class="chip-tog" data-confere>Está certo</button></div>` : ''}
      </div>` : `
      <div class="fr-item nao" data-i="${i}"><p>${ic('circle-help', 'p')} Não reconheci “${esc(it.texto)}”.</p>
        <div class="fr-chips"><button type="button" class="chip-tog" data-buscar>${ic('search', 'p')} Buscar</button>
        ${temIA ? `<button type="button" class="chip-tog" data-ia>${ic('sparkles', 'p')} Estimar com IA</button>` : ''}
        <button type="button" class="chip-tog" data-rem>Ignorar</button></div></div>`).join('')
      + `<p class="fr-total num">${ok.length} item(ns) · <b>${fmtKcal(tot)} kcal</b></p>`
      : '<p class="mudo">Escreva ou fale com quantidades (“200 g de arroz”, “2 colheres de azeite”, “meia xícara”). Funciona sem internet.</p>';
    const bt = $('[data-lancar]', p);
    bt.disabled = !ok.length;
    bt.textContent = ok.length ? `Lançar ${ok.length} item(ns)` : 'Lançar';
  };
  let t = null;
  campo.addEventListener('input', () => { clearTimeout(t); t = setTimeout(desenhar, 220); });

  // ditado (Web Speech API): acrescenta ao texto e interpreta enquanto você fala
  let parar = null;
  const bDitar = $('[data-ditar]', p);
  const comecarDitado = () => {
    if (parar) return parar();
    const antes = campo.value.trim();
    bDitar.classList.add('gravando'); bDitar.innerHTML = ic('square') + ' Parar (ouvindo…)';
    vibrar(10);
    parar = ditar((final, parcial) => { campo.value = [antes, final, parcial].filter(Boolean).join(' ').slice(0, 400); desenhar(); }, (erro) => {
      parar = null;
      bDitar.classList.remove('gravando'); bDitar.innerHTML = ic('mic') + ' Falar';
      if (erro) $('#erro', p).textContent = erro;
    });
  };
  if (bDitar) bDitar.onclick = comecarDitado;
  if (ditarJa && bDitar) setTimeout(comecarDitado, 300);

  p.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    const box = b?.closest('[data-i]');
    if (!box) return;
    const it = itens[Number(box.dataset.i)];
    if (b.dataset.escolher) {
      lembrarEscolha(lerTrecho(it.texto).nome, b.dataset.escolher);
      ctx = { ...ctx, escolhas: estado.config.escolhas };
      delete ajustes[it.texto];
    } else if (b.dataset.porcao) {
      const po = ctx.porcoesDe(it.food)[Number(b.dataset.porcao)];
      ajustes[it.texto] = { porcao: { nome: po.nome, g: po.g, qtd: it.porcao?.qtd ?? 1 } };
    } else if ('confere' in b.dataset) ajustes[it.texto] = { ...ajustes[it.texto], ok: true };
    else if (b.dataset.q) {
      const passo = Number(b.dataset.q);
      const a = { ...(ajustes[it.texto] || {}) };
      if (it.porcao?.ml) a.qtd = Math.max(10, it.porcao.qtd + passo * 50);
      else if (it.porcao) a.qtd = Math.max(0.5, it.porcao.qtd + passo * 0.5);
      else a.qtd = Math.max(5, it.g + passo * 10);
      a.ok = true;
      ajustes[it.texto] = a;
    } else if ('rem' in b.dataset) {
      // tira o trecho do texto (mantém o resto da frase)
      campo.value = itens.filter((x) => x !== it).map((x) => x.texto).join(', ');
    } else if ('buscar' in b.dataset) {
      fecharFolha();
      setTimeout(() => { location.hash = '#adicionar?q=' + encodeURIComponent(lerTrecho(it.texto).nome); }, 320);
      return;
    } else if ('ia' in b.dataset) {
      const { folhaTextoIA } = await import('./foto-ia.js');
      fecharFolha();
      setTimeout(() => folhaTextoIA({ data, refId: $('[name=ref]', p)?.value || refId, aoLancar, texto: it.texto }), 350);
      return;
    } else return;
    desenhar();
  });

  $('#ff', p).onsubmit = async (e) => {
    e.preventDefault();
    parar?.();
    const ok = itens.filter((i) => i.food);
    if (!ok.length) return;
    const r = e.target.ref.value, nomeRef = refs.find((x) => x.id === r)?.nome;
    const antes = await lerDia(data);
    let d = antes;
    for (const it of ok) {
      const item = criarItem(it.food, it.g, it.porcao && it.porcao.nome !== 'grama' ? it.porcao : null);
      if (data > chaveData()) item.planejado = true;
      d = adicionarItem(d, r, nomeRef, item);
      registrarRecente(it.food.id);
      // o que foi confirmado vira escolha para a próxima frase/busca
      if (!it.incerto) lembrarEscolha(lerTrecho(it.texto).nome, it.food.id);
    }
    await gravarDia(d);
    vibrar(15);
    fecharFolha();
    await aoLancar?.();
    aviso(`${ok.length} item(ns) → ${nomeRef}`, { acao: async () => { await gravarDia(antes); aoLancar?.(); } });
  };
  desenhar();
}
