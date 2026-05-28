# Knowledge Bank - Contexto Geral do Sistema

Gerado em: 2026-05-22

Este documento consolida conhecimento tecnico do sistema Lojinha a partir do proprio codigo-fonte.
Ele foi desenhado para ser util mesmo sem qualquer historico de sessao.

## 1) Visao geral do produto

- ERP web para operacao de loja fisica + producao artesanal/3D.
- Backend em ASP.NET Core Web API (.NET 10), frontend em React + TypeScript (Vite).
- Persistencia principal em PostgreSQL e cache distribuido opcional em Redis.
- Modulos de negocio principais:
  - catalogo e precificacao de produtos
  - receitas e insumos
  - estoque e movimentos
  - vendas e financeiro
  - feiras e rateios
  - listas operacionais (restock e todo)
  - projetos de producao
  - personalizados
  - fornecedores e usuarios

## 2) Arquitetura e estrutura tecnica

### 2.1 Backend (camadas)

- src/Lojinha.Api: camada HTTP/API, autenticacao, composicao de servicos.
- src/Lojinha.Application: servicos de aplicacao, contratos, validacoes, regras de caso de uso.
- src/Lojinha.Domain: entidades e enums de dominio.
- src/Lojinha.Infrastructure: EF Core, repositorios, migrations e servicos de infraestrutura.

### 2.2 Frontend

- src/lojinha-web: SPA React 18 + TypeScript.
- UI baseada em Material UI.
- Data fetching com React Query.
- Cliente HTTP centralizado com Axios e controle de sessao JWT em localStorage.

### 2.3 Execucao

- Ambiente local via docker-compose com postgres, redis, api e web.
- Ambiente Oracle com proxy Caddy (TLS), containers internos de api/web e banco/redis isolados em rede Docker.

## 3) Modelo de dominio (nucleo)

Entidades-chave mapeadas em AppDbContext:

- Identidade e acesso:
  - User
  - Supplier
- Catalogo e precificacao:
  - ProductCategory
  - Product
  - ProductRecipe
  - ProductRecipeItem
  - ProductFilament
  - PrinterProfile
  - FilamentProfile
  - MarketplaceFee
  - CardFeeSettings
- Operacao:
  - InventoryMovement
  - OperationalRestockItem
  - OperationalTodoItem
- Comercial/financeiro:
  - Sale
  - SaleItem
  - FinancialEntry
  - Fair
  - FairSupplier
- Projetos e personalizados:
  - Project
  - ProjectStep
  - ProjectStepAttempt
  - ProjectStepFilament
  - ProjectStepAttemptFilament
  - PersonalizedPricingTier
- Auditoria:
  - AuditLog

Enums funcionais relevantes:

- papeis: Admin, Supplier, Reseller
- estoque: item type, movement type
- vendas: payment method, sale status
- produto: lifecycle status (Disponivel, EmProducao, Orcamento)
- feira: Awaiting, Open, Finalized, Cancelled
- financeiro: type e classification
- operacionais: priority e restock status
- projetos: status de projeto, etapa e tentativa

## 4) Regras de negocio principais

### 4.1 Produtos e preco

- Produto tem SKU unico, identificador numerico unico e categoria obrigatoria.
- Produto pode ser de fornecedor (SupplierId opcional).
- Existe fluxo de orcamento (lifecycle Orcamento) com conversao para produto disponivel.
- Precificacao considera custo, energia, acabamento, comissao e markups.
- Regras de seed de catalogo/planilha existem e devem permanecer em fluxo offline de importacao.

### 4.2 Vendas

- Venda cria baixa de estoque por item e registra movimento de inventario tipo Sale.
- Venda gera entrada financeira liquida (net received) e pode gerar despesa de custo de producao.
- Venda comissionada distribui repasse por fornecedor vendedor (quando aplicavel).
- Revendedor (Reseller):
  - nao pode informar fornecedor no item
  - nao pode marcar venda comissionada
  - enxerga somente vendas autoriais dele
