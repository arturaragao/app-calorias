// frase.js — interpretador local de frases em português (sem IA, sem rede).
// "2 ovos mexidos e 1 pão francês com manteiga", "200 ml de leite", "meia xícara de arroz", "um prato de feijão"
// → [{ texto, food, opcoes, g, porcao, qtd, unidade, incerto, motivo }]. Gramas sempre vêm de uma porção do alimento
// (porcoes.json ou do usuário), de g/kg/mL digitados ou da última quantidade usada — nada é inventado: quando a
// medida não existe para o alimento, o item fica "incerto" e a tela oferece as porções para escolher.

import { normalizar } from './utils.js';
import { buscar, raiz } from './foods.js';

// ---------- Números por extenso, frações ----------

const UNIDADES = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CENTENAS = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };
const MEIO = new Set(['meio', 'meia']);
const valorPalavra = (p) => UNIDADES[p] ?? DEZENAS[p] ?? CENTENAS[p] ?? (p === 'mil' ? 1000 : null);

/** Troca frações tipográficas e escritas ("½", "1/2", "1,5") antes de normalizar. */
function prepararNumeros(txt) {
  return String(txt)
    .replace(/(\d)\s*½/g, (_, d) => `${d}.5`).replace(/(\d)\s*¼/g, (_, d) => `${d}.25`).replace(/(\d)\s*¾/g, (_, d) => `${d}.75`)
    .replace(/½/g, ' 0.5 ').replace(/¼/g, ' 0.25 ').replace(/¾/g, ' 0.75 ').replace(/⅓/g, ' 0.33 ')
    .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (_, a, b) => ` ${Number(a) / Number(b)} `)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)(kg|g|gr|ml|l)\b/gi, '$1 $2');
}

/** Tokens normalizados preservando números decimais ("1.5"). */
function tokens(txt) {
  return prepararNumeros(txt).split(/\s+/).flatMap((t) => (/^\d+(\.\d+)?$/.test(t) ? [t] : normalizar(t).split(' '))).filter(Boolean);
}

/** Junta números por extenso em dígitos: "duzentos e cinquenta" → 250, "um e meio" → 1.5, "meia" → 0.5, "um quarto" → 0.25. */
export function numerosParaDigitos(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const num = /^\d+(\.\d+)?$/.test(t) ? Number(t) : valorPalavra(t);
    if (num == null && !MEIO.has(t) && t !== 'metade') { out.push(t); continue; }
    if (t === 'metade') { out.push('0.5'); if (toks[i + 1] === 'de' || toks[i + 1] === 'do' || toks[i + 1] === 'da') i++; continue; }
    if (MEIO.has(t)) { out.push('0.5'); continue; }
    let v = num, ultimo = num;
    // "um quarto", "um terço" (frações)
    if (v === 1 && (toks[i + 1] === 'quarto' || toks[i + 1] === 'terco')) { out.push(toks[i + 1] === 'quarto' ? '0.25' : '0.33'); i++; continue; }
    while (toks[i + 1] === 'e') {
      const prox = toks[i + 2];
      if (MEIO.has(prox)) { v += 0.5; i += 2; break; }
      const pv = prox != null ? (/^\d+$/.test(prox) ? null : valorPalavra(prox)) : null;
      if (pv != null && pv < ultimo && !/^\d/.test(t)) { v += pv; ultimo = pv; i += 2; } else break;
    }
    // "vinte cinco" sem "e" ou "cento vinte"
    while (!/^\d/.test(t) && valorPalavra(toks[i + 1]) != null && valorPalavra(toks[i + 1]) < ultimo && !/^\d/.test(toks[i + 1])) {
      ultimo = valorPalavra(toks[i + 1]); v += ultimo; i++;
    }
    out.push(String(v));
  }
  return out;
}

// ---------- Unidades ----------

