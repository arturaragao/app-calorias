// body.js — composição corporal e medidas (funções puras, testadas em tests/run.js).

// ---------- Sítios de dobras ----------
export const SITIOS = {
  peitoral: 'Peitoral', axilar: 'Axilar média', triceps: 'Tríceps', biceps: 'Bíceps', subescapular: 'Subescapular',
  abdominal: 'Abdominal', suprailiaca: 'Suprailíaca', coxa: 'Coxa', lombar: 'Lombar', panturrilha: 'Panturrilha',
};

/** Siri WE (1961): %G = 495 / densidade − 450. */
export const siri = (dc) => 495 / dc - 450;

/**
 * Durnin JVGA, Womersley J. Br J Nutr 1974;32:77-97 (tabela 4): DC = c − m·log10(soma de 4 dobras).
 * Faixas etárias: [idade mínima, c, m]. Abaixo da 1ª faixa usa a 1ª (fora da validação do estudo).
 */
const DW = {
  M: [[17, 1.1620, 0.0630], [20, 1.1631, 0.0632], [30, 1.1422, 0.0544], [40, 1.1620, 0.0700], [50, 1.1715, 0.0779]],
  F: [[16, 1.1549, 0.0678], [20, 1.1599, 0.0717], [30, 1.1423, 0.0632], [40, 1.1333, 0.0612], [50, 1.1339, 0.0645]],
};
export function coefDW(sexo, idade) {
  const t = DW[sexo === 'F' ? 'F' : 'M'];
  let r = t[0];
  for (const l of t) if (idade >= l[0]) r = l;
  return { c: r[1], m: r[2] };
}

/**
 * Protocolos. `sitios(sexo)` lista os sítios exigidos; `calc(soma, {sexo, idade, peso})` -> {dc?, pct}.
 * Jackson AS, Pollock ML. Br J Nutr 1978;40:497-504 (homens, 7 e 3 dobras).
 * Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc 1980;12:175-181 (mulheres, 7 e 3 dobras).
 * Parrillo: %G = soma (mm) × 27 ÷ peso (lb) — fórmula de prática de academia, pouco validada.
 */
export const PROTOCOLOS = {
  parrillo: {
    nome: '9 dobras (Parrillo)',
    sitios: () => ['peitoral', 'abdominal', 'coxa', 'biceps', 'triceps', 'subescapular', 'suprailiaca', 'lombar', 'panturrilha'],
    calc: (s, { peso }) => ({ pct: (s * 27) / (peso * 2.20462) }),
  },
  pollock7: {
    nome: 'Pollock 7 dobras',
    sitios: () => ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    calc: (s, { sexo, idade }) => {
      const dc = sexo === 'F'
        ? 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade
        : 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade;
      return { dc, pct: siri(dc) };
    },
  },
  pollock3: {
    nome: 'Pollock 3 dobras',
    sitios: (sexo) => (sexo === 'F' ? ['triceps', 'suprailiaca', 'coxa'] : ['peitoral', 'abdominal', 'coxa']),
    calc: (s, { sexo, idade }) => {
      const dc = sexo === 'F'
        ? 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * idade
        : 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * idade;
      return { dc, pct: siri(dc) };
    },
  },
  durnin: {
    nome: 'Durnin-Womersley 4 dobras',
    sitios: () => ['biceps', 'triceps', 'subescapular', 'suprailiaca'],
    calc: (s, { sexo, idade }) => {
      const { c, m } = coefDW(sexo, idade);
      const dc = c - m * Math.log10(s);
      return { dc, pct: siri(dc) };
    },
  },
  personalizado: {
    nome: 'Personalizado (só soma)',
    sitios: () => [],                 // definidos pelo usuário
    calc: () => ({ pct: null }),
  },
};

/**
 * Calcula um registro de dobras. valores: {sitio: mm}. Retorna soma, %G, massa gorda e magra (kg).
 * Lança erro se faltar sítio exigido.
 */
export function calcularDobras(protocolo, valores, { sexo, idade, peso }, sitiosPers = []) {
  const p = PROTOCOLOS[protocolo];
  const sitios = protocolo === 'personalizado' ? sitiosPers : p.sitios(sexo);
  const faltam = sitios.filter((k) => !(valores[k] > 0));
  if (faltam.length) throw new Error('Faltam: ' + faltam.map((k) => SITIOS[k] || k).join(', '));
  const soma = sitios.reduce((s, k) => s + valores[k], 0);
  const { dc = null, pct } = p.calc(soma, { sexo, idade, peso });
  const mGorda = pct != null && peso ? (peso * pct) / 100 : null;
  return { soma, dc, pct, mGorda, mMagra: mGorda != null ? peso - mGorda : null, sitios };
}

// ---------- Faixas plausíveis (pedem confirmação, não bloqueiam) ----------
export const FAIXAS = { peso: [30, 300], dobra: [1, 80], circ: [10, 250] };
export const foraDaFaixa = (tipo, v) => v < FAIXAS[tipo][0] || v > FAIXAS[tipo][1];

// ---------- Circunferências ----------
export const CIRC_PADRAO = [
  ['pescoco', 'Pescoço'], ['ombro', 'Ombro'], ['torax', 'Tórax'], ['cintura', 'Cintura'], ['abdomen', 'Abdômen'],
  ['quadril', 'Quadril'], ['bracoDRel', 'Braço D relaxado'], ['bracoERel', 'Braço E relaxado'],
  ['bracoDCon', 'Braço D contraído'], ['bracoECon', 'Braço E contraído'], ['antebracoD', 'Antebraço D'],
  ['antebracoE', 'Antebraço E'], ['coxaD', 'Coxa D'], ['coxaE', 'Coxa E'], ['panturrilhaD', 'Panturrilha D'], ['panturrilhaE', 'Panturrilha E'],
].map(([id, nome]) => ({ id, nome }));

/** Diferença de cada medida em relação à medição anterior que tenha a mesma medida. regs ordenados por data. */
export function diferencas(regs, campo = 'valores') {
  const ult = {};
  return regs.map((r) => {
    const dif = {};
    for (const [k, v] of Object.entries(r[campo] || {})) {
      if (ult[k] != null) dif[k] = v - ult[k];
      ult[k] = v;
    }
    return { ...r, dif };
  });
}

// ---------- Peso ----------
/** Peso do dia = último registro do dia. regsDia: [{ts, kg}] */
export const pesoDoDia = (regsDia) => (regsDia?.length ? [...regsDia].sort((a, b) => a.ts - b.ts).at(-1).kg : null);

/** Média móvel simples de `n` pontos (por posição). */
export function mediaMovel(valores, n = 7) {
  return valores.map((_, i) => {
    const jan = valores.slice(Math.max(0, i - n + 1), i + 1);
    return jan.reduce((s, v) => s + v, 0) / jan.length;
  });
}