- Regra de exibicao para venda de revendedor na tela de detalhes:
  - `commissionAmount` e persistido como valor de repasse/base da lojinha (ex.: preco base do item)
  - a comissao exibida para conferencia deve ser calculada como `totalPrice - commissionAmount`
  - o ganho exibido da lojinha deve usar o valor de repasse/base (`commissionAmount`), nao o campo bruto `lojinhaGainAmount`
- Em feira, fornecedor dos itens deve estar vinculado a feira.
- Opcionalmente, venda pode gerar itens de restock automaticamente para produtos vendidos.

### 4.3 Listas operacionais

- Restock:
  - cria item por produto/fornecedor
  - consolida em item ativo existente (somando target quantity)
  - consumo automatico quando estoque sobe
- Todo:
  - lista de tarefas operacionais simples por escopo
- Ambos os modulos registram auditoria de create/update/delete.

### 4.4 Projetos

- Projeto possui etapas (steps) e tentativas por etapa.
- Etapas tem ordem normalizada e controle de filamentos planejados.
- Tentativas registram impressora usada, tempos/pesos reais e status.
- Abertura/conclusao/reabertura de projeto e etapas atualiza totais agregados.
- Existe fluxo para concluir projeto gerando produto derivado.

### 4.5 Financeiro

- Lancamentos de receitas/despesas integrados com vendas.
- Modulo de taxas de cartao permite reprocessar vendas para consistencia de liquido/taxa.
- Classificacoes principais: Fixed e Variable.

## 5) Autenticacao, autorizacao e escopo

### 5.1 Autenticacao

- JWT Bearer com issuer/audience e chave simetrica configuraveis.
- Endpoints de autenticacao:
  - login
  - impersonate (somente Admin)
  - change-password (usuario autenticado)

### 5.2 Papeis e acesso

- Admin:
  - acesso total aos modulos administrativos
- Supplier:
  - acesso com escopo por fornecedor em produtos/estoque/vendas/listas/projetos
- Reseller:
  - acesso focado em dashboard, vendas, produtos (consulta) e financeiro
  - com restricoes especificas no fluxo de venda

### 5.3 Escopo por fornecedor

- Aplicado em servicos via scopedSupplierId.
- Produtos, vendas, listas operacionais e projetos respeitam esse filtro.

## 6) Mapa da API (alto nivel)

Base URL: /api

- AuthController
  - POST /auth/login
  - POST /auth/impersonate
  - PUT /auth/change-password
- UsersController
  - CRUD de usuarios
- SuppliersController
  - CRUD de fornecedores
- DashboardController
  - GET /dashboard
- ProductsController
  - listagem, metadata, detalhe, pricing, historico de preco
  - preview de preco, recalc global, CRUD, conversao de orcamento
- RecipesController
  - GET/PUT receita por produto
- SuppliesController
  - listagem, detalhe, create, update
- CategoriesController
  - listagem, detalhe, create, update, delete
- PrintersController
  - listagem, detalhe, create, update, delete
- InventoryController
  - movimentos de estoque (GET/POST)
- SalesController
  - listagem, detalhe, create, delete, cancel
- FairsController
  - CRUD + transicoes de status (start/finalize/reopen/cancel)
  - relatorio e export
  - criacao de venda vinculada a feira
- FinanceController
  - entries/report/create
- CardFeeSettingsController
  - get, put, reprocess-sales
- OperationalListsController
  - restock: get/create/update/delete
  - todo: get/create/update/delete
- ProjectsController
  - CRUD de projetos
  - etapas e tentativas
  - start/reopen/conclude/duplicate
  - conclude-with-product
- PersonalizadosController
  - pricing tiers
  - fluxo de etapas de projeto personalizado

## 7) Frontend (rotas e comportamento)

### 7.1 Estrutura

- App com rotas protegidas por sessao.
- Pagina de login quando sessao ausente.
- AppShell com navegacao principal por modulo.

### 7.2 Restricoes por papel no frontend

- Reseller:
  - sem cadastro/edicao de produtos
  - sem feiras
  - sem listas operacionais, projetos e personalizados
  - sem configuracoes administrativas de usuarios/taxas/fornecedores
