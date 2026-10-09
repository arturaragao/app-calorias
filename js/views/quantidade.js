// views/quantidade.js — folha para escolher quantidade (gramas, mL ou porção caseira) e refeição.
// Usada ao adicionar um alimento e ao editar um item do diário. Teclado numérico próprio (o do Android não abre),
// atalhos de ½ · 1 · 1½ · 2 porções e prévia do que sobra no dia depois do lançamento.

import { estado, salvarConfig, lerDia, pesoAtual } from '../state.js';
import { ic } from '../icones.js';
import { carregarBase, porcoesDe, rotuloFonte, ehLiquido, densidadeDe } from '../foods.js';
import { nutrientesPorGramas, totalDia, ehTreino } from '../diary.js';
import { metaDoDia } from '../goals.js';
import { abrirFolha, fecharFolha, esc, aviso, vibrar } from '../ui.js';
import { ehFavorito, alternarFavorito, catalogo } from '../custom.js';
import { folhaAlimento } from './alimento-form.js';
import { avaliarSuspeito } from '../inteligencia.js';
import { contextoSuspeito } from './sugestao.js';
import { chaveData, fmtKcal, fmtMacro, fmtNum, fmtG, lerNumero } from '../utils.js';

const ATALHOS = [[0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2']];

/** Restante do dia (kcal e proteína) antes deste lançamento; `descontar` = nutrientes do item em edição. */
async function restanteAntes(data, descontar) {
  const dia = await lerDia(data);
  const meta = metaDoDia(estado.metas, data, await pesoAtual(), { treino: ehTreino(dia) });
  const t = totalDia(dia);
  return { kcal: meta.kcal - t.kcal + (descontar?.kcal || 0), prot: meta.prot - t.prot + (descontar?.prot || 0) };
}

/**
 * food: objeto com valores por 100 g (alimento da base ou snapshot por100 do item).
 * opcoes: { titulo, g, porcao, refId, botao, data, planejado, descontar, aoConfirmar({g, porcao, refId, planejado}), aoApagar }
 */
export async function folhaQuantidade(food, opcoes) {
  const { porcoes: tabela } = await carregarBase();
  const porcoes = porcoesDe(food, tabela, estado.config.porcoesUsuario);
  // "1 grama" sempre disponível como porção: quantidade conta gramas, de 1 em 1
  const lista = [...porcoes, { nome: 'grama', g: 1, umG: true }];
  const ultima = estado.config.ultimaQtd[food.id];
  const dens = densidadeDe(food, tabela);   // g/mL (1 se não houver valor com fonte)
  // porção própria do produto (rótulo/receita) vira o padrão quando não há última quantidade
  const porcaoPropria = !ultima && !opcoes.g && food.porcoes?.length && !porcoes[0]?.aprox;
  // mL (líquidos): g = mL × densidade; vem em mL se o item já era em mL, se a última vez foi em mL ou se é bebida
  const ref = opcoes.porcao || (!opcoes.g ? ultima?.porcao : null);
  let modo = ref?.ml ? 'ml' : opcoes.porcao || porcaoPropria ? 'porcao' : (ultima?.porcao && !opcoes.g ? 'porcao'
    : !ultima && !opcoes.g && ehLiquido(food) ? 'ml' : 'g');
  const porcaoIni = ref?.ml ? null : opcoes.porcao || ultima?.porcao || null;
  const gIni = ref?.ml ? ref.qtd : opcoes.g ?? ultima?.g ?? (modo === 'ml' ? 200 : 100);
  const refs = estado.config.refeicoes;
  const refIni = opcoes.refId || refs[0]?.id;
  const falta = ['kcal', 'prot', 'carb', 'gord'].filter((k) => food[k] == null);
  const data = opcoes.data || estado.dataAtual;
  const futuro = data > chaveData();
  const iSel = Math.max(0, porcaoIni ? lista.findIndex((p) => p.nome === porcaoIni.nome) : 0);
  const antes = await restanteAntes(data, opcoes.descontar).catch(() => null);

  const painel = abrirFolha(opcoes.titulo || food.nome, `
    <p class="mudo" style="margin-top:-6px">${opcoes.titulo ? esc(food.nome) + '<br>' : ''}${esc(rotuloFonte(food))} · por 100 g: ${fmtKcal(food.kcal)} kcal</p>
    ${opcoes.semAcoes ? '' : `<div class="linha" style="flex-wrap:wrap;margin-bottom:10px">
      <button type="button" class="btn peq" data-fav aria-pressed="${ehFavorito(food.id)}">${ehFavorito(food.id) ? ic('star', 'cheio') + ' Favorito' : ic('star') + ' Favoritar'}</button>
      ${String(food.id).startsWith('c-') ? '<button type="button" class="btn peq" data-editar-alim>Editar alimento</button>'
        : String(food.id).startsWith('r-') ? '<button type="button" class="btn peq" data-editar-rec>Editar receita</button>'
        : '<button type="button" class="btn peq" data-duplicar>Duplicar e editar</button>'}</div>`}
    ${falta.includes('kcal') ? `<div class="nota alerta"><p style="margin:0 0 8px"><b>Sem dados na ${esc(food.fonte || 'fonte')}</b>: a tabela não traz calorias nem macros deste alimento (lançaria 0 kcal). Use o rótulo da embalagem ou busque no Open Food Facts (botão abaixo da busca).</p>
      <button type="button" class="btn peq" data-criar-rotulo>Criar pelo rótulo</button></div>`
      : falta.length ? '<p class="nota alerta">Alguns nutrientes não constam na fonte (contam como 0).</p>' : ''}
    <div class="seg" role="group"><button type="button" data-modo="g" aria-pressed="${modo === 'g'}">Gramas</button>
      <button type="button" data-modo="ml" aria-pressed="${modo === 'ml'}">mL</button>
      <button type="button" data-modo="porcao" aria-pressed="${modo === 'porcao'}">Porção</button></div>
    <div id="m-p"><select name="porcao" aria-label="Porção">${lista.map((p, i) =>
      `<option value="${i}" ${i === iSel ? 'selected' : ''}>${p.umG ? '1 grama (contar de 1 em 1 g)' : `${esc(p.nome)} (${fmtNum(p.g)} g)`}</option>`).join('')}</select>
      <p class="mudo" style="margin:4px 0 0;font-size:var(--fs-12)">${porcoes.some((p) => p.aprox) ? 'Porções aproximadas · ' : ''}<button type="button" class="btn texto peq" data-editar-porcoes>Editar porções</button></p></div>
    <div class="qtd-visor" aria-live="polite">
      <input type="text" name="g" value="${fmtNum(Math.round(gIni * 10) / 10)}" inputmode="none" readonly aria-label="Quantidade em gramas ou mL">
      <input type="text" name="qtd" value="${fmtNum(porcaoIni?.qtd ?? 1)}" inputmode="none" readonly aria-label="Quantidade de porções">
      <span class="qtd-un" id="un"></span></div>
    <div class="qtd-atalhos" role="group" aria-label="Atalhos de porção">${ATALHOS.map(([k, r]) =>
      `<button type="button" class="chip-tog" data-atalho="${k}">${r}</button>`).join('')}<span class="mudo" id="at-rot"></span></div>
    <div class="teclado" role="group" aria-label="Teclado numérico">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'apagar'].map((k) =>
      k === 'apagar' ? `<button type="button" data-tecla="apagar" aria-label="Apagar">${ic('delete', 'g')}</button>`
        : `<button type="button" data-tecla="${k}">${k}</button>`).join('')}</div>
    <p class="mudo" id="nota-ml" style="margin:4px 0 0;font-size:var(--fs-12)">${dens === 1 ? 'mL convertido como 1 mL ≈ 1 g (aproximação).' : `1 mL ≈ ${fmtNum(dens)} g (densidade aproximada, FAO/INFOODS).`}</p>
    <div class="qtd-calc num" id="calc"></div>
    ${antes ? '<p class="previa num" id="previa"></p>' : ''}
    <label class="campo" style="margin-top:8px"><span>Refeição</span><select name="ref">${refs.map((r) =>
      `<option value="${r.id}" ${r.id === refIni ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <label class="linha-chave"><span>Planejado<small>Ainda não comi: não soma até confirmar</small></span>
      <span class="chave"><input type="checkbox" name="planejado" ${opcoes.planejado ?? futuro ? 'checked' : ''}><i></i></span></label>
    <p class="erro" id="erro"></p>
    <p class="nota alerta alerta-suspeito" id="suspeito" hidden></p>
    <div class="linha" style="margin-top:8px">
      ${opcoes.aoApagar ? '<button type="button" class="btn perigo" data-apagar>Apagar</button>' : ''}
      <button type="button" class="btn prim" data-ok>${esc(opcoes.botao || 'Adicionar')}</button></div>`, { foco: false });

  const $p = (s) => painel.querySelector(s);
  const campoAtivo = () => $p(modo === 'porcao' ? '[name=qtd]' : '[name=g]');
  let substituir = true;   // a 1ª tecla troca o número inteiro (como selecionar tudo)
  const porcaoSel = () => lista[Number($p('[name=porcao]').value)];
  // porção de referência dos atalhos: a escolhida (modo porção) ou a 1ª conhecida do alimento
  const porcaoAtalho = () => (modo === 'porcao' ? porcaoSel() : porcoes[0] || { nome: '100 g', g: 100 });
  const ler = () => {
    if (modo === 'g') return { g: lerNumero($p('[name=g]').value), porcao: null };
    if (modo === 'ml') {
      const ml = lerNumero($p('[name=g]').value);
      return { g: ml * dens, porcao: { nome: 'mL', g: dens, qtd: ml, ml: true } };
    }
    const p = porcaoSel(), qtd = lerNumero($p('[name=qtd]').value);
    return { g: p.g * qtd, porcao: { nome: p.nome, g: p.g, qtd } };
  };
  const erroDe = ({ g }) => (isNaN(g) || g <= 0 ? 'Informe uma quantidade maior que zero.' : g > 5000 ? 'Quantidade acima de 5000 g.' : '');
  let confirmado = false;   // lançamento suspeito: 2º toque em "Lançar mesmo assim" confirma
  const atualizar = () => {
    if (confirmado) { confirmado = false; $p('#suspeito').hidden = true; $p('[data-ok]').textContent = opcoes.botao || 'Adicionar'; }
    $p('#m-p').hidden = modo !== 'porcao';
    $p('[name=g]').hidden = modo === 'porcao';
    $p('[name=qtd]').hidden = modo !== 'porcao';
    $p('#nota-ml').hidden = modo !== 'ml';
    $p('#un').textContent = modo === 'ml' ? 'mL' : modo === 'g' ? 'g' : porcaoSel().umG ? 'g' : `× ${porcaoSel().nome}`;
    const pa = porcaoAtalho();
    $p('#at-rot').textContent = modo === 'porcao' ? 'porções' : `× ${pa.nome} (${fmtNum(pa.g)} g)`;
    const q = ler(), erro = erroDe(q);
    $p('#erro').textContent = erro;
    if (erro) { $p('#calc').innerHTML = ''; if ($p('#previa')) $p('#previa').textContent = ''; return; }
    const { n } = nutrientesPorGramas(food, q.g);
    const qtdTxt = modo === 'ml' ? `${fmtNum(Math.round(q.porcao.qtd))} mL${dens !== 1 ? ` (${fmtNum(Math.round(q.g))} g)` : ''}` : `${fmtNum(Math.round(q.g))} g`;
    $p('#calc').innerHTML = `<span>${qtdTxt}</span><b>${fmtKcal(n.kcal)} kcal</b><span>P ${fmtMacro(n.prot)}</span><span>C ${fmtMacro(n.carb)}</span><span>G ${fmtMacro(n.gord)}</span>`;
    const pv = $p('#previa');
    if (pv) {
      const plan = $p('[name=planejado]').checked;
      const k = antes.kcal - (plan ? 0 : n.kcal), pr = antes.prot - (plan ? 0 : n.prot);
      pv.classList.toggle('acima', k < 0);
      pv.innerHTML = plan ? 'Planejado: não muda o restante de hoje até você confirmar.'
        : `Depois disto: ${k >= 0 ? `faltam <b>${fmtKcal(k)} kcal</b>` : `<b>${fmtKcal(-k)} kcal acima</b> da meta`}${pr > 0 ? ` · ${fmtG(pr)} g de proteína` : ' · proteína batida'}`;
    }
  };
  /** Teclado numérico: dígitos, vírgula e apagar no campo ativo. */
  const tecla = (k) => {
    const inp = campoAtivo();
    let v = substituir ? '' : inp.value;
    substituir = false;
    if (k === 'apagar') v = v.slice(0, -1);
    else if (k === ',') { if (!v.includes(',')) v = (v || '0') + ','; }
    else if (v.replace(',', '').length < 6) v = v === '0' ? k : v + k;
    inp.value = v || '0';
    vibrar(5);
  };
  painel.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.tecla) tecla(t.dataset.tecla);
    else if (t.dataset.atalho) {
      const k = Number(t.dataset.atalho);
      if (modo === 'porcao') $p('[name=qtd]').value = fmtNum(k);
      else {
        const g = porcaoAtalho().g * k;
        $p('[name=g]').value = fmtNum(Math.round((modo === 'ml' ? g / dens : g) * 10) / 10);
      }
      substituir = true;
    } else if (t.dataset.modo) {
      // gramas <-> mL: mantém o número digitado
      modo = t.dataset.modo;
      substituir = true;
      painel.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', b === t));
    } else if ('fav' in t.dataset) {
      const fav = alternarFavorito(food.id);
      t.innerHTML = fav ? ic('star', 'cheio') + ' Favorito' : ic('star') + ' Favoritar';
      t.setAttribute('aria-pressed', fav);
      return;
    } else if ('editarAlim' in t.dataset || 'duplicar' in t.dataset) {
      const c = await catalogo();
      const atual = c.porId.get(food.id) || food;
      const reabrir = (novo) => folhaQuantidade(novo, { ...opcoes, g: undefined, porcao: null });
      return 'duplicar' in t.dataset
        ? folhaAlimento(null, { duplicarDe: atual, aoSalvar: reabrir })
        : folhaAlimento(atual, { aoSalvar: reabrir, aoApagar: opcoes.aoMudarCatalogo });
    } else if ('criarRotulo' in t.dataset) {
      // só o nome vem da base; os valores são digitados do rótulo (nada é inventado)
      return folhaAlimento(null, { prefill: { nome: food.nome, fonte: 'rótulo' },
        aoSalvar: (novo) => folhaQuantidade(novo, { ...opcoes, g: undefined, porcao: null }) });
    } else if ('editarRec' in t.dataset) {
      fecharFolha();
      location.hash = '#receita?id=' + encodeURIComponent(food.id);
      return;
    } else if ('editarPorcoes' in t.dataset) {
      return editarPorcoes(food, porcoes, () => folhaQuantidade(food, opcoes));
    } else if ('apagar' in t.dataset) {
      fecharFolha(); return opcoes.aoApagar();
    } else if ('ok' in t.dataset) {
      const q = ler();
      if (erroDe(q)) return;
      if (!confirmado) {
        const msg = avaliarSuspeito(food, q.g, await contextoSuspeito(food.id).catch(() => ({})));
        if (msg) {
          const el = $p('#suspeito');
          el.innerHTML = ic('triangle-alert', 'p') + ' ' + esc(msg); el.hidden = false;
          t.textContent = 'Lançar mesmo assim';
          vibrar([20, 40, 20]);
          confirmado = true;
          return;
        }
      }
      const refId = $p('[name=ref]').value;
      estado.config.ultimaQtd[food.id] = { g: q.g, porcao: q.porcao };
      salvarConfig();
      fecharFolha();
      return opcoes.aoConfirmar({ ...q, refId, planejado: $p('[name=planejado]').checked });
    } else return;
    atualizar();
  });
  painel.addEventListener('change', (e) => { if (e.target.name === 'porcao') substituir = true; atualizar(); });
  // teclado físico (computador): números, vírgula/ponto e apagar
  painel.addEventListener('keydown', (e) => {
    if (e.target.matches('select, textarea, input[type=checkbox]')) return;
    const k = /^[0-9]$/.test(e.key) ? e.key : e.key === ',' || e.key === '.' ? ',' : e.key === 'Backspace' ? 'apagar' : null;
    if (!k) return;
    e.preventDefault(); tecla(k); atualizar();
  });
  atualizar();
}

/** Edita as porções deste alimento (ficam salvas por alimento, substituindo as sugeridas). */
function editarPorcoes(food, atuais, voltar) {
  const linhas = (ps) => ps.map((p, i) => `<div class="linha" style="margin-bottom:8px" data-i="${i}">
      <input type="text" name="n${i}" value="${esc(p.nome)}" aria-label="Nome da porção">
      <input type="text" inputmode="decimal" name="g${i}" value="${fmtNum(p.g)}" style="flex:0 0 90px" aria-label="Gramas">
      <button type="button" class="ico" data-rem="${i}" aria-label="Remover">${ic('x')}</button></div>`).join('');
  let lista = atuais.map((p) => ({ nome: p.nome, g: p.g }));
  const painel = abrirFolha('Porções de ' + food.nome, `<p class="mudo">Nome e gramas de cada porção. Vale só para este alimento.</p>
    <div id="ps">${linhas(lista)}</div>
    <button type="button" class="btn bloco" data-novo>+ Nova porção</button>
    <p class="erro" id="erro"></p>
    <div class="linha"><button type="button" class="btn" data-restaurar>Restaurar sugeridas</button><button type="button" class="btn prim" data-salvar>Salvar</button></div>`,
  );
  const ler = () => lista.map((_, i) => ({ nome: painel.querySelector(`[name=n${i}]`).value.trim(), g: lerNumero(painel.querySelector(`[name=g${i}]`).value) }));
  painel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.rem) { lista = ler(); lista.splice(Number(t.dataset.rem), 1); painel.querySelector('#ps').innerHTML = linhas(lista); }
    if ('novo' in t.dataset) { lista = ler(); lista.push({ nome: '', g: '' }); painel.querySelector('#ps').innerHTML = linhas(lista); }
    if ('restaurar' in t.dataset) { delete estado.config.porcoesUsuario[food.id]; salvarConfig(); voltar(); }
    if ('salvar' in t.dataset) {
      const ps = ler().filter((p) => p.nome || !isNaN(p.g));
      if (ps.some((p) => !p.nome || !(p.g > 0 && p.g <= 5000))) { painel.querySelector('#erro').textContent = 'Cada porção precisa de nome e gramas (0–5000).'; return; }
      estado.config.porcoesUsuario[food.id] = ps; salvarConfig();
      aviso('Porções salvas'); voltar();
    }
  });
}
