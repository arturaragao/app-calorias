// views/fotos.js — fotos da refeição (câmera ou galeria), com observação. Sem IA no app.

import { fotosDe, gravarFotos, adicionarFoto } from '../photos.js';
import { ic } from '../icones.js';
import { abrirFolha, esc, aviso, ICONES } from '../ui.js';
import { fmtData } from '../utils.js';

export async function folhaFotos(data, refId, nomeRef, aoMudar) {
  let urls = [];
  const limpar = () => { urls.forEach(URL.revokeObjectURL); urls = []; };
  const p = abrirFolha(`Fotos — ${nomeRef} (${fmtData(data)})`, `
    <label class="btn prim bloco" style="margin-bottom:10px">${ic('camera')} Tirar ou escolher foto
      <input type="file" accept="image/*" id="arq" hidden></label>
    <p class="mudo">A foto é comprimida (~1280 px) e fica só neste aparelho. Para estimar porções, mande a foto ao Claude no chat e lance pela Adição rápida.</p>
    <div id="lst"></div>`, { fechar: () => { limpar(); aoMudar?.(); } });

  const desenhar = async () => {
    limpar();
    const fotos = await fotosDe(data, refId);
    p.querySelector('#lst').innerHTML = fotos.length ? fotos.map((f, i) => {
      const u = URL.createObjectURL(f.blob); urls.push(u);
      return `<div class="card" style="padding:8px"><img decoding="async" loading="lazy" src="${u}" alt="Foto ${i + 1} de ${esc(nomeRef)}" style="width:100%;border-radius:10px;display:block">
        <div class="linha" style="margin-top:8px"><input type="text" data-obs="${i}" value="${esc(f.obs)}" placeholder="Observação (ex.: prato cheio, 2 conchas de feijão)" maxlength="200">
        <button class="ico" data-rem="${i}" aria-label="Apagar foto ${i + 1}" style="flex:0 0 44px">${ICONES.lixo}</button></div></div>`;
    }).join('') : '<p class="mudo">Nenhuma foto nesta refeição.</p>';
  };
  await desenhar();

  p.querySelector('#arq').onchange = async (e) => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    try {
      const tam = await adicionarFoto(data, refId, arq);
      aviso(`Foto salva (${Math.round(tam / 1024)} KB)`);
      await desenhar();
    } catch (err) {
      console.error(err);
      aviso('Não foi possível salvar a foto neste navegador.');
    }
  };
  let timer;
  p.addEventListener('input', (e) => {
    const i = e.target.dataset.obs;
    if (i == null) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const fotos = await fotosDe(data, refId);
      fotos[i].obs = e.target.value.trim();
      await gravarFotos(data, refId, fotos);
    }, 400);
  });
  p.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rem]');
    if (!b) return;
    const fotos = await fotosDe(data, refId);
    const [rem] = fotos.splice(Number(b.dataset.rem), 1);
    await gravarFotos(data, refId, fotos);
    await desenhar();
    aviso('Foto apagada', { acao: async () => { const fs = await fotosDe(data, refId); fs.push(rem); await gravarFotos(data, refId, fs); desenhar(); } });
  });
}
