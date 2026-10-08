# PROGRESSO

**Etapa atual:** 1 concluída — aguardando OK do Artur para a Etapa 2.

## Pronto (Etapa 1)
- PWA estática (HTML/CSS/JS ES modules, sem build): manifest, ícones, `sw.js` com cache versionado e aviso "Atualização disponível".
- Temas escuro (verde/preto) e claro (verde/branco pastel), padrão = sistema, escolha em Configurações.
- `scripts/importar_alimentos.py` → `foods.json`: TACO 4ª ed. extraída do PDF, **597/597 alimentos**. Lê também planilhas TACO/TBCA (.csv/.xlsx) que forem colocadas em `dados/` (TBCA vence duplicatas).
- `porcoes.json` (porções aproximadas, editáveis por alimento no app).
- Busca sem acento/caixa, ranqueada, renderização incremental.
- Diário: dia anterior/próximo/calendário/Hoje, anel de kcal restantes (excesso em âmbar), barras P/C/G, detalhe do dia (fibra, sódio, totais por refeição), editar item (toque), apagar com desfazer, item guarda snapshot dos nutrientes.
- Onboarding/perfil (Mifflin-St Jeor, fator de atividade, ritmo, piso 1200/1500).
- Metas: % / gramas / g/kg, todos iguais ou por dia da semana (copiar para todos), fibra e sódio, histórico por data.
- Refeições editáveis (renomear, adicionar, remover, reordenar).
- IndexedDB com fallback localStorage, `schemaVersion` + migração, `storage.persist()`.
- Testes: `node tests/run.js` → 44 aprovados.

## Pendências / próximas etapas
- Etapa 2: receitas, favoritos, recentes, alimentos personalizados, CSV, adição rápida, copiar dia, foto.
- Etapa 3 em diante conforme CLAUDE.md. Telas Registros/Progresso são placeholders.
- "Recalcular meta quando o peso mudar": opção já salva; passa a agir quando houver registro de peso (Etapa 3).

## Bugs conhecidos
- Nenhum aberto. (O navegador interno do Claude não roda service worker; testar offline no Chrome.)

## Lembretes de manutenção
- Ao mudar qualquer arquivo publicado, **incrementar `VERSAO` em `sw.js`** (senão o celular continua com a versão em cache) e incluir arquivos novos em `ARQUIVOS`.
- Atualizar a base: colocar planilhas em `dados/` e rodar `python scripts/importar_alimentos.py`.
