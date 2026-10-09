// micros.js — micronutrientes da TACO (por 100 g em food.mic) e referências de ingestão diária.
// Referências: Dietary Reference Intakes (Institute of Medicine / National Academies), adultos 19–50 anos:
// RDA para Ca, Fe, Mg, P, Zn, vitaminas A, C, B1, B2, B6, niacina; potássio = AI (NASEM, DRI for Sodium and Potassium, 2019).
// Colesterol não tem meta (só exibido).

export const MICROS = [
  // [campo, nome, unidade, ref homem, ref mulher]
  ['calcio_mg', 'Cálcio', 'mg', 1000, 1000],
  ['ferro_mg', 'Ferro', 'mg', 8, 18],
  ['magnesio_mg', 'Magnésio', 'mg', 400, 310],
  ['fosforo_mg', 'Fósforo', 'mg', 700, 700],
  ['potassio_mg', 'Potássio', 'mg', 3400, 2600],
  ['zinco_mg', 'Zinco', 'mg', 11, 8],
  ['vita_ug', 'Vitamina A (RAE)', 'µg', 900, 700],
  ['vitc_mg', 'Vitamina C', 'mg', 90, 75],
  ['tiamina_mg', 'Tiamina (B1)', 'mg', 1.2, 1.1],
  ['riboflavina_mg', 'Riboflavina (B2)', 'mg', 1.3, 1.1],
  ['piridoxina_mg', 'Piridoxina (B6)', 'mg', 1.3, 1.3],
  ['niacina_mg', 'Niacina (B3)', 'mg', 16, 14],
  ['colest_mg', 'Colesterol', 'mg', null, null],
];

export const refMicro = (m, sexo, idade = 30) => {
  if (m[0] === 'magnesio_mg' && idade > 30) return sexo === 'F' ? 320 : 420;
  return sexo === 'F' ? m[4] : m[3];
};

/**
 * Soma os micronutrientes de uma lista de itens do diário. `micDe(item)` devolve o objeto mic por 100 g
 * (snapshot do item ou, para itens antigos, o do alimento atual da base). Retorna { tot, cobertura } —
 * cobertura = fração das kcal que vêm de itens com dados de micronutrientes.
 */
export function somarMicros(itens, micDe = (it) => it.por100?.mic) {
  const tot = Object.fromEntries(MICROS.map(([k]) => [k, 0]));
  let kcalTotal = 0, kcalCom = 0;
  for (const it of itens) {
    const k = it.n?.kcal || 0;
    kcalTotal += k;
    const mic = micDe(it);
    if (!mic || !it.g) continue;
    kcalCom += k;
    for (const [c] of MICROS) if (mic[c] != null) tot[c] += (mic[c] * it.g) / 100;
  }
  return { tot, cobertura: kcalTotal ? kcalCom / kcalTotal : 0 };
}
