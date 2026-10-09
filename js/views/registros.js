// views/registros.js — abas Peso · Água · Medidas · Dobras · Fotos (ordem e visibilidade editáveis).

import { estado } from '../state.js';
import { topo, $, $$ } from '../ui.js';
import { aplicarLayout, botaoOrganizar, ordemDe, visivel } from '../layout.js';

const ABAS = [['peso', 'Peso'], ['agua', 'Água'], ['medidas', 'Medidas'], ['dobras', 'Dobras'], ['fotos', 'Fotos']];
const MODULOS = {
  peso: () => import('./reg-peso.js'), agua: () => import('./reg-agua.js'),
  medidas: () => import('./reg-medidas.js'), dobras: () => import('./reg-dobras.js'), fotos: () => import('./reg-fotos.js'),
};

export async function render(tela) {
  const aba = new URLSearchParams(location.hash.split('?')[1] || '').get('aba');
  if (MODULOS[aba]) estado.abaRegistros = aba;
  // aba escondida só abre se pedida pelo link (ex.: atalho "Peso"); senão vale a primeira visível
  if (!estado.abaRegistros || (!visivel('registros', estado.abaRegistros) && estado.abaRegistros !== aba)) {
    estado.abaRegistros = ordemDe('registros').find((id) => visivel('registros', id)) || 'peso';
  }
  topo('<h1 class="esq">Registros</h1>');
  tela.innerHTML = `<div class="seg" role="tablist">${ABAS.map(([v, r]) =>
    `<button type="button" role="tab" data-bloco="${v}" data-aba="${v}" aria-pressed="${v === estado.abaRegistros}">${r}</button>`).join('')}</div>
    <div id="sub"></div>
    ${botaoOrganizar('registros')}`;
  aplicarLayout(tela, 'registros');
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
