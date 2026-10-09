// instantaneos.js — cópia automática local, uma por dia (as últimas 7), num banco IndexedDB separado
// ("calorias-instantaneos"): não entra no backup, não conta como "último backup" e sobrevive a um erro de importação
// ou a um "apagar" sem querer. Sem fotos (para caber). Restaurar em Ajustes › Cópias automáticas.

import { montarBackup } from './backup.js';
import { chaveData } from './utils.js';

const NOME = 'calorias-instantaneos', STORE = 'copias', MAX = 7;

function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
const tx = async (modo, fn) => {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const t = db.transaction(STORE, modo), st = t.objectStore(STORE);
    const req = fn(st);
    t.oncomplete = () => { db.close(); ok(req?.result); };
    t.onerror = () => { db.close(); erro(t.error); };
  });
};

/** Quais cópias apagar para ficar com as `max` mais recentes (pura). */
export const sobrando = (datas, max = MAX) => [...datas].sort().reverse().slice(max);

/** Faz a cópia de hoje, se ainda não houver (chamada ao abrir o app, em momento ocioso). */
export async function talvezCopiaDoDia({ temDados = true } = {}) {
  if (!temDados || !('indexedDB' in self)) return null;
  const hoje = chaveData();
  try { if (localStorage.getItem('copiaDoDia') === hoje) return null; } catch {}
  const json = JSON.stringify(await montarBackup(false));
  await tx('readwrite', (st) => st.put({ data: hoje, ts: Date.now(), tamanho: json.length, json }, hoje));
  const datas = await tx('readonly', (st) => st.getAllKeys());
  for (const d of sobrando(datas)) await tx('readwrite', (st) => st.delete(d));
  try { localStorage.setItem('copiaDoDia', hoje); } catch {}
  return hoje;
}

/** [{ data, ts, tamanho }] das cópias, mais recentes primeiro. */
export async function listarCopias() {
  const l = await tx('readonly', (st) => st.getAll());
  return (l || []).map(({ json, ...m }) => m).sort((a, b) => (a.data < b.data ? 1 : -1));
}

/** Objeto de backup da cópia do dia `data` (para importar). */
export async function lerCopia(data) {
  const c = await tx('readonly', (st) => st.get(data));
  return c ? JSON.parse(c.json) : null;
}
