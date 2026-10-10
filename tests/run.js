// tests/run.js — testes sem framework: node tests/run.js
import { readFileSync } from 'node:fs';
import { tmbMifflin, tdee, ajusteDiario, metaCalorica, pctParaGramas, gramasParaPct, gkgParaGramas, gramasParaGkg,
  kcalDeMacros, resolverConjunto, novoConjunto, metaDoDia, registrarHistorico, metasIniciais, somaPct } from '../js/goals.js';
import { criarItem, alterarQuantidade, adicionarItem, removerItem, totalDia, totalRefeicao, diaVazio, gramasDaPorcao } from '../js/diary.js';
import { chaveData, somarDias, diaSemana, fmtData, idadeEm, lerNumero, normalizar, fmtMacro, fmtKcal } from '../js/utils.js';
import { criarIndice, buscar, porcoesDe } from '../js/foods.js';
import { migrar, SCHEMA_VERSION } from '../js/db.js';

let ok = 0, falhas = [];
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
function t(nome, fn) {
  try { fn(); ok++; } catch (e) { falhas.push(`${nome}: ${e.message}`); }
}
function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); }
function aprox(a, b, tol = 1e-6, msg = '') { if (!perto(a, b, tol)) throw new Error(`${msg} esperado ≈${b}, obtido ${a}`); }

// ---------- TMB / TDEE / ritmo / piso ----------
t('TMB homem referência (30a, 80kg, 180cm) = 1780', () => eq(tmbMifflin({ sexo: 'M', peso: 80, altura: 180, idade: 30 }), 1780));
t('TMB mulher = homem − 166', () => eq(tmbMifflin({ sexo: 'F', peso: 80, altura: 180, idade: 30 }), 1614));
t('TDEE moderado 1780 × 1,55 = 2759', () => aprox(tdee(1780, 'moderado'), 2759));
t('TDEE fatores', () => { aprox(tdee(1000, 'sedentario'), 1200); aprox(tdee(1000, 'leve'), 1375); aprox(tdee(1000, 'intenso'), 1725); aprox(tdee(1000, 'muito'), 1900); });
t('Ajuste 0,5 kg/sem perder = −550', () => aprox(ajusteDiario('perder', 0.5), -550));
t('Ajuste ganhar positivo, manter zero', () => { aprox(ajusteDiario('ganhar', 0.25), 275); eq(ajusteDiario('manter', 1), 0); });
t('Piso homem 1500', () => {
  const m = metaCalorica({ sexo: 'M', peso: 55, altura: 160, idade: 60, atividade: 'sedentario', objetivo: 'perder', ritmo: 1 });
  eq(m.abaixoPiso, true); eq(m.kcal, 1500);
});
t('Piso mulher 1200', () => {
  const m = metaCalorica({ sexo: 'F', peso: 50, altura: 155, idade: 60, atividade: 'sedentario', objetivo: 'perder', ritmo: 1 });
  eq(m.kcal, 1200);
});
t('Meta sem piso', () => {
  const m = metaCalorica({ sexo: 'M', peso: 80, altura: 180, idade: 30, atividade: 'moderado', objetivo: 'perder', ritmo: 0.5 });
  aprox(m.kcal, 2209); eq(m.abaixoPiso, false);
});

// ---------- Conversões de macros ----------
t('% → g (2000 kcal, 25/45/30)', () => {
  const g = pctParaGramas(2000, { prot: 25, carb: 45, gord: 30 });
  aprox(g.prot, 125); aprox(g.carb, 225); aprox(g.gord, 66.6666667, 1e-6);
});
t('g → % ida e volta', () => {
  const p = gramasParaPct(pctParaGramas(2000, { prot: 25, carb: 45, gord: 30 }));
  aprox(p.prot, 25); aprox(p.carb, 45); aprox(p.gord, 30);
});
t('g/kg ↔ g', () => {
  const g = gkgParaGramas({ prot: 2, carb: 3, gord: 1 }, 80);
  eq(g.prot, 160); eq(g.carb, 240); eq(g.gord, 80);
  aprox(gramasParaGkg(g, 80).prot, 2);
});
t('kcal de macros 4/4/9', () => eq(kcalDeMacros({ prot: 200, carb: 250, gord: 70 }), 2430));
t('Soma de %', () => eq(somaPct({ prot: 30, carb: 40, gord: 30 }), 100));
t('Modo gramas: kcal derivam dos macros e diferença', () => {
  const c = { ...novoConjunto(2500), macroModo: 'g', g: { prot: 200, carb: 250, gord: 70 } };
  const r = resolverConjunto(c, 80);
  eq(r.kcal, 2430); eq(r.diferenca, -70); eq(r.prot, 200);
});
t('Modo g/kg usa peso', () => {
  const c = { ...novoConjunto(2500), macroModo: 'gkg', gkg: { prot: 2, carb: 3, gord: 1 } };
  const r = resolverConjunto(c, 80);
  eq(r.prot, 160); eq(r.kcal, 160 * 4 + 240 * 4 + 80 * 9);
});
t('Modo %: kcal é a meta', () => { const r = resolverConjunto(novoConjunto(2000), 80); eq(r.kcal, 2000); aprox(r.prot, 125); });

// ---------- Metas por dia da semana e histórico ----------
t('Metas por dia da semana', () => {
  const metas = metasIniciais({ sexo: 'M', peso: 80, altura: 180, idade: 30, atividade: 'moderado', objetivo: 'manter' }, '2026-01-01');
  metas.modo = 'semana';
  metas.semana[5].kcal = 3000;                              // sábado
  const m2 = registrarHistorico(metas, '2026-01-01');
  eq(metaDoDia(m2, '2026-10-10', 80).kcal, 3000);            // 10/10/2026 = sábado
  eq(metaDoDia(m2, '2026-10-12', 80).kcal, 2759);            // segunda
});
t('Histórico: dia antigo mantém meta antiga', () => {
  let metas = metasIniciais({ sexo: 'M', peso: 80, altura: 180, idade: 30, atividade: 'moderado', objetivo: 'manter' }, '2026-01-01');
  metas = { ...metas, base: { ...metas.base, kcal: 2000 } };
  metas = registrarHistorico(metas, '2026-06-01');
  eq(metaDoDia(metas, '2026-03-01', 80).kcal, 2759);
  eq(metaDoDia(metas, '2026-06-01', 80).kcal, 2000);
  eq(metaDoDia(metas, '2025-12-01', 80).kcal, 2759, 'antes do 1º registro usa o mais antigo');
});
t('Alternar modo não perde dados', () => {
  const metas = metasIniciais({ sexo: 'M', peso: 80, altura: 180, idade: 30, atividade: 'moderado', objetivo: 'manter' }, '2026-01-01');
  metas.semana[2].kcal = 1800; metas.modo = 'iguais'; metas.modo = 'semana';
  eq(metas.semana[2].kcal, 1800);
});

// ---------- Diário: itens, porções e totais ----------
const arroz = { id: 'taco-3', nome: 'Arroz, tipo 1, cozido', kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2, fibra: 1.6, sodio_mg: 1 };
const frango = { id: 'x', nome: 'Frango', kcal: 159, prot: 32, carb: 0, gord: 2.5, fibra: null, sodio_mg: 50 };
t('Item por gramas', () => { const it = criarItem(arroz, 150); aprox(it.n.kcal, 192); aprox(it.n.prot, 3.75); });
t('Item por porção caseira', () => {
  const g = gramasDaPorcao({ nome: 'colher de sopa cheia', g: 25 }, 4);
  const it = criarItem(arroz, g, { nome: 'colher de sopa cheia', g: 25, qtd: 4 });
  eq(it.g, 100); aprox(it.n.kcal, 128);
});
t('Valor ausente conta 0 e fica marcado', () => { const it = criarItem(frango, 100); eq(it.n.fibra, 0); eq(it.falta.includes('fibra'), true); });
t('Snapshot: editar alimento não muda item', () => {
  const f = { ...arroz }; const it = criarItem(f, 100); f.kcal = 999; aprox(it.n.kcal, 128);
  aprox(alterarQuantidade(it, 200).n.kcal, 256);
});
t('Totais por refeição e dia (sem arredondar)', () => {
  let d = diaVazio('2026-10-08');
  d = adicionarItem(d, 'almoco', 'Almoço', criarItem(arroz, 133));
  d = adicionarItem(d, 'almoco', 'Almoço', criarItem(frango, 120));
  d = adicionarItem(d, 'jantar', 'Jantar', criarItem(arroz, 77));
  aprox(totalRefeicao(d, 'almoco').kcal, 1.28 * 133 + 1.59 * 120);
  aprox(totalDia(d).kcal, 1.28 * 210 + 1.59 * 120);
  aprox(totalDia(d).prot, 0.025 * 210 + 0.32 * 120);
});
t('Remover item', () => {
  let d = adicionarItem(diaVazio('2026-10-08'), 'cafe', 'Café', criarItem(arroz, 100));
  const id = d.refeicoes.cafe[0].id;
  const r = removerItem(d, 'cafe', id);
  eq(r.dia.refeicoes.cafe.length, 0); eq(d.refeicoes.cafe.length, 1, 'original intacto (para desfazer)');
});

// ---------- Datas locais e formatação ----------
t('Chave de data local (não UTC)', () => eq(chaveData(new Date(2026, 0, 1, 23, 59)), '2026-01-01'));
t('Chave de data de madrugada', () => eq(chaveData(new Date(2026, 2, 5, 0, 5)), '2026-03-05'));
t('Somar dias atravessando mês/ano', () => { eq(somarDias('2026-12-31', 1), '2027-01-01'); eq(somarDias('2026-03-01', -1), '2026-02-28'); });
t('Semana começa na segunda', () => { eq(diaSemana('2026-10-12'), 0); eq(diaSemana('2026-10-11'), 6); });
t('dd/mm/aaaa', () => eq(fmtData('2026-10-08'), '08/10/2026'));
t('Idade', () => { eq(idadeEm('1996-10-09', '2026-10-08'), 29); eq(idadeEm('1996-10-08', '2026-10-08'), 30); });
t('Ler número com milhar pt-BR', () => { eq(lerNumero('2.759'), 2759); eq(lerNumero('2.759,5'), 2759.5); eq(lerNumero('0.5'), 0.5); });
t('Ler número com vírgula', () => { eq(lerNumero('12,5'), 12.5); eq(Number.isNaN(lerNumero('abc')), true); eq(Number.isNaN(lerNumero('')), true); });
t('Formatação pt-BR', () => { eq(fmtMacro(12.345), '12,3'); eq(fmtKcal(1780.6), '1.781'); });

// ---------- Busca ----------
const base = JSON.parse(readFileSync(new URL('../foods.json', import.meta.url), 'utf8'));
const idx = criarIndice(base);
t('Base TACO + TBCA (6000+ itens, ids únicos, ids TACO preservados)', () => {
  if (base.filter((f) => f.fonte === 'TBCA').length < 5600) throw new Error('TBCA incompleta');
  eq(new Set(base.map((f) => f.id)).size, base.length, 'ids repetidos');
  eq(base.filter((f) => f.id.startsWith('taco-')).length, 597, 'id TACO perdido');
});
t('TBCA: valores, micronutrientes e nome limpo (lentilha crua C0019T)', () => {
  const l = base.find((f) => f.id === 'tbca-C0019T');
  eq(l.kcal, 314); eq(l.prot, 23.5); eq(l.carb, 61); eq(l.fibra, 18.7); eq(l.mic.ferro_mg, 7.06);
  if (/,$/.test(l.nome)) throw new Error('vírgula final no nome');
});
t('Busca: TACO antes da TBCA; ingredientes entre parênteses não casam', () => {
  if (buscar(idx, 'banana prata')[0].fonte !== 'TACO') throw new Error('banana');
  if (buscar(idx, 'tutu')[0]?.nome.startsWith('Tutu') !== true) throw new Error('tutu');
  if (buscar(idx, 'mandioca cozida').some((f) => f.nome.startsWith('Tutu'))) throw new Error('ingrediente casou');
});
t('Normalização sem acento/caixa', () => eq(normalizar('FEIJÃO, Carioca'), 'feijao carioca'));
t('Busca sem acento encontra "Feijão"', () => { const r = buscar(idx, 'feijao'); if (!r.length || !normalizar(r[0].nome).startsWith('feijao')) throw new Error(r[0]?.nome); });
t('Ranking: começa com antes de contém', () => {
  const r = buscar(idx, 'arroz');
  if (!normalizar(r[0].nome).startsWith('arroz')) throw new Error(r[0].nome);
});
t('Busca por palavras fora de ordem', () => { const r = buscar(idx, 'cozido arroz'); if (!r.some((f) => f.nome === 'Arroz, tipo 1, cozido')) throw new Error('não achou'); });
t('Busca < 100 ms (média de 50)', () => {
  const t0 = performance.now(); for (let i = 0; i < 50; i++) buscar(idx, 'fra gre'); const ms = (performance.now() - t0) / 50;
  if (ms > 100) throw new Error(`${ms.toFixed(1)} ms`);
});
t('Porções: regra específica, grupo e do usuário', () => {
  const tab = JSON.parse(readFileSync(new URL('../porcoes.json', import.meta.url), 'utf8'));
  eq(porcoesDe(arroz, tab)[0].nome, 'colher de sopa cheia');
  eq(porcoesDe({ id: 'z', nome: 'Pão, trigo, francês', grupo: '' }, tab)[0].g, 50);
  eq(porcoesDe({ id: 'z', nome: 'Pitanga, crua', grupo: 'Frutas e derivados' }, tab)[0].nome, 'unidade média');
  eq(porcoesDe(arroz, tab, { 'taco-3': [{ nome: 'minha', g: 80 }] })[0].g, 80);
});

