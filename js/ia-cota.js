// ia-cota.js — limite diário de chamadas ao Gemini contado pelo próprio app (por aparelho, zera à meia-noite local).
// A API não informa a cota restante; este limite do app evita esbarrar na cota gratuita e deixa o uso visível.

import { chaveData } from './utils.js';

const USO_LS = 'iaUso', LIMITE_LS = 'iaLimite';
export const LIMITE_PADRAO = 20;

const ler = (s, k) => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const gravar = (s, k, v) => { try { s?.setItem(k, v); } catch {} };
const armazem = () => (typeof localStorage !== 'undefined' ? localStorage : null);

export function limiteDiario(s = armazem()) {
  const v = Number(ler(s, LIMITE_LS));
  return v >= 1 && v <= 500 ? Math.round(v) : LIMITE_PADRAO;
}
export const definirLimite = (n, s = armazem()) => gravar(s, LIMITE_LS, String(Math.round(n)));

/** Chamadas usadas hoje (data local). */
export function usoHoje(s = armazem(), hoje = chaveData()) {
  try { const u = JSON.parse(ler(s, USO_LS)); return u?.data === hoje ? u.n : 0; } catch { return 0; }
}
export const restantesHoje = (s = armazem(), hoje = chaveData()) => Math.max(0, limiteDiario(s) - usoHoje(s, hoje));

export function registrarUso(s = armazem(), hoje = chaveData()) {
  gravar(s, USO_LS, JSON.stringify({ data: hoje, n: usoHoje(s, hoje) + 1 }));
}
