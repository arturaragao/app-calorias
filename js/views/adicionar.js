// views/adicionar.js — busca (base + meus + receitas + Open Food Facts), abas Recentes/Favoritos/Meus/Receitas,
// leitor de código de barras e "+" para lançar com um toque a última quantidade usada.

import { estado, lerDia, gravarDia } from '../state.js';
import { ic } from '../icones.js';
import { buscar, porcoesDe } from '../foods.js';
import { catalogo, registrarRecente, ehFavorito } from '../custom.js';
import { criarItem, adicionarItem, sugestoesRefeicao, nutrientesPorGramas } from '../diary.js';
import { topo, esc, $, $$, aviso, ICONES, vibrar } from '../ui.js';
import { fmtKcal, fmtData, fmtNum, fmtG, chaveData, somarDias, normalizar } from '../utils.js';
import { pareceFrase } from '../frase.js';
import { pesosBusca } from '../inteligencia.js';
import { folhaFrase, lembrarEscolha } from './frase-ui.js';
import { folhaCesta } from './cesta.js';
import { buscarNome } from '../off.js';
import { folhaQuantidade } from './quantidade.js';
import { folhaAlimento } from './alimento-form.js';
import { abrirScanner } from './scanner.js';
import { folhaFotoIA, folhaRotulo, folhaCardapioIA } from './foto-ia.js';
import { motorIA } from '../ia.js';
import { estadoVazio } from '../vazio.js';
import { folhaSalvas } from './salvas.js';
import { db } from '../db.js';
import { aplicarLayout, ordemDe, visivel } from '../layout.js';
import { refeicaoPeloHorario as sugerirRefeicao } from './sugestao.js';

const LOTE = 30;
const ABAS = [['recentes', 'Recentes'], ['favoritos', 'Favoritos'], ['meus', 'Meus'], ['receitas', 'Receitas']];
let ultimaBusca = '';