// ---------- Migração de esquema ----------
t('Migração 0 → atual define schemaVersion', () => {
  const e = migrar({ kv: { perfil: { peso: 80 } } }, 0);
  eq(e.kv.meta.schemaVersion, SCHEMA_VERSION); eq(e.kv.perfil.peso, 80);
});
t('Migração ausente gera erro', () => { let erro = false; try { migrar({ kv: {} }, 0, 99); } catch { erro = true; } eq(erro, true); });

// ---------- Etapa 2: personalizados, receitas, rápida, cópia, CSV, fotos ----------
const { paraPor100, avisoKcalMacros, alimentoDaReceita, atualizarRecentes } = await import('../js/custom.js');
const { criarItemRapido, copiarPara } = await import('../js/diary.js');
const { analisarCSV, lerPorcoes } = await import('../js/csv.js');
const { dimensoes } = await import('../js/photos.js');

t('Alimento personalizado: valores por porção → por 100 g', () => {
  const r = paraPor100({ kcal: 120, prot: 24, carb: 3, gord: 1.5, fibra: null, sodio_mg: 90 }, 30);
  aprox(r.kcal, 400); aprox(r.prot, 80); eq(r.fibra, null); aprox(r.sodio_mg, 300);
});
t('Aviso kcal × macros (só aviso)', () => {
  eq(avisoKcalMacros({ kcal: 400, prot: 80, carb: 10, gord: 5 }), '');
  eq(avisoKcalMacros({ kcal: 100, prot: 80, carb: 10, gord: 5 }) !== '', true);
});
const rec = { id: 'r-1', nome: 'Arroz com frango', porcoes: 4, ingredientes: [
  { foodId: 'taco-3', nome: 'Arroz', g: 400, por100: arroz },
  { foodId: 'x', nome: 'Frango', g: 200, por100: frango }] };
t('Receita: total e por 100 g pela soma dos ingredientes', () => {
  const f = alimentoDaReceita(rec);
  aprox(f.total.kcal, 512 + 318); aprox(f.peso, 600); aprox(f.kcal, (830 * 100) / 600);
  aprox(f.porcoes[0].g, 150);
});
t('Receita: peso final cozido redistribui (escala correta)', () => {
  const f = alimentoDaReceita({ ...rec, pesoFinal: 500 });
  aprox(f.kcal, 166); aprox(f.porcoes[0].g, 125);
  // lançar 1 porção = 1/4 da receita, qualquer que seja o peso final
  aprox((f.kcal * f.porcoes[0].g) / 100, 830 / 4);
});
t('Receita usa o alimento atual quando existe (resolver)', () => {
  const f = alimentoDaReceita(rec, (id) => (id === 'x' ? { ...frango, kcal: 200 } : null));
  aprox(f.total.kcal, 512 + 400);
});
t('Recentes: sobe para o topo, sem repetir, com limite', () => {
  eq(atualizarRecentes(['a', 'b', 'c'], 'b').join(), 'b,a,c');
  eq(atualizarRecentes(['a', 'b'], 'z', 2).join(), 'z,a');
});
t('Adição rápida: soma no total do dia', () => {
  let d = adicionarItem(diaVazio('2026-10-08'), 'almoco', 'Almoço', criarItemRapido({ kcal: 650, prot: 40, carb: 70, gord: 20 }));
  d = adicionarItem(d, 'almoco', 'Almoço', criarItem(arroz, 100));
  aprox(totalDia(d).kcal, 778); eq(d.refeicoes.almoco[0].rapido, true);
});
t('Copiar refeição e dia anterior (ids novos, acrescenta)', () => {
  let ontem = adicionarItem(diaVazio('2026-10-07'), 'cafe', 'Café', criarItem(arroz, 100));
  ontem = adicionarItem(ontem, 'jantar', 'Jantar', criarItem(frango, 100));
  const hoje = adicionarItem(diaVazio('2026-10-08'), 'cafe', 'Café', criarItem(arroz, 50));
  const r1 = copiarPara(hoje, ontem, 'cafe');
  eq(r1.n, 1); eq(r1.dia.refeicoes.cafe.length, 2);
  if (r1.dia.refeicoes.cafe[1].id === ontem.refeicoes.cafe[0].id) throw new Error('id repetido');
  const r2 = copiarPara(hoje, ontem);
  eq(r2.n, 2); aprox(totalDia(r2.dia).kcal, 64 + 128 + 159);
});
t('CSV com ; e vírgula decimal, cabeçalho e porções', () => {
  const r = analisarCSV('nome;kcal;proteina;carboidrato;gordura;fibra;sodio;porcoes\nPão X;250;10;45;3,5;6;450;fatia=30|unidade=50\n');
  eq(r.linhas.length, 1); eq(r.linhas[0].erros.length, 0);
  aprox(r.linhas[0].food.gord, 3.5); eq(r.linhas[0].food.porcoes[1].g, 50);
});
t('CSV com , sem cabeçalho e erros/duplicatas', () => {
  const r = analisarCSV('Whey,400,80,8,6,0,300\n,100,1,1,1\nOvo X,-5,1,1,1\nwhey,400,80,8,6\n', new Set(['ovo y']));
  eq(r.linhas[0].erros.length, 0); eq(r.linhas[1].erros[0], 'sem nome');
  eq(r.linhas[2].erros.includes('kcal negativo'), true); eq(r.linhas[3].duplicata, true);
  eq(r.linhas[3].food.falta.join(), 'fibra,sodio_mg');
});
t('CSV marca nome já existente', () => {
  const r = analisarCSV('nome;kcal\nArroz, tipo 1, cozido;128', new Set([normalizar('Arroz, tipo 1, cozido')]));
  eq(r.linhas[0].duplicata, true);
});
t('Porções do CSV', () => eq(lerPorcoes('scoop=30|x=abc').length, 1));
t('Foto: redimensiona para 1280 px no maior lado', () => {
  const d = dimensoes(4000, 3000); eq(d.w, 1280); eq(d.h, 960);
  eq(dimensoes(800, 600).w, 800);
});
const { produtoParaAlimento, limparCodigo, variantesCodigo } = await import('../js/off.js');
t('Open Food Facts: produto → por 100 g (sódio g→mg, porção)', () => {
  const f = produtoParaAlimento({ product_name: 'Leite Condensado', brands: 'Moça, Nestlé', serving_size: '20 g', serving_quantity: 20,
    nutriments: { 'energy-kcal_100g': 325, proteins_100g: 7, carbohydrates_100g: 55, fat_100g: 8, sodium_100g: 0.11 } }, '7891000100103');
  eq(f.kcal, 325); aprox(f.sodio_mg, 110); eq(f.fibra, null); eq(f.falta.join(), 'fibra');
  eq(f.porcoes[0].g, 20); eq(f.nome, 'Leite Condensado — Moça'); eq(f.codigo, '7891000100103');
});
t('Open Food Facts: kJ → kcal e sal → sódio', () => {
  const f = produtoParaAlimento({ product_name: 'X', nutriments: { energy_100g: 418.4, salt_100g: 1 } }, '12345678');
  aprox(f.kcal, 100); aprox(f.sodio_mg, 400); eq(f.prot, null);
});
t('Código de barras: limpeza e variantes UPC/EAN', () => {
  eq(limparCodigo('789 1000-100103'), '7891000100103'); eq(limparCodigo('123'), '');
  eq(variantesCodigo('012345678905').includes('0012345678905'), true);
});
// ---------- Etapa 3: composição corporal (referências calculadas à mão em DECISOES/PROGRESSO) ----------
const { calcularDobras, siri, coefDW, PROTOCOLOS, diferencas, pesoDoDia, foraDaFaixa, mediaMovel } = await import('../js/body.js');
const pessoa = (sexo, idade, peso = 80) => ({ sexo, idade, peso });
const valoresIguais = (prot, sexo, soma) => {
  const s = PROTOCOLOS[prot].sitios(sexo);
  return Object.fromEntries(s.map((k) => [k, soma / s.length]));
};
t('Siri: DC 1,0653532 → 14,63%', () => aprox(siri(1.0653532), 14.6346, 1e-3));
t('Parrillo 9: soma 90 mm, 80 kg → 13,78%', () => {
  const r = calcularDobras('parrillo', valoresIguais('parrillo', 'M', 90), pessoa('M', 30, 80));
  aprox(r.pct, 13.7779, 1e-3); aprox(r.mGorda, 80 * 0.137779, 1e-3); aprox(r.mMagra + r.mGorda, 80);
});
t('Pollock 7 homem: soma 100, 30 anos → DC 1,06535; 14,63%', () => {
  const r = calcularDobras('pollock7', valoresIguais('pollock7', 'M', 100), pessoa('M', 30));
  aprox(r.dc, 1.0653532, 1e-7); aprox(r.pct, 14.6346, 1e-3);
});
t('Pollock 7 mulher: soma 100, 30 anos → 20,63%', () => aprox(calcularDobras('pollock7', valoresIguais('pollock7', 'F', 100), pessoa('F', 30)).pct, 20.6305, 1e-3));
t('Pollock 3 homem (peitoral/abdominal/coxa): soma 60 → 17,95%', () => {
  eq(PROTOCOLOS.pollock3.sitios('M').join(), 'peitoral,abdominal,coxa');
  aprox(calcularDobras('pollock3', valoresIguais('pollock3', 'M', 60), pessoa('M', 30)).pct, 17.9453, 1e-3);
});
t('Pollock 3 mulher (tríceps/suprailíaca/coxa): soma 60 → 24,13%', () => {
  eq(PROTOCOLOS.pollock3.sitios('F').join(), 'triceps,suprailiaca,coxa');
  aprox(calcularDobras('pollock3', valoresIguais('pollock3', 'F', 60), pessoa('F', 30)).pct, 24.1279, 1e-3);
});
t('Durnin-Womersley: homem 25a soma 40 → 16,17%; mulher 35a → 25,48%', () => {
  aprox(calcularDobras('durnin', valoresIguais('durnin', 'M', 40), pessoa('M', 25)).pct, 16.1676, 1e-3);
  aprox(calcularDobras('durnin', valoresIguais('durnin', 'F', 40), pessoa('F', 35)).pct, 25.4816, 1e-3);
});
t('Durnin-Womersley: faixas etárias', () => {
  eq(coefDW('M', 19).c, 1.1620); eq(coefDW('M', 45).m, 0.0700); eq(coefDW('F', 60).c, 1.1339); eq(coefDW('M', 15).c, 1.1620);
});
t('Personalizado: só soma, sem %G', () => {
  const r = calcularDobras('personalizado', { triceps: 10, coxa: 15 }, pessoa('M', 30), ['triceps', 'coxa']);
  eq(r.soma, 25); eq(r.pct, null); eq(r.mGorda, null);
});
t('Dobra faltando gera erro', () => { let e = ''; try { calcularDobras('pollock3', { peitoral: 10 }, pessoa('M', 30)); } catch (x) { e = x.message; } eq(e.startsWith('Faltam'), true); });
t('Faixas de confirmação', () => { eq(foraDaFaixa('dobra', 81), true); eq(foraDaFaixa('peso', 29), true); eq(foraDaFaixa('circ', 90), false); });
t('Peso do dia = último registro', () => eq(pesoDoDia([{ ts: 2, kg: 80 }, { ts: 1, kg: 81 }, { ts: 3, kg: 79.5 }]), 79.5));
t('Circunferências: diferença vs medição anterior da mesma medida', () => {
  const r = diferencas([{ data: '1', valores: { cintura: 90, braco: 35 } }, { data: '2', valores: { cintura: 88 } }, { data: '3', valores: { braco: 36, cintura: 87.5 } }]);
  eq(r[1].dif.cintura, -2); eq(r[2].dif.braco, 1); eq(r[2].dif.cintura, -0.5); eq(r[0].dif.cintura, undefined);
});
t('Média móvel', () => { const m = mediaMovel([1, 2, 3, 4], 2); eq(m.join(), '1,1.5,2.5,3.5'); });

