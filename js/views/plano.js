// views/plano.js — planejador semanal (segunda → domingo × refeições): itens planejados, refeições salvas e receitas,
// totais do dia × meta do dia (metas por dia da semana e dia de treino), montar a semana sem IA e lista de compras.

import { estado, lerDia, gravarDia, pesoAtual } from '../state.js';
import { kvGet, kvSet } from '../db.js';
import { criarItem, copiarItens, adicionarItem, distribuicaoRefeicoes, ehTreino, NUTRIENTES } from '../diary.js';
import { metaDoDia } from '../goals.js';
import { catalogo } from '../custom.js';
import { buscar, porcoesDe } from '../foods.js';
import { candidatosFrequentes } from '../inteligencia.js';
import { montarSemana, listaCompras, textoCompras, paresCoccao } from '../planejamento.js';
import { inicioSemana } from '../progress.js';
import { diariosRecentes } from './sugestao.js';
import { topo, esc, ic, ICONES, iconeRef, $, $$, aviso, abrirFolha, fecharFolha, vibrar, seg, entregarArquivo } from '../ui.js';
import { chaveData, somarDias, fmtKcal, fmtG, fmtData, DIAS_CURTOS, normalizar } from '../utils.js';

let tela, semana = null;

export async function render(t) {
  tela = t;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  semana = inicioSemana(semana && !q.get('compras') ? semana : estado.dataAtual);
  topo(`<a class="ico" href="#diario" aria-label="Voltar ao diário">${ICONES.voltar}</a><h1>Planejar semana</h1><span style="width:48px"></span>`);
  await desenhar();
  if (q.get('compras')) { history.replaceState(null, '', '#plano'); folhaCompras(); }
}

/** Soma de todos os itens (planejados + comidos): o planejador mostra o dia como vai ficar. */
const somaTudo = (itens) => Object.fromEntries(NUTRIENTES.map((k) => [k, itens.reduce((s, i) => s + (i.n?.[k] || 0), 0)]));
const datasDaSemana = () => Array.from({ length: 7 }, (_, i) => somarDias(semana, i));

async function desenhar() {
  const hoje = chaveData(), datas = datasDaSemana(), refs = estado.config.refeicoes;
  const dias = await Promise.all(datas.map(lerDia)), peso = await pesoAtual();
  tela.innerHTML = `
    <div class="nav-mes plano-nav"><button class="ico" data-sem="-7" aria-label="Semana anterior">${ICONES.voltar}</button>
      <h2 class="num">${fmtData(datas[0]).slice(0, 5)} – ${fmtData(datas[6]).slice(0, 5)}</h2>
      <button class="ico" data-sem="7" aria-label="Próxima semana">${ICONES.avancar}</button></div>
    <div class="acoes-rolar" role="group" aria-label="Ações do plano">
      <button class="btn peq suave" data-montar>${ic('wand-sparkles')} Montar a semana</button>
      <button class="btn peq suave" data-compras>${ic('shopping-cart')} Lista de compras</button>
      <button class="btn peq" data-limpar>${ic('eraser')} Limpar planejados</button></div>
    ${dias.map((d, i) => {
      const data = datas[i], meta = metaDoDia(estado.metas, data, peso, { treino: ehTreino(d) });
      const t = somaTudo(Object.values(d.refeicoes).flat()), passado = data < hoje;
      const frac = meta.kcal ? t.kcal / meta.kcal : 0;
      return `<section class="card plano-dia${data === hoje ? ' hoje' : ''}${passado ? ' passado' : ''}" data-data="${data}">
        <div class="pd-cab"><b>${DIAS_CURTOS[i]} ${fmtData(data).slice(0, 5)}</b>${ehTreino(d) ? `<span class="chip">${ic('dumbbell', 'p')} treino</span>` : ''}
          <span class="num pd-tot"><b>${fmtKcal(t.kcal)}</b>/${fmtKcal(meta.kcal)} kcal · P ${fmtG(t.prot)}/${fmtG(meta.prot)}</span></div>
        <div class="pd-barra ${frac > 1.1 ? 'acima' : frac >= 0.9 ? 'meta' : ''}"><i style="width:${Math.min(100, frac * 100)}%"></i></div>
        ${refs.map((r) => {
          const its = d.refeicoes[r.id] || [];
          const k = its.reduce((s, x) => s + (x.n?.kcal || 0), 0);
          return `<div class="pd-ref" data-ref="${r.id}"><span class="ref-ico" aria-hidden="true">${iconeRef(r.id)}</span>
            <button type="button" class="pd-txt" data-abrir aria-label="${esc(r.nome)} de ${fmtData(data)}: abrir no diário">${its.length
              ? its.map((x) => `<span class="${x.planejado ? 'plan' : ''}">${esc(x.nome.split(',')[0])}</span>`).join(', ') : `<span class="mudo">${esc(r.nome)}</span>`}</button>
            ${k ? `<span class="num mudo">${fmtKcal(k)}</span>` : ''}
            ${passado ? '' : `<button type="button" class="ico" data-plan-add aria-label="Planejar ${esc(r.nome)} de ${fmtData(data)}">${ic('plus')}</button>`}</div>`;
        }).join('')}</section>`;
    }).join('')}
    <p class="mudo" style="text-align:center">Planejados aparecem listrados no Diário e só contam quando você toca em “comi”.</p>`;
  tela.onclick = clique;
}

