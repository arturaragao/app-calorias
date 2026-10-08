// views/registros.js — abas Peso · Água · Medidas · Dobras.

import { estado } from '../state.js';
import { topo, $, $$ } from '../ui.js';

const ABAS = [['peso', 'Peso'], ['agua', 'Água'], ['medidas', 'Medidas'], ['dobras', 'Dobras']];
const MODULOS = {
  peso: () => import('./reg-peso.js'), agua: () => import('./reg-agua.js'),
  medidas: () => import('./reg-medidas.js'), dobras: () => import('./reg-dobras.js'),
};

export async function render(tela) {
  const aba = new URLSearchParams(location.hash.split('?')[1] || '').get('aba');
  if (MODULOS[aba]) estado.abaRegistros = aba;
  estado.abaRegistros ||= 'peso';
  topo('<h1 class="esq">Registros</h1>');
  tela.innerHTML = `<div class="seg" role="tablist">${ABAS.map(([v, r]) =>
    `<button type="button" role="tab" data-aba="${v}" aria-pressed="${v === estado.abaRegistros}">${r}</button>`).join('')}</div>
    <div id="sub"></div>`;
  const abrir = async () => {
    $$('[data-aba]', tela).forEach((b) => b.setAttribute('aria-pressed', b.dataset.aba === estado.abaRegistros));
    const sub = $('#sub', tela);
    sub.innerHTML = '';
    (await MODULOS[estado.abaRegistros]()).render(sub);
  };
  tela.querySelector('[role=tablist]').onclick = (e) => {
    const b = e.target.closest('[data-aba]');
    if (b) { estado.abaRegistros = b.dataset.aba; abrir(); }
  };
  await abrir();
}
