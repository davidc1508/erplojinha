# Banco de Conhecimento da Lojinha

Gerado em: 2026-05-22

Este diretorio consolida conhecimento tecnico do sistema Lojinha para continuidade de desenvolvimento e operacao.
O foco principal e contexto do produto e da arquitetura, nao historico de chat.

## Objetivo

- Servir como referencia unica e versionada do contexto geral do sistema.
- Permitir onboard rapido sem depender de memoria de sessao.
- Reduzir risco de perda de conhecimento quando historico local nao estiver disponivel.

## Arquivos

- knowledge-bank.md
	- Base principal com arquitetura, dominio, regras de negocio, API, frontend e operacao.
	- Inclui catalogo detalhado de regras por modulo, linha do tempo de decisoes e regras validadas por testes.
- sessions-index.json
	- Metadado auxiliar de sessoes locais detectadas.
	- Nao deve ser tratado como fonte principal de conhecimento tecnico.

## Fontes de verdade usadas para montar este banco

- Codigo-fonte backend e frontend.
- Configuracoes de execucao local/producao (compose e appsettings).
- Migrations e modelagem de dados.
- Regras funcionais inferidas dos servicos de aplicacao.

## Como manter atualizado

1. A cada mudanca relevante de arquitetura/regra, atualizar knowledge-bank.md no mesmo PR/commit.
2. Ao incluir novo modulo/endpoints, atualizar secoes de API, dominio e acesso por papel.
3. Tratar sessions-index.json apenas como apoio historico, nunca como substituto da documentacao tecnica.
4. Quando existir evidencia em teste, registrar a regra tambem na secao de regras validadas por testes.
5. Ao introduzir regra de negocio nova, adicionar identificador de regra (ex.: R-VEN-013) para rastreabilidade.
