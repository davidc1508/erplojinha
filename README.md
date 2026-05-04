# Lojinha Sem Nome ERP

Sistema web completo para gestão de loja física e produção artesanal/3D, com backend em .NET 10 Web API e frontend em React + TypeScript.

## Stack

- Backend: .NET 10, ASP.NET Core Web API, Entity Framework Core, PostgreSQL, FluentValidation, JWT
- Frontend: React 18, TypeScript, Vite 4, Material UI, React Query, Axios, Recharts
- Seed inteligente: importa categorias, produtos, perfis de impressora, filamentos e marketplace a partir das planilhas em Planilhas
- Identidade visual: frontend usa a arte da loja em Logo e uma paleta pastel derivada da marca

## Módulos entregues

- Produtos com SKU, categoria, estoque, estoque mínimo, custo, preço sugerido, preço final e margem
- Insumos com custo por unidade e estoque
- Receita por produto com lista de insumos e recálculo automático de custo
- Movimentação de estoque manual e automática
- Vendas com baixa de estoque e lançamento financeiro automático
- Financeiro com receitas, despesas, categorias, relatório e saldo
- Dashboard com faturamento mensal, lucro estimado, top produtos, baixo estoque e gráficos
- Autenticação administrativa via JWT
- Histórico via audit log para alterações relevantes

## Regra de preço sugerido

O backend replica a lógica base das planilhas de precificação:

- custo de material por peso ou comprimento do filamento
- custo de energia por tempo de impressão e potência da impressora
- custo de manutenção e taxa de falha por perfil da máquina
- custo de acabamento e custo da hora trabalhada
- markups de atacado, varejo e revenda
- ajuste de comissão e taxa fixa por marketplace

Os dados das tabelas auxiliares são importados de Calculadora Geral.xlsx. Os catálogos por categoria são lidos das demais planilhas.

## Credenciais seed

- Email: admin@lojinha.local
- Senha: Admin@123

## Estrutura

```text
src/
  Lojinha.Api/
  lojinha-web/
tests/
  Lojinha.Api.Tests/
Logo/
Planilhas/
```

## Rodando localmente

### 1. Banco com Docker

```powershell
docker compose up -d postgres
```

### 2. Backend

```powershell
cd src/Lojinha.Api
dotnet restore
dotnet ef database update
dotnet run
```

Swagger fica disponível em http://localhost:5212/swagger durante execução local padrão do ASP.NET Core.

### 3. Frontend

```powershell
cd src/lojinha-web
npm install
npm run dev
```

O frontend espera a API em http://localhost:5212 por padrão. Se quiser mudar, defina VITE_API_URL.

## Rodando com Docker Compose

```powershell
docker compose up --build
```

API: http://localhost:8080/swagger

## HTTPS em produção

Para produção no Oracle, a aplicação deve ficar atrás de um proxy reverso com TLS.

- Frontend público: https://app.alojinhasemnome.com.br
- API pública: https://api.alojinhasemnome.com.br
- Proxy recomendado: Caddy com certificados automáticos Let's Encrypt

Regras importantes:

- o frontend deve ser buildado com `VITE_API_URL=https://api.alojinhasemnome.com.br`
- o proxy expõe apenas as portas `80` e `443`
- os containers `web` e `api` ficam acessíveis apenas internamente pela rede do Docker
- o CORS da API deve aceitar `https://app.alojinhasemnome.com.br`

O arquivo de produção com essa topologia fica em [deploy/oracle/docker-compose.yml](deploy/oracle/docker-compose.yml), usando o [deploy/oracle/Caddyfile](deploy/oracle/Caddyfile).

## Testes e builds validados

```powershell
dotnet build src/Lojinha.Api/Lojinha.Api.csproj
dotnet test tests/Lojinha.Api.Tests/Lojinha.Api.Tests.csproj
cd src/lojinha-web
npm run build
```

## Banco e scripts

- Migration inicial: src/Lojinha.Api/Migrations
- Script SQL: src/Lojinha.Api/Migrations/InitialCreate.sql

## Hospedagem gratuita sugerida

- Backend: Render, Fly.io ou Railway starter
- Banco PostgreSQL: Neon ou Supabase (camadas gratuitas)
- Frontend: Vercel ou Netlify

Para produção pessoal e privada, a combinação mais simples é:

1. Frontend no Vercel
2. API no Render
3. PostgreSQL no Neon

## Observações

- O seed usa os arquivos reais das pastas Planilhas e Logo.
- A importação inicial acontece quando o banco está vazio.
- A venda bloqueia quando não há estoque suficiente de produto ou insumo.