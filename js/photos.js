// photos.js — fotos da refeição: compressão (~1280 px, JPEG 0,7) e armazenamento no IndexedDB.
// Chave: "AAAA-MM-DD|refId" -> { fotos: [{ id, blob, obs, ts }] }

import { db } from './db.js';
import { uid } from './utils.js';

export const LADO_MAX = 1280, QUALIDADE = 0.7;

/** Dimensões finais mantendo proporção, maior lado ≤ max (pura). */
export function dimensoes(w, h, max = LADO_MAX) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export async function comprimir(arquivo) {
  const img = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(arquivo));
  const { w, h } = dimensoes(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  img.close?.();
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error('Falha ao comprimir'))), 'image/jpeg', QUALIDADE));
}

const chave = (data, refId) => `${data}|${refId}`;

export async function fotosDe(data, refId) {
  return ((await db.get('photos', chave(data, refId))) || { fotos: [] }).fotos;
}

/** Contagem de fotos por refeição de um dia (para o ícone no diário). */
export async function contagemDoDia(data) {
  const r = {};
  for (const [k, v] of await db.getAll('photos')) {
    if (k.startsWith(data + '|') && v.fotos.length) r[k.slice(data.length + 1)] = v.fotos.length;
  }
  return r;
}

export async function gravarFotos(data, refId, fotos) {
  if (fotos.length) await db.put('photos', chave(data, refId), { fotos });
  else await db.del('photos', chave(data, refId));
}

export async function adicionarFoto(data, refId, arquivo) {
  const blob = await comprimir(arquivo);
  const fotos = await fotosDe(data, refId);
  fotos.push({ id: uid(), blob, obs: '', ts: Date.now() });
  await gravarFotos(data, refId, fotos);
  return blob.size;
}

// ---------- Miniaturas (grades de fotos) ----------
const minis = new WeakMap();
/** URL de uma miniatura JPEG (lado maior `max` px) do blob; gerada uma vez por blob e guardada em memória. */
export async function urlMiniatura(blob, max = 360) {
  if (minis.has(blob)) return minis.get(blob);
  let url;
  try {
    const img = await createImageBitmap(blob);
    const { w, h } = dimensoes(img.width, img.height, max);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    img.close?.();
    url = URL.createObjectURL(await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.75)));
  } catch { url = URL.createObjectURL(blob); }
  minis.set(blob, url);
  return url;
}
