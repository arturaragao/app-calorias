# PROGRESSO

**Etapa atual:** 3 concluída (+ scanner/Open Food Facts adiantado da Etapa 5) — aguardando OK do Artur para a Etapa 4.
**Publicado:** https://arturaragao.github.io/app-calorias/ (push automático; o celular se atualiza sozinho).

## Pronto
**Etapa 1** — PWA, temas, TACO 597/597 (`scripts/importar_alimentos.py`), busca, diário com anel e macros, detalhe com fibra/sódio, metas %/g/g·kg e por dia da semana, onboarding, refeições editáveis, IndexedDB + migração.

**Etapa 2**
- Meus alimentos: criar/editar/excluir, campo fonte, valores digitados por qualquer porção (convertidos para 100 g), porção padrão, código de barras opcional; "Duplicar e editar" de alimento da base. Aviso (sem bloqueio) se kcal ≠ 4P+4C+9G.
- Receitas: ingredientes em gramas, nº de porções, peso final pronto opcional; lança por porção, receita inteira ou grama.
- Abas Recentes / Favoritos / Meus / Receitas; busca inclui tudo, Meus/Receitas/Recentes primeiro. Favoritar na tela de quantidade.
- Importar CSV (Configurações): arquivo ou colar, pré-visualização, erros, duplicatas (ignoradas por padrão), modelo para baixar.
- Diário: menu ⋯ por refeição → Adição rápida, Copiar de ontem, Fotos; botão "Copiar o dia anterior inteiro"; desfazer em tudo.
- Foto da refeição: câmera/galeria, comprimida para ≤1280 px JPEG 0,7, observação, ícone 📷 com contagem.
- Atualização automática do app no celular.
- Testes: 58 aprovados.

**Scanner (adiantado da Etapa 5)** — ícone de código de barras na busca e ao lado de "+ Adicionar alimento"; câmera traseira (BarcodeDetector), lanterna, campo manual; resolve local → Open Food Facts → revisar/salvar; busca por nome no OFF.

**Etapa 3**
- Peso: vários por dia (vale o último), gráfico com média, histórico com diferença, apagar/desfazer; atualiza o peso do perfil e, se ligado, recalcula a meta.
- Água: copo/500 ml/valor livre, desfazer, meta e tamanho do copo editáveis, navegação por dia.
- Circunferências: lista editável (adicionar/renomear/remover/reordenar), registro por data, diferença vs anterior, gráfico por medida.
- Dobras: Parrillo 9, Pollock 7, Pollock 3, Durnin-Womersley 4, Personalizado (só soma); último protocolo como padrão; %G, MG, MM, densidade; gráfico só do protocolo escolhido; nota do Parrillo; lembrete mensal desligável (no Diário e em Registros).
- Valores incoerentes pedem confirmação. Testes: 75 aprovados (fórmulas conferidas com referências calculadas à mão).

## Pendências / próximas etapas
- Etapa 4: Progresso e gráficos, backup exportar/importar + lembrete de 30 dias, PWA offline polido.
- Etapa 5: o que restar (scanner já feito).

## Bugs conhecidos
- Nenhum aberto.

## Manutenção
- Mudou arquivo publicado → incrementar `VERSAO` em `sw.js`; arquivo JS novo → incluir em `ARQUIVOS` (há teste que confere).
- Publicar: `git add -A; git commit; git push` com `$env:GCM_INTERACTIVE='always'`.
