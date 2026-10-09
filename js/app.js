// app.js — inicialização, roteamento por hash, tema e service worker.

import { iniciarDB } from './db.js';
import { estado, carregarEstado } from './state.js';
import { $, $$, aviso, fecharFolha, esqueleto } from './ui.js';
import { chaveData } from './utils.js';
import { carregarBase } from './foods.js';
import { tentarAuto } from './drive.js';
import { aplicarCores } from './cores.js';
import { folhaOrganizar } from './layout.js';

const ROTAS = {
  diario: () => import('./views/diario.js'),
  adicionar: () => import('./views/adicionar.js'),
  registros: () => import('./views/registros.js'),
  progresso: () => import('./views/progresso.js'),
  config: () => import('./views/config.js'),
  metas: () => import('./views/metas.js'),
  perfil: () => import('./views/onboarding.js'),
  receita: () => import('./views/receita.js'),
  importar: () => import('./views/importar.js'),
};
const ABA_DA_ROTA = { metas: 'config', perfil: 'config', importar: 'config', receita: 'adicionar' };

// ---------- Tema ----------
export function aplicarTema(tema) {
  const r = document.documentElement;
  if (tema === 'claro' || tema === 'escuro') r.dataset.tema = tema; else delete r.dataset.tema;
  try { localStorage.setItem('tema', tema); } catch {}
  // barra de status do Android acompanha o fundo (inclusive com cores personalizadas)
  const bg = getComputedStyle(document.body).backgroundColor;
  if (bg) $('meta[name=theme-color]').content = bg;
}

// ---------- Roteamento ----------
// Cada tela define seus handlers em #tela (onclick etc.); zera todos antes de trocar de tela,
// senão o handler da tela anterior continua ativo numa tela que não define o seu.
const HANDLERS_TELA = ['onclick', 'oninput', 'onchange', 'onkeydown', 'onsubmit',
  'onpointerdown', 'onpointermove', 'onpointerup', 'onpointercancel'];
function limparHandlers(tela) {
  for (const h of HANDLERS_TELA) tela[h] = null;
  tela.style.touchAction = ''; tela.style.transform = ''; tela.classList.remove('dia-esq', 'dia-dir');
}

export async function navegar() {
  fecharFolha(true);
  let rota = location.hash.slice(1).split('?')[0] || 'diario';
  if (!estado.perfil && rota !== 'perfil') rota = 'perfil';
  if (!ROTAS[rota]) rota = 'diario';
  const ativa = ABA_DA_ROTA[rota] || rota;
  $$('.nav a').forEach((a) => {
    if (a.dataset.rota === ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('.nav').hidden = !estado.perfil;
  const tela = $('#tela');
  // esqueleto só se a tela demorar a montar (> 150 ms) e ainda não tiver desenhado nada novo
  const antes = tela.firstElementChild;
  let pronta = false;
  const tEsq = setTimeout(() => { if (!pronta && (!tela.firstElementChild || tela.firstElementChild === antes)) tela.innerHTML = esqueleto(); }, 150);
  try {
    const mod = await ROTAS[rota]();
    limparHandlers(tela);
    if (tela.firstElementChild === antes) tela.innerHTML = '';
    await mod.render(tela, rota);
    pronta = true; clearTimeout(tEsq);
    window.scrollTo(0, 0);
    tela.classList.remove('entrando'); void tela.offsetWidth; tela.classList.add('entrando');   // transição suave
  } catch (e) {
    pronta = true; clearTimeout(tEsq);
    console.error(e);
    tela.innerHTML = `<div class="card"><p>Erro ao abrir a tela.</p><p class="mudo">${String(e.message || e)}</p></div>`;
  }
}

// ---------- Service worker com aviso de atualização ----------
function registrarSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Atualização automática: o SW novo assume sozinho (skipWaiting) e o app recarrega.
  // Procura versão nova ao abrir e sempre que o app volta ao primeiro plano.
  const tinhaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting) reg.waiting.postMessage('pular-espera');
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW não registrado', e));
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || recarregou) return;          // 1ª instalação não precisa recarregar
    recarregou = true;
    try { sessionStorage.setItem('atualizado', '1'); } catch {}
    // não interrompe uma folha aberta (ex.: lançando um alimento): espera fechar
    const recarregar = () => ($('#folha').hidden ? location.reload() : setTimeout(recarregar, 1000));
    recarregar();
  });
  try {
    if (sessionStorage.getItem('atualizado')) { sessionStorage.removeItem('atualizado'); aviso('App atualizado'); }
    if (sessionStorage.getItem('importado')) { sessionStorage.removeItem('importado'); aviso('Backup importado com sucesso'); }
  } catch {}
}

// ---------- Início ----------
async function iniciar() {
  try {
    const db = await iniciarDB();
    if (db.tipo !== 'indexeddb') aviso(db.tipo === 'memoria'
      ? 'Armazenamento indisponível: os dados não serão salvos.' : 'Usando armazenamento reduzido (localStorage).', { ms: 8000 });
  } catch (e) {
    console.error(e);
    aviso('Erro ao abrir o banco de dados.');
  }
  await carregarEstado();
  aplicarCores(estado.config.cores);
  aplicarTema(estado.config.tema);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(estado.config.tema));
  window.addEventListener('hashchange', navegar);
  // "Organizar" no fim de cada tela (ordem e visibilidade dos blocos)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-organizar]');
    if (b) folhaOrganizar(b.dataset.organizar, navegar);
  });
  // campo numérico focado já vem com o número todo selecionado: digitar substitui o valor
  // (o toque que deu o foco às vezes reposiciona o cursor depois: seleciona de novo nesse clique)
  const NUM = 'input[inputmode=decimal], input[inputmode=numeric]';
  let focoEm = 0;
  document.addEventListener('focusin', (e) => {
    const inp = e.target;
    if (!inp.matches?.(NUM)) return;
    focoEm = Date.now();
    setTimeout(() => { try { inp.select(); } catch {} }, 0);
  });
  document.addEventListener('click', (e) => {
    if (e.target.matches?.(NUM) && Date.now() - focoEm < 600) { try { e.target.select(); } catch {} }
  });
  // app aberto em segundo plano de um dia para o outro: o diário passa para o novo "hoje"
  let hojeAntes = chaveData();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const hoje = chaveData();
    if (hoje === hojeAntes) return;
    if (estado.dataAtual === hojeAntes) estado.dataAtual = hoje;
    hojeAntes = hoje;
    if ((location.hash.slice(1) || 'diario').startsWith('diario')) navegar();
  });
  // pré-carrega a base de alimentos quando o celular estiver ocioso (busca instantânea depois)
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => carregarBase().catch(() => {}));
  window.addEventListener('offline', () => aviso('Sem internet: tudo funciona, exceto a consulta ao Open Food Facts.', { ms: 5000 }));
  await navegar();
  registrarSW();
  // backup no Drive: envia em silêncio se houver token válido e novidades (ao abrir e ao sair do app)
  setTimeout(() => tentarAuto().catch(() => {}), 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') tentarAuto().catch(() => {}); });
}

iniciar();