// ---------- Etapa 4: progresso e backup ----------
const P = await import('../js/progress.js');
const { validarBackup, migrarBackup } = await import('../js/backup.js');
const dd = (data, kcal, meta = 2000) => ({ data, tot: { kcal, prot: 100, carb: 200, gord: 50, fibra: 20, sodio_mg: 1500 }, meta: { kcal: meta, prot: 150, carb: 250, gord: 60 } });
t('Média móvel de 7 dias por calendário (não por posição)', () => {
  const m = P.mediaMovelDias([{ data: '2026-10-01', y: 80 }, { data: '2026-10-07', y: 79 }, { data: '2026-10-08', y: 78 }]);
  eq(m[0], 80); eq(m[1], 79.5); eq(m[2], 78.5);           // 08/10: janela 02–08 exclui 01/10
});
t('Semanas começam na segunda; média só dos dias registrados', () => {
  eq(P.inicioSemana('2026-10-11'), '2026-10-05'); eq(P.inicioSemana('2026-10-12'), '2026-10-12');
  const s = P.semanas([dd('2026-10-05', 1800), dd('2026-10-07', 2200), dd('2026-10-12', 2500, 2500)]);
  eq(s.length, 2); eq(s[0].kcal, 2000); eq(s[0].n, 2); eq(s[1].meta, 2500);
});
t('Aderência ±10%', () => {
  const a = P.aderencia([dd('1', 2000), dd('2', 2199), dd('3', 2300), dd('4', 1700)]);
  eq(a.dentro, 2); eq(a.acima, 1); eq(a.abaixo, 1); eq(a.pct, 50);
  eq(P.aderencia([]).pct, null);
});
t('Médias de macros e % das kcal', () => {
  const m = P.mediasMacros([dd('1', 1800), dd('2', 2200)]);
  eq(m.consumo.kcal, 2000); eq(m.meta.prot, 150);
  aprox(m.pct.prot + m.pct.carb + m.pct.gord, 100); aprox(m.pct.gord, (50 * 900) / (400 + 800 + 450));
});
t('Período: últimos n dias inclusive', () => {
  const l = P.noPeriodo([{ data: '2026-09-01' }, { data: '2026-10-02' }, { data: '2026-10-08' }], 7, '2026-10-08');
  eq(l.length, 2); eq(P.noPeriodo([{ data: 'x' }], null, 'y').length, 1);
});
t('Dias seguidos: conta até hoje, ou até ontem se hoje está vazio', () => {
  const s = new Set(['2026-10-05', '2026-10-06', '2026-10-07']);
  eq(P.sequencia(s, '2026-10-07'), 3); eq(P.sequencia(s, '2026-10-08'), 3); eq(P.sequencia(s, '2026-10-09'), 0);
  s.add('2026-10-08'); eq(P.sequencia(s, '2026-10-08'), 4);
});
const bkOk = { app: 'app-calorias', schemaVersion: 1, stores: { kv: [['perfil', { peso: 80 }], ['metas', {}]], diary: [['2026-10-08', diaVazio('2026-10-08')]] } };
t('Backup válido: contagem', () => { const v = validarBackup(bkOk); eq(v.ok, true); eq(v.contagem.diary, 1); });
t('Backup inválido é recusado antes de gravar', () => {
  eq(validarBackup(null).ok, false);
  eq(validarBackup({ ...bkOk, app: 'outro' }).ok, false);
  eq(validarBackup({ ...bkOk, schemaVersion: 99 }).erro.includes('mais nova'), true);
  eq(validarBackup({ ...bkOk, stores: { ...bkOk.stores, lixo: [] } }).ok, false);
  eq(validarBackup({ ...bkOk, stores: { kv: [['perfil', {}]], diary: [['a']] } }).ok, false);
  eq(validarBackup({ ...bkOk, stores: { kv: [] } }).erro, 'Backup sem perfil.');
});
t('Backup: ida e volta JSON preserva dados', () => {
  const volta = JSON.parse(JSON.stringify(bkOk));
  eq(validarBackup(volta).ok, true); eq(volta.stores.kv[0][1].peso, 80);
  eq(migrarBackup(volta).schemaVersion, 1);
});
{
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const { VERSAO_APP } = await import('../js/versao.js');
  t('Versão do app igual à do service worker', () => eq(sw.match(/VERSAO = '([^']+)'/)[1], VERSAO_APP));
  t('Todo arquivo listado no service worker existe', () => {
    const { existsSync } = process.getBuiltinModule('node:fs');
    const lista = [...sw.matchAll(/'([^']+\.(?:js|css|json|html|png|webmanifest))'/g)].map((m) => m[1]);
    const faltam = lista.filter((a) => !existsSync(new URL('../' + a, import.meta.url)));
    if (faltam.length) throw new Error(faltam.join(', '));
  });
}
t('Service worker lista todos os módulos JS', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const { readdirSync } = process.getBuiltinModule('node:fs');
  const arqs = [...readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
    ...readdirSync(new URL('../js/views/', import.meta.url)).map((f) => 'js/views/' + f)];
  const faltando = arqs.filter((a) => !sw.includes(`'${a}'`));
  if (faltando.length) throw new Error('faltam no sw.js: ' + faltando.join(', '));
});

// ---------- Estimativa por foto (IA) e backup no Drive ----------
const { normalizarEstimativa, mensagemErro, chaveValida, limparChave } = await import('../js/ia.js');
t('IA: aceita chave antiga (AIza…), nova com ponto (AQ.…) e colada com espaços', () => {
  eq(chaveValida('AIzaSyD-abc_DEF1234567890abcdefghijk'), true);
  eq(chaveValida('AQ.Ab8RN6Kx_y-Z0123456789abcdefGHIJ'), true);
  eq(chaveValida(' AIzaSyD-abc_DEF12345\n67890abcdefghijk '), true);
  eq(limparChave(' "AQ.abc"\n'), 'AQ.abc');
  eq(chaveValida('curta'), false); eq(chaveValida('https://aistudio.google.com/apikey'), false);
});
t('IA: normaliza resposta, descarta inválidos e limita valores', () => {
  const r = normalizarEstimativa({ itens: [
    { nome: ' Arroz branco cozido ', gramas: 150, kcal: 192, prot: 3.8, carb: 42, gord: 0.3, fibra: 2.4 },
    { nome: '', gramas: 10, kcal: 50, prot: 1, carb: 1, gord: 1 },
    { nome: 'Feijão', gramas: -5, kcal: 'x', prot: 1, carb: 1, gord: 1 },
    { nome: 'Bife', gramas: 9999, kcal: 400, prot: 'abc', carb: 0, gord: 20 },
  ], observacao: 'ok' });
  eq(r.itens.length, 2); eq(r.itens[0].nome, 'Arroz branco cozido'); eq(r.itens[0].g, 150); eq(r.itens[0].fibra, 2.4);
  eq(r.itens[1].g, 5000); eq(r.itens[1].prot, 0); eq(r.itens[1].fibra, null); eq(r.obs, 'ok');
  eq(normalizarEstimativa(null).itens.length, 0);
});
t('IA: mensagens de erro (cota, chave)', () => {
  if (!/Cota gratuita/.test(mensagemErro(429))) throw new Error('429');
  if (!/inválida/.test(mensagemErro(400, 'API key not valid'))) throw new Error('400');
});
const { backupDevido, montarMultipart } = await import('../js/drive.js');
t('Drive: backup devido só se conectado, automático, alterado e após o intervalo', () => {
  const H = 3600000, st = { conectado: true, auto: true, ultimo: 100 * H };
  eq(backupDevido(st, 101 * H, 121 * H), true);
  eq(backupDevido(st, 101 * H, 110 * H), false, 'intervalo');
  eq(backupDevido(st, 99 * H, 130 * H), false, 'sem alteração');
  eq(backupDevido({ ...st, auto: false }, 101 * H, 130 * H), false, 'desligado');
  eq(backupDevido({ ...st, conectado: false }, 101 * H, 130 * H), false, 'desconectado');
  eq(backupDevido({ conectado: true, auto: true, ultimo: 0 }, 5, 6, 0), true, 'nunca enviado');
});
t('Drive: corpo multipart com metadados e conteúdo', () => {
  const { partes, tipo } = montarMultipart({ name: 'a.json' }, '{"x":1}', 'B');
  eq(tipo, 'multipart/related; boundary=B');
  eq(partes.join(''), ['--B', 'Content-Type: application/json; charset=UTF-8', '', '{"name":"a.json"}', '--B', 'Content-Type: application/json', '', '{"x":1}', '--B--'].join('\r\n'));
});

// ---------- Progresso: tendência, gasto real, projeção, relatório, calendário, origem ----------
t('Tendência de peso (EMA 0,1 com interpolação)', () => {
  const tr = P.tendenciaPeso([{ data: '2026-01-01', kg: 80 }, { data: '2026-01-03', kg: 82 }]);
  eq(tr.length, 3); aprox(tr[0].y, 80); aprox(tr[1].y, 80.1); aprox(tr[2].y, 80.29);
  eq(tr[1].real, false); eq(tr[2].real, true); eq(P.tendenciaPeso([]).length, 0);
});
t('Inclinação e ritmo semanal', () => {
  const pts = Array.from({ length: 10 }, (_, i) => ({ data: somarDias('2026-01-01', i), y: 80 - 0.1 * i }));
  aprox(P.inclinacao(pts), -0.1); aprox(P.ritmoSemanal(pts, '2026-01-10'), -0.7);
  eq(P.ritmoSemanal(pts.slice(0, 5), '2026-01-05'), null);
});
const tendSint = Array.from({ length: 28 }, (_, k) => ({ data: somarDias('2026-02-01', k), y: 80 - 0.05 * k }));
const diasSint = tendSint.map((p) => ({ data: p.data, tot: { kcal: 2000, prot: 150 }, meta: { kcal: 2000 } }));
t('Gasto real (TDEE adaptativo): consumo − Δtendência × 7700 / dias', () => {
  const r = P.tdeeAdaptativo(diasSint, tendSint, '2026-02-28');
  aprox(r.deltaKg, -1.35, 1e-9); aprox(r.tdee, 2000 + (1.35 * 7700) / 28, 1e-6); eq(r.confianca, 'alta'); eq(r.registrados, 28);
  eq(P.tdeeAdaptativo(diasSint.slice(0, 9), tendSint, '2026-02-28'), null, 'poucos dias registrados');
  eq(P.tdeeAdaptativo(diasSint, tendSint.slice(0, 10), '2026-02-10'), null, 'tendência curta');
  eq(P.metaSugerida(2371.25, -550, 1500), 1820); eq(P.metaSugerida(1700, -550, 1500), 1500, 'piso');
});
t('Projeção do peso-alvo e fração do caminho', () => {
  const p = P.projecao(80, 75, -0.5, '2026-01-01');
  aprox(p.semanas, 10); eq(p.data, '2026-03-12');
  eq(P.projecao(80, 75, 0.3, '2026-01-01'), null, 'direção errada');
  eq(P.projecao(75.02, 75, -0.5, '2026-01-01').atingido, true);
  aprox(P.fracaoAlvo(85, 80, 75), 0.5); eq(P.fracaoAlvo(85, 86, 75), 0); eq(P.fracaoAlvo(85, 70, 75), 1);
});
t('Comparação com o período anterior', () => {
  const c = P.compararPeriodos(diasSint, 14, '2026-02-28');
  eq(c.n[0], 14); eq(c.n[1], 14); aprox(c.kcal[0], 2000);
});
t('Relatório semanal', () => {
  const ds = [dd('2026-02-02', 2000), dd('2026-02-03', 2600), dd('2026-02-04', 1900), dd('2026-02-10', 1000)];
  const r = P.relatorioSemana(ds, tendSint, '2026-02-02');
  eq(r.registrados, 3); eq(r.melhor.data, '2026-02-02'); eq(r.pior.data, '2026-02-03'); eq(r.aderencia.dentro, 2);
  aprox(r.deltaPeso, -0.05 * 7, 1e-9);
});
t('Calendário: grade do mês começa na segunda e situação do dia', () => {
  const g = P.gradeMes(2026, 10);                       // 01/10/2026 é quinta-feira
  eq(g.length, 35); eq(g[2], null); eq(g[3], '2026-10-01'); eq(g[33], '2026-10-31');
  eq(P.situacaoDia(dd('x', 2050)), 'meta'); eq(P.situacaoDia(dd('x', 2300)), 'acima'); eq(P.situacaoDia(dd('x', 1700)), 'abaixo'); eq(P.situacaoDia(null), null);
});
t('De onde vêm as calorias (por refeição e por alimento)', () => {
  const it = (foodId, nome, kcal, prot) => ({ foodId, nome, n: { kcal, prot } });
  const ds = [
    { data: '1', nomes: { almoco: 'Almoço', cafe: 'Café' }, refeicoes: { almoco: [it('taco-3', 'Arroz', 300, 6), it(null, 'Feijão (≈100 g)', 100, 5)], cafe: [it('x', 'Pão', 100, 4)] } },
    { data: '2', nomes: { almoco: 'Almoço' }, refeicoes: { almoco: [it('taco-3', 'Arroz', 300, 6), it(null, 'Feijão (≈150 g)', 100, 5)] } },
  ];
  const o = P.origemCalorias(ds);
  eq(o.porRefeicao[0].id, 'almoco'); aprox(o.porRefeicao[0].kcal, 400); aprox(o.porRefeicao[0].pct, 800 / 900 * 100);
  eq(o.topKcal[0].nome, 'Arroz'); eq(o.topKcal[0].vezes, 2); eq(o.topKcal[1].nome, 'Feijão'); eq(o.topKcal[1].vezes, 2);
});