// medida → lista de nomes que contam como ela nas porções do alimento (início do nome normalizado)
export const MEDIDAS = [
  ['colher de sopa', ['colher de sopa']], ['colher de cha', ['colher de cha']], ['colher de sobremesa', ['colher de sobremesa']],
  ['colher', ['colher']], ['xicara de cafe', ['xicara de cafe']], ['xicara de cha', ['xicara de cha', 'xicara']], ['xicara', ['xicara']],
  ['copo', ['copo']], ['concha', ['concha']], ['escumadeira', ['escumadeira']], ['fatia', ['fatia']], ['unidade', ['unidade']],
  ['pedaco', ['pedaco']], ['prato', ['prato']], ['porcao', ['porcao']], ['lata', ['lata']], ['pote', ['pote']], ['file', ['file']],
  ['bife', ['bife']], ['pegador', ['pegador']], ['ponta de faca', ['ponta de faca']], ['folha', ['folha']], ['ramo', ['ramo']],
  ['gomo', ['gomo']], ['cacho', ['cacho']], ['quadradinho', ['quadradinho']], ['barra', ['barra']], ['fio', ['fio']], ['caneca', ['caneca', 'xicara']],
];
const PESO = { g: 1, gr: 1, grama: 1, kg: 1000, quilo: 1000 };
const VOLUME = { ml: 1, mililitro: 1, l: 1000, litro: 1000 };
const LIGA = new Set(['de', 'do', 'da', 'dos', 'das']);
const ENFEITE = new Set(['bem', 'tipo', 'aproximadamente', 'cerca', 'uns', 'umas', 'mais ou menos', 'so', 'pouco', 'meu', 'minha']);

/** Lê medida no início (após o número). Devolve { tipo: 'peso'|'volume'|'caseira', fator|nome, usados }. */
function lerMedida(toks) {
  const r = toks.map(raiz);
  if (PESO[r[0]] != null || PESO[toks[0]] != null) return { tipo: 'peso', fator: PESO[toks[0]] ?? PESO[r[0]], usados: 1 };
  if (VOLUME[r[0]] != null || VOLUME[toks[0]] != null) return { tipo: 'volume', fator: VOLUME[toks[0]] ?? VOLUME[r[0]], usados: 1 };
  for (const [nome] of MEDIDAS) {
    const ps = nome.split(' ');
    // a medida não pode engolir o alimento ("xícara de café" = xícara + café quando nada vem depois)
    if (toks.length > ps.length && toks[ps.length] !== 'com' && ps.every((p, i) => r[i] === p || toks[i] === p)) return { tipo: 'caseira', nome, usados: ps.length };
  }
  return null;
}

// ---------- Separar a frase em itens ----------

/** Quebra em trechos: vírgula, ";", "+", " e ", " mais ", quebra de linha; " com " só se o trecho inteiro não for um alimento (ex.: "tapioca com manteiga"). */
export function trechos(texto, ehAlimentoInteiro = () => false) {
  // vírgula, ";", "+" e quebra de linha separam antes de normalizar (a normalização apaga a pontuação)
  const base = String(texto).replace(/(\d),(\d)/g, '$1.$2').split(/[,;+\n]/)
    .map((p) => numerosParaDigitos(tokens(p)).join(' ')).join(' , ');
  const partes = [];
  for (const p of base.split(/\s*,\s*|\s+e\s+|\s+mais\s+(?!ou\b)/).map((s) => s.trim()).filter(Boolean)) {
    // "uma banana e meia": a fração solta soma no trecho anterior
    if (/^\d+(\.\d+)?$/.test(p) && partes.length) {
      const ant = partes[partes.length - 1], m = ant.match(/^(\d+(?:\.\d+)?)\s/);
      partes[partes.length - 1] = m ? `${Number(m[1]) + Number(p)} ${ant.slice(m[0].length)}` : `${1 + Number(p)} ${ant}`;
    } else partes.push(p);
  }
  return partes.flatMap((p) => (/\scom\s/.test(` ${p} `) && !ehAlimentoInteiro(p) ? p.split(/\s+com\s+/) : [p])).map((s) => s.trim()).filter(Boolean);
}

/** Um trecho → { qtd, medida, nomeAlimento }. Aceita número/medida no início ou no fim ("arroz 150 g"). */
export function lerTrecho(t) {
  let toks = t.split(' ').filter((x) => x && !ENFEITE.has(x));
  let qtd = null, medida = null;
  const ehNum = (x) => /^\d+(\.\d+)?$/.test(x);
  if (ehNum(toks[0])) { qtd = Number(toks[0]); toks = toks.slice(1); }
  let m = lerMedida(toks);
  if (m) { medida = m; toks = toks.slice(m.usados); }
  if (LIGA.has(toks[0])) toks = toks.slice(1);
  // número e medida no fim: "arroz 150 g", "leite 200 ml"
  if (qtd == null && toks.length >= 2) {
    const k = toks.findIndex(ehNum);
    if (k > 0) {
      const resto = toks.slice(k + 1), mf = lerMedida(resto);
      if (mf && mf.usados === resto.length) { qtd = Number(toks[k]); medida = mf; toks = toks.slice(0, k); }
      else if (!resto.length) { qtd = Number(toks[k]); toks = toks.slice(0, k); }
    }
  }
  // sobras de ligação ("de") no fim
  while (toks.length && LIGA.has(toks[toks.length - 1])) toks.pop();
  return { qtd, medida, nome: toks.join(' ') };
}

