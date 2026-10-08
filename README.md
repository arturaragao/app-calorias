# Calorias e Macros

App pessoal (PWA) para registrar alimentação, metas, peso, água e composição corporal. Funciona offline, sem conta e sem custo. Os dados ficam só no celular.

**Endereço:** https://arturaragao.github.io/app-calorias/

## Instalar no celular (Android/Chrome)
1. Abra o endereço no Chrome.
2. Menu ⋮ → **Adicionar à tela inicial** → **Instalar**.
3. Segure o ícone para ver os atalhos: *Adicionar alimento*, *Ler código de barras*, *Registrar peso*.

As atualizações chegam sozinhas: ao abrir o app, ele baixa a versão nova e mostra "App atualizado".

## Backup (importante)
Os dados ficam só neste aparelho. Em **Ajustes › Backup**:
- **Exportar backup** gera um arquivo `.json` (com ou sem fotos). Guarde-o no Drive ou mande por e-mail para você.
- **Importar backup** substitui os dados atuais pelos do arquivo. O app confere o arquivo e pede confirmação antes.
- Se você passar 30 dias sem backup, aparece um lembrete no Diário.

## Base de alimentos
- **TACO 4ª ed.** (NEPA/UNICAMP, 2011): 597 alimentos, valores por 100 g.
- **Open Food Facts**: produtos industrializados, por código de barras ou por nome (precisa de internet). O que você salva vai para *Meus alimentos* e passa a funcionar offline.
- **Meus alimentos, receitas e CSV**: criados por você.

### Atualizar ou ampliar a base (no PC)
1. Coloque a planilha oficial (TACO ou TBCA, `.csv` ou `.xlsx`) ou o PDF da TACO na pasta `dados/`.
2. Rode `python scripts/importar_alimentos.py` (precisa de `pip install pdfplumber`; `openpyxl` para `.xlsx`).
3. O script gera `foods.json` e mostra um relatório (total importado, duplicatas e campos faltando). Em nomes repetidos, a TBCA prevalece sobre a TACO.
4. Incremente `VERSAO` em `sw.js` e em `js/versao.js` e publique.

## Desenvolvimento
- HTML, CSS e JavaScript puros (ES modules), sem build e sem dependências.
- Testes: `node tests/run.js`.
- Servidor local: `python -m http.server 8765`, depois abra http://127.0.0.1:8765.
- Publicar: `git add -A`, `git commit -m "…"`, `git push`. O GitHub Pages atualiza em cerca de 1 minuto.
- Ao mudar qualquer arquivo publicado, incremente a versão (`sw.js` e `js/versao.js`). Os testes conferem se as duas batem e se o `sw.js` lista todos os arquivos.
- Andamento e decisões ficam em `PROGRESSO.md` e `DECISOES.md`. A especificação completa está em `CLAUDE.md`.

## Referências
Mifflin-St Jeor (1990) para a TMB; Jackson & Pollock (1978) e Jackson, Pollock & Ward (1980) para 7 e 3 dobras; Durnin & Womersley (1974); Siri (1961). As citações completas estão nos comentários de `js/goals.js` e `js/body.js`.
