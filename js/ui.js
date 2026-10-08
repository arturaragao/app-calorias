// ui.js — utilidades de interface: folha (bottom sheet), avisos com "desfazer", topo, campos.

import { escapeHtml, fmtNum, lerNumero } from './utils.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const esc = escapeHtml;

export const ICONES = {
  voltar: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  avancar: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12 M18 6L6 18"/></svg>',
  lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13"/></svg>',
  cima: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  baixo: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  codigo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v10 M7 7v10 M10 7v10 M13 7v10 M15.5 7v10 M18 7v10 M20 7v10" stroke-width="1.5"/><path d="M2 4h3 M19 4h3 M2 20h3 M19 20h3 M2 4v3 M22 4v3 M2 17v3 M22 17v3"/></svg>',
};

// ---------- Topo ----------
export function topo(html) { $('#topo').innerHTML = html; }

// ---------- Folha ----------
// Histórico: abrir folha empilha um estado (o "voltar" do Android fecha a folha).
// Fechar por código faz history.back(); se outra folha abrir antes desse "voltar" chegar,
// o pushState espera por ele (senão o popstate fecharia a folha nova).
let aoFechar = null, voltaPendente = false, empilharDepois = false;
export function abrirFolha(titulo, corpoHtml, { fechar, foco = true } = {}) {
  const f = $('#folha');
  if (f.hidden) {
    if (voltaPendente) empilharDepois = true; else history.pushState({ folha: true }, '');
  }
  f.innerHTML = `<div class="painel"><button class="ico fechar" data-fechar aria-label="Fechar">${ICONES.fechar}</button>
    <h2>${esc(titulo)}</h2>${corpoHtml}</div>`;
  f.hidden = false;
  aoFechar = fechar || null;
  f.onclick = (e) => { if (e.target === f || e.target.closest('[data-fechar]')) fecharFolha(); };
  // foco: false evita abrir o teclado sozinho (ex.: leitor de código de barras)
  if (foco) setTimeout(() => f.querySelector('input:not([type=hidden]),select,button.prim')?.focus({ preventScroll: true }), 50);
  else document.activeElement?.blur?.();
  return f.querySelector('.painel');
}
export function fecharFolha(daHistoria = false) {
  const f = $('#folha');
  if (f.hidden) return;
  f.hidden = true; f.innerHTML = '';
  aoFechar?.(); aoFechar = null;
  if (!daHistoria && history.state?.folha) { voltaPendente = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (voltaPendente) {
    voltaPendente = false;
    if (empilharDepois) { empilharDepois = false; history.pushState({ folha: true }, ''); }
    return;
  }
  fecharFolha(true);                                            // botão voltar do Android fecha a folha
});

// ---------- Aviso ----------
let timer = null;
export function aviso(msg, { acao, rotulo = 'Desfazer', ms = 5000 } = {}) {
  const a = $('#aviso');
  a.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button>${esc(rotulo)}</button>` : ''}`;
  a.hidden = false;
  clearTimeout(timer);
  if (acao) a.querySelector('button').onclick = () => { a.hidden = true; acao(); };
  timer = setTimeout(() => (a.hidden = true), ms);
}

// ---------- Campos ----------
/** Campo numérico com botões −/+ (passo configurável). */
export function campoPasso(nome, valor, { passo = 1, rotulo = '', sufixo = '' } = {}) {
  return `<label class="campo"><span>${esc(rotulo)}</span><div class="passo">
    <button type="button" class="btn" data-passo="-${passo}" data-alvo="${nome}" aria-label="Diminuir">−</button>
    <input type="text" inputmode="decimal" name="${nome}" value="${fmtNum(valor)}" autocomplete="off">
    <button type="button" class="btn" data-passo="${passo}" data-alvo="${nome}" aria-label="Aumentar">+</button>
    ${sufixo ? `<span class="mudo">${esc(sufixo)}</span>` : ''}</div></label>`;
}

/** Liga os botões −/+ de um contêiner; chama aoMudar após cada mudança. */
export function ligarPassos(raiz, aoMudar) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-passo]');
    if (!b) return;
    const inp = raiz.querySelector(`[name="${b.dataset.alvo}"]`);
    const atual = lerNumero(inp.value);
    const novo = Math.max(0, Math.round(((isNaN(atual) ? 0 : atual) + Number(b.dataset.passo)) * 100) / 100);
    inp.value = fmtNum(novo);
    aoMudar?.(inp);
  });
  raiz.addEventListener('input', (e) => { if (e.target.matches('input')) aoMudar?.(e.target); });
}

export const valorDe = (raiz, nome) => lerNumero(raiz.querySelector(`[name="${nome}"]`)?.value);

export function seg(nome, opcoes, atual) {
  return `<div class="seg" role="group" data-seg="${nome}">${opcoes.map(([v, r]) =>
    `<button type="button" data-v="${v}" aria-pressed="${v === atual}">${esc(r)}</button>`).join('')}</div>`;
}
