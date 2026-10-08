// views/adicionar.js — busca (base + meus + receitas + Open Food Facts), abas Recentes/Favoritos/Meus/Receitas,
// leitor de código de barras e "+" para lançar com um toque a última quantidade usada.

import { estado, lerDia, gravarDia } from '../state.js';
import { buscar, rotuloFonte } from '../foods.js';
import { catalogo, registrarRecente, ehFavorito } from '../custom.js';
import { criarItem, adicionarItem } from '../diary.js';
import { topo, esc, $, $$, aviso, ICONES } from '../ui.js';
import { fmtKcal, fmtData, fmtNum, chaveData } from '../utils.js';
import { buscarNome } from '../off.js';
import { folhaQuantidade } from './quantidade.js';
import { folhaAlimento } from './alimento-form.js';
import { abrirScanner } from './scanner.js';

const LOTE = 30;
const ABAS = [['recentes', 'Recentes'], ['favoritos', 'Favoritos'], ['meus', 'Meus'], ['receitas', 'Receitas']];
let ultimaBusca = '';

export async function render(tela) {
  const aba = new URLSearchParams(location.hash.split('?')[1] || '').get('aba');
  if (aba) estado.abaAdicionar = aba;
  ultimaBusca = '';                         // ao voltar para a aba, a busca começa limpa
  estado.abaAdicionar ||= 'recentes';
  const refs = estado.config.refeicoes;
  // refeição escolhida no diário vale; vindo pela barra inferior, sugere pelo horário
  if (!estado.refeicaoDoDiario || !refs.some((r) => r.id === estado.refeicaoAlvo)) estado.refeicaoAlvo = sugerirRefeicao(refs);
  estado.refeicaoDoDiario = false;
  const quando = estado.dataAtual === chaveData() ? 'Hoje' : fmtData(estado.dataAtual);
  topo(`<a class="ico" href="#diario" aria-label="Voltar ao diário">${ICONES.voltar}</a>
    <div class="tit-sel"><h1>Adicionar · ${esc(quando)}</h1>
      <select id="ref-alvo" aria-label="Refeição de destino">${refs.map((r) => `<option value="${r.id}" ${r.id === estado.refeicaoAlvo ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></div>
    <span style="width:44px"></span>`);
  $('#ref-alvo').onchange = (e) => { estado.refeicaoAlvo = e.target.value; };
  tela.innerHTML = `<div class="campo-busca"><div class="busca-box">${ICONES.lupa}
      <input type="search" id="q" placeholder="Buscar alimento" aria-label="Buscar alimento" autocomplete="off" enterkeyhint="search" value="${esc(ultimaBusca)}">
      <button type="button" class="ico" data-scan aria-label="Ler código de barras com a câmera">${ICONES.codigo}</button></div>
      <div class="seg abas" role="tablist" style="margin:8px 0 0">${ABAS.map(([v, r]) =>
        `<button type="button" role="tab" data-aba="${v}" aria-pressed="${v === estado.abaAdicionar}">${r}</button>`).join('')}</div></div>
    <div class="linha" style="margin:2px 0 8px"><button class="btn peq suave" data-novo-alim>+ Novo alimento</button>
      <a class="btn peq suave" href="#receita">+ Nova receita</a></div>
    <p class="mudo" id="info"></p><ul class="lista" id="res"></ul><div id="mais" style="height:1px"></div>
    <div id="off" hidden><button class="btn bloco" data-off-buscar style="margin-top:10px"></button><ul class="lista" id="resoff"></ul></div>`;
  let cat = await catalogo();
  const q = $('#q', tela), res = $('#res', tela), info = $('#info', tela);
  let lista = [], mostrados = 0;

  const desenharLote = () => {
    const fatia = lista.slice(mostrados, mostrados + LOTE);
    res.insertAdjacentHTML('beforeend', fatia.map((f) => {
      const u = estado.config.ultimaQtd[f.id];
      return `<li><button data-id="${esc(f.id)}">
      <span><span class="nome">${ehFavorito(f.id) ? '★ ' : ''}${esc(f.nome)}</span><span class="mudo">${esc(rotuloFonte(f))}${u ? ` · última: ${esc(rotuloQtd(u))}` : ''}</span></span>
      <span class="num" style="white-space:nowrap"><b>${fmtKcal(f.kcal)}</b> <span class="mudo">kcal/100 g</span></span></button>
      ${u ? `<button class="rapido" data-rapido="${esc(f.id)}" aria-label="Adicionar ${esc(rotuloQtd(u))} de ${esc(f.nome)} com um toque">+</button>` : ''}</li>`;
    }).join(''));
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
    // busca online opcional (só quando o usuário toca)
    $('#off', tela).hidden = !buscando;
    $('[data-off-buscar]', tela).textContent = `🌐 Buscar “${q.value.trim()}” no Open Food Facts (industrializados)`;
    $('#resoff', tela).innerHTML = '';
    offRes = [];
  };
  let offRes = [];
  async function buscarOFF() {
    const termo = q.value.trim();
    if (termo.length < 3) return aviso('Digite ao menos 3 letras.');
    const ul = $('#resoff', tela);
    ul.innerHTML = '<li class="mudo" style="padding:10px 0">Buscando no Open Food Facts…</li>';
    try {
      offRes = await buscarNome(termo);
      ul.innerHTML = offRes.length ? offRes.map((f, i) => `<li><button data-off="${i}"><span><span class="nome">${esc(f.nome)}</span>
        <span class="mudo">Open Food Facts${f.falta.length ? ' · dados parciais' : ''}</span></span>
        <span class="num" style="white-space:nowrap"><b>${fmtKcal(f.kcal)}</b> <span class="mudo">kcal/100 g</span></span></button></li>`).join('')
        : '<li class="mudo" style="padding:10px 0">Nada encontrado no Open Food Facts.</li>';
    } catch (e) {
      console.warn(e);
      ul.innerHTML = '<li class="mudo" style="padding:10px 0">Open Food Facts indisponível (sem internet ou bloqueado). A base local continua funcionando.</li>';
    }
  }
  q.addEventListener('input', pesquisar);
  pesquisar();

  if (new URLSearchParams(location.hash.split('?')[1] || '').get('scan')) {
    history.replaceState(null, '', '#adicionar');           // atalho do ícone: abre o leitor direto
    abrirScanner({ aoAlimento: async (f) => { await recarregar(); abrir(f); } });
  }

  new IntersectionObserver((ent) => { if (ent[0].isIntersecting && mostrados < lista.length) desenharLote(); })
    .observe($('#mais', tela));

  const recarregar = async () => { cat = await catalogo(); pesquisar(); };
  tela.onclick = (e) => {
    const ab = e.target.closest('[data-aba]');
    if (ab) { estado.abaAdicionar = ab.dataset.aba; q.value = ''; return pesquisar(); }
    if (e.target.closest('[data-novo-alim]')) return folhaAlimento(null, { aoSalvar: recarregar });
    const rp = e.target.closest('[data-rapido]');
    if (rp) {
      const food = cat.porId.get(rp.dataset.rapido), u = estado.config.ultimaQtd[food.id];
      return lancar(food, { g: u.g, porcao: u.porcao, refId: estado.refeicaoAlvo });
    }
    if (e.target.closest('[data-scan]')) return abrirScanner({ aoAlimento: async (f) => { await recarregar(); abrir(f); } });
    if (e.target.closest('[data-off-buscar]')) return buscarOFF();
    const o = e.target.closest('[data-off]');
    if (o) {
      return folhaAlimento(null, {
        prefill: offRes[Number(o.dataset.off)], titulo: 'Revisar e salvar',
        nota: 'Dados do Open Food Facts (colaborativo): confira com o rótulo. Ao salvar, fica em Meus alimentos e funciona offline.',
        aoSalvar: async (f) => { await recarregar(); abrir(f); },
      });
    }
    const b = e.target.closest('[data-id]');
    if (!b) return;
    abrir(cat.porId.get(b.dataset.id));
  };

  function abrir(food) {
    folhaQuantidade(food, {
      refId: estado.refeicaoAlvo,
      aoMudarCatalogo: recarregar,
      aoConfirmar: (q) => lancar(food, q),
    });
  }

  async function lancar(food, { g, porcao, refId }) {
    const ref = refs.find((r) => r.id === refId);
    const item = criarItem(food, g, porcao);
    const antes = await lerDia(estado.dataAtual);
    await gravarDia(adicionarItem(antes, refId, ref.nome, item));
    estado.refeicaoAlvo = refId;
    $('#ref-alvo').value = refId;
    registrarRecente(food.id);
    navigator.vibrate?.(12);
    aviso(`✓ ${food.nome} (${fmtKcal(item.n.kcal)} kcal) → ${ref.nome}`, { acao: async () => { await gravarDia(antes); aviso('Desfeito'); } });
    if (!q.value.trim() && estado.abaAdicionar === 'recentes') pesquisar();
  }
}

const rotuloQtd = (u) => (u.porcao ? `${fmtNum(u.porcao.qtd)} × ${u.porcao.nome}` : `${fmtNum(Math.round(u.g))} g`);

/** Refeição provável pelo horário (só quando nenhuma foi escolhida). */
function sugerirRefeicao(refs) {
  const h = new Date().getHours();
  const id = h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia';
  return (refs.find((r) => r.id === id) || refs[0])?.id;
}
