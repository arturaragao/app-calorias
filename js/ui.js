// ui.js — utilidades de interface: folha (bottom sheet), avisos com "desfazer", topo, campos.

import { escapeHtml, fmtNum, lerNumero } from './utils.js';
import { ic } from './icones.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const esc = escapeHtml;

/** Ícones das refeições padrão (refeições criadas pelo usuário usam o prato). */
export const ICONES_REF = {
  cafe: ic('coffee'), almoco: ic('utensils'), lanche: ic('apple'), jantar: ic('soup'), ceia: ic('moon-star'), outro: ic('utensils-crossed'),
};
export const iconeRef = (id) => ICONES_REF[id] || ICONES_REF.outro;

/** Ícones de interface mais usados (todos do sprite; ver DESIGN.md). */
export const ICONES = {
  lupa: ic('search', 'lupa'), gota: ic('droplet'), mais: ic('plus'), pontos: ic('ellipsis'), raio: ic('zap'),
  copiar: ic('copy'), camera: ic('camera'), voltar: ic('chevron-left'), avancar: ic('chevron-right'), fechar: ic('x'),
  lixo: ic('trash-2'), cima: ic('chevron-up'), baixo: ic('chevron-down'), codigo: ic('scan-barcode'),
};
export { ic };

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
/** Vibração leve de confirmação (desligável em Ajustes; ignorada se o aparelho não vibra). */
export function vibrar(ms = 10) {
  try { if (localStorage.getItem('vibrar') !== 'nao') navigator.vibrate?.(ms); } catch {}
}

export function aviso(msg, { acao, rotulo = 'Desfazer', ms = 5000 } = {}) {
  const a = $('#aviso');
  if (acao && rotulo === 'Desfazer') vibrar(10);          // ação concluída (que pode ser desfeita)
  a.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button>${esc(rotulo)}</button>` : ''}`;
  a.hidden = false;
  clearTimeout(timer);
  if (acao) a.querySelector('button').onclick = () => { a.hidden = true; acao(); };
  timer = setTimeout(() => (a.hidden = true), ms);
}

// ---------- Diálogo ----------
/** Confirmação no padrão do app (substitui window.confirm). Resolve true/false; "voltar" do Android = cancelar. */
export function confirmar(texto, { titulo = 'Confirmar', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.innerHTML = `<h2>${esc(titulo)}</h2><p>${esc(texto)}</p><div class="acoes">
      <button type="button" class="btn texto" value="nao">${esc(cancelar)}</button>
      <button type="button" class="btn texto${perigo ? ' perigo' : ''}" value="sim">${esc(ok)}</button></div>`;
    let feito = false;
    const fim = (v) => { if (feito) return; feito = true; if (d.open) d.close(); d.remove(); resolve(v); };
    d.addEventListener('click', (e) => {
      const b = e.target.closest('button[value]');
      if (b) fim(b.value === 'sim');
      else if (e.target === d) fim(false);                                 // toque fora = cancelar
    });
    d.addEventListener('close', () => fim(false));                         // "voltar"/Esc
    document.body.append(d);
    d.showModal();
    d.querySelector('[value=sim]').focus();
  });
}

// ---------- Componentes ----------
/** Linha de lista (1 ou 2 linhas). href → <a>; senão <button>. attrs: atributos extras já escapados. */
export function linhaLista({ icone = '', titulo, sub = '', fim = '', href = '', attrs = '' }) {
  const tag = href ? 'a' : 'button';
  return `<${tag} class="ll${sub ? ' duas' : ''}"${href ? ` href="${href}"` : ' type="button"'} ${attrs}>
    ${icone ? `<span class="ref-ico" aria-hidden="true">${icone}</span>` : ''}
    <span class="ll-txt">${titulo}${sub ? `<small>${sub}</small>` : ''}</span>
    <span class="ll-fim">${fim}${href ? ic('chevron-right') : ''}</span></${tag}>`;
}

/** Esqueleto de carregamento: tipos 'alto' (cartão grande), 'medio' (cartão) ou '' (linha de texto). */
export const esqueleto = (tipos = ['alto', 'medio', 'medio', '', '']) =>
  `<div class="esqueleto" aria-busy="true" aria-label="Carregando">${tipos.map((t) => `<i class="${t}"></i>`).join('')}</div>`;

// ---------- Dicas de uso (coachmark) ----------
// Cada dica aparece uma única vez (por aparelho), num balão apontando o elemento; some ao tocar em qualquer lugar.
const dicasVistas = () => { try { return JSON.parse(localStorage.getItem('dicasVistas') || '[]'); } catch { return []; } };
export const dicaVista = (chave) => dicasVistas().includes(chave);
function marcarDica(chave) {
  try { localStorage.setItem('dicasVistas', JSON.stringify([...new Set([...dicasVistas(), chave])])); } catch {}
}

/** Mostra a primeira dica ainda não vista cujo elemento existe e está visível. lista: [{ chave, el, texto }]. */
export function talvezDica(lista) {
  if (document.querySelector('.dica-balao') || !$('#folha').hidden) return;
  const d = lista.find((x) => x.el && !dicaVista(x.chave) && x.el.getBoundingClientRect().height);
  if (!d) return;
  marcarDica(d.chave);
  const r = d.el.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'dica-balao';
  b.setAttribute('role', 'status');
  b.innerHTML = `${ic('lightbulb', 'p')}<span>${esc(d.texto)}</span>`;
  document.body.append(b);
  const embaixo = r.bottom + b.offsetHeight + 16 < innerHeight - 90;   // não cobre a barra inferior
  const x = Math.min(innerWidth - 12 - b.offsetWidth, Math.max(12, r.left + r.width / 2 - b.offsetWidth / 2));
  b.style.left = x + 'px';
  b.style.top = (embaixo ? r.bottom + 10 : r.top - b.offsetHeight - 10) + 'px';
  b.style.setProperty('--seta-x', Math.max(16, Math.min(b.offsetWidth - 16, r.left + r.width / 2 - x)) + 'px');
  b.classList.add(embaixo ? 'embaixo' : 'em-cima');
  const sumir = () => { b.classList.add('saindo'); setTimeout(() => b.remove(), 200); removeEventListener('pointerdown', sumir, true); removeEventListener('scroll', sumir, true); };
  setTimeout(() => { addEventListener('pointerdown', sumir, true); addEventListener('scroll', sumir, true); }, 300);
  setTimeout(sumir, 9000);
}

// ---------- Tamanho do texto ----------
export const ESCALAS_FONTE = [0.85, 0.92, 1, 1.08, 1.15, 1.22, 1.3];
/** Aplica a escala do texto (0,85× a 1,3×) na raiz; guardada por aparelho. */
export function aplicarEscalaFonte(v) {
  const n = Math.min(1.3, Math.max(0.85, Number(v) || 1));
  document.documentElement.style.setProperty('--escala-fonte', String(n));
  try { localStorage.setItem('escalaFonte', String(n)); } catch {}
  return n;
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

// ---------- Arquivos ----------
/** Compartilha (Android: WhatsApp, Drive, e-mail…) ou baixa o arquivo. */
export async function entregarArquivo(blob, nome, titulo = nome) {
  const arq = new File([blob], nome, { type: blob.type });
  if (navigator.canShare?.({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: titulo }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