- Supplier:
  - sem telas administrativas de usuarios/fornecedores/taxas
  - sem create/edit de alguns modulos restritos a admin

### 7.3 Integracao API

- api.ts resolve baseURL por ambiente:
  - VITE_API_URL
  - dominio de producao app/api
  - fallback local
- Interceptor adiciona bearer token.
- Em 401 nao-login, limpa sessao e redireciona para /login.

## 8) Banco de dados e migrations

- Migration inicial e evolucoes em src/Lojinha.Infrastructure/Migrations.
- Historico mostra crescimento modular:
  - feiras e dashboard
  - fornecedores
  - taxas de cartao e comissionamento
  - listas operacionais
  - projetos e multifilamento
  - personalizados
- Snapshot EF em AppDbContextModelSnapshot.
- Seed de catalogo em CatalogSeedSql.g.cs.

## 9) Operacao e runbook rapido

### 9.1 Subida local

- docker compose up -d postgres
- backend: dotnet ef database update; dotnet run
- frontend: npm install; npm run dev

## 10) Aprendizados operacionais (cadastro direto de mesas)

- Antes de inserir mesas manualmente no banco, confirmar sempre com o usuario a impressora e o filamento obrigatorios do projeto.
- No schema atual de producao:
  - `ProjectSteps` exige `CreatedAtUtc` e `UpdatedAtUtc` (NOT NULL).
  - `ProjectStepFilaments` usa `Id` proprio e FK `StepId` (nao `ProjectStepId`).
  - Nao existe unique para upsert por (`StepId`, `FilamentProfileId`), entao a estrategia segura e `DELETE` dos vinculos do projeto + `INSERT` completo.
  - Em `Projects`, campos de perda sao `TimeLostToFailuresMinutes` e `WeightLostToFailuresGrams`.
- Ao salvar nomes com acento via terminal/ssh, validar com `encode(convert_to("Name", 'UTF8'), 'hex')` para garantir que nao ficou corrompido.
- Quando uma mesa vier com ordem ambigua de tempo/peso (ex.: `4g, 35m`), confirmar explicitamente com o usuario antes de inserir.
- Quando o usuario ja informar impressora e filamento no pedido, aplicar direto sem nova pergunta e manter validacao de obrigatoriedade em 100% das mesas.

### 9.2 Compose completo

- docker compose up --build

### 9.3 Validacao minima

- API health: /health
- Swagger em ambiente local de desenvolvimento.

### 9.4 Producao Oracle

- Proxy Caddy publica web e api em HTTPS.
- Containers de app nao devem ser expostos diretamente para internet.

## 10) Invariantes importantes para manutencao

- Nao excluir produto com vendas vinculadas.
- Regras de escopo por fornecedor nao podem ser quebradas.
- Fluxo de venda sempre deve manter consistencia entre:
  - estoque
  - financeiro
  - auditoria
- Em alteracoes de precificacao, preservar compatibilidade com seed e importacao offline.

## 11) Sobre o arquivo sessions-index.json

- sessions-index.json permanece apenas como metadado auxiliar de sessoes locais.
- Ele nao e fonte principal de conhecimento do sistema.
- Este knowledge-bank.md e a referencia canonicamente util para continuidade tecnica.

## 12) Catalogo detalhado de regras de negocio

### 12.1 Regras de vendas (operacional + financeiro)

- R-VEN-001: venda reduz estoque de produto e gera movimento InventoryMovementType.Sale.
- R-VEN-002: exclusao/cancelamento de venda deve reverter estoque e remover efeitos relacionados da venda.
- R-VEN-003: venda pode ocorrer com estoque insuficiente sem quebrar criacao da venda (comportamento legado mantido).
- R-VEN-004: quando CreateTodoForProducedItems estiver ativo, a venda gera/atualiza alvo de restock por produto.
- R-VEN-005: ao excluir venda que gerou restock, o alvo de restock deve ser reduzido na quantidade correspondente.
- R-VEN-006: itens de venda em feira so podem referenciar fornecedores vinculados a feira.
- R-VEN-007: revendedor nao pode enviar SupplierId no item da venda.
- R-VEN-008: revendedor nao pode marcar IsCommissionedSale.
- R-VEN-009: venda comissionada exige fornecedor vendedor (CommissionSellerSupplierId).
- R-VEN-010: venda registra receita liquida (NetReceivedAmount) apos regras de taxa/cartao.
- R-VEN-011: pode haver despesa de custo de producao na venda quando aplicavel por produto.
- R-VEN-012: recalculo de valores de venda por taxa de cartao deve preservar consistencia historica de vendas antigas.

