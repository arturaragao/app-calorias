// coach.js — números agregados da semana para o coach (IA). Só médias, metas, contagens e peso:
// nenhum nome de alimento, nota de texto ou dado pessoal identificável sai do aparelho. (lógica pura, testada)

const r0 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v));
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

/**
 * rel / relAnt: resultados de relatorioSemana (semana analisada e a anterior).
 * perfil: { objetivo, ritmo }; pesoKg: peso usado para g/kg; tags: { etiqueta: nº de dias }.
 */
export function numerosCoach({ rel, relAnt = null, perfil = {}, pesoKg = null, tags = {} }) {
  const c = rel.medias.consumo, m = rel.medias.meta;
  return {
    semana: { inicio: rel.inicio, fim: rel.fim },
    dias_registrados: rel.registrados,
    media_diaria: { kcal: r0(c.kcal), proteina_g: r0(c.prot), carboidrato_g: r0(c.carb), gordura_g: r0(c.gord), fibra_g: r0(c.fibra), sodio_mg: r0(c.sodio_mg) },
    meta_diaria: { kcal: r0(m.kcal), proteina_g: r0(m.prot), carboidrato_g: r0(m.carb), gordura_g: r0(m.gord) },
    proteina_g_por_kg: pesoKg > 0 ? r1(c.prot / pesoKg) : null,
    dias_na_meta_kcal_10pct: rel.aderencia.dentro, dias_acima: rel.aderencia.acima, dias_abaixo: rel.aderencia.abaixo,
    peso_tendencia_kg: r1(rel.pesoFim), variacao_peso_semana_kg: r1(rel.deltaPeso),
    objetivo: perfil.objetivo || null, ritmo_planejado_kg_semana: perfil.objetivo && perfil.objetivo !== 'manter' ? r1(perfil.ritmo) : 0,
    semana_anterior: relAnt?.registrados ? { dias_registrados: relAnt.registrados, media_kcal: r0(relAnt.medias.consumo.kcal), dias_na_meta: relAnt.aderencia.dentro } : null,
    etiquetas_dias: tags,
  };
}

/** Conta etiquetas por dia na lista de anotações ({ tags }) — sem o texto das notas. */
export function contarEtiquetas(anotacoes) {
  const t = {};
  for (const a of anotacoes) for (const tag of a.tags || []) t[tag] = (t[tag] || 0) + 1;
  return t;
}

/** Guarda a resposta da semana e mantém só as 12 semanas mais recentes. */
export function guardarResposta(cache = {}, inicio, resposta) {
  const novo = { ...cache, [inicio]: resposta };
  return Object.fromEntries(Object.entries(novo).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 12));
}
