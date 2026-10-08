// views/diario.js — tela inicial: navegação por dia, anel de calorias, macros e refeições.

import { estado, lerDia, gravarDia, pesoAtual } from '../state.js';
import { metaDoDia } from '../goals.js';
import { totalDia, totalRefeicao, refeicoesDoDia, removerItem, alterarQuantidade, substituirItem, camposFaltando } from '../diary.js';
import { topo, esc, ICONES, $, aviso, abrirFolha } from '../ui.js';
import { chaveData, somarDias, fmtData, fmtKcal, fmtMacro, fmtMg, fmtNum, DIAS_SEMANA, diaSemana } from '../utils.js';
import { folhaQuantidade } from './quantidade.js';

let tela, dia, meta;

export async function render(t) {
  tela = t;
  await desenhar();
}

function rotuloData(chave) {
  const hoje = chaveData();
  if (chave === hoje) return 'Hoje';
  if (chave === somarDias(hoje, -1)) return 'Ontem';
  if (chave === somarDias(hoje, 1)) return 'Amanhã';
  return `${DIAS_SEMANA[diaSemana(chave)].slice(0, 3)}, ${fmtData(chave)}`;
}

function desenharTopo() {
  const c = estado.dataAtual, hoje = chaveData();
  topo(`<button class="ico" data-dia="-1" aria-label="Dia anterior">${ICONES.voltar}</button>
    <button class="data-btn" aria-label="Escolher data">${esc(rotuloData(c))}<input type="date" value="${c}" aria-label="Calendário"></button>
    ${c !== hoje ? '<button class="btn peq" data-hoje>Hoje</button>' : ''}
    <button class="ico" data-dia="1" aria-label="Próximo dia">${ICONES.avancar}</button>`);
  const tp = $('#topo');
  tp.onclick = (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.dia) mudarDia(somarDias(estado.dataAtual, Number(b.dataset.dia)));
    else if (b && 'hoje' in b.dataset) mudarDia(chaveData());
    else if (b?.classList.contains('data-btn')) { try { b.querySelector('input').showPicker(); } catch {} }
  };
  tp.querySelector('input[type=date]').onchange = (e) => e.target.value && mudarDia(e.target.value);
}

async function mudarDia(chave) {
  estado.dataAtual = chave;
  await desenhar();
}

async function desenhar() {
  desenharTopo();
  dia = await lerDia(estado.dataAtual);
  meta = metaDoDia(estado.metas, estado.dataAtual, await pesoAtual());
  const tot = totalDia(dia);
  const restante = meta.kcal - tot.kcal;
  const frac = meta.kcal > 0 ? Math.min(tot.kcal / meta.kcal, 1) : 0;
  const C = 2 * Math.PI * 64;
  const barra = (cls, nome, v, m, un = 'g', f = fmtMacro) => {
    const pct = m > 0 ? Math.min((v / m) * 100, 100) : 0;
    return `<div class="barra ${cls} ${v > m * 1.0001 ? 'passou' : ''}"><div class="rot"><span>${nome}</span>
      <span class="num"><b>${f(v)}</b> / ${f(m)} ${un}</span></div><div class="trilho"><div class="enche" style="width:${pct}%"></div></div></div>`;
  };
  const refs = refeicoesDoDia(dia, estado.config.refeicoes);
  tela.innerHTML = `
    <section class="card resumo" data-detalhe tabindex="0" role="button" aria-label="Ver detalhes do dia">
      <div class="anel ${restante < 0 ? 'excesso' : ''}">
        <svg viewBox="0 0 150 150" aria-hidden="true"><circle class="fundo" cx="75" cy="75" r="64"/>
          <circle class="valor" cx="75" cy="75" r="64" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
        <div class="centro"><span class="grande num">${fmtKcal(Math.abs(restante))}</span>
          <span class="mudo">${restante < 0 ? 'kcal acima' : 'kcal restantes'}</span></div>
      </div>
      <div>
        <p class="mudo num" style="margin:0 0 6px">Meta ${fmtKcal(meta.kcal)} · Consumido ${fmtKcal(tot.kcal)}</p>
        ${barra('prot', 'Proteína', tot.prot, meta.prot)}
        ${barra('carb', 'Carboidrato', tot.carb, meta.carb)}
        ${barra('gord', 'Gordura', tot.gord, meta.gord)}
      </div>
    </section>
    ${refs.map((r) => cartaoRefeicao(r)).join('')}
    <p class="mudo" style="text-align:center">Toque no resumo para ver fibra, sódio e totais.</p>`;
  tela.onclick = clique;
  tela.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-detalhe]')) detalheDia(); };
}

