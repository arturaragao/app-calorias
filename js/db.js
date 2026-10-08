// db.js — armazenamento: IndexedDB com fallback para localStorage e migração de esquema.
// API mínima: get/put/del/getAll por "store". As stores já existem para as próximas etapas.

export const SCHEMA_VERSION = 1;
const DB_NOME = 'app-calorias';
export const STORES = ['kv', 'diary', 'customFoods', 'recipes', 'weights', 'water', 'circumferences', 'skinfolds', 'photos'];

// ---------- Migração (pura, testável) ----------
// Cada função recebe o "estado" { kv: {chave: valor}, ... } e devolve o estado na versão seguinte.
export const MIGRACOES = {
  // 0 -> 1: estado inicial; garante meta.schemaVersion.
  1: (estado) => ({ ...estado, kv: { ...(estado.kv || {}), meta: { ...(estado.kv?.meta || {}), schemaVersion: 1 } } }),
};

export function migrar(estado, de, ate = SCHEMA_VERSION) {
  let e = estado;
  for (let v = de + 1; v <= ate; v++) {
    if (!MIGRACOES[v]) throw new Error(`Migração ausente para a versão ${v}`);
    e = MIGRACOES[v](e);
  }
  return e;
}

// ---------- Backend IndexedDB ----------

function abrirIDB() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
    req.onblocked = () => erro(new Error('Banco bloqueado por outra aba'));
  });
}

function idbBackend(db) {
  const tx = (store, modo, fn) => new Promise((ok, erro) => {
    const t = db.transaction(store, modo);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error || new Error('Transação abortada'));
  });
  return {
    tipo: 'indexeddb',
    get: (s, k) => tx(s, 'readonly', (o) => o.get(k)),
    put: (s, k, v) => tx(s, 'readwrite', (o) => o.put(v, k)).then(() => v),
    del: (s, k) => tx(s, 'readwrite', (o) => o.delete(k)),
    async getAll(s) {
      const [keys, vals] = await Promise.all([tx(s, 'readonly', (o) => o.getAllKeys()), tx(s, 'readonly', (o) => o.getAll())]);
      return keys.map((k, i) => [k, vals[i]]);
    },
  };
}

// ---------- Backend localStorage (fallback para o essencial) ----------

function lsBackend() {
  const chave = (s) => `${DB_NOME}:${s}`;
  const ler = (s) => { try { return JSON.parse(localStorage.getItem(chave(s)) || '{}'); } catch { return {}; } };
  const gravar = (s, o) => localStorage.setItem(chave(s), JSON.stringify(o));
  return {
    tipo: 'localStorage',
    get: async (s, k) => ler(s)[k],
    async put(s, k, v) { if (s === 'photos') throw new Error('Fotos exigem IndexedDB'); const o = ler(s); o[k] = v; gravar(s, o); return v; },
    async del(s, k) { const o = ler(s); delete o[k]; gravar(s, o); },
    getAll: async (s) => Object.entries(ler(s)),
  };
}

function memoriaBackend() {
  const m = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return {
    tipo: 'memoria',
    get: async (s, k) => m[s].get(k),
    put: async (s, k, v) => (m[s].set(k, v), v),
    del: async (s, k) => { m[s].delete(k); },
    getAll: async (s) => [...m[s].entries()],
  };
}

// ---------- Inicialização ----------

export let db = null;

/** Grava em localStorage a hora da última alteração (o backup automático no Drive só envia se houver novidade). */
function marcarAlteracoes(b) {
  const marca = () => { try { localStorage.setItem('alteradoEm', String(Date.now())); } catch {} };
  const { put, del } = b;
  b.put = async (...a) => { const r = await put(...a); marca(); return r; };
  b.del = async (...a) => { const r = await del(...a); marca(); return r; };
}

export async function iniciarDB() {
  try {
    db = idbBackend(await abrirIDB());
  } catch (e) {
    console.warn('IndexedDB indisponível, usando localStorage', e);
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); db = lsBackend(); }
    catch { db = memoriaBackend(); }
  }
  marcarAlteracoes(db);
  // migração de esquema
  const meta = (await db.get('kv', 'meta')) || {};
  const v = meta.schemaVersion || 0;
  if (v < SCHEMA_VERSION) {
    const kv = Object.fromEntries(await db.getAll('kv'));
    const novo = migrar({ kv }, v);
    for (const [k, val] of Object.entries(novo.kv)) await db.put('kv', k, val);
  }
  // pedir armazenamento persistente (evita o navegador apagar os dados)
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
  return db;
}

export const kvGet = (k, padrao = null) => db.get('kv', k).then((v) => (v === undefined ? padrao : v));
export const kvSet = (k, v) => db.put('kv', k, v);