async function clique(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.sem) { semana = somarDias(semana, Number(b.dataset.sem)); return desenhar(); }
  if ('montar' in b.dataset) return folhaMontar();
  if ('compras' in b.dataset) return folhaCompras();
  if ('limpar' in b.dataset) return limparPlanejados();
  const dia = b.closest('[data-data]'), ref = b.closest('[data-ref]');
  if (!dia || !ref) return;
  if ('abrir' in b.dataset) { estado.dataAtual = dia.dataset.data; location.hash = '#diario'; return; }
  if ('planAdd' in b.dataset) return folhaEscolher(dia.dataset.data, ref.dataset.ref);
}

/** Grava itens planejados num dia/refeição (com desfazer de todos os dias tocados). */
async function planejar(lancamentos, msg) {
  const antes = new Map();
  for (const { data, refId, itens } of lancamentos) {
    const d = antes.has(data) ? await lerDia(data) : await lerDia(data);
    if (!antes.has(data)) antes.set(data, structuredClone(d));
    let novo = d;
    const nome = estado.config.refeicoes.find((r) => r.id === refId)?.nome;
    for (const it of itens) novo = adicionarItem(novo, refId, nome, { ...it, planejado: true });
    await gravarDia(novo);
  }
  vibrar(12);
  await desenhar();
  aviso(msg, { ms: 7000, acao: async () => { for (const d of antes.values()) await gravarDia(d); desenhar(); } });
}

// ---------- Escolher o que planejar (refeição salva, receita ou busca) ----------
async function folhaEscolher(data, refId) {
  const cat = await catalogo();
  const nomeRef = estado.config.refeicoes.find((r) => r.id === refId)?.nome || '';
  let aba = (estado.config.refeicoesSalvas || []).length ? 'salvas' : 'buscar';
  const p = abrirFolha(`${nomeRef} · ${fmtData(data).slice(0, 5)}`, `${seg('aba-plan', [['salvas', 'Salvas'], ['receitas', 'Receitas'], ['buscar', 'Buscar']], aba)}
    <input type="search" id="qp" placeholder="Buscar alimento" autocomplete="off" hidden><ul class="lista" id="lp"></ul>`, { foco: false });
  const usual = (f) => {
    const u = estado.config.ultimaQtd[f.id];
    if (u) return { g: u.g, porcao: u.porcao };
    const p0 = porcoesDe(f, cat.porcoes, estado.config.porcoesUsuario)[0];
    return p0 ? { g: p0.g, porcao: { nome: p0.nome, g: p0.g, qtd: 1 } } : { g: 100, porcao: null };
  };
  const linhaFood = (f) => { const u = usual(f); return `<li><button data-food="${esc(f.id)}"><span><span class="nome">${esc(f.nome)}</span>
    <span class="mudo num">${u.porcao ? `${esc(String(u.porcao.qtd))} × ${esc(u.porcao.nome)}` : `${fmtG(u.g)} g`} · ${fmtKcal(((f.kcal || 0) * u.g) / 100)} kcal</span></span></button></li>`; };
  const desenharLista = () => {
    $('#qp', p).hidden = aba !== 'buscar';
    const q = $('#qp', p).value.trim();
    $('#lp', p).innerHTML = aba === 'salvas'
      ? (estado.config.refeicoesSalvas || []).map((s, i) => `<li><button data-salva="${i}"><span><span class="nome">${esc(s.nome)}</span>
          <span class="mudo num">${s.itens.length} item(ns) · ${fmtKcal(s.itens.reduce((a, x) => a + (x.n?.kcal || 0), 0))} kcal</span></span></button></li>`).join('') || '<li class="mudo" style="padding:10px 0">Nenhuma refeição salva (Diário › ⋯ › Salvar como refeição salva).</li>'
      : aba === 'receitas' ? cat.recFoods.map(linhaFood).join('') || '<li class="mudo" style="padding:10px 0">Nenhuma receita.</li>'
      : (q ? buscar(cat.indice, q, { limite: 30, sinonimos: cat.porcoes?.sinonimos, escolha: estado.config.escolhas?.[normalizar(q)] })
        : (estado.config.recentes || []).map((id) => cat.porId.get(id)).filter(Boolean)).map(linhaFood).join('');
  };
  p.addEventListener('click', async (e) => {
    const sb = e.target.closest('[data-seg="aba-plan"] button');
    if (sb) { aba = sb.dataset.v; $$('[data-seg="aba-plan"] button', p).forEach((x) => x.setAttribute('aria-pressed', x === sb)); return desenharLista(); }
    const s = e.target.closest('[data-salva]'), f = e.target.closest('[data-food]');
    if (!s && !f) return;
    let itens, nome;
    if (s) { const sv = estado.config.refeicoesSalvas[Number(s.dataset.salva)]; itens = copiarItens(sv.itens); nome = sv.nome; }
    else { const food = cat.porId.get(f.dataset.food), u = usual(food); itens = [criarItem(food, u.g, u.porcao)]; nome = food.nome.split(',')[0]; }
    fecharFolha();
    await planejar([{ data, refId, itens }], `${nome} planejado para ${nomeRef.toLowerCase()} de ${fmtData(data).slice(0, 5)}`);
  });
  $('#qp', p).oninput = desenharLista;
  desenharLista();
}

