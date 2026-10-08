// views/drive-ui.js — cartão "Backup no Google Drive" (Ajustes), restaurar (Ajustes e primeiro uso) e envio com um toque.

import { validarBackup, importar } from '../backup.js';
import { estadoDrive, salvarEstadoDrive, clientId, obterToken, enviarBackup, baixarBackup, desconectar } from '../drive.js';
import { $, aviso } from '../ui.js';

const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const quando = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Confirma com resumo e substitui os dados pelo backup (arquivo ou Drive). */
export async function confirmarEImportar(obj, origem = '') {
  const v = validarBackup(obj);
  if (!v.ok) return aviso(v.erro, { ms: 8000 });
  const c = v.contagem;
  const resumo = `Backup${origem} de ${obj.exportadoEm ? new Date(obj.exportadoEm).toLocaleString('pt-BR') : '?'}:\n` +
    `${c.diary || 0} dia(s) de diário, ${c.customFoods || 0} alimento(s), ${c.recipes || 0} receita(s), ${c.weights || 0} dia(s) de peso, ` +
    `${c.skinfolds || 0} avaliação(ões) de dobras${obj.comFotos ? `, ${c.photos || 0} refeição(ões) com foto` : ' (sem fotos: as fotos atuais serão mantidas)'}.\n\n` +
    'Isso SUBSTITUI os dados atuais deste aparelho. Continuar?';
  if (!confirm(resumo)) return;
  try {
    await importar(obj);
    try { sessionStorage.setItem('importado', '1'); } catch {}
    location.hash = '#diario';
    location.reload();
  } catch (err) { console.error(err); aviso('Falha ao importar: ' + err.message, { ms: 8000 }); }
}

/** Restaurar do Drive (pede login com um toque). */
export async function restaurarDoDrive() {
  try {
    const token = await obterToken({ interativo: true, consentir: !estadoDrive().conectado });
    aviso('Baixando backup do Drive…', { ms: 15000 });
    const { obj, id } = await baixarBackup(token);
    salvarEstadoDrive({ conectado: true, fileId: id });
    await confirmarEImportar(obj, ' do Google Drive');
  } catch (e) { aviso(e.message, { ms: 8000 }); }
}

/** Envio manual ou pelo aviso do Diário. */
export async function enviarAgora({ consentir = false } = {}) {
  const token = await obterToken({ interativo: true, consentir });
  aviso('Enviando backup ao Drive…', { ms: 15000 });
  const tam = await enviarBackup(token);
  aviso(`Backup salvo no Google Drive (${kb(tam)})`);
}

// ---------- Cartão em Ajustes ----------

export function cartaoDrive() {
  return `<div class="card" id="drive"><h2 style="margin-bottom:6px">Backup no Google Drive</h2><div id="drive-corpo"></div></div>`;
}

export function ligarCartaoDrive(tela, aoMudar) {
  const raiz = $('#drive', tela);
  const desenhar = () => {
    const st = estadoDrive(), id = clientId();
    $('#drive-corpo', raiz).innerHTML = !id ? `
      <p class="mudo" style="margin-top:0">Para ligar, cole o <b>ID do cliente OAuth</b> do Google (termina em <i>.apps.googleusercontent.com</i>; passo a passo no README).</p>
      <form id="f-cid" class="linha"><input type="text" name="cid" placeholder="123…apps.googleusercontent.com" autocomplete="off" style="flex:1">
        <button class="btn prim">Salvar</button></form>` : !st.conectado ? `
      <p class="mudo" style="margin-top:0">Guarda uma cópia de tudo no seu Drive, uma vez por dia, para trocar de celular sem perder nada.
        O app só vê o próprio arquivo de backup.</p>
      <div class="grade2"><button class="btn prim" data-dr="conectar">Conectar ao Drive</button>
        <button class="btn" data-dr="restaurar">Restaurar do Drive</button></div>
      <button class="btn peq suave" data-dr="trocar-id" style="margin-top:8px">Trocar ID do cliente</button>` : `
      <p class="mudo" style="margin-top:0">${st.ultimo ? `Último envio: ${quando(st.ultimo)}.` : 'Conectado. Nenhum envio ainda.'}</p>
      <label class="linha" style="margin-bottom:6px"><input type="checkbox" data-dr-op="auto" ${st.auto ? 'checked' : ''} style="flex:0;width:22px;height:22px"><span>Backup automático diário</span></label>
      <label class="linha" style="margin-bottom:8px"><input type="checkbox" data-dr-op="fotos" ${st.fotos ? 'checked' : ''} style="flex:0;width:22px;height:22px"><span>Incluir fotos (arquivo maior)</span></label>
      <div class="grade2"><button class="btn prim" data-dr="enviar">Enviar agora</button>
        <button class="btn" data-dr="restaurar">Restaurar do Drive</button></div>
      <button class="btn peq suave" data-dr="desconectar" style="margin-top:8px">Desconectar</button>
      <p class="mudo">Envia sozinho quando o app está aberto e há novidades. O Google exige login a cada ~1 h em apps sem servidor:
        quando vencer, o Diário mostra “☁️ tocar para enviar” (um toque por dia, no máximo).</p>`;
  };
  desenhar();
  raiz.onsubmit = (e) => {
    e.preventDefault();
    const cid = e.target.cid.value.trim();
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(cid)) return aviso('ID inválido: deve terminar em .apps.googleusercontent.com');
    salvarEstadoDrive({ clientId: cid }); desenhar();
  };
  raiz.onchange = (e) => {
    const op = e.target.dataset.drOp;
    if (op) salvarEstadoDrive({ [op]: e.target.checked });
  };
  raiz.onclick = async (e) => {
    const b = e.target.closest('[data-dr]');
    if (!b) return;
    const op = b.dataset.dr;
    if (op === 'restaurar') return restaurarDoDrive();
    if (op === 'trocar-id') { salvarEstadoDrive({ clientId: '' }); return desenhar(); }
    if (op === 'desconectar') {
      if (!confirm('Desconectar do Drive? O backup que já está lá não é apagado.')) return;
      desconectar(); return desenhar();
    }
    b.disabled = true;
    try { await enviarAgora({ consentir: op === 'conectar' }); salvarEstadoDrive({ conectado: true }); aoMudar?.(); }
    catch (err) { aviso(err.message, { ms: 8000 }); }
    b.disabled = false;
    desenhar();
  };
}

/** Bloco "Trocou de celular?" do primeiro uso. */
export function blocoRestaurarInicio() {
  return `<div class="card" id="rest-ini"><h2 style="margin-bottom:6px">Trocou de celular?</h2>
    <p class="mudo" style="margin-top:0">Recupere seus dados antes de preencher o perfil.</p>
    <div class="grade2"><button type="button" class="btn" data-rest="drive" ${clientId() ? '' : 'hidden'}>Do Google Drive</button>
      <label class="btn">De um arquivo<input type="file" accept=".json,application/json" hidden></label></div></div>`;
}

export function ligarRestaurarInicio(tela) {
  const r = $('#rest-ini', tela);
  if (!r) return;
  r.querySelector('[data-rest=drive]').onclick = restaurarDoDrive;
  r.querySelector('input[type=file]').onchange = async (e) => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    try { await confirmarEImportar(JSON.parse(await arq.text())); } catch { aviso('Arquivo não é um JSON válido.'); }
  };
}