// ---------- Pacotes 2 e 3 ----------
const G2 = await import('../js/goals.js');
t('Dia de treino: soma o extra (vigente na data) em carboidratos', () => {
  const metas = G2.metasIniciais({ sexo: 'M', idade: 30, peso: 80, altura: 180, atividade: 'moderado', objetivo: 'manter', ritmo: 0 }, '2026-01-01');
  const comExtra = G2.registrarHistorico({ ...metas, treinoExtra: 300 }, '2026-02-01');
  const normal = G2.metaDoDia(comExtra, '2026-02-05', 80);
  const treino = G2.metaDoDia(comExtra, '2026-02-05', 80, { treino: true });
  aprox(treino.kcal - normal.kcal, 300); aprox(treino.carb - normal.carb, 75); aprox(treino.prot, normal.prot);
  const antes = G2.metaDoDia(comExtra, '2026-01-10', 80, { treino: true });
  aprox(antes.kcal, G2.metaDoDia(comExtra, '2026-01-10', 80).kcal, 1e-9, 'antes do extra existir');
});
const D2 = await import('../js/diary.js');
t('Refeições salvas: snapshot sem ids e lançamento com ids novos', () => {
  const it1 = D2.criarItem(arroz, 150), it2 = D2.criarItem(frango, 120);
  const s = D2.criarRefeicaoSalva('Almoço padrão', [it1, it2]);
  eq(s.itens.length, 2); eq(s.itens[0].id, undefined);
  const d = D2.lancarSalva(D2.diaVazio('2026-01-01'), 'almoco', 'Almoço', s);
  eq(d.refeicoes.almoco.length, 2); if (d.refeicoes.almoco[0].id === it1.id) throw new Error('id repetido');
  aprox(D2.totalDia(d).kcal, it1.n.kcal + it2.n.kcal);
});
t('Sugestões pela refeição: frequência ≥ 2, mais frequente primeiro', () => {
  const dia = (data, ids) => ({ data, nomes: {}, refeicoes: { cafe: ids.map((id) => ({ foodId: id, g: 50, porcao: null, n: { kcal: 1, prot: 0 } })) } });
  const s = D2.sugestoesRefeicao([dia('2026-01-01', ['pao', 'cafe']), dia('2026-01-02', ['pao', 'leite']), dia('2026-01-03', ['pao', 'cafe']), dia('2026-01-04', ['leite'])], 'cafe');
  eq(s.map((x) => x.foodId).join(','), 'pao,leite,cafe'); eq(s[0].vezes, 3);
  eq(D2.alvoProteinaRefeicao(80), 32);
});
t('Proteína por refeição e anotações do dia', () => {
  const it = (prot) => ({ n: { kcal: 100, prot } });
  const ds = [{ data: '2026-01-01', nomes: {}, refeicoes: { cafe: [it(10), it(15)], almoco: [it(40)] }, tags: ['treino'] },
    { data: '2026-01-02', nomes: {}, refeicoes: { cafe: [it(20)], almoco: [] }, nota: 'festa' }];
  const r = P.proteinaPorRefeicao(ds);
  aprox(r.find((x) => x.id === 'cafe').prot, 22.5); eq(r.find((x) => x.id === 'almoco').dias, 1);
  eq(P.anotacoesEntre(ds, '2026-01-01', '2026-01-07').length, 2);
});
const F2 = await import('../js/foods.js');
t('Correspondência IA → TACO (exata e por aproximação)', () => {
  const c1 = F2.correspondencias(idx, { nomeTaco: 'Arroz, tipo 1, cozido', nome: 'Arroz' });
  eq(c1.exata, true); eq(c1.opcoes[0].nome, 'Arroz, tipo 1, cozido');
  const c2 = F2.correspondencias(idx, { nomeTaco: 'Banana, prata, crua, xyzinexistente', nome: 'qwerty' });
  eq(c2.exata, false); if (!c2.opcoes[0]?.nome.startsWith('Banana, prata')) throw new Error('aproximação');
  eq(F2.correspondencias(idx, { nomeTaco: '', nome: 'zzzz' }).opcoes.length, 0);
});
const IA2 = await import('../js/ia.js');
t('Rótulo: por porção vira por 100 g; por 100 g mantém', () => {
  const a = IA2.rotuloParaAlimento({ nome: 'Whey', marca: 'Marca X', porcao_g: 30, porcao_desc: '1 scoop', base: 'porcao', kcal: 120, prot: 24, carb: 3, gord: 1.5, sodio_mg: 60 });
  aprox(a.kcal, 400); aprox(a.prot, 80); aprox(a.sodio_mg, 200); eq(a.nome, 'Whey — Marca X'); eq(a.porcoes[0].g, 30); eq(a.porcoes[0].nome, '1 scoop');
  eq(a.falta.join(','), 'fibra');
  const b = IA2.rotuloParaAlimento({ nome: 'Granola', base: '100g', kcal: 420, prot: 9 });
  aprox(b.kcal, 420); eq(b.porcoes.length, 0);
  eq(IA2.rotuloParaAlimento({ nome: 'x', base: 'porcao', kcal: 100 }), null, 'porção sem gramas');
  eq(IA2.rotuloParaAlimento({ nome: 'x' }), null, 'sem kcal');
});
t('IA: nome no estilo TACO é preservado', () => {
  eq(IA2.normalizarEstimativa({ itens: [{ nome: 'Arroz', nome_taco: 'Arroz, tipo 1, cozido', gramas: 100, kcal: 128, prot: 2.5, carb: 28, gord: 0.2 }] }).itens[0].nomeTaco, 'Arroz, tipo 1, cozido');
});

// ---------- Pacote 4 ----------
const OFF4 = await import('../js/off.js');
t('Código de barras: dígito verificador GTIN', () => {
  eq(OFF4.digitoOk('7891000100103'), true); eq(OFF4.digitoOk('7891000100104'), false);
  eq(OFF4.digitoOk('96385074'), true); eq(OFF4.digitoOk('036000291452'), true); eq(OFF4.digitoOk('123'), false);
});
const M4 = await import('../js/micros.js');
t('Micronutrientes: soma por gramas, cobertura e referência por sexo', () => {
  const ovo = { id: 'o', nome: 'Ovo', kcal: 146, prot: 13, carb: 0.6, gord: 9.5, fibra: 0, sodio_mg: 146, mic: { calcio_mg: 49, ferro_mg: 1.5 } };
  const it = D2.criarItem(ovo, 100);
  eq(it.por100.mic.calcio_mg, 49, 'snapshot guarda mic');
  eq(D2.alterarQuantidade(it, 50).por100.mic.ferro_mg, 1.5, 'mic sobrevive à edição');
  const rap = D2.criarItemRapido({ nome: 'x', kcal: 146 });
  const r = M4.somarMicros([D2.criarItem(ovo, 50), rap]);
  aprox(r.tot.calcio_mg, 24.5); aprox(r.cobertura, 73 / (73 + 146));
  const fe = M4.MICROS.find((m) => m[0] === 'ferro_mg'), mg = M4.MICROS.find((m) => m[0] === 'magnesio_mg');
  eq(M4.refMicro(fe, 'M'), 8); eq(M4.refMicro(fe, 'F'), 18); eq(M4.refMicro(mg, 'M', 35), 420);
});
const E4 = await import('../js/exportar.js');
t('CSV do diário: separador ;, vírgula decimal, aspas e BOM', () => {
  let d = D2.adicionarItem(D2.diaVazio('2026-10-08'), 'almoco', 'Almoço', D2.criarItem({ ...arroz, nome: 'Arroz; "tipo 1"' }, 150));
  d = { ...d, tags: ['treino'], nota: 'perna' };
  const c = E4.csvItens([d], { almoco: 'Almoço' }).split('\r\n');
  eq(c[0].charCodeAt(0), 0xFEFF); eq(c.length, 2);
  if (!c[1].startsWith('08/10/2026;Almoço;"Arroz; ""tipo 1""";150;;192;3,8')) throw new Error(c[1]);
  const t2 = E4.csvTotais([d], () => ({ kcal: 2000, prot: 150, carb: 200, gord: 60 })).split('\r\n');
  if (!t2[1].startsWith('08/10/2026;192;2000;3,8;150')) throw new Error(t2[1]);
  if (!t2[1].endsWith(';treino;perna')) throw new Error(t2[1]);
});
t('Base TACO traz micronutrientes (ex.: ovo cozido, laranja)', () => {
  const ovo = base.find((f) => f.id === 'taco-488'), lar = base.find((f) => f.id === 'taco-210');
  eq(ovo.mic.colest_mg, 397); eq(ovo.mic.vita_ug, 32); eq(lar.mic.vitc_mg, 34.7);
  if (base.filter((f) => f.mic).length < 500) throw new Error('poucos alimentos com micronutrientes');
});

// ---------- Pacote 5 ----------
const C5 = await import('../js/cores.js');
t('Cores: padrão não gera CSS; personalizadas geram claro e escuro', () => {
  eq(C5.cssCores({}), '');
  eq(C5.cssCores({ ...C5.CORES_PADRAO }), '');
  const css = C5.cssCores({ prot: '#123456' });
  if (!css.includes('--prot:#123456') || !css.includes('[data-tema="escuro"]') || css.includes('--acento')) throw new Error(css);
  const a = C5.cssCores({ acento: '#2f5f9e' });
  if (!a.includes('--acento:#2f5f9e') || !a.includes('--bg:') || !a.includes('prefers-color-scheme: dark')) throw new Error(a);
});
t('Parcela das refeições: padrão soma 100%, personalizada e refeição nova', () => {
  const refs = [{ id: 'cafe' }, { id: 'almoco' }, { id: 'lanche' }, { id: 'jantar' }, { id: 'ceia' }];
  const d = D2.distribuicaoRefeicoes(refs);
  aprox(d.cafe, 0.25); aprox(d.almoco, 0.35); aprox(Object.values(d).reduce((s, v) => s + v, 0), 1);
  const d2 = D2.distribuicaoRefeicoes([...refs, { id: 'pre' }], {});          // padrão já soma 100 → nova ganha parte igual e tudo é normalizado
  aprox(Object.values(d2).reduce((s, v) => s + v, 0), 1); aprox(d2.pre, 1 / 7);
  const d3 = D2.distribuicaoRefeicoes([{ id: 'a' }, { id: 'b' }]);           // sem referência: divide igual
  aprox(d3.a, 0.5);
  const d4 = D2.distribuicaoRefeicoes(refs, { cafe: 30, almoco: 33.3, lanche: 9.5, jantar: 23.8, ceia: 3.4 });
  aprox(d4.cafe, 0.3);
});
const U5 = await import('../js/utils.js');
t('Gramas sem casas decimais só na exibição', () => {
  eq(U5.fmtG(38.2), '38'); eq(U5.fmtG(38.6), '39'); eq(U5.fmtG(null), '—');
});

