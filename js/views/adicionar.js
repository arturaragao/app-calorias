// views/adicionar.js — busca na base local e adição ao diário.
// (Abas Recentes/Favoritos/Meus alimentos/Receitas e scanner chegam nas Etapas 2 e 5.)

import { estado, lerDia, gravarDia } from '../state.js';
import { carregarBase, buscar, rotuloFonte } from '../foods.js';
import { criarItem, adicionarItem } from '../diary.js';
import { topo, esc, $, aviso } from '../ui.js';
import { fmtKcal, fmtData, chaveData } from '../utils.js';
import { folhaQuantidade } from './quantidade.js';

const LOTE = 30;
let ultimaBusca = '';

export async function render(tela) {
  const refs = estado.config.refeicoes;
  if (!refs.some((r) => r.id === estado.refeicaoAlvo)) estado.refeicaoAlvo = sugerirRefeicao(refs);
  const nomeRef = () => refs.find((r) => r.id === estado.refeicaoAlvo)?.nome || '';
  const quando = estado.dataAtual === chaveData() ? 'hoje' : fmtData(estado.dataAtual);
  topo(`<a class="ico" href="#diario" aria-label="Voltar ao diário"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
    <h1>Adicionar · ${esc(nomeRef())} <span class="mudo">(${esc(quando)})</span></h1><span style="width:44px"></span>`);
  tela.innerHTML = `<div class="campo-busca"><input type="search" id="q" placeholder="Buscar alimento (ex.: arroz cozido)" autocomplete="off" enterkeyhint="search" value="${esc(ultimaBusca)}"></div>
    <p class="mudo" id="info"></p><ul class="lista" id="res"></ul><div id="mais" style="height:1px"></div>`;
  const base = await carregarBase();
  const q = $('#q', tela), res = $('#res', tela), info = $('#info', tela);
  let lista = [], mostrados = 0;

  const desenharLote = () => {
    const fatia = lista.slice(mostrados, mostrados + LOTE);
    res.insertAdjacentHTML('beforeend', fatia.map((f) => `<li><button data-id="${esc(f.id)}">
      <span><span class="nome">${esc(f.nome)}</span><span class="mudo">${esc(rotuloFonte(f))}</span></span>
      <span class="num" style="white-space:nowrap"><b>${fmtKcal(f.kcal)}</b> <span class="mudo">kcal/100 g</span></span></button></li>`).join(''));
    mostrados += fatia.length;
  };
  const pesquisar = () => {
    ultimaBusca = q.value;
    lista = buscar(base.indice, q.value, { limite: 500 });
    res.innerHTML = ''; mostrados = 0;
    info.textContent = !q.value.trim() ? `${base.foods.length} alimentos na base (TACO). Digite para buscar — sem acento também funciona.`
      : lista.length ? `${lista.length} resultado(s)` : 'Nada encontrado. Tente outra palavra (ex.: "frango grelhado").';
    desenharLote();
  };
  q.addEventListener('input', pesquisar);
  pesquisar();
  setTimeout(() => q.focus(), 50);

  // renderização incremental ao rolar
  new IntersectionObserver((ent) => { if (ent[0].isIntersecting && mostrados < lista.length) desenharLote(); })
    .observe($('#mais', tela));

  res.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const food = base.porId.get(b.dataset.id);
    folhaQuantidade(food, {
      refId: estado.refeicaoAlvo,
      aoConfirmar: async ({ g, porcao, refId }) => {
        const ref = refs.find((r) => r.id === refId);
        const item = criarItem(food, g, porcao);
        const antes = await lerDia(estado.dataAtual);
        await gravarDia(adicionarItem(antes, refId, ref.nome, item));
        estado.refeicaoAlvo = refId;
        aviso(`${food.nome} → ${ref.nome}`, { acao: async () => { await gravarDia(antes); aviso('Desfeito'); } });
      },
    });
  });
}

/** Refeição provável pelo horário (só quando nenhuma foi escolhida). */
function sugerirRefeicao(refs) {
  const h = new Date().getHours();
  const id = h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia';
  return (refs.find((r) => r.id === id) || refs[0])?.id;
}
