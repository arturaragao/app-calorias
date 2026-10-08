// state.js — estado em memória compartilhado pelas telas + persistência no kv.

import { kvGet, kvSet, db } from './db.js';
import { REFEICOES_PADRAO, diaVazio } from './diary.js';
import { chaveData } from './utils.js';

export const estado = {
  perfil: null,      // {sexo, nascimento, altura, peso, atividade, objetivo, ritmo}
  metas: null,       // ver goals.js
  config: null,      // {tema, refeicoes, ultimaQtd, porcoesUsuario, recalcularComPeso}
  dataAtual: chaveData(),
  refeicaoAlvo: null, // refeição escolhida ao abrir "Adicionar"
};

export const CONFIG_PADRAO = {
  tema: 'sistema',
  refeicoes: REFEICOES_PADRAO,
  ultimaQtd: {},
  porcoesUsuario: {},
  recalcularComPeso: false,
};

export async function carregarEstado() {
  estado.perfil = await kvGet('perfil');
  estado.metas = await kvGet('metas');
  estado.config = { ...CONFIG_PADRAO, ...(await kvGet('config', {})) };
}

export const salvarPerfil = (p) => kvSet('perfil', (estado.perfil = p));
export const salvarMetas = (m) => kvSet('metas', (estado.metas = m));
export const salvarConfig = () => kvSet('config', estado.config);

export async function lerDia(chave) {
  return (await db.get('diary', chave)) || diaVazio(chave);
}
export const gravarDia = (dia) => db.put('diary', dia.data, dia);

/** Peso atual: último registro de peso (Etapa 3) ou o do perfil. */
export async function pesoAtual() {
  const regs = await db.getAll('weights');
  if (regs.length) {
    regs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const ult = regs[regs.length - 1][1];
    return Array.isArray(ult) ? ult[ult.length - 1].kg : ult.kg;
  }
  return estado.perfil?.peso || 0;
}