// ---------- Pacote 6 ----------
const L6 = await import('../js/layout-ordem.js');
t('Layout: sem ordem salva = padrão; ids desconhecidos e repetidos saem', () => {
  eq(L6.mesclarOrdem(['a', 'b', 'c']).join(), 'a,b,c');
  eq(L6.mesclarOrdem(['a', 'b', 'c'], ['c', 'x', 'a', 'c', 'b']).join(), 'c,a,b');
});
t('Layout: bloco novo (versão futura) entra na posição padrão', () => {
  eq(L6.mesclarOrdem(['a', 'novo', 'b', 'c'], ['c', 'b', 'a']).join(), 'c,novo,b,a');
  eq(L6.mesclarOrdem(['a', 'b', 'fim'], ['b', 'a']).join(), 'b,a,fim');
});
t('Layout: ordenar elementos pela ordem (desconhecidos no fim, estável, sem mutar)', () => {
  const els = [{ b: 'agua' }, { b: '?' }, { b: 'semana' }, { b: 'resumo' }];
  const r = L6.ordenarPorOrdem(els, ['semana', 'resumo', 'agua'], (e) => e.b);
  eq(r.map((e) => e.b).join(), 'semana,resumo,agua,?'); eq(els[0].b, 'agua');
  eq(L6.ordenarPorOrdem(['x', 'y', 'b', 'a'], ['a', 'b']).join(), 'a,b,x,y');
});
t('Layout: blocos padrão sem ids repetidos em cada tela', () => {
  for (const [tela, l] of Object.entries(L6.BLOCOS)) eq(new Set(l.map(([id]) => id)).size, l.length, tela);
});
const F6 = await import('../js/foods.js');
t('ehLiquido: bebidas sim; pó, condensado e sólidos não', () => {
  eq(F6.ehLiquido({ nome: 'Leite, de vaca, integral', grupo: 'Leite e derivados' }), true);
  eq(F6.ehLiquido({ nome: 'Suco de laranja', grupo: '' }), true);
  eq(F6.ehLiquido({ nome: 'Café, infusão 10%', grupo: '' }), true);
  eq(F6.ehLiquido({ nome: 'Qualquer', grupo: 'Bebidas (alcoólicas e não alcoólicas)' }), true);
  eq(F6.ehLiquido({ nome: 'Leite, de vaca, integral, pó', grupo: '' }), false);
  eq(F6.ehLiquido({ nome: 'Leite, condensado', grupo: '' }), false);
  eq(F6.ehLiquido({ nome: 'Arroz, tipo 1, cozido', grupo: 'Cereais' }), false);
  eq(F6.ehLiquido({ nome: 'Chocolate, ao leite', grupo: '' }), false);
});
t('Densidade mL→g: porcoes.json (leite 1,03, óleo/azeite 0,92, mel 1,42), campo próprio e padrão 1', () => {
  const tab = JSON.parse(readFileSync(new URL('../porcoes.json', import.meta.url), 'utf8'));
  if (!tab.densidades?.fonte) throw new Error('densidades sem fonte citada');
  aprox(F6.densidadeDe({ nome: 'Leite, de vaca, integral' }, tab), 1.03);
  aprox(F6.densidadeDe({ nome: 'Óleo, de soja' }, tab), 0.92);
  aprox(F6.densidadeDe({ nome: 'Azeite, de oliva, extra virgem' }, tab), 0.92);
  aprox(F6.densidadeDe({ nome: 'Mel, de abelha' }, tab), 1.42);
  aprox(F6.densidadeDe({ nome: 'Melancia, crua' }, tab), 1);
  aprox(F6.densidadeDe({ nome: 'Leite, de vaca, integral, pó' }, tab), 1);
  aprox(F6.densidadeDe({ nome: 'Leite, condensado' }, tab), 1);
  aprox(F6.densidadeDe({ nome: 'Suco de uva' }, tab), 1);
  aprox(F6.densidadeDe({ nome: 'Meu leite', densidade: 1.035 }, tab), 1.035);
  aprox(F6.densidadeDe({ nome: 'Leite' }, {}), 1);
});

// ---------- Pacote 7 ----------
const I7 = await import('../js/inteligencia.js');
const fArroz = { id: 'arroz', nome: 'Arroz cozido', kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2 };
const fFrango = { id: 'frango', nome: 'Frango grelhado', kcal: 159, prot: 32, carb: 0, gord: 2.5 };
const fAzeite = { id: 'azeite', nome: 'Azeite', kcal: 884, prot: 0, carb: 0, gord: 100 };
const fLeite = { id: 'leite', nome: 'Leite integral', kcal: null };
const itemDe = (f, g) => ({ foodId: f.id, nome: f.nome, g, n: { kcal: (f.kcal || 0) * g / 100 } });
const diaCom = (data, ref, ...its) => ({ data, refeicoes: { [ref]: its } });
t('Candidatos: frequência, mediana dos gramas, favoritos e sem kcal fora', () => {
  const ds = [diaCom('2026-01-01', 'almoco', itemDe(fArroz, 100), itemDe(fFrango, 120)), diaCom('2026-01-02', 'almoco', itemDe(fArroz, 200)),
    diaCom('2026-01-03', 'almoco', itemDe(fArroz, 150), itemDe(fLeite, 200))];
  const por = { arroz: fArroz, frango: fFrango, azeite: fAzeite, leite: fLeite };
  const c = I7.candidatosFrequentes(ds, (id) => por[id], { favoritos: ['azeite'], ultimaQtd: { azeite: { g: 10 } } });
  eq(c.map((x) => x.food.id).join(), 'arroz,azeite,frango');
  eq(c[0].gTipico, 150); eq(c.find((x) => x.food.id === 'azeite').gTipico, 10);
  eq(I7.candidatosFrequentes(ds, (id) => por[id], { refId: 'cafe' }).length, 0);
  eq(I7.candidatosFrequentes(ds, (id) => por[id], { refId: 'almoco' }).length, 2);
});
t('O que comer agora: combinações próximas do restante, distintas, dentro dos limites de porção', () => {
  const cands = [{ food: fArroz, gTipico: 150, vezes: 5 }, { food: fFrango, gTipico: 120, vezes: 4 }, { food: fAzeite, gTipico: 10, vezes: 2 }];
  const r = { kcal: 600, prot: 45, carb: 60, gord: 10 };
  const combos = I7.sugerirCombinacoes(r, cands);
  if (!combos.length || combos.length > 3) throw new Error('n combos ' + combos.length);
  const melhor = combos[0];
  if (Math.abs(melhor.tot.kcal - 600) > 120) throw new Error('kcal longe: ' + melhor.tot.kcal);
  for (const c of combos) for (const it of c.itens) {
    const ct = cands.find((x) => x.food === it.food);
    if (it.g < ct.gTipico * 0.5 - 5 || it.g > ct.gTipico * 2 + 5 || it.g % 5) throw new Error('porção fora: ' + it.food.id + ' ' + it.g);
  }
  eq(new Set(combos.map((c) => c.itens.map((i) => i.food.id).sort().join())).size, combos.length);
  for (let i = 1; i < combos.length; i++) if (combos[i].erro < combos[i - 1].erro) throw new Error('ordem');
});
t('O que comer agora: meta batida ou sem candidatos = nenhuma sugestão', () => {
  eq(I7.sugerirCombinacoes({ kcal: 30, prot: 0, carb: 0, gord: 0 }, [{ food: fArroz, gTipico: 100 }]).length, 0);
  eq(I7.sugerirCombinacoes({ kcal: 500, prot: 30, carb: 50, gord: 10 }, []).length, 0);
  eq(I7.erroCombinacao({ kcal: 500, prot: 30, carb: 50, gord: 10 }, { kcal: 500, prot: 30, carb: 50, gord: 10 }), 0);
  if (!(I7.erroCombinacao({ kcal: 600, prot: 30, carb: 50, gord: 10 }, { kcal: 500, prot: 30, carb: 50, gord: 10 })
    > I7.erroCombinacao({ kcal: 400, prot: 30, carb: 50, gord: 10 }, { kcal: 500, prot: 30, carb: 50, gord: 10 }))) throw new Error('passar deve pesar mais');
});
t('Próxima refeição: parcela entre as refeições vazias a partir dela', () => {
  const ordem = ['cafe', 'almoco', 'lanche', 'jantar', 'ceia'], dist = { cafe: 0.25, almoco: 0.35, lanche: 0.1, jantar: 0.25, ceia: 0.05 };
  aprox(I7.fracaoProximaRefeicao('lanche', ordem, new Set(['lanche', 'jantar', 'ceia']), dist), 0.25);
  aprox(I7.fracaoProximaRefeicao('jantar', ordem, new Set(['jantar']), dist), 1);
  aprox(I7.fracaoProximaRefeicao('almoco', ordem, new Set(['jantar']), dist), 0.35 / 0.6);   // almoço já tem itens: conta ele + vazias seguintes
  aprox(I7.fracaoProximaRefeicao('x', ordem, new Set(), dist), 1);
});
t('Refeição de sempre: alimentos em ≥ 40% dos dias (mín. 3 dias), item mais recente', () => {
  const pao = { id: 'pao', nome: 'Pão' }, cafe = { id: 'cafe', nome: 'Café' }, ovo = { id: 'ovo', nome: 'Ovo' };
  const ds = [diaCom('2026-01-01', 'cafe', itemDe(pao, 50), itemDe(cafe, 100)), diaCom('2026-01-02', 'cafe', itemDe(pao, 50), itemDe(ovo, 50)),
    diaCom('2026-01-03', 'cafe', itemDe(pao, 60), itemDe(cafe, 120)), diaCom('2026-01-04', 'cafe', itemDe(pao, 70))];
  const s = I7.refeicaoDeSempre(ds, 'cafe');
  eq(s.map((i) => i.foodId).join(), 'pao,cafe'); eq(s[0].g, 70); eq(s[1].g, 120);
  eq(I7.refeicaoDeSempre(ds.slice(0, 2), 'cafe').length, 0);
  eq(I7.refeicaoDeSempre(ds, 'jantar').length, 0);
});
t('Lançamento suspeito: azeite em excesso, kcal enorme, muito acima do usual e do padrão', () => {
  if (!I7.avaliarSuspeito(fAzeite, 1000)) throw new Error('1000 g azeite');
  eq(I7.avaliarSuspeito(fAzeite, 13), null);
  if (!I7.avaliarSuspeito(fArroz, 2000)) throw new Error('arroz 2000 g');
  eq(I7.avaliarSuspeito(fArroz, 200), null);
  if (!I7.avaliarSuspeito(fArroz, 900, { gUsual: 150 })) throw new Error('6× o usual');
  eq(I7.avaliarSuspeito(fArroz, 300, { gUsual: 150 }), null);
  const hist = Array.from({ length: 40 }, (_, i) => 100 + i * 5);   // itens de 100 a 295 kcal
  if (!I7.avaliarSuspeito({ nome: 'x', kcal: 900 }, 100, { kcalItensUsuario: hist })) throw new Error('acima do padrão');
  eq(I7.avaliarSuspeito({ nome: 'x', kcal: 500 }, 100, { kcalItensUsuario: hist }), null);
  eq(I7.percentil([1, 2, 3, 4], 0.5), 2); eq(I7.percentil([], 0.5), null);
});

