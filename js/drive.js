// drive.js — backup automático no Google Drive do Artur (sem servidor).
// Login: Google Identity Services (token OAuth de ~1 h, só no navegador). Escopo drive.file: o app só
// enxerga os arquivos que ele mesmo criou. Um único arquivo é sobrescrito; o Drive guarda versões anteriores.
// Limite do Google para app sem servidor: o token não se renova sozinho em segundo plano. Por isso o envio
// é automático enquanto houver token válido e, quando vence, o Diário mostra "tocar para enviar" (1 toque/dia).

import { exportar } from './backup.js';

export const CLIENT_ID_PADRAO = '';   // ID do cliente OAuth (público, não é segredo); também pode ser colado em Ajustes
export const NOME_ARQUIVO = 'app-calorias-backup.json';
const ESCOPO = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files', UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const LIMITE_MULTIPART = 4.5 * 1048576;
export const HORAS_ENTRE_BACKUPS = 20;      // backup "diário" (pendente após 20 h com dados alterados)
const MIN_COM_TOKEN = 10 * 60000;           // com token válido, envia mudanças no máx. a cada 10 min

// ---------- Estado local (só deste aparelho; não vai no backup) ----------

const lerLS = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const estadoDrive = () => ({ conectado: false, auto: true, fotos: false, ultimo: 0, fileId: '', clientId: '', ...lerLS('drive', {}) });
export const salvarEstadoDrive = (mud) => gravarLS('drive', { ...estadoDrive(), ...mud });
export const clientId = () => estadoDrive().clientId || CLIENT_ID_PADRAO;
const alteradoEm = () => Number(lerLS('alteradoEm', 0)) || 0;

// ---------- Puras (testáveis) ----------

/** Backup pendente: conectado, automático, dados mudaram desde o último envio e já passou o intervalo. */
export function backupDevido(st, alterado, agora, minMs = HORAS_ENTRE_BACKUPS * 3600000) {
  return !!(st.conectado && st.auto && alterado > (st.ultimo || 0) && agora - (st.ultimo || 0) >= minMs);
}

/** Corpo multipart/related do upload do Drive (metadados JSON + conteúdo). */
export function montarMultipart(meta, conteudo, fronteira = 'calorias' + Math.random().toString(36).slice(2)) {
  const partes = [
    `--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${fronteira}\r\nContent-Type: application/json\r\n\r\n`, conteudo, `\r\n--${fronteira}--`,
  ];
  return { partes, tipo: `multipart/related; boundary=${fronteira}` };
}

// ---------- Token (Google Identity Services) ----------

let gisCarregando = null;
function carregarGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return (gisCarregando ||= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = ok; s.onerror = () => { gisCarregando = null; erro(new Error('Não foi possível carregar o login do Google (sem internet?).')); };
    document.head.appendChild(s);
  }));
}

export function tokenValido() {
  const t = lerLS('driveToken', null);
  return t && t.exp > Date.now() + 60000 ? t.t : null;
}

/** Pede um token. `interativo` = chamado por um toque (o Google abre uma janelinha que fecha sozinha se já autorizado). */
export async function obterToken({ interativo = false, consentir = false } = {}) {
  const val = tokenValido();
  if (val) return val;
  if (!interativo) return null;
  const id = clientId();
  if (!id) throw new Error('Falta o ID do cliente do Google (Ajustes › Backup no Google Drive).');
  await carregarGIS();
  return new Promise((ok, erro) => {
    const cli = google.accounts.oauth2.initTokenClient({
      client_id: id, scope: ESCOPO,
      callback: (r) => {
        if (r.error || !r.access_token) return erro(new Error('Login do Google não concluído.'));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, ESCOPO)) return erro(new Error('Permita o acesso ao Drive para fazer o backup.'));
        gravarLS('driveToken', { t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
        ok(r.access_token);
      },
      error_callback: (e) => erro(new Error(e?.type === 'popup_closed' ? 'Janela do Google fechada.' : 'Login do Google bloqueado ou cancelado.')),
    });
    cli.requestAccessToken({ prompt: consentir ? 'consent' : '' });
  });
}

