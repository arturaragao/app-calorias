// ui.js — utilidades de interface: folha (bottom sheet), avisos com "desfazer", topo, campos.

import { escapeHtml, fmtNum, lerNumero } from './utils.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const esc = escapeHtml;

/** Ícones das refeições padrão (refeições criadas pelo usuário usam o prato). */
export const ICONES_REF = {
  cafe: '<svg viewBox="0 0 24 24"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M16 10h1.5a2.5 2.5 0 0 1 0 5H16 M8 3.5c0 1 1 1.5 1 2.5 M12 3.5c0 1 1 1.5 1 2.5"/></svg>',
  almoco: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="6"/><path d="M3 4v5a2 2 0 0 0 2 2v9 M5 4v5 M7 4v5a2 2 0 0 1-2 2 M21 4c-1.5 1-2 3-2 6h2v10"/></svg>',
  lanche: '<svg viewBox="0 0 24 24"><path d="M12 7c-1.5-1.5-5-1.5-6.5 1S4.6 15 6.5 18s3.5 3 5.5 2c2 1 3.6 1 5.5-2s2.5-7.5 1-10S13.5 5.5 12 7z M12 7c0-2 1-3.5 3-4"/></svg>',
  jantar: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  ceia: '<svg viewBox="0 0 24 24"><path d="M18 15a7 7 0 0 1-9-9 7 7 0 1 0 9 9z M17 3l.7 1.6L19.3 5l-1.6.7L17 7.3l-.7-1.6L14.7 5l1.6-.4z"/></svg>',
  outro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>',
};
export const iconeRef = (id) => ICONES_REF[id] || ICONES_REF.outro;

export const ICONES = {
  lupa: '<svg class="lupa" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  gota: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/></svg>',
  mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12 M6 12h12"/></svg>',
  pontos: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  raio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
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