// ---------- Pacote 8 ----------
const Q8 = await import('../js/ia-cota.js');
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
t('Cota da IA: conta por dia local, zera no dia seguinte, limite editável e com faixa', () => {
  const st = memoria();
  eq(Q8.limiteDiario(st), Q8.LIMITE_PADRAO); eq(Q8.restantesHoje(st, '2026-10-09'), Q8.LIMITE_PADRAO);
  Q8.registrarUso(st, '2026-10-09'); Q8.registrarUso(st, '2026-10-09');
  eq(Q8.usoHoje(st, '2026-10-09'), 2); eq(Q8.restantesHoje(st, '2026-10-09'), Q8.LIMITE_PADRAO - 2);
  eq(Q8.usoHoje(st, '2026-10-10'), 0);
  Q8.registrarUso(st, '2026-10-10'); eq(Q8.usoHoje(st, '2026-10-10'), 1);
  Q8.definirLimite(1, st); eq(Q8.restantesHoje(st, '2026-10-10'), 0);
  Q8.definirLimite(9999, st); eq(Q8.limiteDiario(st), Q8.LIMITE_PADRAO);
  eq(Q8.usoHoje(null, '2026-10-10'), 0);
});
const L8 = await import('../js/ia-local.js');
const dispLocal8 = await L8.localDisponivel();
t('IA do Chrome: esquema do Gemini vira JSON Schema; sem LanguageModel = indisponível', () => {
  const js = L8.paraJsonSchema({ type: 'OBJECT', properties: { a: { type: 'NUMBER' }, l: { type: 'ARRAY', items: { type: 'STRING' } },
    e: { type: 'STRING', enum: ['x'] }, n: { type: 'STRING', nullable: true } }, required: ['a'] });
  eq(js.type, 'object'); eq(js.properties.a.type, 'number'); eq(js.properties.l.items.type, 'string');
  eq(js.properties.e.enum[0], 'x'); eq(js.required[0], 'a'); eq(JSON.stringify(js.properties.n.type), '["string","null"]');
  eq(dispLocal8, false);
});
const IA8 = await import('../js/ia.js');
t('Coach: resposta limpa (até 3 observações + ação), inválida = null', () => {
  const r = IA8.normalizarCoach({ observacoes: [' a ', '', 'b', 'c', 'd'], acao: ' faça x ' });
  eq(r.observacoes.join('|'), 'a|b|c'); eq(r.acao, 'faça x');
  eq(IA8.normalizarCoach({ observacoes: [], acao: 'x' }), null); eq(IA8.normalizarCoach({ observacoes: ['a'] }), null); eq(IA8.normalizarCoach(null), null);
});
const C8 = await import('../js/coach.js');
t('Coach: só números agregados (sem nomes de alimentos nem notas), arredondados', () => {
  const rel = { inicio: '2026-09-28', fim: '2026-10-04', registrados: 6, aderencia: { dentro: 4, acima: 1, abaixo: 1 },
    medias: { consumo: { kcal: 2210.4, prot: 150.6, carb: 240.2, gord: 70.1, fibra: 25.5, sodio_mg: 2300.7 }, meta: { kcal: 2200, prot: 160, carb: 250, gord: 70 } },
    deltaPeso: -0.34, pesoFim: 79.66 };
  const relAnt = { registrados: 5, aderencia: { dentro: 2 }, medias: { consumo: { kcal: 2400 } } };
  const n = C8.numerosCoach({ rel, relAnt, perfil: { objetivo: 'perder', ritmo: 0.5, nome: 'Fulano' }, pesoKg: 80,
    tags: C8.contarEtiquetas([{ tags: ['treino'], nota: 'segredo' }, { tags: ['treino', 'festa'] }]) });
  eq(n.media_diaria.kcal, 2210); eq(n.media_diaria.proteina_g, 151); eq(n.proteina_g_por_kg, 1.9);
  eq(n.variacao_peso_semana_kg, -0.3); eq(n.peso_tendencia_kg, 79.7); eq(n.ritmo_planejado_kg_semana, 0.5);
  eq(n.semana_anterior.media_kcal, 2400); eq(n.etiquetas_dias.treino, 2); eq(n.etiquetas_dias.festa, 1);
  const txt = JSON.stringify(n);
  if (txt.includes('segredo') || txt.includes('Fulano')) throw new Error('vazou texto pessoal');
  eq(C8.numerosCoach({ rel: { ...rel, deltaPeso: null, pesoFim: null }, perfil: { objetivo: 'manter' } }).ritmo_planejado_kg_semana, 0);
});
t('Coach: cache por semana guarda as 12 mais recentes', () => {
  let c = {};
  for (let i = 1; i <= 14; i++) c = C8.guardarResposta(c, `2026-01-${String(i).padStart(2, '0')}`, { acao: String(i) });
  eq(Object.keys(c).length, 12); eq(c['2026-01-14'].acao, '14'); eq(c['2026-01-01'], undefined);
});

// ---------- Pacote 9 ----------
// Contraste WCAG 2.x (W3C, "relative luminance" e "contrast ratio") dos pares de cores usados com texto.
const hex = (h) => { const v = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); };
const lumW = (rgb) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const l1 = lumW(a), l2 = lumW(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const css9 = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const tokens = (bloco) => Object.fromEntries([...bloco.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], hex(m[2])]));
const claro9 = tokens(css9.slice(css9.indexOf(':root {'), css9.indexOf('@media (prefers-color-scheme: dark)')));
const escuro9 = tokens(css9.slice(css9.indexOf(':root[data-tema="escuro"]'), css9.indexOf('/* ---------- Base')));
t('Contraste AA (≥ 4,5) dos textos nos dois temas', () => {
  const pares = [['txt', 'bg'], ['txt', 'sup'], ['txt', 'sup2'], ['txt2', 'bg'], ['txt2', 'sup'], ['txt2', 'sup2'], ['acento-txt', 'acento'],
    ['acento', 'sup'], ['alerta', 'sup'], ['perigo', 'sup'], ['bg', 'acento'], ['bg', 'alerta'], ['bg', 'perigo']];
  for (const [nome, tk] of [['claro', claro9], ['escuro', escuro9]]) {
    for (const [a, b] of pares) {
      if (!tk[a] || !tk[b]) throw new Error(`${nome}: faltou --${!tk[a] ? a : b}`);
      const r = contraste(tk[a], tk[b]);
      if (r < 4.5) throw new Error(`${nome}: --${a} sobre --${b} = ${r.toFixed(2)}`);
    }
  }
  // calendário "abaixo": no claro o fundo é a água escurecida (78% + preto); no escuro, a própria água
  if (contraste(claro9.bg, claro9.agua.map((c) => c * 0.78)) < 4.5) throw new Error('claro: dia abaixo da meta');
  if (contraste(escuro9.bg, escuro9.agua) < 4.5) throw new Error('escuro: dia abaixo da meta');
});
const V9 = await import('../js/vazio.js');
t('Estado vazio: ilustração SVG decorativa + título + texto', () => {
  const h = V9.estadoVazio('estrela', 'Sem favoritos', 'Toque em ☆');
  if (!h.includes('<svg') || !h.includes('aria-hidden="true"') || !h.includes('Sem favoritos') || !h.includes('Toque em ☆')) throw new Error(h);
  if (!V9.estadoVazio('inexistente', 'x').includes('<svg')) throw new Error('fallback');
});

