# PROGRESSO

**Etapa atual:** 4 concluída — aguardando OK do Artur para a Etapa 5 (scanner já feito) / Etapa 6.
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

**Etapa 4**
- Progresso (7/30/90 dias/tudo): peso com média móvel de 7 dias (por calendário), calorias médias por semana × meta (barras), aderência ±10%, médias de macros/fibra/sódio × meta, %G por protocolo e circunferências.
- Backup: exportar JSON (fotos opcionais, compartilhar ou baixar), importar com validação de estrutura/versão e confirmação; lembrete no Diário após 30 dias sem backup; apagar tudo com confirmação dupla; uso de armazenamento e versão em Configurações.
- PWA: atalhos no ícone (Adicionar, Ler código, Registrar peso), aviso ao ficar offline, teste garante que sw.js lista todos os arquivos e que a versão bate.
- Leitor de código não abre mais o teclado sozinho.
- Testes: 86 aprovados.

## Pendências / próximas etapas
- Etapa 5: já entregue antes (scanner + Open Food Facts). Falta só validar a câmera no S23+.
- Etapa 6: acabamento (visual, acessibilidade, desempenho, revisão de bugs, README).

## Bugs conhecidos
- Nenhum aberto.

## Manutenção
- Mudou arquivo publicado → incrementar `VERSAO` em `sw.js` **e** em `js/versao.js`; arquivo JS novo → incluir em `ARQUIVOS` (testes conferem os dois).
- Publicar: `git add -A; git commit; git push` com `$env:GCM_INTERACTIVE='always'`.
