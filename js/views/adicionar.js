// views/adicionar.js — busca (base + meus + receitas) e abas Recentes/Favoritos/Meus alimentos/Receitas.
// (Scanner de código de barras chega na Etapa 5.)

import { estado, lerDia, gravarDia } from '../state.js';
import { buscar, rotuloFonte } from '../foods.js';
import { catalogo, registrarRecente, ehFavorito } from '../custom.js';
import { criarItem, adicionarItem } from '../diary.js';
import { topo, esc, $, $$, aviso } from '../ui.js';
import { fmtKcal, fmtData, chaveData } from '../utils.js';
import { folhaQuantidade } from './quantidade.js';
import { folhaAlimento } from './alimento-form.js';

const LOTE = 30;
const ABAS = [['recentes', 'Recentes'], ['favoritos', 'Favoritos'], ['meus', 'Meus'], ['receitas', 'Receitas']];
let ultimaBusca = '';

export async function render(tela) {
  const aba = new URLSearchParams(location.hash.split('?')[1] || '').get('aba');
  if (aba) { estado.abaAdicionar = aba; ultimaBusca = ''; }
  estado.abaAdicionar ||= 'recentes';
  const refs = estado.config.refeicoes;
  if (!refs.some((r) => r.id === estado.refeicaoAlvo)) estado.refeicaoAlvo = sugerirRefeicao(refs);
  const nomeRef = () => refs.find((r) => r.id === estado.refeicaoAlvo)?.nome || '';
  const quando = estado.dataAtual === chaveData() ? 'hoje' : fmtData(estado.dataAtual);
  topo(`<a class="ico" href="#diario" aria-label="Voltar ao diário"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
    <h1>Adicionar · ${esc(nomeRef())} <span class="mudo">(${esc(quando)})</span></h1><span style="width:44px"></span>`);
  tela.innerHTML = `<div class="campo-busca"><input type="search" id="q" placeholder="Buscar alimento (ex.: arroz cozido)" autocomplete="off" enterkeyhint="search" value="${esc(ultimaBusca)}">
      <div class="seg abas" role="tablist" style="margin:8px 0 0">${ABAS.map(([v, r]) =>
        `<button type="button" role="tab" data-aba="${v}" aria-pressed="${v === estado.abaAdicionar}">${r}</button>`).join('')}</div></div>
    <div class="linha" style="margin:4px 0 8px"><button class="btn peq" data-novo-alim>+ Novo alimento</button>
      <a class="btn peq" href="#receita">+ Nova receita</a></div>
    <p class="mudo" id="info"></p><ul class="lista" id="res"></ul><div id="mais" style="height:1px"></div>`;
  let cat = await catalogo();
  const q = $('#q', tela), res = $('#res', tela), info = $('#info', tela);
  let lista = [], mostrados = 0;

  const desenharLote = () => {
    const fatia = lista.slice(mostrados, mostrados + LOTE);
    res.insertAdjacentHTML('beforeend', fatia.map((f) => `<li><button data-id="${esc(f.id)}">
      <span><span class="nome">${ehFavorito(f.id) ? '★ ' : ''}${esc(f.nome)}</span><span class="mudo">${esc(rotuloFonte(f))}</span></span>
      <span class="num" style="white-space:nowrap"><b>${fmtKcal(f.kcal)}</b> <span class="mudo">kcal/100 g</span></span></button></li>`).join(''));
    mostrados += fatia.length;
  };
  const daAba = () => {
    const ids = { recentes: estado.config.recentes || [], favoritos: estado.config.favoritos || [] }[estado.abaAdicionar];
    if (ids) return ids.map((id) => cat.porId.get(id)).filter(Boolean);
    const l = estado.abaAdicionar === 'meus' ? cat.meus : cat.recFoods;
    return [...l].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };
  const VAZIO = {
    recentes: 'Os alimentos que você lançar aparecem aqui.',
    favoritos: 'Toque em ☆ Favoritar na tela de quantidade para fixar um alimento aqui.',
    meus: 'Crie alimentos (rótulos, suplementos) em "+ Novo alimento" ou importe um CSV em Configurações.',
    receitas: 'Monte uma receita em "+ Nova receita" para lançar por porção ou por grama.',
  };
  const pesquisar = () => {
    ultimaBusca = q.value;
    const buscando = !!q.value.trim();
    $$('[data-aba]', tela).forEach((b) => b.setAttribute('aria-pressed', !buscando && b.dataset.aba === estado.abaAdicionar));
    if (buscando) {
      const prioridade = new Set([...cat.meus.map((f) => f.id), ...cat.recFoods.map((f) => f.id), ...(estado.config.recentes || [])]);
      lista = buscar(cat.indice, q.value, { limite: 500, prioridade });
      info.textContent = lista.length ? `${lista.length} resultado(s)` : 'Nada encontrado. Tente outra palavra ou crie em "+ Novo alimento".';
    } else {
      lista = daAba();
      info.textContent = lista.length ? '' : VAZIO[estado.abaAdicionar];
    }
    res.innerHTML = ''; mostrados = 0;
    desenharLote();
  };
  q.addEventListener('input', pesquisar);
  pesquisar();

  new IntersectionObserver((ent) => { if (ent[0].isIntersecting && mostrados < lista.length) desenharLote(); })
    .observe($('#mais', tela));

  const recarregar = async () => { cat = await catalogo(); pesquisar(); };
  tela.onclick = (e) => {
    const ab = e.target.closest('[data-aba]');
    if (ab) { estado.abaAdicionar = ab.dataset.aba; q.value = ''; return pesquisar(); }
    if (e.target.closest('[data-novo-alim]')) return folhaAlimento(null, { aoSalvar: recarregar });
    const b = e.target.closest('[data-id]');
    if (!b) return;
    abrir(cat.porId.get(b.dataset.id));
  };

  function abrir(food) {
    folhaQuantidade(food, {
      refId: estado.refeicaoAlvo,
      aoMudarCatalogo: recarregar,
      aoConfirmar: async ({ g, porcao, refId }) => {
        const ref = refs.find((r) => r.id === refId);
        const item = criarItem(food, g, porcao);
        const antes = await lerDia(estado.dataAtual);
        await gravarDia(adicionarItem(antes, refId, ref.nome, item));
        estado.refeicaoAlvo = refId;
        registrarRecente(food.id);
        aviso(`${food.nome} → ${ref.nome}`, { acao: async () => { await gravarDia(antes); aviso('Desfeito'); } });
        if (!q.value.trim()) pesquisar();
      },
    });
  }
}

/** Refeição provável pelo horário (só quando nenhuma foi escolhida). */
function sugerirRefeicao(refs) {
  const h = new Date().getHours();
  const id = h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia';
  return (refs.find((r) => r.id === id) || refs[0])?.id;
}
