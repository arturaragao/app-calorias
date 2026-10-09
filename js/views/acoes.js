// views/acoes.js — botão "+" central: toque = buscar; segurar ou arrastar para cima = folha de ações rápidas.
// Cada ação é um endereço (#…), o mesmo que os atalhos do ícone e as rotinas do Android podem abrir.

import { abrirFolha, fecharFolha, ic, esc, vibrar } from '../ui.js';

export const ACOES = [
  ['buscar', 'Buscar alimento', 'search', '#adicionar'],
  ['codigo', 'Código de barras', 'scan-barcode', '#adicionar?scan=1'],
  ['foto', 'Foto do prato', 'camera', '#adicionar?foto=1'],
  ['falar', 'Falar', 'mic', '#adicionar?falar=1'],
  ['rapida', 'Adição rápida', 'zap', '#diario?acao=rapida'],
  ['agua', 'Água', 'droplet', '#diario?acao=agua'],
  ['peso', 'Peso', 'scale', '#registros?aba=peso'],
];

export function folhaAcoes() {
  vibrar(12);
  const p = abrirFolha('Lançar', `<div class="acoes-grade">${ACOES.map(([id, nome, icone]) =>
    `<button type="button" class="acao" data-acao="${id}"><span class="acao-ico">${ic(icone, 'g')}</span>${esc(nome)}</button>`).join('')}</div>`, { foco: false });
  p.onclick = (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const destino = ACOES.find(([id]) => id === b.dataset.acao)[3];
    fecharFolha();
    // espera o "voltar" da folha antes de mudar o endereço (senão o voltar desfaria a navegação)
    setTimeout(() => { location.hash = destino; }, 320);
  };
}

/** Liga o "+" da barra: segurar 450 ms ou arrastar para cima abre a folha; toque simples segue o link. */
export function ligarBotaoMais(fab) {
  let t = null, y0 = null, abriu = false;
  const abrir = () => { clearTimeout(t); t = null; if (!abriu) { abriu = true; folhaAcoes(); } };
  fab.addEventListener('pointerdown', (e) => { abriu = false; y0 = e.clientY; t = setTimeout(abrir, 450); });
  fab.addEventListener('pointermove', (e) => { if (y0 != null && y0 - e.clientY > 28) abrir(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fab.addEventListener(ev, () => { clearTimeout(t); y0 = null; });
  fab.addEventListener('click', (e) => { if (abriu) { e.preventDefault(); abriu = false; } });
  fab.addEventListener('contextmenu', (e) => e.preventDefault());
}
