// views/alimento-form.js — criar/editar alimento personalizado (ou duplicar um da base).

import { salvarAlimento, apagarAlimento, paraPor100, avisoKcalMacros, nomesExistentes } from '../custom.js';
import { abrirFolha, fecharFolha, esc, aviso } from '../ui.js';
import { fmtNum, lerNumero, normalizar } from '../utils.js';
import { limparCodigo } from '../off.js';

const CAMPOS = [
  ['kcal', 'Calorias (kcal)'], ['prot', 'Proteína (g)'], ['carb', 'Carboidrato (g)'],
  ['gord', 'Gordura (g)'], ['fibra', 'Fibra (g)'], ['sodio_mg', 'Sódio (mg)'],
];

/**
 * food: alimento existente (editar) ou null (novo). opcoes: { duplicarDe, aoSalvar(food), aoApagar() }
 * Os valores podem ser digitados por qualquer quantidade de referência (ex.: porção do rótulo);
 * são guardados por 100 g.
 */
export function folhaAlimento(food, opcoes = {}) {
  const origem = food || opcoes.prefill || opcoes.duplicarDe || {};
  const editando = !!food;
  const porcao = origem.porcoes?.[0];
  const base = 100;
  const fonteIni = editando || opcoes.prefill ? origem.fonte || '' : opcoes.duplicarDe ? (origem.fonte || '') + ' (editado)' : 'rótulo';
  const painel = abrirFolha(opcoes.titulo || (editando ? 'Editar alimento' : opcoes.duplicarDe ? 'Duplicar e editar' : 'Novo alimento'), `
    <form id="fa" novalidate>
      ${opcoes.nota ? `<p class="nota">${opcoes.nota}</p>` : ''}
      <label class="campo"><span>Nome</span><input type="text" name="nome" maxlength="80" value="${esc(opcoes.duplicarDe && !editando ? origem.nome + ' (meu)' : origem.nome || '')}"></label>
      <label class="campo"><span>Fonte (ex.: rótulo, TBCA, nutricionista)</span><input type="text" name="fonte" maxlength="40"
        value="${esc(fonteIni)}"></label>
      <label class="campo"><span>Valores abaixo referentes a quantos gramas?</span>
        <input type="text" inputmode="decimal" name="baseG" value="${base}"></label>
      <div class="grade2">${CAMPOS.map(([k, r]) => `<label class="campo"><span>${r}</span>
        <input type="text" inputmode="decimal" name="${k}" value="${fmtNum(origem[k])}"></label>`).join('')}</div>
      <div class="grade2">
        <label class="campo"><span>Porção (nome, opcional)</span><input type="text" name="pNome" maxlength="30" value="${esc(porcao?.nome || '')}" placeholder="ex.: scoop"></label>
        <label class="campo"><span>Porção (g)</span><input type="text" inputmode="decimal" name="pG" value="${fmtNum(porcao?.g)}"></label>
      </div>
      <label class="campo"><span>Código de barras (opcional)</span><input type="text" inputmode="numeric" name="codigo" value="${esc(origem.codigo || '')}"></label>
      <p class="nota alerta" id="av" hidden></p>
      <p class="erro" id="erro"></p>
      <div class="linha">${editando ? '<button type="button" class="btn perigo" data-apagar>Excluir</button>' : ''}
        <button class="btn prim">Salvar</button></div>
    </form>`);
  const f = painel.querySelector('#fa');
  let confirmado = false;

  const ler = () => {
    const v = {};
    for (const [k] of CAMPOS) { const t = f[k].value.trim(); v[k] = t === '' ? null : lerNumero(t); }
    return { nome: f.nome.value.trim(), fonte: f.fonte.value.trim(), baseG: lerNumero(f.baseG.value), v,
      pNome: f.pNome.value.trim(), pG: lerNumero(f.pG.value), codigo: f.codigo.value.replace(/\D/g, '') };
  };
  f.addEventListener('input', () => { confirmado = false; painel.querySelector('#av').hidden = true; });

  f.onclick = async (e) => {
    if (!e.target.closest('[data-apagar]')) return;
    if (!confirm(`Excluir "${food.nome}"? Itens já lançados no diário não mudam.`)) return;
    const antes = await apagarAlimento(food.id);
    fecharFolha();
    aviso('Alimento excluído', { acao: async () => { await salvarAlimento(antes); opcoes.aoSalvar?.(antes); } });
    opcoes.aoApagar?.();
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = ler();
    const erro = !d.nome ? 'Informe o nome.'
      : !(d.baseG > 0 && d.baseG <= 5000) ? 'A quantidade de referência deve ficar entre 1 e 5000 g.'
      : d.v.kcal == null || Number.isNaN(d.v.kcal) ? 'Informe as calorias.'
      : Object.values(d.v).some((x) => Number.isNaN(x)) ? 'Há um número inválido.'
      : Object.values(d.v).some((x) => x != null && x < 0) ? 'Valores não podem ser negativos.'
      : (d.pNome || f.pG.value.trim()) && !(d.pG > 0 && d.pG <= 5000) ? 'Porção: informe os gramas (até 5000).' : '';
    painel.querySelector('#erro').textContent = erro;
    if (erro) return;
    const por100 = paraPor100(d.v, d.baseG);
    // avisos que pedem confirmação (não bloqueiam)
    const avisos = [avisoKcalMacros(d.v)];
    if (por100.kcal > 900) avisos.push('Mais de 900 kcal por 100 g é fisicamente improvável.');
    if (!editando && (await nomesExistentes()).has(normalizar(d.nome))) avisos.push('Já existe um alimento com esse nome.');
    if (d.codigo && !limparCodigo(d.codigo)) avisos.push('O código de barras não tem 8, 12, 13 ou 14 dígitos.');
    const txt = avisos.filter(Boolean).join(' ');
    if (txt && !confirmado) {
      const av = painel.querySelector('#av');
      av.textContent = txt + ' Toque em Salvar de novo para confirmar.'; av.hidden = false; confirmado = true;
      return;
    }
    const porcoes = [];
    if (d.pG > 0) porcoes.push({ nome: d.pNome || 'porção', g: d.pG });
    else if (d.baseG !== 100) porcoes.push({ nome: 'porção', g: d.baseG });
    const falta = Object.keys(por100).filter((k) => por100[k] == null);
    const novo = await salvarAlimento({
      ...(editando ? food : {}), nome: d.nome, fonte: d.fonte, origem: food?.origem || opcoes.prefill?.origem || 'manual',
      ...por100, porcoes, codigo: d.codigo || undefined, falta: falta.length ? falta : undefined,
    });
    fecharFolha();
    aviso(editando ? 'Alimento atualizado' : 'Alimento salvo em Meus alimentos');
    opcoes.aoSalvar?.(novo);
  };
}
