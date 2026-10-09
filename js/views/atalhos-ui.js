// views/atalhos-ui.js — Ajustes › "Atalhos, rotinas e jejum": endereços para Rotinas da Samsung / atalhos,
// etiqueta NFC (Web NFC, opcional) e o bloco de jejum intermitente (escondido por padrão).

import { estado, salvarConfig } from '../state.js';
import { esc, ic, aviso } from '../ui.js';

export const ATALHOS_URL = [
  ['Falar o que comeu', '#adicionar?falar=1'], ['Água +250 mL', '#diario?acao=agua&ml=250'], ['Água +500 mL', '#diario?acao=agua&ml=500'],
  ['Registrar peso', '#registros?aba=peso'], ['Foto do prato', '#adicionar?foto=1'], ['Código de barras', '#adicionar?scan=1'],
  ['Adição rápida', '#diario?acao=rapida'], ['Restaurante', '#adicionar?restaurante=1'], ['Planejar semana', '#plano'], ['Lista de compras', '#plano?compras=1'],
];
const base = () => location.origin + location.pathname;
const temNFC = () => 'NDEFReader' in window;

export function cardAtalhos() {
  const j = estado.config.jejum || {};
  return `<div class="card" id="c-atalhos"><h2 style="margin-bottom:6px">${ic('zap')} Atalhos, rotinas e jejum</h2>
    <p class="mudo" style="margin-top:0">Segure o ícone do app para os atalhos (o Android mostra cerca de 4). Para Modos e Rotinas da Samsung,
      use a ação de abrir site (se o seu aparelho tiver) com um destes endereços:</p>
    <ul class="lista atalhos-url">${ATALHOS_URL.map(([n, h]) => `<li><button type="button" data-copiar-url="${esc(h)}"><span><span class="nome">${esc(n)}</span>
      <span class="mudo url">${esc(base() + h)}</span></span>${ic('copy')}</button></li>`).join('')}</ul>
    ${temNFC() ? `<p class="secao" style="margin:14px 0 6px">Etiqueta NFC (experimental)</p>
      <div class="linha"><select name="nfc-url" aria-label="Ação da etiqueta">${ATALHOS_URL.map(([n, h]) => `<option value="${esc(h)}" ${h.includes('ml=500') ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <button type="button" class="btn suave" data-nfc style="flex:0 0 auto">${ic('nfc')} Gravar</button></div>
      <p class="mudo" id="nfc-st" style="font-size:var(--fs-12)">Toque em Gravar e encoste a etiqueta (NTAG) na traseira do celular. Depois, encostar o celular na etiqueta abre o endereço (o Android cuida disso; com o app aberto, abre direto).</p>` : ''}
    <p class="secao" style="margin:14px 0 6px">Jejum intermitente</p>
    <label class="linha-chave"><span>Mostrar no Diário<small>Tempo desde o último lançamento, meta e últimas noites. Sem notificações.</small></span>
      <span class="chave"><input type="checkbox" name="jejum-ativo" ${j.ativo ? 'checked' : ''}><i></i></span></label>
    <label class="campo"><span>Meta de jejum</span><select name="jejum-meta">${[12, 13, 14, 16, 18, 20].map((h) => `<option value="${h}" ${(j.meta || 16) === h ? 'selected' : ''}>${h} horas</option>`).join('')}</select></label></div>`;
}

export function ligarAtalhos(el) {
  if (!el) return;
  el.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copiar-url]');
    if (c) {
      try { await navigator.clipboard.writeText(base() + c.dataset.copiarUrl); aviso('Endereço copiado'); } catch { aviso('Não consegui copiar.'); }
      return;
    }
    if (e.target.closest('[data-nfc]')) {
      const st = el.querySelector('#nfc-st');
      try {
        st.textContent = 'Encoste a etiqueta na traseira do celular…';
        await new window.NDEFReader().write({ records: [{ recordType: 'url', data: base() + el.querySelector('[name=nfc-url]').value }] });
        st.textContent = 'Etiqueta gravada.'; aviso('Etiqueta NFC gravada');
      } catch (err) { st.textContent = err.name === 'NotAllowedError' ? 'Permita o NFC para o site e tente de novo.' : `Não gravou: ${err.message}`; }
    }
  });
  el.addEventListener('change', async (e) => {
    if (!e.target.name?.startsWith('jejum-')) return;
    estado.config.jejum = { ativo: el.querySelector('[name=jejum-ativo]').checked, meta: Number(el.querySelector('[name=jejum-meta]').value) };
    await salvarConfig();
    aviso(estado.config.jejum.ativo ? 'Jejum aparece no Diário' : 'Jejum escondido');
  });
}