### 12.2 Regras de restock e lista operacional

- R-OPS-001: novo restock para produto com item ativo existente soma TargetQuantity no item existente.
- R-OPS-002: restock concluido/cancelado nao entra em consolidacao nem consumo.
- R-OPS-003: consumo de restock e feito quando ha aumento de estoque.
- R-OPS-004: reducao de alvo (DecreaseRestockTargetAsync) remove apenas a quantidade solicitada, sem zerar indevidamente.
- R-OPS-005: fornecedor so pode operar restock/todo no proprio escopo (OwnerSupplierId).
- R-OPS-006: produto fora do escopo do fornecedor gera erro de negocio.
- R-OPS-007: item todo exige nome obrigatorio e limites de tamanho para nome/fonte.

### 12.3 Regras de produtos, orcamentos e precificacao

- R-PROD-001: SKU e identificadores numericos de categoria/produto sao unicos.
- R-PROD-002: orcamento usa lifecycle Orcamento e pode ser convertido para Disponivel.
- R-PROD-003: produto com vendas nao pode ser excluido.
- R-PROD-004: ao aumentar estoque de produto, sistema consome alvo de restock pendente.
- R-PROD-005: sugestao de preco considera custo, markups e comissao; ha preview e recalc global.
- R-PROD-006: fornecedor pode ter visao escopada de catalogo com opcao de includeAllForSupplier em fluxos especificos.

### 12.4 Regras de feiras

- R-FEIRA-001: feira possui ciclo Awaiting -> Open -> Finalized, com opcao de Cancelled.
- R-FEIRA-002: somente perfis autorizados podem executar transicoes sensiveis (start/finalize/reopen/cancel).
- R-FEIRA-003: vendas de feira impactam relatorios da feira e financeiro por categoria especifica.
- R-FEIRA-004: rateio de taxa de feira considera participantes vinculados e split configurado.
- R-FEIRA-005: taxa de feira pode ser opcional (regra introduzida em ajustes de validacao/formulario).

### 12.5 Regras de projetos

- R-PROJ-001: etapas possuem ordem normalizada e podem ser reordenadas com consistencia.
- R-PROJ-002: tentativa de etapa incrementa AttemptNumber sequencial.
- R-PROJ-003: concluir/falhar tentativa atualiza status da etapa e agregados do projeto.
- R-PROJ-004: reprint e autoordenacao de mesas foram incorporados ao fluxo de producao.
- R-PROJ-005: conclusao de projeto pode atualizar/gerar produto derivado.

### 12.6 Regras de personalizados

- R-PERS-001: projeto personalizado segue etapas fixas de budget/modeling/approval/printing/finishing/finalization.
- R-PERS-002: projeto cancelado nao pode seguir fluxo normal de aprovacao/producao.
- R-PERS-003: impressao so pode finalizar apos produto configurado e tamanho real definido.
- R-PERS-004: ao finalizar impressao, produto pode ir para EmProducao; ao finalizar acabamento, volta para Disponivel.
- R-PERS-005: finalizar personalizado pode disparar venda e concluir projeto base associado.
- R-PERS-006: faixa de preco por tamanho deve cobrir o tamanho informado; caso contrario, erro de negocio.

### 12.7 Regras de acesso e escopo

- R-ACC-001: Admin possui acesso total de administracao.
- R-ACC-002: Supplier opera com escopo por fornecedor em vendas, estoque, listas, projetos e financeiro escopado.
- R-ACC-003: Reseller possui escopo em dashboard, vendas, produtos e financeiro, com bloqueios de acoes administrativas.
- R-ACC-004: impersonate e exclusivo de Admin e preserva sessao original para retorno.

