// views/compartilhado.js — chegada de algo compartilhado de outro app (galeria, iFood, navegador, WhatsApp).
// O service worker guardou texto/imagens no cache "compartilhado"; aqui o Diário abre e uma folha pergunta o que fazer.

import { abrirFolha, fecharFolha, esc, ic, aviso } from '../ui.js';
import { refeicaoPeloHorario } from './sugestao.js';

async function lerCompartilhado() {
  try {
    const c = await caches.open('compartilhado');
    const meta = await (await c.match('./compartilhado/meta'))?.json();
    if (!meta) return null;
    const imagens = [];
    for (let i = 0; i < meta.imagens; i++) { const r = await c.match(`./compartilhado/${i}`); if (r) imagens.push(await r.blob()); }
    await caches.delete('compartilhado');                       // lido uma vez só
    return { ...meta, imagens };
  } catch { return null; }
}

export async function render(tela) {
  history.replaceState(null, '', '#diario');
  const diario = await import('./diario.js');
  await diario.render(tela);
  const r = await lerCompartilhado();
  if (!r || (!r.imagens.length && !r.texto && !r.url)) return aviso('Nada foi recebido do compartilhamento.');
  const aoLancar = () => diario.render(tela);
  const refId = refeicaoPeloHorario();
  const texto = [r.titulo, r.texto, r.url].filter(Boolean).join(' ').trim();
  if (r.imagens.length) {
    const url = URL.createObjectURL(r.imagens[0]);
    const p = abrirFolha('Imagem recebida', `<img class="ia-foto" src="${url}" alt="Imagem compartilhada">
      <p class="mudo" style="margin-top:0">O que é esta imagem?</p>
      <div class="menu-lista">
        <button class="btn" data-o="prato">${ic('camera')} Foto do prato</button>
        <button class="btn" data-o="pedido">${ic('receipt')} Print de pedido (iFood, restaurante)</button>
        <button class="btn" data-o="cardapio">${ic('clipboard-list')} Cardápio</button>
        <button class="btn" data-o="rotulo">${ic('tag')} Rótulo (tabela nutricional)</button>
        <button class="btn" data-o="receita">${ic('chef-hat')} Receita</button></div>`, { foco: false });
    p.onclick = async (e) => {
      const o = e.target.closest('[data-o]')?.dataset.o;
      if (!o) return;
      const ia = await import('./foto-ia.js');
      const arquivo = r.imagens[0];
      fecharFolha();
      setTimeout(() => {
        if (o === 'prato') ia.folhaFotoIA({ refId, aoLancar, arquivo });
        else if (o === 'rotulo') ia.folhaRotulo({ arquivo, aoSalvar: () => aviso('Salvo em Meus alimentos.') });
        else ia.folhaCardapioIA({ refId, aoLancar, arquivo, tipoIni: o === 'receita' ? 'receita' : 'cardapio' });
      }, 350);
    };
    return;
  }
  // só texto: descrição do que comeu (interpretador local, sem IA)
  const { folhaFrase } = await import('./frase-ui.js');
  folhaFrase({ texto: texto.slice(0, 400), refId, aoLancar });
}
