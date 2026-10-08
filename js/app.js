// app.js — inicialização, roteamento por hash, tema e service worker.

import { iniciarDB } from './db.js';
import { estado, carregarEstado } from './state.js';
import { $, $$, aviso, fecharFolha } from './ui.js';

const ROTAS = {
  diario: () => import('./views/diario.js'),
  adicionar: () => import('./views/adicionar.js'),
  registros: () => import('./views/embreve.js'),
  progresso: () => import('./views/embreve.js'),
  config: () => import('./views/config.js'),
  metas: () => import('./views/metas.js'),
  perfil: () => import('./views/onboarding.js'),
};

// ---------- Tema ----------
export function aplicarTema(tema) {
  const r = document.documentElement;
  if (tema === 'claro' || tema === 'escuro') r.dataset.tema = tema; else delete r.dataset.tema;
  try { localStorage.setItem('tema', tema); } catch {}
  const escuro = tema === 'escuro' || (tema !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = escuro ? '#0d1510' : '#f4f8f4';
}

// ---------- Roteamento ----------
export async function navegar() {
  fecharFolha(true);
  let rota = location.hash.slice(1).split('?')[0] || 'diario';
  if (!estado.perfil && rota !== 'perfil') rota = 'perfil';
  if (!ROTAS[rota]) rota = 'diario';
  const ativa = rota === 'metas' || rota === 'perfil' ? 'config' : rota;
  $$('.nav a').forEach((a) => {
    if (a.dataset.rota === ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('.nav').hidden = !estado.perfil;
  const tela = $('#tela');
  try {
    const mod = await ROTAS[rota]();
    tela.innerHTML = '';
    await mod.render(tela, rota);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    tela.innerHTML = `<div class="card"><p>Erro ao abrir a tela.</p><p class="mudo">${String(e.message || e)}</p></div>`;
  }
}

// ---------- Service worker com aviso de atualização ----------
function registrarSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const avisar = (w) => aviso('Atualização disponível', {
      rotulo: 'Atualizar', ms: 60000, acao: () => w.postMessage('pular-espera'),
    });
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(w);
      });
    });
  }).catch((e) => console.warn('SW não registrado', e));
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recarregou) { recarregou = true; location.reload(); } });
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
  aplicarTema(estado.config.tema);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(estado.config.tema));
  window.addEventListener('hashchange', navegar);
  await navegar();
  registrarSW();
}

iniciar();