## 13) Decisoes historicas de negocio (derivadas de entregas)

Linha do tempo objetiva das decisoes mais relevantes, extraidas de commits e artefatos de codigo:

- 2026-05-21
  - Inclusao do papel Revendedor e seu escopo funcional restrito.
  - Ajustes de UX para esconder acoes nao permitidas para revendedor em financeiro/feiras.
  - Ajuste de anos KPI para refletir base de dados existente.
- 2026-05-22
  - Tela de Projetos passou a ter paginacao na listagem (linhas por pagina e navegacao).
  - Cards de resumo da tela de Projetos foram trocados para indicadores objetivos: total, em andamento, planejados e concluidos.
  - Semantica de "ativos" corrigida: agora o indicador operacional usa apenas status EmAndamento (nao inclui todo status diferente de Concluido).
  - Deploy realizado na Oracle VM com tag 20260522-projects-pagination-v1 (API + Web). Ambos os endpoints validados HTTP 200.
  - Backup automatico diario configurado: cron 2h AM na Oracle VM, pg_dump do container lojinha-postgres (formato custom -Fc -Z9), publicado em backups/lojinha-latest.dump no repositorio git (sparse checkout, sem codigo-fonte na Oracle). Deploy key SSH configurada na Oracle (lojinha-oracle-backup). Somente o ultimo dump e mantido.
  - Modulo de estoque revalidado: botao de estorno (reversal) adicionado em cada movimentacao do tipo Entrada/Saida/Ajuste (exceto Venda) na tela InventoryPage. Confirmacao por dialog antes de executar. Endpoint POST /api/inventory/movements/{id}/reverse criado em InventoryController; servico ReverseAsync em InventoryService cria movimento oposto automatico com nota "Estorno de [tipo] em [data]".
  - KPIs do modulo de estoque substituidos por indicadores reais: "Produtos em estoque" (currentStock > 0), "Abaixo do minimo" (currentStock < minimumStock, destacado em laranja), "Sem estoque" (currentStock === 0), "Valor estimado (custo)" (soma de currentStock * costPrice). Todos respeitam filtro de escopo por fornecedor.
  - Linhas abaixo do estoque minimo destacadas em laranja na tabela de produtos do modulo de estoque.
  - Deploy realizado na Oracle VM com tag 20260522-inventory-kpis-estorno-v1 (API + Web). Ambos os endpoints validados HTTP 200. Imagens antigas da tag anterior removidas do Oracle.
  - Atualizacao em banco (Oracle/producao): todos os produtos com minimumStock = 2 foram alterados para minimumStock = 1 via SQL operacional versionado em deploy/oracle/artifacts/minstock-products-2-to-1.sql (resultado: 416 linhas atualizadas, 0 restantes com valor 2).
  - Cadastro de produto ajustado: valor padrao de estoque minimo na ProductFormPage alterado de 2 para 1 para novos cadastros.
  - Tela de estoque ajustada para o contexto atual de acuracia: indicador KPI "Abaixo do minimo" removido e destaques visuais de alerta por minimo (cartao/tabela/lista mobile) desativados para evitar sinalizacao enganosa.
  - Listagem de produtos ajustada: busca textual da tela ProductsPage agora filtra somente por nome do produto (nao considera categoria, SKU ou fornecedor no campo de texto).
  - Ajuste da busca textual em produtos: filtro por texto mantido em nome + SKU, removendo apenas filtro indevido por categoria no campo de busca livre.
  - Vendas de revendedor revisadas: calculo de lucro por perfil corrigido (revendedor ve lucro de revenda; dono do item ve lucro real com base em repasse e custo). Listagem de vendas passou a exibir coluna de repasse para facilitar conferencia.
  - Dashboard com escopo de revendedor corrigido: invalidacao de cache agora remove chaves especificas por ator de revendedor para refletir vendas novas imediatamente nos indicadores.
  - Financeiro do revendedor corrigido: KPIs e relatorio agora contabilizam nas vendas apenas o resultado liquido real da revenda (lucro/prejuizo), removendo o lancamento sintetico indevido de "Custo das pecas vendidas" para esse perfil.
