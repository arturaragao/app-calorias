# DECISÕES (uma linha cada)

- 2026-10-08 · Pasta do projeto: `C:\Users\Artur\app-calorias`. Instalados Node 24 LTS, Git e pdfplumber (autorizado).
- 2026-10-08 · TACO extraída direto do PDF (Tabela 1) por posição de coluna; planilha oficial não foi necessária. Custo de tokens baixo (dados não passam pelo chat).
- 2026-10-08 · O PDF "Tabelas complementares — Perfil de carboidratos" (TBCA) só traz frações de carboidrato de poucos alimentos; não serve como base e é ignorado pelo script.
- 2026-10-08 · "NA" da TACO (não aplicável/não analisado) = ausente (null) e marcado; no somatório conta 0 e o total mostra "dados parciais". Ex.: fibra em carnes, sódio em óleos.
- 2026-10-08 · Formato do foods.json: `{id, nome, grupo, fonte, kcal, prot, carb, gord, fibra, sodio_mg, tr?, falta?}` por 100 g; ids `taco-N` = número do alimento na TACO.
- 2026-10-08 · Modo %: kcal é a meta e os macros derivam dela. Modos g e g/kg: macros são a meta e as kcal derivam deles (4/4/9); a diferença para a kcal "planejada" é mostrada.
- 2026-10-08 · Metas padrão: 25/45/30; fibra 30 g (OMS/EFSA recomendam ≥ 25 g/dia); sódio 2000 mg (OMS: < 2 g/dia). Editáveis.
- 2026-10-08 · Histórico de metas por data (`historico[{desde,…}]`): salvar metas vale a partir de hoje; dias passados mantêm a meta da época. Data anterior ao 1º registro usa o mais antigo.
- 2026-10-08 · Ao entrar no modo semanal pela 1ª vez (7 dias idênticos), os 7 dias partem da meta atual.
- 2026-10-08 · Porções do usuário são por alimento (`config.porcoesUsuario[id]`) e substituem as sugeridas; "Restaurar sugeridas" volta ao padrão.
- 2026-10-08 · Diário: dia = `{data, nomes, refeicoes:{refId:[itens]}}`; refeição removida das configurações continua aparecendo nos dias em que tem itens.
- 2026-10-08 · Campos numéricos sem separador de milhar; leitura aceita "2.759" (milhar) e "2,5" (decimal).
- 2026-10-08 · Service worker sem skipWaiting automático: o usuário toca em "Atualizar".
- 2026-10-08 · Refeição sugerida pelo horário ao abrir "Adicionar" sem refeição escolhida.
