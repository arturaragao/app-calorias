// views/scanner.js — leitura de código de barras pela câmera traseira (BarcodeDetector do Chrome Android),
// com campo manual de reserva. Resolve localmente (Meus alimentos) antes de consultar o Open Food Facts.

import { abrirFolha, fecharFolha, aviso, esc } from '../ui.js';
import { catalogo } from '../custom.js';
import { limparCodigo, variantesCodigo, buscarCodigo } from '../off.js';
import { folhaAlimento } from './alimento-form.js';
import { fmtKcal, fmtMacro } from '../utils.js';

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

/** aoAlimento(food): chamado com o alimento pronto para lançar (já salvo em Meus alimentos). */
export async function abrirScanner({ aoAlimento }) {
  let stream = null, parar = false;
  const encerrar = () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const temDetector = 'BarcodeDetector' in window;
  const p = abrirFolha('Ler código de barras', `
    ${temDetector ? `<div class="camera"><video id="vid" playsinline muted></video><div class="mira"></div>
      <button class="btn peq lanterna" id="luz" hidden>🔦 Lanterna</button></div>
      <p class="mudo" id="st">Aponte a câmera para o código de barras da embalagem.</p>`
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
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (parar) return encerrar();
    const vid = p.querySelector('#vid');
    vid.srcObject = stream;
    await vid.play();
    const trilha = stream.getVideoTracks()[0];
    if (trilha.getCapabilities?.().torch) {
      const b = p.querySelector('#luz'); let ligada = false; b.hidden = false;
      b.onclick = () => { ligada = !ligada; trilha.applyConstraints({ advanced: [{ torch: ligada }] }).catch(() => {}); };
    }
    // laço de detecção (~6 vezes por segundo); exige 2 leituras iguais seguidas para evitar erro
    let anterior = '';
    const laco = async () => {
      if (parar) return;
      try {
        const cods = await det.detect(vid);
        const c = limparCodigo(cods[0]?.rawValue);
        if (c && c === anterior) {
          navigator.vibrate?.(80);
          encerrar(); fecharFolha();
          return resolver(c, aoAlimento);
        }
        anterior = c || anterior;
      } catch {}
      setTimeout(laco, 160);
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

function manual(codigo, aoAlimento, msg) {
  aviso(msg, { ms: 7000 });
  folhaAlimento(null, { prefill: { codigo, fonte: 'rótulo', nome: '' }, titulo: 'Cadastrar produto', aoSalvar: aoAlimento });
}
