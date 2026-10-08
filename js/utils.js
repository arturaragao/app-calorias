// utils.js — funções puras: datas locais, formatação pt-BR, normalização de texto.
// Sem DOM: importável pelos testes em Node.

// ---------- Datas (sempre locais, nunca UTC) ----------

/** Chave AAAA-MM-DD a partir de um Date, no fuso local. */
export function chaveData(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Date local (meio-dia, evita bordas de horário de verão) a partir de AAAA-MM-DD. */
export function dataDeChave(chave) {
  const [y, m, d] = chave.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function somarDias(chave, n) {
  const d = dataDeChave(chave);
  d.setDate(d.getDate() + n);
  return chaveData(d);
}

/** Dia da semana com segunda = 0 … domingo = 6. */
export function diaSemana(chave) {
  return (dataDeChave(chave).getDay() + 6) % 7;
}

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DIAS_CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/** dd/mm/aaaa */
export function fmtData(chave) {
  const [y, m, d] = chave.split('-');
  return `${d}/${m}/${y}`;
}

/** Idade em anos completos numa data de referência. */
export function idadeEm(nascimento, refChave = chaveData()) {
  const n = dataDeChave(nascimento), r = dataDeChave(refChave);
  let idade = r.getFullYear() - n.getFullYear();
  if (r.getMonth() < n.getMonth() || (r.getMonth() === n.getMonth() && r.getDate() < n.getDate())) idade--;
  return idade;
}

// ---------- Números (precisão total; arredondar só na exibição) ----------

const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtN = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

export const fmtKcal = (v) => (v == null ? '—' : fmt0.format(Math.round(v)));
export const fmtMacro = (v) => (v == null ? '—' : fmt1.format(v));
export const fmtMg = (v) => (v == null ? '—' : fmt0.format(Math.round(v)));
export const fmtNum = (v) => (v == null || v === '' || Number.isNaN(v) ? '' : fmtN.format(v));

/** Aceita "12,5", "12.5", "2.759" (milhar) e "2.759,5"; retorna NaN se inválido. */
export function lerNumero(txt) {
  if (typeof txt === 'number') return txt;
  let t = String(txt ?? '').trim().replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (t === '' || !/^-?\d*\.?\d+$/.test(t)) return NaN;
  return Number(t);
}

// ---------- Texto ----------

/** Minúsculas, sem acento, só letras/números separados por espaço. */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
