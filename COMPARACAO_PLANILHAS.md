# Comparação das duas versões de planilha — 23/11/2026

## Fontes analisadas
- `Nova Planilha Preço Turbinado VFF.xlsm` — novo ficheiro apresentado como versão mais recente.
- `Precificação_Atelieescoladeconfeitaria.xlsx` — versão pessoal usada como referência inicial.

## Resultado
**Não se trata apenas de uma troca de identidade visual.** O ficheiro novo é um modelo de distribuição mais enxuto, com automações VBA, e há fórmulas diferentes nas áreas auxiliares de fechamento e metas. A estrutura fundamental de cálculo de ingredientes e custo unitário é amplamente semelhante.

| Critério | Nova `.xlsm` | Anterior `.xlsx` |
|---|---|---|
| Folhas | 7 | 31 |
| Cadastro central | `BANCO DE DADOS Turbinado` | `Ingredientes` |
| Abas de exemplo | Brownie Americano, Massa Delicia Baunilha, Geleia de Morango, Creme Base Branco, Massa Base BG | Brownie e numerosas receitas pessoais |
| VBA incorporado | Sim (`xl/vbaProject.bin`) | Não |
| Fórmulas no modelo-base | 101 | 116 |
| Marca | Formação Confeitaria Turbinada por Débora Alves | Identidade anterior |

## Cálculos preservados no modelo-base
- `G22 = SUM(G5:G21)` soma os materiais.
- `K22 = K21/J4*J6` apropria o custo de mão de obra ao rendimento e tempo de produção.
- `L4 = (G22/J4)+(M17+K22)` soma materiais unitários, fixos e mão de obra.
- `C5` e `D5` continuam usando `VLOOKUP` para recuperar dados da tabela central.
- `L12 = K12/$J$8` e `M12 = L12/$J$4` aparecem em ambas: os custos fixos originais **não** consideram diretamente o tempo de produção. A regra corrigida por tempo adotada para o novo aplicativo continua uma divergência intencional a validar pedagogicamente.

## Diferenças funcionais comprovadas
- No modelo e na aba brownie, a fórmula `J5` na nova `.xlsm` é `(J8/J6)*J4`, enquanto na versão anterior os valores correspondentes são células de entrada.
- Existem 17 diferenças de presença/conteúdo de fórmulas no `Modelo`, incluindo células da faixa `T` de projeções e células `Q6`, `Q8`, `P19`, `P20`.
- Na aba de brownie, foram observadas 18 diferenças de presença/conteúdo de fórmulas, em especial em cenários de metas/fechamento; há também diferença numa fórmula de entrada `E35`.
- A nova versão traz comandos gráficos de adição/remoção e projeto VBA incorporado. A existência do arquivo VBA foi verificada, mas **não foi feita auditoria do código das macros**; não se pode garantir aqui que os comportamentos sejam idênticos.
- A nova versão não contém todas as receitas da planilha anterior. Isso é esperado se ela é um modelo para alunos, e não a base pessoal de receitas.

## Implicações para o MVP
1. A nova `.xlsm` deve passar a ser o modelo **canônico** de migração; aceitar `.xlsm` no seletor e validar a estrutura padrão, sem executar macros.
2. Converter `BANCO DE DADOS Turbinado` em ingredientes, e demais abas de receitas existentes em receitas relacionadas. O modelo base deve ser ignorado como receita de aluno.
3. Validar dados de referência e fórmulas reais com testes de importação; não importar valores de fórmulas como verdade financeira permanente.
4. A secção de fechamento/metas permanece uma simulação didática de produto único, não o resultado real de uma empresa; não reproduzir automaticamente fórmulas divergentes.
5. O logótipo e o azul/dourado do material oficial podem ser usados no aplicativo mediante autorização da titular da marca.

## Alteração nesta entrega
Somente identidade visual (marca e esquema de cores) do protótipo v0.3. Não se alterou a base local, o código do motor nem a regra financeira. Os testes anteriores permanecem relevantes; é necessária uma validação visual no navegador.