// ---------- Pacote 10: sistema de design ----------
{
  const { readdirSync } = process.getBuiltinModule('node:fs');
  const arqs10 = ['index.html', ...readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
    ...readdirSync(new URL('../js/views/', import.meta.url)).map((f) => 'js/views/' + f)];
  const fonte10 = Object.fromEntries(arqs10.map((a) => [a, readFileSync(new URL('../' + a, import.meta.url), 'utf8')]));
  // Emoji só em conteúdo digitado pelo usuário: nenhum na interface. Lista permitida (arquivo → caracteres), hoje vazia.
  const PERMITIDOS = {};
  t('Interface sem emoji (ícones só do sprite)', () => {
    const re = /[\p{Extended_Pictographic}★☆⇅✓✕✗↺▲▼]/gu;
    const achados = [];
    for (const [a, txt] of Object.entries(fonte10)) {
      txt.split('\n').forEach((l, i) => { for (const m of l.matchAll(re)) if (!(PERMITIDOS[a] || []).includes(m[0])) achados.push(`${a}:${i + 1} ${m[0]}`); });
    }
    if (achados.length) throw new Error(achados.join(', '));
  });
  t('Todo ícone usado existe no sprite e o sprite não tem sobra', () => {
    const sprite = readFileSync(new URL('../icons/sprite.svg', import.meta.url), 'utf8');
    const noSprite = new Set([...sprite.matchAll(/<symbol id="([a-z0-9-]+)"/g)].map((m) => m[1]));
    const usados = new Set();
    for (const txt of Object.values(fonte10)) {
      for (const m of txt.matchAll(/\bic\(\s*'([a-z0-9-]+)'/g)) usados.add(m[1]);
      for (const m of txt.matchAll(/sprite\.svg#([a-z0-9-]+)/g)) usados.add(m[1]);
    }
    const faltam = [...usados].filter((n) => !noSprite.has(n));
    if (faltam.length) throw new Error('faltam no sprite (rode node scripts/gerar_sprite.mjs): ' + faltam.join(', '));
    if (noSprite.size < usados.size) throw new Error('sprite menor que o usado');
  });
  t('Nenhum <svg> de ícone desenhado à mão nas telas (só sprite, gráficos e ilustrações)', () => {
    // permitidos: gráficos (chart.js, roscas, anel), ilustrações (vazio.js, tour.js) e o próprio helper
    const livres = ['js/chart.js', 'js/vazio.js', 'js/views/tour.js', 'js/views/detalhe-dia.js', 'js/views/diario.js', 'js/views/relatorio-pdf.js', 'js/views/progresso.js', 'js/icones.js'];
    const ruins = Object.entries(fonte10).filter(([a, txt]) => !livres.includes(a) && /<svg viewBox="0 0 24 24"/.test(txt)).map(([a]) => a);
    if (ruins.length) throw new Error(ruins.join(', '));
  });
  const { ic: ic10 } = await import('../js/icones.js');
  t('ic(): svg decorativo com <use> para o sprite', () => {
    const h = ic10('star', 'p cheio');
    if (!h.includes('aria-hidden="true"') || !h.includes('href="icons/sprite.svg#star"') || !h.includes('class="i p cheio"')) throw new Error(h);
  });
  t('DESIGN.md documenta os tokens usados no CSS', () => {
    const design = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');
    for (const tk of ['--fs-16', '--e4', '--r-m', '--elev-3', '--dur-m', '--curva-enfase', '--camada-press', '--escala-fonte']) {
      if (!css9.includes(tk + ':')) throw new Error('CSS sem ' + tk);
      if (!design.includes(tk)) throw new Error('DESIGN.md sem ' + tk);
    }
  });
}

// ---------- Pacote 11: Diário ----------
{
  const D11 = await import('../js/diary.js');
  const M11 = await import('../js/micros.js');
  const ts = (data, h, m) => new Date(`${data}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
  t('Horário do item: lançado no dia usa a hora; antigo/copiado usa o padrão da refeição', () => {
    if (D11.minutoDoItem({ ts: ts('2026-10-09', 8, 15) }, '2026-10-09', 'cafe') !== 495) throw new Error('hora do lançamento');
    if (D11.minutoDoItem({ ts: ts('2026-10-08', 8, 15) }, '2026-10-09', 'jantar') !== 20 * 60) throw new Error('outro dia → padrão');
    if (D11.minutoDoItem({}, '2026-10-09', 'almoco') !== 12 * 60 + 30) throw new Error('sem horário → padrão');
    if (D11.copiarItens([{ id: 'a', ts: 1, n: {} }])[0].ts !== undefined) throw new Error('cópia não leva o horário');
    const it = D11.criarItem({ id: 'x', nome: 'x', kcal: 100 }, 100);
    if (!(it.ts > 0)) throw new Error('item novo sem ts');
  });
  t('Linha do tempo ordena por horário entre refeições', () => {
    const dia = { data: '2026-10-09', nomes: {}, refeicoes: {
      almoco: [{ id: 'a', ts: ts('2026-10-09', 13, 0) }], cafe: [{ id: 'c' }], lanche: [{ id: 'l', ts: ts('2026-10-09', 10, 30) }] } };
    const ordem = D11.linhaDoTempo(dia, D11.REFEICOES_PADRAO).map((x) => x.item.id).join('');
    if (ordem !== 'cla') throw new Error(ordem);
  });
  t('Micronutrientes mais distantes da referência (sem colesterol)', () => {
    const itens = [{ g: 100, n: { kcal: 100 }, por100: { mic: { calcio_mg: 500, vitc_mg: 90, ferro_mg: 1 } } }];
    const r = M11.microsMaisDistantes(itens, 'M', 30, 3);
    if (r.length !== 3 || r.some((m) => m.campo === 'colest_mg') || r[0].frac > r[2].frac) throw new Error(JSON.stringify(r));
    if (r.some((m) => m.campo === 'vitc_mg')) throw new Error('vit C está na meta');
    if (M11.microsMaisDistantes([{ g: 100, n: { kcal: 100 } }], 'M', 30).length) throw new Error('sem dados → vazio');
  });
}

// ---------- Pacote 12: busca e frases ----------
{
  const F12 = await import('../js/foods.js');
  const FR12 = await import('../js/frase.js');
  const I12 = await import('../js/inteligencia.js');
  const { CASOS, HISTORICO } = await import('./frases.js');
  const foods12 = JSON.parse(readFileSync(new URL('../foods.json', import.meta.url), 'utf8'));
  const tab12 = JSON.parse(readFileSync(new URL('../porcoes.json', import.meta.url), 'utf8'));
  const ind12 = F12.criarIndice(foods12);
  const nomes = (q, o = {}) => F12.buscar(ind12, q, { limite: 3, sinonimos: tab12.sinonimos, ...o }).map((f) => f.nome);
  t('Busca: sinônimos regionais (aipim, macaxeira, bergamota, jerimum, cacetinho)', () => {
    for (const [q, esp] of [['aipim', 'Mandioca'], ['macaxeira', 'Mandioca'], ['bergamota', 'Tangerina'], ['mexerica', 'Tangerina'], ['jerimum', 'Abóbora'], ['cacetinho', 'Pão, trigo, francês']]) {
      if (!nomes(q)[0]?.startsWith(esp)) throw new Error(`${q} → ${nomes(q)[0]}`);
    }
  });
  t('Busca: erro de digitação (1–2 letras) e plural', () => {
    if (!nomes('fejão')[0]?.startsWith('Feijão')) throw new Error('fejão → ' + nomes('fejão')[0]);
    if (!nomes('brocolis cozdo')[0]?.startsWith('Brócolis, cozido')) throw new Error('brocolis cozdo');
    if (!nomes('ovos')[0]?.startsWith('Ovo')) throw new Error('ovos → ' + nomes('ovos')[0]);
    if (!nomes('maçã')[0]?.startsWith('Maçã')) throw new Error('maçã → ' + nomes('maçã')[0]);
    if (F12.distancia('arroz', 'aroz', 2) !== 1 || F12.distancia('abc', 'xyzw', 1) !== 2) throw new Error('distância');
  });
  t('Busca: frequência/recência/horário e escolha anterior sobem o alimento', () => {
    const hoje = '2026-10-09';
    const diarios = [{ data: '2026-10-08', refeicoes: { almoco: [{ foodId: 'taco-561' }, { foodId: 'taco-561' }] } },
      { data: '2026-07-01', refeicoes: { cafe: [{ foodId: 'taco-560' }] } }, { data: '2026-10-08', refeicoes: { almoco: [{ foodId: 'taco-999', planejado: true }] } }];
    const b = I12.pesosBusca(diarios, { refId: 'almoco', hoje });
    if (!(b.get('taco-561') > b.get('taco-560'))) throw new Error('recente e frequente deve pesar mais');
    if (b.has('taco-999')) throw new Error('planejado não conta');
    if (b.get('taco-561') > 0.9) throw new Error('bônus acima de 0,9');
    if (nomes('feijao', { bonus: b })[0] !== 'Feijão, carioca, cozido') throw new Error(nomes('feijao', { bonus: b })[0]);
    if (nomes('arroz', { escolha: 'taco-4' })[0] !== foods12.find((f) => f.id === 'taco-4').nome) throw new Error('escolha');
  });
  t('Números por extenso e frações', () => {
    const d = (s) => FR12.numerosParaDigitos(s.split(' ')).join(' ');
    for (const [a, b] of [['duzentos e cinquenta', '250'], ['cento e vinte e cinco', '125'], ['um e meio', '1.5'], ['meia', '0.5'], ['um quarto', '0.25'], ['tres', '3'], ['2 e meia', '2.5']]) {
      if (d(a) !== b) throw new Error(`${a} → ${d(a)}`);
    }
  });
  const ctx12 = { indice: ind12, porcoesDe: (f) => F12.porcoesDe(f, tab12), densidade: (f) => F12.densidadeDe(f, tab12),
    sinonimos: tab12.sinonimos, escolhas: HISTORICO.escolhas, bonus: new Map(HISTORICO.bonus), ultimaQtd: {} };
  t(`Interpretador local: ${CASOS.length} frases reais`, () => {
    if (CASOS.length < 40) throw new Error('menos de 40 frases');
    const erros = [];
    for (const [frase, esperado] of CASOS) {
      const r = FR12.interpretar(frase, ctx12).map((i) => [i.food?.id ?? null, Math.round((i.g || 0) * 10) / 10, !!i.incerto]);
      if (JSON.stringify(r) !== JSON.stringify(esperado)) erros.push(`"${frase}": ${JSON.stringify(r)} ≠ ${JSON.stringify(esperado)}`);
    }
    if (erros.length) throw new Error(erros.join('\n    '));
  });
  t('Interpretador usa a última quantidade do alimento quando a frase não diz a medida', () => {
    const r = FR12.interpretar('2 bananas', { ...ctx12, ultimaQtd: { 'taco-182': { g: 100, porcao: { nome: 'unidade grande', g: 100, qtd: 1 } } } })[0];
    if (r.g !== 200 || r.porcao.nome !== 'unidade grande' || r.incerto) throw new Error(JSON.stringify(r));
  });
  const D12 = await import('../js/diary.js');
  t('Planejados: não somam, não marcam o dia, confirmam com horário', () => {
    const dia = { data: '2026-10-10', nomes: {}, refeicoes: { almoco: [{ id: 'a', n: { kcal: 300, prot: 20 }, planejado: true }, { id: 'b', n: { kcal: 100, prot: 5 } }] } };
    if (D12.totalDia(dia).kcal !== 100) throw new Error('planejado somou');
    if (!D12.temConsumo(dia) || D12.temConsumo({ refeicoes: { a: [{ planejado: true }] } })) throw new Error('temConsumo');
    const c = D12.confirmarPlanejado(dia, 'almoco', 'a');
    if (c.refeicoes.almoco[0].planejado || !(c.refeicoes.almoco[0].ts > 0) || D12.totalDia(c).kcal !== 400) throw new Error('confirmar');
    if (!dia.refeicoes.almoco[0].planejado) throw new Error('não pode alterar o original');
  });
  t('Copiar para vários dias: intervalo, dias da semana e cópia como planejada', () => {
    const ds = D12.datasNoIntervalo('2026-10-09', '2026-10-15', [0, 1, 2, 3, 4]);   // sex 09 → qui 15, só seg–sex
    if (ds.join() !== '2026-10-09,2026-10-12,2026-10-13,2026-10-14,2026-10-15') throw new Error(ds.join());
    if (D12.datasNoIntervalo('2026-01-01', '2026-12-31').length !== 62) throw new Error('limite de 62 datas');
    const origem = { data: '2026-10-09', nomes: { almoco: 'Almoço' }, refeicoes: { almoco: [{ id: 'x', ts: 5, n: { kcal: 500 } }] } };
    const { dia: d, n } = D12.copiarPara({ data: '2026-10-12', nomes: {}, refeicoes: {} }, origem, 'almoco', { planejado: true });
    const it = d.refeicoes.almoco[0];
    if (n !== 1 || !it.planejado || it.ts !== undefined || it.id === 'x' || D12.totalDia(d).kcal !== 0) throw new Error(JSON.stringify(it));
  });
  t('Receita: ingrediente cru preferido e o hábito do pronto passa para o cru', () => {
    const porId = (id) => foods12.find((f) => f.id === id);
    const r = FR12.interpretar('2 ovos', { ...ctx12, escolhas: {}, porId, preferirCru: true, bonus: new Map([['taco-488', 0.8]]) })[0];
    if (r.food.id !== foods12.find((f) => f.nome === 'Ovo, de galinha, inteiro, cru').id) throw new Error(r.food.nome);
    const r2 = FR12.interpretar('2 ovos', { ...ctx12, escolhas: {}, porId, bonus: new Map([['taco-488', 0.8]]) })[0];
    if (r2.food.id !== 'taco-488') throw new Error('na refeição, o hábito (cozido) vale: ' + r2.food.nome);
  });
  t('pareceFrase: só com número ou separador', () => {
    if (!FR12.pareceFrase('2 ovos') || !FR12.pareceFrase('arroz e feijão') || FR12.pareceFrase('arroz') || FR12.pareceFrase('feijão carioca')) throw new Error();
  });
}

// ---------- Pacote 14: inteligência prática ----------
{
  const CK = await import('../js/checkin.js');
  const PD = await import('../js/padroes.js');
  const NU = await import('../js/nutricao.js');
  const PG = await import('../js/perguntas.js');
  const hoje = '2026-10-12';                        // segunda-feira
  const dia = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  t('Check-in: gasto real → meta sugerida, texto sem julgamento, delta preserva dias', () => {
    // 28 dias comendo 2300 kcal e a tendência caindo 1 kg → gasto = 2300 + 7700/28 = 2575
    const dias = Array.from({ length: 28 }, (_, i) => ({ data: dia(hoje, -27 + i), tot: { kcal: 2300 } }));
    const tend = Array.from({ length: 28 }, (_, i) => ({ data: dia(hoje, -27 + i), y: 85 - i / 27 }));
    const metas = { modo: 'semana', base: { kcal: 2000, macroModo: 'pct' }, semana: Array.from({ length: 7 }, (_, i) => ({ kcal: 2000 + (i === 5 ? 300 : 0), macroModo: 'pct' })) };
    const c = CK.calcularCheckin({ dias, tend, hoje, perfil: { objetivo: 'perder', ritmo: 0.5 }, metas, mc: { ajuste: -550, piso: 1500 } });
    if (!c || Math.abs(c.tdee - 2575) > 1 || c.semana !== hoje) throw new Error(JSON.stringify(c));
    if (c.metaSugerida !== Math.round((c.tdee - 550) / 10) * 10 || c.emGramas) throw new Error('meta sugerida');
    const txt = CK.textoCheckin(c).join(' ');
    if (!/Gasto estimado/.test(txt) || /(falhou|ruim|errou|culpa)/i.test(txt)) throw new Error(txt);
    const m2 = CK.aplicarDeltaMetas(metas, 100);
    if (m2.semana[5].kcal - m2.semana[0].kcal !== 300 || m2.base.kcal !== 2100 || metas.base.kcal !== 2000) throw new Error('delta');
    if (CK.calcularCheckin({ dias: dias.slice(0, 5), tend: tend.slice(0, 5), hoje, perfil: {}, metas, mc: {} })) throw new Error('sem dados → null');
    const h = CK.registrarCheckin(CK.registrarCheckin([], { semana: 'a', x: 1 }), { semana: 'a', x: 2 });
    if (h.length !== 1 || h[0].x !== 2) throw new Error('histórico');
  });
  t('Padrões: fim de semana, proteína do café, sódio por etiqueta, café cedo', () => {
    const base = Array.from({ length: 21 }, (_, i) => {
      const data = dia('2026-09-21', i), sem = (new Date(data + 'T12:00').getDay() + 6) % 7;
      const ts = new Date(`${data}T${i % 2 ? '08' : '10'}:00:00`).getTime();
      const plantao = i % 4 === 0;
      return { data, tags: plantao ? ['plantao'] : [], meta: { kcal: 2000, sodio: 2000 },
        tot: { kcal: sem >= 5 ? 2600 : (i % 2 ? 2000 : 2500), sodio_mg: plantao ? 3000 : 1500 },
        refeicoes: { cafe: [{ ts, n: { prot: 10 } }] } };
    });
    const ps = PD.detectarPadroes(base, { peso: 80, nomesTags: { plantao: 'Plantão' } });
    const tipos = ps.map((p) => p.tipo);
    for (const tp of ['fds', 'prot-cafe', 'sodio-tag', 'cafe-cedo']) if (!tipos.includes(tp)) throw new Error('faltou ' + tp + ': ' + tipos);
    if (!ps.every((p) => /\d/.test(p.texto))) throw new Error('cada cartão precisa do número');
    if (PD.cartoesDaSemana(ps, ['fds']).some((p) => p.tipo === 'fds') || PD.cartoesDaSemana(ps).length !== 2) throw new Error('máx. 2 e ocultos');
  });
  t('Qualidade do dia: faixas, sem micros redistribui, sódio acima pesa', () => {
    const meta = { prot: 150, fibra: 30, sodio: 2000 };
    const boa = NU.qualidadeDia({ kcal: 2000, prot: 150, fibra: 30, sodio_mg: 1500 }, meta, []);
    if (boa.nota !== 100 || boa.faixa !== 'ótima' || boa.comMicros) throw new Error(JSON.stringify(boa));
    const ruim = NU.qualidadeDia({ kcal: 2000, prot: 30, fibra: 3, sodio_mg: 4000 }, meta, []);
    if (ruim.faixa !== 'baixa') throw new Error(JSON.stringify(ruim));
    if (NU.qualidadeDia({ kcal: 0 }, meta, []) !== null) throw new Error('dia vazio');
  });
  t('Lacuna de micronutriente e alimentos ricos por 100 kcal (preferindo os que você come)', () => {
    const itens = [{ g: 100, n: { kcal: 100 }, por100: { mic: { calcio_mg: 900, ferro_mg: 8, vitc_mg: 1 } } }];
    const l = NU.maiorLacuna(itens, 1, { sexo: 'M' });
    if (!l || l.frac > 0.2) throw new Error(JSON.stringify(l));
    const foods = [{ id: 'a', nome: 'Acerola, crua', grupo: 'Frutas e derivados', kcal: 50, mic: { vitc_mg: 50 } }, { id: 'b', nome: 'B', kcal: 300, mic: { vitc_mg: 60 } }, { id: 'c', nome: 'C', kcal: 2, mic: { vitc_mg: 9 } }, { id: 'd', nome: 'D', kcal: 40, mic: {} }, { id: 'e', nome: 'Fígado, cru', grupo: 'Carnes', kcal: 100, mic: { vitc_mg: 500 } }];
    const r = NU.alimentosRicos('vitc_mg', foods, new Set(['b']));
    if (r.seus[0]?.f.id !== 'b' || r.outros[0]?.f.id !== 'a' || r.outros.some((x) => ['c', 'd', 'e'].includes(x.f.id))) throw new Error(JSON.stringify(r));
  });
  t('Pergunte ao app: interpretação local e execução no aparelho', () => {
    const refs = [{ id: 'cafe', nome: 'Café da manhã' }, { id: 'jantar', nome: 'Jantar' }];
    const c = PG.interpretarPergunta('quanto de proteína comi no jantar nas últimas 2 semanas?', hoje, refs);
    if (c.nutriente !== 'prot' || c.refeicao !== 'jantar' || c.ini !== dia(hoje, -13) || c.agregacao !== 'media') throw new Error(JSON.stringify(c));
    const mx = PG.interpretarPergunta('maior sódio do mês', hoje, refs);
    if (mx.agregacao !== 'max' || mx.ini !== dia(hoje, -29)) throw new Error('max do mês');
    if (PG.interpretarPergunta('total de calorias ontem', hoje, refs).ini !== dia(hoje, -1)) throw new Error('ontem');
    if (PG.interpretarPergunta('como está o tempo', hoje, refs) !== null) throw new Error('sem nutriente → null');
    const diarios = [{ data: dia(hoje, -1), refeicoes: { jantar: [{ n: { prot: 40 } }, { n: { prot: 99 }, planejado: true }] } },
      { data: dia(hoje, -3), refeicoes: { jantar: [{ n: { prot: 20 } }], cafe: [{ n: { prot: 50 } }] } }];
    const r = PG.executarConsulta(c, diarios);
    if (r.total !== 60 || r.media !== 30 || r.dias !== 2) throw new Error(JSON.stringify(r));
    if (!/30 g/.test(PG.respostaTexto(c, r, 'Jantar'))) throw new Error(PG.respostaTexto(c, r, 'Jantar'));
    const n = PG.normalizarConsulta({ nutriente: 'veneno', dias: 3 }, hoje, refs);
    if (n !== null) throw new Error('nutriente inválido');
    const n2 = PG.normalizarConsulta({ nutriente: 'fibra', dias: 9999, refeicao: 'xx', agregacao: 'zz' }, hoje, refs);
    if (n2.refeicao !== null || n2.agregacao !== 'media' || n2.ini !== dia(hoje, -365)) throw new Error(JSON.stringify(n2));
  });
}

// ---------- Pacote 13: planejamento ----------
{
  const PL = await import('../js/planejamento.js');
  const foods13 = JSON.parse(readFileSync(new URL('../foods.json', import.meta.url), 'utf8'));
  const by = (id) => foods13.find((f) => f.id === id);
  const pares = PL.paresCoccao(foods13);
  t('Fator de cocção pelo par cru/pronto da TACO (energia conservada)', () => {
    const r = PL.rendimento(by('taco-3'), pares);                                    // arroz tipo 1 cozido
    if (!r || r.cru.id !== 'taco-4' || Math.abs(r.fator - by('taco-4').kcal / by('taco-3').kcal) > 1e-9) throw new Error(JSON.stringify(r));
    if (PL.rendimento(by('taco-182'), pares)) throw new Error('banana não tem par');
    const p = PL.pesoProntoEstimado([{ foodId: 'taco-4', g: 100 }, { foodId: 'taco-182', g: 50 }], by, pares);
    if (p.comPar !== 1 || Math.abs(p.g - Math.round(100 * r.fator + 50)) > 1) throw new Error(JSON.stringify(p));
  });
  t('Lista de compras: soma, pronto → cru (≈), receita → ingredientes, agrupada', () => {
    const rec = { id: 'r-x', nome: 'Bolo', ingredientes: [{ foodId: 'taco-182', nome: 'Banana', g: 200 }, { foodId: 'taco-7', nome: 'Aveia', g: 100 }], pesoFinal: null };
    const l = PL.listaCompras([{ foodId: 'taco-3', g: 280 }, { foodId: 'taco-3', g: 280 }, { foodId: 'taco-182', g: 100 }, { foodId: 'r-x', g: 150 }, { foodId: null, g: 0 }],
      { porId: by, pares, receitas: new Map([['r-x', rec]]) });
    const itens = l.flatMap((g) => g.itens);
    const arroz = itens.find((i) => i.id === 'taco-4'), banana = itens.find((i) => i.id === 'taco-182'), aveia = itens.find((i) => i.id === 'taco-7');
    if (!arroz?.aprox || Math.abs(arroz.g - Math.round(560 / (by('taco-4').kcal / by('taco-3').kcal))) > 1) throw new Error('arroz ' + JSON.stringify(arroz));
    if (banana.g !== 200 || aveia.g !== 50) throw new Error(`banana ${banana.g} aveia ${aveia.g}`);
    if (l.map((g) => g.grupo).join() !== [...l.map((g) => g.grupo)].sort((a, b) => a.localeCompare(b, 'pt-BR')).join()) throw new Error('ordem');
    const txt = PL.textoCompras(l, new Set(['taco-182']));
    if (!txt.includes('[x] Banana') || !txt.includes('≈') || !txt.startsWith('*Lista de compras*')) throw new Error(txt);
  });
  t('Montar a semana: respeita ocupadas, alvo e variedade (máx. repetições)', () => {
    const refs = [{ id: 'almoco', nome: 'Almoço' }, { id: 'jantar', nome: 'Jantar' }];
    const datas = ['2026-10-12', '2026-10-13', '2026-10-14'];
    const cands = [by('taco-3'), by('taco-561'), by('taco-410'), by('taco-377'), by('taco-88')].map((f) => ({ food: f, gTipico: 120, gMin: 60, gMax: 240 }));
    const alvos = () => ({ kcal: 600, prot: 40, carb: 70, gord: 15 });
    const plano = PL.montarSemana({ datas, refs, alvos, candidatos: () => cands, ocupadas: new Set(['2026-10-12|almoco']), maxRepeticoes: 1 });
    if (plano.some((x) => x.data === '2026-10-12' && x.refId === 'almoco')) throw new Error('não pode preencher refeição ocupada');
    if (plano.length < 4) throw new Error('planejou pouco: ' + plano.length);
    const chaves = plano.filter((x) => x.refId === 'jantar').map((x) => x.itens.map((i) => i.foodId).sort().join('+'));
    if (new Set(chaves).size !== chaves.length) throw new Error('repetiu além do permitido');
    for (const x of plano) {
      const kcal = x.itens.reduce((s, i) => s + (i.food.kcal * i.g) / 100, 0);
      if (kcal < 300 || kcal > 900) throw new Error('fora do alvo: ' + kcal);
    }
    const salva = { nome: 'PF', itens: [{ foodId: 'a', n: { kcal: 610 } }] };
    const p2 = PL.montarSemana({ datas: datas.slice(0, 1), refs: refs.slice(0, 1), alvos, candidatos: () => cands, salvas: [salva] });
    if (p2[0]?.origem !== 'salva') throw new Error('refeição salva que cabe no alvo vem primeiro');
  });
}

// ---------- O que comer agora: priorizar o que faz bem ----------
{
  const IN = await import('../js/inteligencia.js');
  const fx = JSON.parse(readFileSync(new URL('../foods.json', import.meta.url), 'utf8'));
  const nome = (n) => fx.find((f) => f.nome === n);
  t('Saúde do alimento: verduras/leguminosas altas, embutido e frito baixos, doces = guloseima (batata-doce não)', () => {
    const s = (n) => IN.saudeAlimento(nome(n));
    if (!(s('Brócolis, cozido').nota > 0.8 && s('Feijão, carioca, cozido').nota > 0.8)) throw new Error('básicos');
    if (!(s('Lingüiça, porco, frita').nota < 0.3)) throw new Error('embutido frito');
    if (!s('Chocolate, ao leite').guloseima || !s('Refrigerante, tipo cola').guloseima) throw new Error('guloseima');
    if (s('Batata, doce, cozida').guloseima) throw new Error('batata-doce não é doce');
    for (const lista of Object.values(IN.BASICOS)) for (const n of lista) if (!nome(n)) throw new Error('básico inexistente na TACO: ' + n);
  });
  t('Sugestões: as primeiras sem guloseima e no máximo um agrado (só se o usuário come doce)', () => {
    const c = (n, g, habitual = true) => ({ food: nome(n), gTipico: g, vezes: 5, habitual });
    const cands = [c('Chocolate, ao leite', 30), c('Biscoito, doce, recheado com chocolate', 40), c('Arroz, tipo 1, cozido', 150),
      c('Feijão, carioca, cozido', 140), c('Frango, peito, sem pele, grelhado', 120), c('Brócolis, cozido', 80, false), c('Banana, prata, crua', 90)];
    const alvo = { kcal: 600, prot: 40, carb: 70, gord: 15 };
    const r = IN.sugerirSaudaveis(alvo, cands, { n: 3 });
    const gul = (x) => x.itens.some((i) => IN.saudeAlimento(i.food).guloseima);
    if (r.filter(gul).length > 1) throw new Error('mais de um agrado');
    if (gul(r[0]) || r[0].tipo !== 'saudavel') throw new Error('a 1ª tem de ser nutritiva');
    if (r.some(gul) && r.find(gul).tipo !== 'agrado') throw new Error('agrado sem rótulo');
    const semDoce = IN.sugerirSaudaveis(alvo, cands.map((x) => ({ ...x, habitual: IN.saudeAlimento(x.food).guloseima ? false : x.habitual })), { n: 3 });
    if (semDoce.some(gul)) throw new Error('não oferece doce a quem não come doce');
  });
}

// ---------- Pacote 15: jejum e atalhos ----------
{
  const JJ = await import('../js/jejum.js');
  const ts = (k, h, m = 0) => new Date(`${k}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
  const diarios = [
    { data: '2026-10-07', refeicoes: { jantar: [{ ts: ts('2026-10-07', 20) }] } },
    { data: '2026-10-08', refeicoes: { cafe: [{ ts: ts('2026-10-08', 10) }], jantar: [{ ts: ts('2026-10-08', 21, 30) }, { planejado: true, ts: ts('2026-10-08', 23) }] } },
    { data: '2026-10-09', refeicoes: { cafe: [{ ts: ts('2026-10-09', 9, 30) }, { n: {} }] } },
  ];
  t('Jejum: atual desde o último lançamento com horário; noites entre dias seguidos; planejado não conta', () => {
    const j = JJ.jejumAtual(diarios, ts('2026-10-09', 13, 30));
    if (j.desde !== ts('2026-10-09', 9, 30) || Math.abs(j.horas - 4) > 1e-9) throw new Error(JSON.stringify(j));
    const h = JJ.historicoJejum(diarios);
    if (h.length !== 2 || Math.abs(h[0].horas - 12) > 1e-9 || Math.abs(h[1].horas - 14) > 1e-9) throw new Error(JSON.stringify(h));
    if (JJ.fmtDuracao(13.34) !== '13 h 20 min' || JJ.jejumAtual([], 1) !== null) throw new Error('formato/vazio');
  });
  t('Manifest: atalhos apontam para endereços que o app trata e têm ícone', () => {
    const m = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
    if (m.shortcuts.length < 4 || m.shortcuts[0].short_name !== 'Falar') throw new Error('Falar primeiro');
    for (const s of m.shortcuts) {
      if (!/^\.\/#(adicionar|diario|registros|plano)/.test(s.url)) throw new Error(s.url);
      readFileSync(new URL('../' + s.icons[0].src, import.meta.url));
    }
    if (m.share_target?.method !== 'POST' || !m.share_target.params.files?.length) throw new Error('share_target');
  });
}

// ---------- Pacote 16: onboarding e integridade ----------
{
  const PR = await import('../js/progress.js');
  const IS = await import('../js/instantaneos.js');
  t('Onboarding: projeção até o peso-alvo (direção, ritmo e limite de 3 anos)', () => {
    const p = PR.projecaoInicial(84, 78, 'perder', 0.5, '2026-10-09');
    if (!p || p.semanas !== 12 || p.data !== '2027-01-01') throw new Error(JSON.stringify(p));
    if (PR.projecaoInicial(84, 90, 'perder', 0.5, '2026-10-09')) throw new Error('alvo acima ao perder');
    if (PR.projecaoInicial(84, 78, 'manter', 0.5, '2026-10-09')) throw new Error('manter não projeta');
    if (PR.projecaoInicial(150, 60, 'perder', 0.25, '2026-10-09')) throw new Error('> 156 semanas');
  });
  t('Cópias automáticas: ficam as 7 mais recentes', () => {
    const datas = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const fora = IS.sobrando(datas);
    if (fora.length !== 3 || fora.includes('2026-10-10') || !fora.includes('2026-10-01')) throw new Error(fora.join());
    if (IS.sobrando(datas.slice(0, 3)).length) throw new Error('com poucas, não apaga');
  });
  const BK = readFileSync(new URL('../js/backup.js', import.meta.url), 'utf8');
  t('Cópia automática não marca "último backup" (só a exportação marca)', () => {
    const corpo = BK.slice(BK.indexOf('export async function montarBackup'), BK.indexOf('export async function exportar'));
    if (/ultimoBackup/.test(corpo)) throw new Error('montarBackup não pode mexer no lembrete de backup');
  });
}

// ---------- Resultado ----------
console.log(`\n${ok} aprovados, ${falhas.length} reprovados`);
falhas.forEach((f) => console.log('  ✗ ' + f));
process.exit(falhas.length ? 1 : 0);
