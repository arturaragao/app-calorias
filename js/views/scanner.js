// views/scanner.js — leitura de código de barras pela câmera traseira (BarcodeDetector do Chrome Android),
// com campo manual de reserva. Resolve localmente (Meus alimentos) antes de consultar o Open Food Facts.

import { abrirFolha, fecharFolha, aviso, esc, vibrar } from '../ui.js';
import { ic } from '../icones.js';
import { catalogo } from '../custom.js';
import { limparCodigo, variantesCodigo, buscarCodigo, digitoOk } from '../off.js';
import { folhaAlimento } from './alimento-form.js';
import { fmtKcal, fmtMacro } from '../utils.js';

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'];

/** aoAlimento(food): chamado com o alimento pronto para lançar (já salvo em Meus alimentos). */
export async function abrirScanner({ aoAlimento }) {
  let stream = null, parar = false;
  const encerrar = () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const temDetector = 'BarcodeDetector' in window;
  const p = abrirFolha('Ler código de barras', `
    ${temDetector ? `<div class="camera"><video id="vid" playsinline muted></video><div class="mira"></div>
      <button class="btn peq lanterna" id="luz" hidden>${ic('flashlight')} Lanterna</button>
      <div class="zoom" id="zoom" hidden><span>1×</span><input type="range" id="zr" aria-label="Zoom"><span id="zv"></span></div></div>
      <p class="mudo" id="st">Aponte para o código, a uns 15–20 cm, com o código na faixa. Toque na imagem para focar.</p>`
    : '<p class="nota">Este navegador não lê códigos pela câmera. Digite os números abaixo.</p>'}
    <form id="fm" class="linha" style="margin-top:8px"><input type="text" inputmode="numeric" name="cod" placeholder="ou digite o código (8 a 14 dígitos)" autocomplete="off">
      <button class="btn prim" style="flex:0 0 auto">OK</button></form>`, { fechar: encerrar, foco: false });

  p.querySelector('#fm').onsubmit = (e) => {
    e.preventDefault();
    const c = limparCodigo(e.target.cod.value);
    if (!c) return aviso('Código inválido: use 8, 12, 13 ou 14 dígitos.');
    encerrar(); resolver(c, aoAlimento);
  };
  if (!temDetector) return;

  try {
    const suportados = await BarcodeDetector.getSupportedFormats();
    const det = new BarcodeDetector({ formats: FORMATOS.filter((f) => suportados.includes(f)) });
    // resolução maior = barras finas mais nítidas
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (parar) return encerrar();
    const vid = p.querySelector('#vid');
    vid.srcObject = stream;
    await vid.play();
    const trilha = stream.getVideoTracks()[0];
    const cap = trilha.getCapabilities?.() || {};
    if (cap.torch) {
      const b = p.querySelector('#luz'); let ligada = false; b.hidden = false;
      b.onclick = () => { ligada = !ligada; trilha.applyConstraints({ advanced: [{ torch: ligada }] }).catch(() => {}); };
    }
    // foco contínuo; toque na imagem refaz o foco
    if (cap.focusMode?.includes('continuous')) trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    vid.onclick = () => {
      if (cap.focusMode?.includes('single-shot')) trilha.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] })
        .then(() => setTimeout(() => cap.focusMode.includes('continuous') && trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}), 1200)).catch(() => {});
    };
    // zoom: começa em ~2× (dá para afastar o celular e a câmera consegue focar); ajustável
    if (cap.zoom && cap.zoom.max > 1) {
      const z = p.querySelector('#zoom'), zr = p.querySelector('#zr'), zv = p.querySelector('#zv');
      const ini = Math.min(cap.zoom.max, Math.max(cap.zoom.min || 1, 2));
      Object.assign(zr, { min: cap.zoom.min || 1, max: Math.min(cap.zoom.max, 6), step: cap.zoom.step || 0.1, value: ini });
      const aplicar = () => { zv.textContent = `${Number(zr.value).toFixed(1).replace('.', ',')}×`; trilha.applyConstraints({ advanced: [{ zoom: Number(zr.value) }] }).catch(() => {}); };
      zr.oninput = aplicar; z.hidden = false; aplicar();
    }
    // laço de detecção: alterna o quadro inteiro e o centro (faixa da mira) ampliado 2×, que ajuda em códigos pequenos.
    // EAN/UPC com dígito verificador correto vale na 1ª leitura; os demais exigem 2 leituras iguais seguidas.
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    let anterior = '', vez = 0;
    const recorte = () => {
      const w = vid.videoWidth, h = vid.videoHeight;
      if (!w || !h) return vid;
      const sw = w * 0.8, sh = h * 0.34;
      cv.width = Math.round(sw * 2); cv.height = Math.round(sh * 2);
      cx.drawImage(vid, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
      return cv;
    };
    const laco = async () => {
      if (parar) return;
      try {
        const fonte = vez++ % 2 ? recorte() : vid;
        const cods = await det.detect(fonte);
        for (const cod of cods) {
          const c = limparCodigo(cod.rawValue);
          if (!c) continue;
          const confiavel = /ean|upc/.test(cod.format) && digitoOk(c);
          if (confiavel || c === anterior) {
            vibrar(80);
            encerrar(); fecharFolha();
            return resolver(c, aoAlimento);
          }
          anterior = c;
        }
      } catch {}
      setTimeout(laco, 90);
    };
    laco();
  } catch (e) {
    console.warn(e);
    const st = p.querySelector('#st');
    if (st) st.textContent = e.name === 'NotAllowedError'
      ? 'Permissão da câmera negada. Libere em Configurações do Chrome › Site › Câmera, ou digite o código.'
      : 'Não foi possível abrir a câmera. Digite o código abaixo.';
    p.querySelector('.camera')?.remove();
  }
}