// ---------- Resolver alimento e quantidade ----------

const comeca = (nomePorcao, alvos) => alvos.some((a) => normalizar(nomePorcao).startsWith(a));

/**
 * ctx = { indice, porcoesDe(food) → [{nome,g}], densidade(food) → g/mL, sinonimos, bonus: Map, escolhas: {texto: id}, ultimaQtd: {id: {g, porcao}} }
 */
export function resolverAlimento(nome, ctx, medida = null) {
  const n = normalizar(nome);
  if (!n) return { food: null, opcoes: [] };
  const escolha = ctx.escolhas?.[n];
  const opc = { limite: 12, sinonimos: ctx.sinonimos, bonus: ctx.bonus, escolha, comNota: true };
  // numa refeição descrita, o mais provável é o alimento pronto: "cru"/"pó" só se foi dito; sem kcal na fonte vai para o fim
  const disse = new Set(n.split(' '));
  // receita: o hábito de comer o pronto (ex.: ovo cozido) vale para o cru do mesmo alimento (ovo de galinha cru)
  const PREP = /^(cru|crua|crus|cruas|cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|frit[oa]s?|refogad[oa]s?|\d+minutos)$/;
  const base = (nome) => normalizar(nome).split(' ').filter((p) => !PREP.test(p)).join(' ');
  const habitoBase = new Map();
  if (ctx.preferirCru && ctx.bonus) for (const [id, b] of ctx.bonus) { const f = ctx.porId?.(id); if (f) habitoBase.set(base(f.nome), Math.max(b, habitoBase.get(base(f.nome)) || 0)); }
  const ajustar = (lista) => lista.map((x) => {
    const pal = normalizar(x.f.nome).split(' ');
    let s = x.s;
    if (ctx.preferirCru && !ctx.bonus?.has(x.f.id)) s -= habitoBase.get(base(x.f.nome)) || 0;
    if (x.f.kcal == null) s += 0.6;
    // refeição: o provável é o pronto; receita (ctx.preferirCru): o provável é o ingrediente cru
    if (!ctx.preferirCru && pal.some((p) => /^(cru|crua|crus|cruas|po)$/.test(p) && !disse.has(p))) s += 0.35;
    if (ctx.preferirCru && pal.some((p) => /^(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|frit[oa]s?|refogad[oa]s?)/.test(p) && !disse.has(p))) s += 0.35;
    const lata = medida && ['lata', 'pote'].includes(medida.nome);   // lata/pote = produto em conserva
    if (pal.some((p) => /^(doce|calda|barra|conserva|extrato|suco|mistura|industrializad[oa])$/.test(p) && !disse.has(p) && !(lata && p === 'conserva'))) s += 0.5;
    if (lata && pal.some((p) => /^(cru|crua)$/.test(p))) s += 0.3;
    // a medida dita ("1 lata de atum") favorece o alimento que tem essa porção
    if (medida?.tipo === 'caseira' && (ctx.porcoesDe(x.f) || []).some((p) => comeca(p.nome, MEDIDAS.find(([m]) => m === medida.nome)[1]))) s -= 0.6;
    return { ...x, s };
  }).sort((a, b) => a.s - b.s).slice(0, 5);
  let r = ajustar(buscar(ctx.indice, n, opc)), cortadas = [];
  // tira palavras do fim até achar ("ovos mexidos" → "ovos"), mantendo a 1ª
  const palavras = n.split(' ');
  while (!r.length && palavras.length > 1) { cortadas.unshift(palavras.pop()); r = ajustar(buscar(ctx.indice, palavras.join(' '), opc)); }
  if (!r.length) return { food: null, opcoes: [] };
  const [a, b] = r;
  // certo: escolhido antes, ou bem à frente do 2º (começa com / hábito do usuário), sem palavras descartadas
  const certo = !cortadas.length && (a.s <= -2 || !b || b.s - a.s >= 0.35 || (a.s <= 0 && ctx.bonus?.get(a.f.id) >= 0.3));
  return { food: a.f, opcoes: r.map((x) => x.f), certo, cortadas };
}


