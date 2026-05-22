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