// ---------- Montar a semana automaticamente (sem IA) ----------
async function folhaMontar() {
  const hoje = chaveData();
  const p = abrirFolha('Montar a semana', `<form id="fm" novalidate>
    <p class="mudo" style="margin-top:0">Preenche só as refeições vazias, com as suas refeições salvas e combinações dos alimentos que você mais come, batendo calorias e proteína de cada dia (meta do dia da semana e de treino). Tudo entra como planejado.</p>
    <label class="campo"><span>A partir de</span><select name="ini"><option value="${hoje}">Hoje</option><option value="${somarDias(hoje, 1)}" selected>Amanhã</option></select></label>
    <label class="campo"><span>Variedade: a mesma refeição no máximo</span><select name="rep">${[1, 2, 3, 7].map((n) => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n === 7 ? 'sem limite' : `${n} vez${n > 1 ? 'es' : ''} na semana`}</option>`).join('')}</select></label>
    <label class="linha-chave"><span>Usar refeições salvas</span><span class="chave"><input type="checkbox" name="salvas" checked><i></i></span></label>
    <p class="erro" id="erro"></p><button class="btn prim bloco">${ic('wand-sparkles')} Montar</button></form>`, { foco: false });
  $('#fm', p).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, refs = estado.config.refeicoes;
    const datas = datasDaSemana().filter((d) => d >= f.ini.value && d >= hoje);
    if (!datas.length) { $('#erro', p).textContent = 'Esta semana já passou: escolha outra semana.'; return; }
    const [cat, recentes, peso] = await Promise.all([catalogo(), diariosRecentes(30), pesoAtual()]);
    const dias = new Map(await Promise.all(datas.map(async (d) => [d, await lerDia(d)])));
    const dist = distribuicaoRefeicoes(refs, estado.config.distRef);
    const opc = { favoritos: estado.config.favoritos || [], ultimaQtd: estado.config.ultimaQtd || {} };
    const todos = candidatosFrequentes(recentes, (id) => cat.porId.get(id), opc);
    const cache = new Map();
    const candidatos = (refId) => cache.get(refId) || cache.set(refId, (() => {
      const c = candidatosFrequentes(recentes, (id) => cat.porId.get(id), { ...opc, refId });
      return c.length >= 3 ? c : todos;
    })()).get(refId);
    const alvos = (data, refId) => {
      const m = metaDoDia(estado.metas, data, peso, { treino: ehTreino(dias.get(data)) }), fr = dist[refId] || 0;   // fração 0–1
      return { kcal: m.kcal * fr, prot: m.prot * fr, carb: m.carb * fr, gord: m.gord * fr };
    };
    const ocupadas = new Set(datas.flatMap((d) => refs.filter((r) => (dias.get(d).refeicoes[r.id] || []).length).map((r) => `${d}|${r.id}`)));
    const plano = montarSemana({ datas, refs, alvos, candidatos, salvas: estado.config.refeicoesSalvas || [], ocupadas,
      maxRepeticoes: Number(f.rep.value), usarSalvas: f.salvas.checked });
    if (!plano.length) { $('#erro', p).textContent = todos.length < 2 ? 'Lance refeições por alguns dias (ou favorite alimentos) para o app conhecer o que você come.' : 'Não há refeição vazia para preencher.'; return; }
    fecharFolha();
    await planejar(plano.map((x) => ({ data: x.data, refId: x.refId,
      itens: x.origem === 'salva' ? copiarItens(x.itens) : x.itens.map((i) => criarItem(i.food, i.g)) })),
    `${plano.length} refeição(ões) planejada(s) em ${new Set(plano.map((x) => x.data)).size} dia(s)`);
  };
}

async function limparPlanejados() {
  const hoje = chaveData(), antes = [];
  let n = 0;
  for (const data of datasDaSemana().filter((d) => d >= hoje)) {
    const d = await lerDia(data);
    const qtd = Object.values(d.refeicoes).flat().filter((i) => i.planejado).length;
    if (!qtd) continue;
    antes.push(structuredClone(d));
    for (const r of Object.keys(d.refeicoes)) d.refeicoes[r] = d.refeicoes[r].filter((i) => !i.planejado);
    await gravarDia(d);
    n += qtd;
  }
  if (!n) return aviso('Nenhum item planejado a partir de hoje nesta semana.');
  await desenhar();
  aviso(`${n} item(ns) planejado(s) removido(s)`, { ms: 7000, acao: async () => { for (const d of antes) await gravarDia(d); desenhar(); } });
}

// ---------- Lista de compras ----------
async function folhaCompras() {
  const hoje = chaveData();
  const cat = await catalogo();
  const datas = datasDaSemana().filter((d) => d >= hoje);
  const itens = (await Promise.all(datas.map(lerDia))).flatMap((d) => Object.values(d.refeicoes).flat()).filter((i) => i.planejado);
  const lista = listaCompras(itens, { porId: (id) => cat.porId.get(id), receitas: new Map(cat.receitas.map((r) => [r.id, r])), pares: paresCoccao(cat.base.foods) });
  const salvo = (await kvGet('compras', {})) || {};
  const marcados = new Set(salvo.semana === semana ? salvo.marcados : []);
  const q = (g) => (g >= 1000 ? `${(Math.round(g / 100) / 10).toLocaleString('pt-BR')} kg` : `${g} g`);
  const p = abrirFolha('Lista de compras', lista.length ? `<p class="mudo" style="margin-top:-4px">Do que está planejado de ${fmtData(datas[0]).slice(0, 5)} a ${fmtData(datas.at(-1)).slice(0, 5)}. Receitas viram ingredientes; “≈ cru” = convertido do pronto pelo par cru/cozido da TACO.</p>
    ${lista.map((g) => `<p class="secao" style="margin:10px 0 4px">${esc(g.grupo)}</p><ul class="lista compras">${g.itens.map((i) => `<li><label class="compra">
      <input type="checkbox" data-comprado="${esc(i.id)}" ${marcados.has(i.id) ? 'checked' : ''}><span>${esc(i.nome)}</span>
      <span class="num mudo">${i.aprox ? '≈ ' : ''}${q(i.g)}${i.aprox ? ' cru' : ''}</span></label></li>`).join('')}</ul>`).join('')}
    <div class="linha" style="margin-top:12px"><button class="btn prim" data-partilhar>${ic('share-2')} Compartilhar</button><button class="btn" data-copiar-lista>${ic('copy')} Copiar</button></div>`
    : '<p class="mudo">Nada planejado a partir de hoje nesta semana. Use “Montar a semana” ou o “+” de cada refeição.</p>', { foco: false });
  const texto = () => textoCompras(lista, marcados, `Lista de compras · ${fmtData(datas[0]).slice(0, 5)} a ${fmtData(datas.at(-1)).slice(0, 5)}`);
  p.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-comprado]');
    if (!c) return;
    if (c.checked) marcados.add(c.dataset.comprado); else marcados.delete(c.dataset.comprado);
    await kvSet('compras', { semana, marcados: [...marcados] });
  });
  p.addEventListener('click', async (e) => {
    if (e.target.closest('[data-partilhar]')) {
      if (navigator.share) { try { await navigator.share({ text: texto() }); } catch {} return; }
      return entregarArquivo(new Blob([texto()], { type: 'text/plain' }), 'lista-de-compras.txt');
    }
    if (e.target.closest('[data-copiar-lista]')) {
      try { await navigator.clipboard.writeText(texto()); aviso('Lista copiada'); } catch { aviso('Não consegui copiar.'); }
    }
  });
}
