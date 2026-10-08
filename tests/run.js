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
t('Base TACO carregada (597 itens)', () => eq(base.length, 597));
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
t('Service worker lista todos os módulos JS', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const { readdirSync } = process.getBuiltinModule('node:fs');
  const arqs = [...readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
    ...readdirSync(new URL('../js/views/', import.meta.url)).map((f) => 'js/views/' + f)];
  const faltando = arqs.filter((a) => !sw.includes(`'${a}'`));
  if (faltando.length) throw new Error('faltam no sw.js: ' + faltando.join(', '));
});

// ---------- Resultado ----------
console.log(`\n${ok} aprovados, ${falhas.length} reprovados`);
falhas.forEach((f) => console.log('  ✗ ' + f));
process.exit(falhas.length ? 1 : 0);