export function desconectar() {
  const t = tokenValido();
  try { if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {}); } catch {}
  try { localStorage.removeItem('driveToken'); } catch {}
  salvarEstadoDrive({ conectado: false, fileId: '' });
}

// ---------- Drive ----------

async function req(url, opcoes, token) {
  const r = await fetch(url, { ...opcoes, headers: { Authorization: `Bearer ${token}`, ...(opcoes?.headers || {}) } });
  if (r.status === 401) { try { localStorage.removeItem('driveToken'); } catch {} throw new Error('Sessão do Google expirou. Toque de novo para enviar.'); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(`Drive: ${j?.error?.message || 'erro ' + r.status}`), { status: r.status }); }
  return r;
}

/** Arquivo de backup mais recente criado por este app ({ id, modifiedTime, size } ou null). */
export async function acharArquivo(token) {
  const q = encodeURIComponent(`name='${NOME_ARQUIVO}' and trashed=false`);
  const r = await req(`${API}?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(id,modifiedTime,size)`, {}, token);
  return (await r.json()).files?.[0] || null;
}

async function subir(token, blob, fileId) {
  const meta = fileId ? {} : { name: NOME_ARQUIVO, mimeType: 'application/json', description: 'Backup do app de calorias (substituído a cada envio; o Drive guarda versões).' };
  const metodo = fileId ? 'PATCH' : 'POST', base = fileId ? `${UPLOAD}/${fileId}` : UPLOAD;
  if (blob.size <= LIMITE_MULTIPART) {
    const { partes, tipo } = montarMultipart(meta, blob);
    const r = await req(`${base}?uploadType=multipart&fields=id`, { method: metodo, headers: { 'Content-Type': tipo }, body: new Blob(partes) }, token);
    return (await r.json()).id;
  }
  // arquivo grande (com fotos): upload "resumable" em uma única etapa
  const ini = await req(`${base}?uploadType=resumable&fields=id`, { method: metodo,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' }, body: JSON.stringify(meta) }, token);
  const destino = ini.headers.get('Location');
  if (!destino) throw new Error('Drive não liberou o envio do arquivo grande. Tente sem fotos.');
  const r = await fetch(destino, { method: 'PUT', body: blob });
  if (!r.ok) throw new Error('Falha ao enviar o arquivo grande ao Drive.');
  return (await r.json()).id;
}

let enviando = null;
/** Exporta tudo e envia ao Drive (sobrescreve o arquivo). Devolve o tamanho em bytes. */
export function enviarBackup(token) {
  return (enviando ||= (async () => {
    try {
      const st = estadoDrive();
      const blob = await exportar(st.fotos);
      let id = st.fileId;
      try { id = await subir(token, blob, id || (await acharArquivo(token))?.id); }
      catch (e) { if (e.status !== 404 || !id) throw e; id = await subir(token, blob, null); }   // arquivo apagado no Drive: cria outro
      salvarEstadoDrive({ fileId: id, ultimo: Date.now(), conectado: true });
      return blob.size;
    } finally { enviando = null; }
  })());
}

/** Baixa o backup do Drive (objeto JSON) e a data dele. */
export async function baixarBackup(token) {
  const arq = await acharArquivo(token);
  if (!arq) throw new Error('Nenhum backup deste app encontrado no seu Drive.');
  const r = await req(`${API}/${arq.id}?alt=media`, {}, token);
  return { obj: await r.json(), quando: arq.modifiedTime, id: arq.id };
}

// ---------- Automático ----------

/** Envia em silêncio se há token válido e dados novos. Chamado ao abrir e ao sair do app. */
export async function tentarAuto() {
  const st = estadoDrive(), token = tokenValido();
  if (!token || !navigator.onLine || !backupDevido(st, alteradoEm(), Date.now(), MIN_COM_TOKEN)) return false;
  try { await enviarBackup(token); return true; } catch (e) { console.warn('Backup automático no Drive falhou', e); return false; }
}

/** Para o aviso do Diário: backup diário vencido e sem token (precisa de um toque). */
export const pendenteToque = () => !tokenValido() && backupDevido(estadoDrive(), alteradoEm(), Date.now());