/** Código lido -> alimento local, ou Open Food Facts (revisar e salvar), ou cadastro manual. */
export async function resolver(codigo, aoAlimento) {
  const cat = await catalogo();
  const vars = variantesCodigo(codigo);
  const local = cat.meus.find((f) => f.codigo && vars.includes(f.codigo));
  if (local) { aviso(`Encontrado em Meus alimentos: ${local.nome}`); return aoAlimento(local); }
  if (!navigator.onLine) return manual(codigo, aoAlimento, 'Sem internet: cadastre o produto pelo rótulo.');
  aviso(`Consultando o código ${codigo}…`, { ms: 9000 });
  let food;
  try { food = await buscarCodigo(codigo); } catch (e) {
    console.warn(e);
    return manual(codigo, aoAlimento, 'Open Food Facts indisponível agora. Cadastre pelo rótulo.');
  }
  if (!food) return manual(codigo, aoAlimento, 'Produto não encontrado no Open Food Facts. Cadastre pelo rótulo (fica salvo para a próxima leitura).');
  const por = food.porcoes[0];
  const fator = por ? por.g / 100 : 0;
  const nota = `Dados do Open Food Facts (colaborativo): confira com o rótulo antes de salvar.
    ${por && food.kcal != null ? `<br>Por porção de ${Math.round(por.g)} g: <b>${fmtKcal(food.kcal * fator)} kcal</b> · P ${fmtMacro((food.prot ?? 0) * fator)} · C ${fmtMacro((food.carb ?? 0) * fator)} · G ${fmtMacro((food.gord ?? 0) * fator)}` : ''}
    ${food.falta.length ? `<br>Campos vazios na fonte: ${food.falta.length}.` : ''}`;
  folhaAlimento(null, { prefill: food, titulo: 'Produto encontrado', nota, aoSalvar: aoAlimento });
}

/** Não encontrado: com IA disponível, vai direto à foto do rótulo (salva com o código); senão, cadastro digitado. */
async function manual(codigo, aoAlimento, msg) {
  const { motorIA } = await import('../ia.js');
  const motor = await motorIA({ comImagem: true }).catch(() => null);
  if (motor === 'local' || (motor && navigator.onLine)) {
    const { folhaRotulo } = await import('./foto-ia.js');
    return folhaRotulo({ codigo, aoSalvar: aoAlimento });
  }
  aviso(msg, { ms: 7000 });
  folhaAlimento(null, { prefill: { codigo, fonte: 'rótulo', nome: '' }, titulo: 'Cadastrar produto', aoSalvar: aoAlimento });
}
