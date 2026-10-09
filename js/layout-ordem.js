// layout-ordem.js — lógica pura (sem DOM nem estado) da ordem dos blocos de cada tela.
// Usada por layout.js e testada em tests/run.js.

export const BLOCOS = {
  diario: [
    ['semana', 'Faixa da semana'], ['resumo', 'Resumo do dia (anel e macros)'], ['agora', 'O que comer agora'], ['etiquetas', 'Treino e nota do dia'],
    ['agua', 'Água'], ['refeicoes', 'Refeições'], ['copiar', 'Copiar o dia anterior'],
  ],
  adicionar: [
    ['aba-recentes', 'Aba Recentes'], ['aba-favoritos', 'Aba Favoritos'], ['aba-meus', 'Aba Meus'], ['aba-receitas', 'Aba Receitas'],
    ['foto', 'Atalho Foto do prato'], ['texto', 'Atalho Descrever'], ['cardapio', 'Atalho Cardápio/receita'], ['salvas', 'Atalho Refeições salvas'],
    ['rotulo', 'Atalho Ler rótulo'], ['novo', 'Atalho Novo alimento'], ['receita', 'Atalho Nova receita'],
  ],
  registros: [['peso', 'Peso'], ['agua', 'Água'], ['medidas', 'Medidas'], ['dobras', 'Dobras'], ['fotos', 'Fotos']],
  progresso: [
    ['kpis', 'Indicadores'], ['peso', 'Peso'], ['gasto', 'Gasto real estimado'], ['semanas', 'Calorias por semana'],
    ['calendario', 'Calendário de aderência'], ['relatorio', 'Relatório semanal'], ['coach', 'Coach da semana (IA)'], ['macros', 'Médias diárias × meta'],
    ['origem', 'De onde vêm as calorias'], ['composicao', 'Composição corporal'], ['circ', 'Circunferências'],
    ['pdf', 'Relatório em PDF'],
  ],
};
export const NOME_TELA = { diario: 'Diário', adicionar: 'Adicionar', registros: 'Registros', progresso: 'Progresso' };

/**
 * Ordem efetiva: a salva (só ids conhecidos) + blocos ausentes (ex.: de versão nova) na posição padrão.
 * `salva` = config.layout[tela].ordem (pode ser undefined).
 */
export function mesclarOrdem(padrao, salva = []) {
  const ordem = salva.filter((id, i) => padrao.includes(id) && salva.indexOf(id) === i);
  padrao.forEach((id, i) => { if (!ordem.includes(id)) ordem.splice(Math.min(i, ordem.length), 0, id); });
  return ordem;
}

/**
 * Ordena itens (ex.: elementos de um mesmo contêiner) pelo id de bloco conforme `ordem`.
 * Ids desconhecidos vão para o fim; empates mantêm a ordem original. Não altera `itens`.
 */
export function ordenarPorOrdem(itens, ordem, idDe = (x) => x) {
  const pos = new Map(ordem.map((id, i) => [id, i]));
  return itens.map((x, i) => [x, i])
    .sort((a, b) => (pos.get(idDe(a[0])) ?? Infinity) - (pos.get(idDe(b[0])) ?? Infinity) || a[1] - b[1])
    .map(([x]) => x);
}