- 2026-05-17
  - Evolucao forte do modulo de projetos: filamento padrao PLA 120, filtros rapidos, reimpressao e autoordenacao.
  - Ajustes de responsividade e padronizacao de acoes em UI.
- 2026-05-15
  - Refinamento de rateio de taxa de feiras (impacto em indicadores e repasses).
- 2026-05-13
  - Correcao de lucro em vendas comissionadas.
  - Migracao/regras de roteamento de restock ligado a vendas legadas.
  - Ajustes de detalhes de venda para coerencia de exibicao.
- 2026-05-12 a 2026-05-06
  - Consolidacao do modulo de listas operacionais.
  - Introducao e estabilizacao do modo Orcamento.
  - Taxa de feira opcional em validacoes/formularios.
- 2026-05-05
  - Introducao dos modulos Personalizados e Projetos com workflow dedicado.
  - Implementacao de impersonacao admin para suporte operacional.

## 14) Regras explicitamente validadas por testes

Fonte: testes de servico presentes no repositorio.

- T-SALE-001: CreateAsync deve permitir venda mesmo com estoque insuficiente.
- T-SALE-002: DeleteAsync restaura estoque e remove registros correlatos da venda.
- T-SALE-003: DeleteAsync reduz alvo de restock quando a venda criou itens automaticos.
- T-OPS-001: CreateRestockItemAsync incrementa item ativo existente em vez de duplicar.
- T-OPS-002: DecreaseRestockTargetAsync reduz apenas a quantidade solicitada.

## 15) Proveniencia das regras e confiabilidade

### 15.1 Fontes usadas para este banco

- Codigo de servicos e controladores.
- Testes automatizados de servicos.
- Historico Git de alteracoes e mensagens de commit.
- Estrutura de migrations e contratos.

### 15.2 O que foi possivel recuperar de sessoes

- Os logs locais de sessoes disponiveis nesta maquina preservam majoritariamente eventos de session_start.
- Nao foi possivel reconstruir turnos completos de conversa antigos a partir desses logs.
- Para cobrir essa lacuna, as regras foram reconstruidas com foco em evidencias fortes de codigo + testes + historico de entregas.

### 15.3 Criterio de confiabilidade

- Alto: regra sustentada por codigo + teste.
- Medio: regra sustentada por codigo sem teste direto no repositorio.
- Contextual: regra inferida de historico de commits/entregas e confirmada parcialmente no codigo.

## 16) Governanca do conhecimento (politica operacional)

### 16.1 Politica global de execucao com Copilot

- Toda demanda concluida deve gerar ou atualizar uma base de conhecimento do contexto atendido.
- Essa base global deve existir fora do repositorio do projeto para sobreviver a novas sessoes e novos workspaces.

### 16.2 Regra obrigatoria para o contexto Lojinha

- Alem da base global externa, toda demanda da Lojinha deve atualizar este banco em docs/banco-aprendizado.
- A atualizacao da base da Lojinha deve ser versionada e enviada ao remoto com push para garantir integridade e historico no repositorio.

### 16.3 Aplicacao pratica desta politica

- Este documento e o README deste diretorio passam a ser parte obrigatoria do fluxo de entrega documental da Lojinha.
- Mudancas de regra, escopo, fluxo ou operacao devem refletir aqui no mesmo ciclo da demanda.

### 16.4 Estado atual de configuracao global (VS Code)

- A politica foi aplicada no nivel de usuario do VS Code (settings globais) para o perfil padrao do Code nesta maquina.
- Chaves configuradas:
  - github.copilot.chat.customInstructionsInSystemMessage = true
  - github.copilot.chat.codeGeneration.useInstructionFiles = true
  - github.copilot.chat.codeGeneration.instructions com instrucao explicita de atualizacao de base de conhecimento global e regra extra da Lojinha.
- Observacao operacional:
  - Novas sessoes passam a herdar a politica imediatamente.
  - Sessoes ja abertas em outras janelas podem exigir reload da janela para refletir configuracoes recarregadas do usuario.
