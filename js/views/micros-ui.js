// views/micros-ui.js — tabela de micronutrientes (detalhe do dia e médias do Progresso).

import { MICROS, refMicro, somarMicros } from '../micros.js';
import { estado } from '../state.js';
import { idadePerfil } from './onboarding.js';
import { fmtNum } from '../utils.js';

const fmt = (v, un) => fmtNum(v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100) + ' ' + un;

/** itens: itens do diário; dias: nº de dias para a média (1 = um dia); base: base de alimentos (para itens antigos sem snapshot). */
export function tabelaMicros(itens, dias = 1, base = null) {
  const micDe = (it) => it.por100?.mic || (it.foodId && base?.porId.get(it.foodId)?.mic) || null;
  const { tot, cobertura } = somarMicros(itens, micDe);
  if (!cobertura) return '';
  const p = estado.perfil || {};
  const idade = idadePerfil(p) || 30;
  return `<details class="micros"><summary>Micronutrientes${dias > 1 ? ' (média por dia)' : ''}</summary>
    <table class="tabela num"><tr><th>Nutriente</th><th>${dias > 1 ? 'Média' : 'Consumido'}</th><th>Referência</th><th>%</th></tr>
    ${MICROS.map((m) => {
      const v = tot[m[0]] / dias, ref = refMicro(m, p.sexo, idade);
      const pct = ref ? Math.round((v / ref) * 100) : null;
      return `<tr><td>${m[1]}</td><td><b>${fmt(v, m[2])}</b></td><td>${ref ? fmt(ref, m[2]) : '—'}</td>
        <td class="${pct != null && pct < 70 ? 'baixo' : ''}">${pct != null ? pct + '%' : ''}</td></tr>`;
    }).join('')}</table>
    <p class="mudo">Valores da TACO/TBCA; ${fmtNum(Math.round(cobertura * 100))}% das calorias vêm de alimentos com esses dados (rótulos, receitas e adições rápidas não entram,
    então os totais podem estar subestimados). “Tr” (traço) conta como 0. Referência: DRI (IOM/NASEM) para ${p.sexo === 'F' ? 'mulheres' : 'homens'} adultos.</p></details>`;
}