export async function render(tela) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const aba = params.get('aba');
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
    <span style="width:48px"></span>`);
  $('#ref-alvo').onchange = (e) => { estado.refeicaoAlvo = e.target.value; tela.dispatchEvent(new Event('trocou-ref')); };
  tela.innerHTML = `<div class="campo-busca"><div class="busca-box">${ICONES.lupa}
      <input type="search" id="q" placeholder="Buscar alimento" aria-label="Buscar alimento" autocomplete="off" enterkeyhint="search" value="${esc(ultimaBusca)}">
      <button type="button" class="ico" data-scan aria-label="Ler código de barras com a câmera">${ICONES.codigo}</button></div>
      <div class="seg abas" role="tablist" style="margin:8px 0 0">${ABAS.map(([v, r]) =>
        `<button type="button" role="tab" data-bloco="aba-${v}" data-aba="${v}" aria-pressed="${v === estado.abaAdicionar}">${r}</button>`).join('')}</div></div>
    <div class="acoes-rolar" role="group" aria-label="Outras formas de adicionar">
      <button class="btn peq suave" data-bloco="foto" data-foto-ia>${ICONES.camera} Foto do prato</button>
      <button class="btn peq suave" data-bloco="texto" data-texto-ia>${ic('mic')} Falar ou escrever</button>
      <button class="btn peq suave" data-bloco="cesta" data-cesta-iniciar>${ic('list-checks')} Vários de uma vez</button>
      <button class="btn peq suave" data-bloco="cardapio" data-cardapio-ia>${ic('clipboard-list')} Cardápio/receita</button>
      <button class="btn peq suave" data-bloco="salvas" data-salvas>${ic('star')} Refeições salvas</button>
      <button class="btn peq suave" data-bloco="rotulo" data-rotulo>${ic('tag')} Ler rótulo</button>
      <button class="btn peq suave" data-bloco="novo" data-novo-alim>+ Novo alimento</button>
      <a class="btn peq suave" data-bloco="receita" href="#receita">+ Nova receita</a>
      <button class="btn peq" data-organizar="adicionar" aria-label="Organizar abas e atalhos">${ic('arrow-up-down')}</button></div>
    <div id="sug"></div>
    <div class="mudo" id="info"></div><ul class="lista" id="res"></ul><div id="mais" style="height:1px"></div>
    <div id="off" hidden><button class="btn bloco" data-off-buscar style="margin-top:10px"></button><ul class="lista" id="resoff"></ul></div>
    <div class="cesta-barra" hidden role="region" aria-label="Seleção"><button type="button" class="btn texto" data-cesta-sair>Cancelar</button>
      <span class="num" id="cesta-n"></span><button type="button" class="btn prim" data-cesta-ok>Lançar</button></div>`;
  aplicarLayout(tela, 'adicionar');
  // sem IA do Chrome nem chave do Gemini, o atalho de cardápio some (8.3)
  motorIA({ comImagem: true }).then((m) => { const b = $('[data-cardapio-ia]', tela); if (!m && b) b.hidden = true; }).catch(() => {});
  if (!visivel('adicionar', 'aba-' + estado.abaAdicionar) && !aba) {
    estado.abaAdicionar = (ordemDe('adicionar').find((id) => id.startsWith('aba-') && visivel('adicionar', id)) || 'aba-recentes').slice(4);
    $$('[data-aba]', tela).forEach((b) => b.setAttribute('aria-pressed', b.dataset.aba === estado.abaAdicionar));
  }
  let cat = await catalogo();
  const ini30 = somarDias(chaveData(), -30), ini60 = somarDias(chaveData(), -60);
  const diarios60 = (await db.getAll('diary')).map(([, d]) => d).filter((d) => d.data >= ini60);
  const recentesDiario = diarios60.filter((d) => d.data >= ini30);
  let bonus = pesosBusca(diarios60, { refId: estado.refeicaoAlvo, hoje: chaveData() });
  let modoSel = false;
  const cesta = new Map();
  /** Porção usual: a última usada, senão a 1ª porção conhecida, senão 100 g. */
  const porcaoUsual = (f) => {
    const u = estado.config.ultimaQtd[f.id];
    if (u) return { g: u.g, rot: rotuloQtd(u) + (u.porcao && !u.porcao.ml && u.porcao.nome !== 'grama' ? ` (${fmtG(u.g)} g)` : '') };
    const p0 = porcoesDe(f, cat.porcoes, estado.config.porcoesUsuario)[0];
    return p0 ? { g: p0.g, rot: `1 ${p0.nome} (${fmtG(p0.g)} g)` } : { g: 100, rot: '100 g' };
  };
  const linhaAlimento = (f) => {
    const u = estado.config.ultimaQtd[f.id], pu = porcaoUsual(f), sel = cesta.has(f.id);
    const n = f.kcal == null ? null : nutrientesPorGramas(f, pu.g).n;
    return `<li><button data-id="${esc(f.id)}" class="res${sel ? ' sel' : ''}"${modoSel ? ` aria-pressed="${sel}"` : ''}>
      ${modoSel ? `<span class="sel-caixa" aria-hidden="true">${sel ? ic('check') : ''}</span>` : ''}
      <span class="res-txt"><span class="nome">${ehFavorito(f.id) ? ic('star', 'p cheio') + ' ' : ''}${esc(f.nome)}</span>
      ${n /* sem kcal na fonte (ex.: leite integral/UHT na TACO): avisa em vez de mostrar 0 */
        ? `<span class="mudo num">${esc(pu.rot)} · <b>${fmtKcal(n.kcal)} kcal</b> · P ${fmtG(n.prot)} C ${fmtG(n.carb)} G ${fmtG(n.gord)}${f.fonte && f.fonte !== 'TACO' ? ` · ${esc(f.fonte)}` : ''}</span>`
        : `<span class="mudo">${ic('triangle-alert', 'p')} sem dados na ${esc(f.fonte || 'fonte')}</span>`}</span></button>
      ${u && !modoSel ? `<button class="rapido" data-rapido="${esc(f.id)}" aria-label="Adicionar ${esc(rotuloQtd(u))} de ${esc(f.nome)} com um toque">+</button>` : ''}</li>`;
  };
  const desenharSugestoes = (buscando) => {
    const el = $('#sug', tela);
    const ref = refs.find((r) => r.id === estado.refeicaoAlvo);
    const sug = buscando || estado.abaAdicionar !== 'recentes' ? []
      : sugestoesRefeicao(recentesDiario, estado.refeicaoAlvo).map((s) => cat.porId.get(s.foodId)).filter(Boolean);
    el.innerHTML = sug.length ? `<p class="secao" style="margin-top:6px">Você costuma comer no ${esc(ref?.nome || '')}</p>
      <ul class="lista">${sug.map(linhaAlimento).join('')}</ul><p class="secao">Recentes</p>` : '';
  };
  const q = $('#q', tela), res = $('#res', tela), info = $('#info', tela);
  let lista = [], mostrados = 0;

  const desenharLote = () => {
    const fatia = lista.slice(mostrados, mostrados + LOTE);
    res.insertAdjacentHTML('beforeend', fatia.map(linhaAlimento).join(''));
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
    favoritos: 'Toque em Favoritar na tela de quantidade para fixar um alimento aqui.',
    meus: 'Crie alimentos (rótulos, suplementos) em "+ Novo alimento" ou importe um CSV em Configurações.',
    receitas: 'Monte uma receita em "+ Nova receita" para lançar por porção ou por grama.',
  };
  const VAZIO_FIG = { recentes: 'relogio', favoritos: 'estrela', meus: 'caderno', receitas: 'caderno' };
  const VAZIO_TIT = { recentes: 'Nada recente ainda', favoritos: 'Sem favoritos', meus: 'Nenhum alimento seu', receitas: 'Nenhuma receita' };
  const pesquisar = () => {
    ultimaBusca = q.value;
    const buscando = !!q.value.trim();
    $$('[data-aba]', tela).forEach((b) => b.setAttribute('aria-pressed', !buscando && b.dataset.aba === estado.abaAdicionar));
    if (buscando) {
      const prioridade = new Set([...cat.meus.map((f) => f.id), ...cat.recFoods.map((f) => f.id), ...(estado.config.recentes || [])]);
      lista = buscar(cat.indice, q.value, { limite: 500, prioridade, bonus, sinonimos: cat.porcoes?.sinonimos,
        escolha: estado.config.escolhas?.[normalizar(q.value)] });
      info.innerHTML = (pareceFrase(q.value) ? `<button type="button" class="btn bloco suave frase-btn" data-frase>${ic('sparkles')} Lançar como frase: “${esc(q.value.trim())}”</button>` : '')
        + (lista.length ? `${lista.length} resultado(s)` : 'Nada encontrado. Tente outra palavra ou crie em "+ Novo alimento".');
    } else {
      lista = daAba();
      info.innerHTML = lista.length ? '' : estadoVazio(VAZIO_FIG[estado.abaAdicionar], VAZIO_TIT[estado.abaAdicionar], VAZIO[estado.abaAdicionar]);
    }
    res.innerHTML = ''; mostrados = 0;
    desenharSugestoes(buscando);
    desenharLote();
    // busca online opcional (só quando o usuário toca)
    $('#off', tela).hidden = !buscando;
    $('[data-off-buscar]', tela).innerHTML = `${ic('globe')} Buscar “${esc(q.value.trim())}” no Open Food Facts (industrializados)`;
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
  tela.addEventListener('trocou-ref', () => { bonus = pesosBusca(diarios60, { refId: estado.refeicaoAlvo, hoje: chaveData() }); desenharSugestoes(!!q.value.trim()); });
  pesquisar();

  if (params.get('q')) {                                   // busca vinda de outra tela (ex.: trecho não reconhecido)
    history.replaceState(null, '', '#adicionar');
    q.value = params.get('q'); pesquisar();
  }
  if (params.get('falar')) {                               // "+" › Falar, atalhos e rotinas do Android
    history.replaceState(null, '', '#adicionar');
    folhaFrase({ ditarJa: true, refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
  }
  if (params.get('foto')) {
    history.replaceState(null, '', '#adicionar');           // atalho do ícone: abre a foto do prato direto
    folhaFotoIA({ refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
  }
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
    if (e.target.closest('[data-foto-ia]')) return folhaFotoIA({ refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
    if (e.target.closest('[data-cardapio-ia]')) return folhaCardapioIA({ refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
    if (e.target.closest('[data-texto-ia]')) return folhaFrase({ refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
    if (e.target.closest('[data-frase]')) return folhaFrase({ texto: q.value, refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
    if (e.target.closest('[data-cesta-iniciar]')) return alternarSelecao(true);
    if (e.target.closest('[data-cesta-sair]')) return alternarSelecao(false);
    if (e.target.closest('[data-cesta-ok]')) {
      if (!cesta.size) return aviso('Marque ao menos um alimento.');
      const foods = [...cesta.values()];
      alternarSelecao(false);
      return folhaCesta(foods, { refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
    }
    if (e.target.closest('[data-salvas]')) return folhaSalvas({ refId: estado.refeicaoAlvo, aoLancar: () => { location.hash = '#diario'; } });
    if (e.target.closest('[data-rotulo]')) return folhaRotulo({ aoSalvar: async (f) => { await recarregar(); abrir(f); } });
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
    if (segurou) { segurou = false; return; }
    const food = cat.porId.get(b.dataset.id);
    if (modoSel) {
      if (cesta.has(food.id)) cesta.delete(food.id); else cesta.set(food.id, food);
      vibrar(8);
      return redesenharLinhas();
    }
    // escolher um resultado ensina a busca ("arroz" → o arroz que você come: cozido, tipo 1…)
    if (q.value.trim()) lembrarEscolha(q.value, food.id);
    abrir(food);
  };

  // ---------- Cesta: segurar um resultado (ou "Vários de uma vez") marca vários ----------
  let segurou = false, tSeg = null, xy = null;
  function redesenharLinhas() {
    res.innerHTML = lista.slice(0, mostrados).map(linhaAlimento).join('');
    desenharSugestoes(!!q.value.trim());
    const barra = $('.cesta-barra', tela);
    barra.hidden = !modoSel;
    $('#cesta-n', tela).textContent = `${cesta.size} selecionado(s)`;
    $('[data-cesta-ok]', tela).textContent = cesta.size ? `Lançar ${cesta.size}` : 'Lançar';
  }
  function alternarSelecao(on) { modoSel = on; if (!on) cesta.clear(); redesenharLinhas(); }
  // propriedades on* (não addEventListener): navegar() as zera ao trocar de tela
  tela.onpointerdown = (e) => {
    const b = e.target.closest('[data-id]');
    if (!b || modoSel) return;
    xy = [e.clientX, e.clientY];
    tSeg = setTimeout(() => { segurou = true; vibrar(15); const f = cat.porId.get(b.dataset.id); cesta.set(f.id, f); alternarSelecao(true); }, 500);
  };
  tela.onpointermove = (e) => { if (tSeg && xy && Math.hypot(e.clientX - xy[0], e.clientY - xy[1]) > 10) { clearTimeout(tSeg); tSeg = null; } };
  tela.onpointerup = tela.onpointercancel = () => { clearTimeout(tSeg); tSeg = null; };
  tela.oncontextmenu = (e) => { if (e.target.closest('[data-id]')) e.preventDefault(); };

  function abrir(food) {
    folhaQuantidade(food, {
      refId: estado.refeicaoAlvo,
      aoMudarCatalogo: recarregar,
      aoConfirmar: (q) => lancar(food, q),
    });
  }

  async function lancar(food, { g, porcao, refId, planejado }) {
    const ref = refs.find((r) => r.id === refId);
    const item = criarItem(food, g, porcao);
    if (planejado) item.planejado = true;
    const antes = await lerDia(estado.dataAtual);
    await gravarDia(adicionarItem(antes, refId, ref.nome, item));
    estado.refeicaoAlvo = refId;
    $('#ref-alvo').value = refId;
    registrarRecente(food.id);
    vibrar(12);
    aviso(`${food.nome} (${fmtKcal(item.n.kcal)} kcal) → ${ref.nome}${planejado ? ' (planejado)' : ''}`, { acao: async () => { await gravarDia(antes); aviso('Desfeito'); } });
    if (!q.value.trim() && estado.abaAdicionar === 'recentes') pesquisar();
  }
}

const rotuloQtd = (u) => (u.porcao?.ml ? `${fmtNum(Math.round(u.porcao.qtd))} mL`
  : u.porcao && u.porcao.nome !== 'grama' ? `${fmtNum(u.porcao.qtd)} × ${u.porcao.nome}` : `${fmtNum(Math.round(u.g))} g`);

