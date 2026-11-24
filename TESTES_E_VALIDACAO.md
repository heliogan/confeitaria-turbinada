# Testes de qualidade — Confeitaria Turbinada v0.6 QA

Esta versão mantém as funcionalidades da v0.5. Acrescenta testes e uma correção de segurança da restauração: backups com dependências circulares entre receitas são recusados, mesmo quando as receitas estão incompletas.

## Execução automatizada

- `npm test` — 11 testes do motor TypeScript (testado: 11/11).
- `npm run test:backup` — 10 testes da validação real do backup JSON, incluindo IDs duplicados, referências inválidas, dados negativos, unidades incompatíveis e ciclos (testado: 10/10).
- `npm run test:importer` — importador JS real em Chromium com JSZip e DOMParser, usando os dois ficheiros Excel originais em `/mnt/data`, além de rejeição de ficheiros inválidos (testado: 4/4 cenários). **No seu computador**, ajustar `INPUT` em `test/importer_qa.py` para a pasta onde colocou os dois Excel. Requer `pip install playwright` e Chromium instalado. Se necessário, adaptar `executable_path` do navegador.
- `npm run test:e2e` — testes preparados para interface real, IndexedDB, exportação, restauração, cancelamento, recuperação após apagar, persistência e importação de ambos os modelos. **Não executados aqui**: a navegação local do Chromium foi bloqueada neste ambiente. Para executar no Windows, ajustar `FILES`, `executable_path` e o Python do servidor em `test/browser_qa.py`; exige Playwright + Chromium. Usa uma porta de testes separada (`18743`) e perfil isolado; não usa a porta 8080 nem a base do seu Chrome habitual.

## Leitura confirmada dos dois Excel

| Modelo | Ingredientes | Receitas preenchidas | Componentes | Ligações de sub-receita | Avisos |
|---|---:|---:|---:|---:|---:|
| Anterior XLSX | 84 | 29 | 263 | 2 | 48 |
| Turbinada XLSM | 15 | 3 | 6 | 0 | 17 |

Os avisos devem ser revistos pelo aluno; as quantidades acima descrevem o que o **importador atual** extraiu, não garantem que toda a informação do Excel foi migrada sem perda.

## Teste manual PRIORITÁRIO: backup e restauração

**Usar a v0.6 QA numa pasta nova e manter um backup separado antes de qualquer operação destrutiva.**

1. Criar dois ingredientes e uma receita com rendimento, tempo, preço de venda e composição; adicionar uma despesa fixa e um preço de mercado.
2. Em **Meus dados → Exportar backup**, guardar o `.json` fora da pasta da aplicação. Verificar que o ficheiro descarregou e tem conteúdo.
3. Alterar o preço de um ingrediente, guardar e atualizar a página. Verificar que o novo preço permanece.
4. Em **Restaurar backup**, selecionar o ficheiro anterior; **cancelar** a confirmação. Verificar que o preço alterado continua igual.
5. Repetir a restauração, desta vez **confirmando**. O preço deve voltar ao valor exportado e a receita, as suas ligações, os custos, as despesas e a pesquisa de mercado devem reaparecer.
6. Num **perfil separado** do navegador, com a mesma aplicação hospedada num endereço permitido, restaurar o JSON e conferir as mesmas quantidades e os mesmos valores. Isso testa a portabilidade real entre bases locais independentes.
7. Só depois de verificar o backup, experimentar **Apagar todos os dados** e restaurar novamente; confirme que tudo é recuperado. Faça-o exclusivamente com dados descartáveis.
8. Selecionar um ficheiro JSON inválido ou de outra aplicação; deve apresentar erro e preservar os dados anteriores.

## Teste manual de importação

1. Fazer backup primeiro.
2. Selecionar `Precificação_Atelieescoladeconfeitaria.xlsx`; ler os avisos e conferir a pré-visualização. **Cancelar** antes de confirmar em um primeiro ensaio, verificando que nada mudou.
3. Confirmar depois de guardar backup. Conferir ingredientes, receitas, composição e sub-receitas; preencher rendimentos/tempos não encontrados antes de verificar custos.
4. Restaurar o backup; testar `Nova Planilha Preço Turbinado VFF.xlsm` separadamente e conferir os avisos.
5. Verificar que a importação preserva configurações gerais e despesas fixas, mas substitui a base de receitas e ingredientes.

## Limitações e cuidados

- A v0.6 QA **não é ainda uma homologação de recuperação de dados em dispositivos móveis**. O teste automatizado de download/restore através da interface ainda precisa de execução no ambiente do usuário.
- O armazenamento continua no IndexedDB do navegador. Limpar os dados do site pode apagar tudo. O backup JSON deve ser guardado fora do dispositivo, se possível.
- A instalação PWA offline no iPhone e Android ainda precisa de testes reais.
- As receitas com campos incompletos após importar podem não produzir custos até que o aluno corrija rendimento, unidade e tempo.
- Os ficheiros Excel não são incluídos neste pacote por serem materiais do usuário; use as suas cópias para testar.
