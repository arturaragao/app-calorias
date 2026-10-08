// backup.js — exportar/importar todos os dados em JSON (fotos opcionais, em base64).
// Formato: { app: 'app-calorias', schemaVersion, exportadoEm, comFotos, stores: { nome: [[chave, valor], …] } }

import { db, STORES, SCHEMA_VERSION, migrar, kvGet, kvSet } from './db.js';

export const APP_ID = 'app-calorias';

// ---------- Puras ----------

/** Valida a estrutura e a versão antes de gravar. Retorna { ok, erro, contagem }. */
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, erro: 'Arquivo não é um JSON válido.' };
  if (obj.app !== APP_ID) return { ok: false, erro: 'Este arquivo não é um backup deste app.' };
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) return { ok: false, erro: 'Versão do backup ausente ou inválida.' };
  if (obj.schemaVersion > SCHEMA_VERSION) return { ok: false, erro: 'Backup feito por uma versão mais nova do app. Atualize o app antes de importar.' };
  if (!obj.stores || typeof obj.stores !== 'object') return { ok: false, erro: 'Backup sem dados.' };
  const contagem = {};
  for (const [s, linhas] of Object.entries(obj.stores)) {
    if (!STORES.includes(s)) return { ok: false, erro: `Parte desconhecida no backup: ${s}.` };
    if (!Array.isArray(linhas) || linhas.some((l) => !Array.isArray(l) || l.length !== 2 || typeof l[0] !== 'string')) {
      return { ok: false, erro: `Dados corrompidos em "${s}".` };
    }
    contagem[s] = linhas.length;
  }
  if (!obj.stores.kv?.some(([k]) => k === 'perfil')) return { ok: false, erro: 'Backup sem perfil.' };
  return { ok: true, contagem };
}

/** Aplica migrações de esquema ao conteúdo do kv de um backup antigo. */
export function migrarBackup(obj) {
  if (obj.schemaVersion === SCHEMA_VERSION) return obj;
  const kv = Object.fromEntries(obj.stores.kv);
  const novo = migrar({ kv }, obj.schemaVersion);
  return { ...obj, schemaVersion: SCHEMA_VERSION, stores: { ...obj.stores, kv: Object.entries(novo.kv) } };
}

// ---------- Fotos <-> base64 ----------

const blobParaDataURL = (b) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(b); });
const dataURLParaBlob = (u) => fetch(u).then((r) => r.blob());

// ---------- Banco ----------

export async function exportar(incluirFotos) {
  const stores = {};
  for (const s of STORES) {
    if (s === 'photos' && !incluirFotos) continue;
    let linhas = await db.getAll(s);
    if (s === 'photos') {
      linhas = await Promise.all(linhas.map(async ([k, v]) => [k, { fotos: await Promise.all(v.fotos.map(async (f) => ({ ...f, blob: await blobParaDataURL(f.blob) }))) }]));
    }
    stores[s] = linhas;
  }
  const obj = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportadoEm: new Date().toISOString(), comFotos: !!incluirFotos, stores };
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const meta = (await kvGet('meta', {})) || {};
  await kvSet('meta', { ...meta, ultimoBackup: Date.now() });
  return blob;
}

/** Substitui todos os dados pelos do backup (já validado e confirmado). Fotos só são trocadas se o backup as tiver. */
export async function importar(obj) {
  const b = migrarBackup(obj);
  for (const s of STORES) {
    if (s === 'photos' && !b.comFotos) continue;
    for (const [k] of await db.getAll(s)) await db.del(s, k);
    for (let [k, v] of b.stores[s] || []) {
      if (s === 'photos') v = { fotos: await Promise.all(v.fotos.map(async (f) => ({ ...f, blob: await dataURLParaBlob(f.blob) }))) };
      await db.put(s, k, v);
    }
  }
  const meta = (await kvGet('meta', {})) || {};
  await kvSet('meta', { ...meta, schemaVersion: SCHEMA_VERSION, ultimoBackup: Date.now() });
}

export async function apagarTudo() {
  for (const s of STORES) for (const [k] of await db.getAll(s)) await db.del(s, k);
  try { localStorage.clear(); } catch {}
}

/** { dias, nunca }: dias desde o último backup (ou desde o 1º uso, se nunca houve backup). */
export async function diasSemBackup() {
  const meta = (await kvGet('meta', {})) || {};
  const ref = meta.ultimoBackup || meta.primeiroUso;
  if (!ref) { await kvSet('meta', { ...meta, primeiroUso: Date.now() }); return { dias: 0, nunca: true }; }
  return { dias: Math.floor((Date.now() - ref) / 86400000), nunca: !meta.ultimoBackup };
}