function cartaoRefeicao(r) {
  const itens = dia.refeicoes[r.id] || [];
  const t = totalRefeicao(dia, r.id);
  return `<section class="card" data-ref="${r.id}">
    <div class="ref-tit"><h2>${esc(r.nome)}</h2><span class="num"><b>${fmtKcal(t.kcal)}</b> kcal</span></div>
    ${itens.length ? `<div class="ref-tot num">P ${fmtMacro(t.prot)} · C ${fmtMacro(t.carb)} · G ${fmtMacro(t.gord)}</div>` : ''}
    <ul class="itens">${itens.map((it) => `<li class="item" data-item="${it.id}">
      <div class="info" data-editar><div class="nome">${esc(it.nome)}</div>
        <div class="mudo num">${it.porcao ? `${fmtNum(it.porcao.qtd)} × ${esc(it.porcao.nome)} · ` : ''}${fmtNum(Math.round(it.g * 10) / 10)} g${it.falta?.length ? ' · dados parciais' : ''}</div></div>
      <span class="kcal num">${fmtKcal(it.n.kcal)}</span>
      <button class="ico" data-apagar aria-label="Apagar ${esc(it.nome)}">${ICONES.lixo}</button></li>`).join('')}</ul>
    <button class="add-alim" data-add>+ Adicionar alimento</button>
  </section>`;
}

async function clique(e) {
  if (e.target.closest('[data-detalhe]')) return detalheDia();
  const sec = e.target.closest('[data-ref]');
  if (!sec) return;
  const refId = sec.dataset.ref;
  if (e.target.closest('[data-add]')) {
    estado.refeicaoAlvo = refId;
    location.hash = '#adicionar';
    return;
  }
  const li = e.target.closest('[data-item]');
  if (!li) return;
  const item = dia.refeicoes[refId].find((i) => i.id === li.dataset.item);
  if (e.target.closest('[data-apagar]')) return apagar(refId, item.id);
  if (e.target.closest('[data-editar]')) {
    folhaQuantidade({ ...item.por100, id: item.foodId, nome: item.nome, fonte: item.fonte }, {
      titulo: 'Editar item', g: item.g, porcao: item.porcao, refId, botao: 'Salvar',
      aoApagar: () => apagar(refId, item.id),
      aoConfirmar: async ({ g, porcao, refId: novaRef }) => {
        const novo = alterarQuantidade(item, g, porcao);
        let d = dia;
        if (novaRef !== refId) {
          d = removerItem(d, refId, item.id).dia;
          (d.refeicoes[novaRef] ||= []).push(novo);
          d.nomes[novaRef] = estado.config.refeicoes.find((r) => r.id === novaRef)?.nome;
        } else d = substituirItem(d, refId, novo);
        await gravarDia(d);
        desenhar();
      },
    });
  }
}

async function apagar(refId, itemId) {
  const antes = dia;
  const { dia: d, removido } = removerItem(dia, refId, itemId);
  await gravarDia(d);
  await desenhar();
  aviso(`${removido.nome} apagado`, { acao: async () => { await gravarDia(antes); desenhar(); } });
}

function detalheDia() {
  const tot = totalDia(dia);
  const refs = refeicoesDoDia(dia, estado.config.refeicoes);
  const falta = camposFaltando(Object.values(dia.refeicoes).flat());
  const linha = (nome, v, m, f, un) => `<tr><td>${nome}</td><td><b>${f(v)}</b></td><td>${f(m)} ${un}</td><td>${m ? Math.round((v / m) * 100) + '%' : '—'}</td></tr>`;
  abrirFolha(`Detalhes — ${rotuloData(estado.dataAtual)}`, `
    <table class="tabela num">
      <tr><th>Nutriente</th><th>Consumido</th><th>Meta</th><th>%</th></tr>
      ${linha('Calorias', tot.kcal, meta.kcal, fmtKcal, 'kcal')}
      ${linha('Proteína', tot.prot, meta.prot, fmtMacro, 'g')}
      ${linha('Carboidrato', tot.carb, meta.carb, fmtMacro, 'g')}
      ${linha('Gordura', tot.gord, meta.gord, fmtMacro, 'g')}
      ${linha('Fibra', tot.fibra, meta.fibra, fmtMacro, 'g')}
      ${linha('Sódio', tot.sodio_mg, meta.sodio, fmtMg, 'mg')}
    </table>
    ${falta.length ? `<p class="nota alerta">Alguns itens não têm todos os nutrientes na fonte (${falta.map((k) => ({ fibra: 'fibra', sodio_mg: 'sódio', kcal: 'kcal', prot: 'proteína', carb: 'carboidrato', gord: 'gordura' }[k])).join(', ')}); os totais podem estar subestimados.</p>` : ''}
    <h2 style="margin-top:14px">Por refeição</h2>
    <table class="tabela num"><tr><th></th><th>kcal</th><th>P</th><th>C</th><th>G</th><th>Fibra</th><th>Na</th></tr>
      ${refs.map((r) => { const t = totalRefeicao(dia, r.id); return `<tr><td>${esc(r.nome)}</td><td>${fmtKcal(t.kcal)}</td><td>${fmtMacro(t.prot)}</td><td>${fmtMacro(t.carb)}</td><td>${fmtMacro(t.gord)}</td><td>${fmtMacro(t.fibra)}</td><td>${fmtMg(t.sodio_mg)}</td></tr>`; }).join('')}
    </table>
    ${meta.macroModo !== 'pct' && Math.abs(meta.diferenca) >= 1 ? `<p class="nota">Meta calórica derivada dos macros (${fmtKcal(meta.kcal)} kcal); a planejada era ${fmtKcal(meta.kcalPlanejada)} kcal.</p>` : ''}`);
}