/** Gramas/porção para a quantidade e a medida lidas, usando só porções conhecidas do alimento. */
export function resolverQuantidade(food, { qtd, medida }, ctx) {
  const porcoes = ctx.porcoesDe(food) || [];
  const q = qtd ?? 1;
  if (medida?.tipo === 'peso') return { g: q * medida.fator, porcao: null, incerto: false };
  if (medida?.tipo === 'volume') {
    const ml = q * medida.fator, d = ctx.densidade?.(food) || 1;
    return { g: ml * d, porcao: { nome: 'mL', g: d, qtd: ml, ml: true }, incerto: false };
  }
  if (medida?.tipo === 'caseira') {
    const alvos = MEDIDAS.find(([nm]) => nm === medida.nome)[1];
    const p = porcoes.find((x) => comeca(x.nome, alvos));
    if (p) return { g: p.g * q, porcao: { nome: p.nome, g: p.g, qtd: q }, incerto: false };
    const p0 = porcoes[0];
    return p0 ? { g: p0.g * q, porcao: { nome: p0.nome, g: p0.g, qtd: q }, incerto: true, motivo: `sem “${medida.nome}” para este alimento` }
      : { g: 100 * q, porcao: null, incerto: true, motivo: 'sem porções conhecidas' };
  }
  // sem medida: última quantidade usada (escalada pelo número dito) → "unidade"/fatia/filé → 1ª porção
  const u = ctx.ultimaQtd?.[food.id];
  if (u?.porcao && !u.porcao.ml && u.porcao.nome !== 'grama') return { g: u.porcao.g * (qtd ?? u.porcao.qtd ?? 1), porcao: { ...u.porcao, qtd: qtd ?? u.porcao.qtd ?? 1 }, incerto: false };
  if (u && qtd == null) return { g: u.g, porcao: u.porcao || null, incerto: false };
  const p = porcoes.find((x) => comeca(x.nome, ['unidade', 'fatia', 'file', 'bife', 'pedaco', 'porcao', 'pote', 'lata', 'copo']))
    || porcoes[0];
  const contavel = p && comeca(p.nome, ['unidade', 'fatia', 'file', 'bife', 'pedaco', 'porcao', 'pote', 'lata', 'copo']);
  if (p) return { g: p.g * q, porcao: { nome: p.nome, g: p.g, qtd: q }, incerto: qtd == null || !contavel,
    motivo: qtd == null ? 'quantidade não dita' : !contavel ? 'medida não dita' : '' };
  return { g: 100 * q, porcao: null, incerto: true, motivo: 'sem porções conhecidas' };
}

/** Frase inteira → itens. Trechos sem alimento reconhecido voltam com food = null (a tela oferece a IA). */
export function interpretar(texto, ctx) {
  const inteiro = (p) => {
    const { nome } = lerTrecho(p);
    const r = buscar(ctx.indice, nome, { limite: 1, sinonimos: ctx.sinonimos, comNota: true });
    const pal = normalizar(r[0]?.f.nome || '').split(' ');
    return r.length > 0 && r[0].s <= 2 && pal.includes('com') && pal[0].startsWith(raiz(normalizar(nome).split(' ')[0]));
  };
  return trechos(texto, inteiro).map((t) => {
    const lido = lerTrecho(t);
    const al = resolverAlimento(lido.nome, ctx, lido.medida);
    if (!al.food) return { texto: t, food: null, opcoes: [], ...lido };
    const qt = resolverQuantidade(al.food, lido, ctx);
    return { texto: t, ...lido, food: al.food, opcoes: al.opcoes, certo: al.certo, cortadas: al.cortadas, ...qt,
      incerto: qt.incerto || !al.certo };
  });
}

/** A frase parece uma descrição com quantidade? (para oferecer "lançar como frase" na busca) */
export const pareceFrase = (txt) => {
  const toks = numerosParaDigitos(tokens(txt));
  return toks.length >= 2 && (toks.some((x) => /^\d/.test(x)) || / e | com /.test(` ${toks.join(' ')} `));
};
