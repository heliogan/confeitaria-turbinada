# Confeitaria Turbinada — Protótipo v0.5

Ferramenta de precificação local-first (HTML/JS, motor TypeScript) baseada nos dois modelos oficiais da planilha da Formação Confeitaria Turbinada. Sem backend, sem contas, sem execução de VBA.

## Como iniciar

Descomprima o ZIP. Dentro da pasta `confeitaria-turbinada-app-v0.5`, execute:

```bash
python -m http.server 8080 --directory public
```

Aceda a `http://localhost:8080`. Se já estava a usar a versão anterior em `localhost:8080`, faça primeiro um **backup JSON** em Meus dados. Em caso de interface antiga, atualize com Ctrl+F5 (não elimine os dados locais do site).

## Novidade: importador das planilhas oficiais

Em **Meus dados → Migrar a planilha Excel**, selecione:

- `Precificação_Atelieescoladeconfeitaria.xlsx` (modelo anterior, aba `Ingredientes`), ou
- `Nova Planilha Preço Turbinado VFF.xlsm` (modelo atual, aba `BANCO DE DADOS Turbinado`).

A leitura é realizada dentro do navegador com uma cópia local da biblioteca JSZip. O ficheiro Excel **não é enviado a servidores**. A aplicação não executa macros e não importa resultados de fórmulas.

**Dados importados:** nome, quantidade, unidade e preço dos ingredientes; nome, composição, rendimento (`J4`), tempo (`J6`, horas convertidas em minutos), preço escolhido (`P6`) de cada receita. Os componentes são lidos das colunas B e E, linhas 5 a 21, dos modelos conhecidos.

A pré-visualização informa quantidade de cadastros e avisos, antes da confirmação. Confirmação substitui ingredientes, receitas, componentes e pesquisas de mercado **mas mantém configurações gerais e despesas fixas**. Exporte backup antes de importar.

**Casos que exigem atenção:**

- Se um ingrediente não tem preço ou quantidade de compra, é omitido com aviso.
- Ingredientes repetidos são consolidados pelo primeiro registo, com aviso.
- Nomes de ingredientes sem unidade explícita são considerados `g`, com aviso para revisão.
- A unidade `m` (metros) ainda não existe no motor; o item é omitido com aviso.
- Receitas vazias são omitidas; receitas com composição mas sem rendimento/tempo são importadas com esses campos **pendentes** (sem inventar valores). Antes de calcular, abra a receita e preencha o que falta.
- Os modelos Excel não distinguem de forma confiável a unidade final de rendimento (`un`, `g` ou `ml`): o importador inicia como `un` e apresenta aviso para conferir cada receita.
- Ligações inequívocas de receitas reutilizadas são recriadas, como as referências de custo de materiais por fórmula na aba de ingredientes. Referências não resolvidas geram aviso; não serão inventadas.
- O modelo novo `.xlsm` fornecido contém várias folhas de receita sem ingredientes e vários campos de rendimento/tempo em branco: é esperado que importe apenas os cadastros efetivamente preenchidos.

## Funcionalidades do protótipo

- Ingredientes com pesquisa, edição, quantidades de compra, preços e unidades.
- Receitas e componentes, com pesquisa e edição de quantidades; sub-receitas incorporam apenas **custo de materiais**.
- Cálculo local de mão de obra, rateio de custos fixos e preço de venda escolhido pelo aluno.
- Pesquisa de mercado e simulação hipotética de produto único (não controla vendas).
- IndexedDB, backup e restauração JSON, PWA instalada localmente após primeiro acesso.

## Validação

- Motor de cálculo: `npm test` — 11 testes unitários.
- Importador: ensaio de leitura com **os dois ficheiros originais** no ambiente de desenvolvimento, sem executar macros. Resultado na amostra enviada: modelo Turbinada: 15 ingredientes, 3 receitas preenchidas, 6 componentes; modelo anterior: 84 ingredientes, 29 receitas preenchidas, 263 componentes. Algumas referências e dados incompletos são assinalados na pré-visualização.
- A interface de importação e a instalação em Android/iPhone **ainda precisam de testes manuais** nos dispositivos reais.

## Tecnologias

Frontend: JavaScript sem framework nesta fase. Motor isolado em `src/engine.ts` com build pré-compilado em `public/core/engine.js`. Leitura XLSX via JSZip (incluída em `public/vendor/jszip.min.js`; biblioteca MIT). IndexedDB para persistência; service worker para offline. Nenhum backend ou sincronização.

## Testes QA da v0.6

Consulte [TESTES_E_VALIDACAO.md](TESTES_E_VALIDACAO.md) para os testes automatizados e o roteiro manual de importação, backup e restauração. A v0.6 inclui uma proteção contra ciclos nas receitas ao restaurar um backup JSON.


## v0.7 — Unidades lineares

Acrescentadas as unidades **m, cm, mm** para fitas, acetato e outros materiais lineares. Conversões: 1 m = 100 cm = 1.000 mm. Não se converte comprimento em massa/volume/unidade. O importador oficial passa a reconhecer ingredientes identificados com `(m)`, `(cm)` ou `(mm)`. Backups JSON anteriores continuam compatíveis (mesmo formato e versão).
