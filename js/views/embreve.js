// views/embreve.js — telas das próximas etapas (Registros: Etapa 3; Progresso: Etapa 4).

import { topo } from '../ui.js';

export async function render(tela, rota) {
  const info = {
    registros: ['Registros', 'Peso, água, circunferências e dobras cutâneas chegam na Etapa 3.'],
    progresso: ['Progresso', 'Gráficos de peso, calorias, aderência e composição corporal chegam na Etapa 4.'],
  }[rota];
  topo(`<h1>${info[0]}</h1>`);
  tela.innerHTML = `<div class="card"><p>${info[1]}</p></div>`;
}
