# Knowledge Bank - Sessoes Anteriores

Gerado em: 2026-05-22

## 1) Inventario de sessoes anteriores

- Total de sessoes detectadas no historico local: 17
- Janela temporal observada: 2026-05-11 ate 2026-05-22
- Os metadados completos estao em `sessions-index.json`

Observacao tecnica:

- O reindex local retornou sessoes, porem sem turns, refs, files e checkpoints disponiveis.
- Isso indica que o armazenamento local atual preserva metadados de sessao, mas nao conserva o conteudo conversacional historico.

## 2) Regras operacionais consolidadas (memoria persistida)

### Deploy Lojinha (obrigatorio)

- Toda alteracao no escopo de `c:\Lojinha` deve ser deployada na Oracle VM ao final do desenvolvimento.
- Nao enviar codigo-fonte para a Oracle VM.
- Nao compilar/buildar na Oracle VM; build sempre local e transferencia por imagem (`docker save`/`scp`/`docker load`).
- Validacao publica apos deploy:
  - API: `https://api.alojinhasemnome.com.br/health`
  - Web: `https://app.alojinhasemnome.com.br`
- Limpeza obrigatoria apos deploy:
  - Limpar artefatos locais (`deploy/oracle/images/*.tar`, `backups/*.tar`, `staging-publish/`).
  - Limpar Docker local com prune seletivo (sem `docker image prune -a`).

### Preferencias de trabalho registradas

- Nao incluir coautoria automatica de Copilot em commits/PRs.
- Sempre rodar testes imediatamente apos alteracoes em testes.
- Antes de mexer em mapeamentos/config compartilhada, levantar impacto por uso do simbolo.
- Em caso de dado faltante, perguntar explicitamente; nao inferir.

## 3) Conhecimento de dominio registrado no repositorio

Fonte: memoria do repositorio (`/memories/repo/seed-pricing.md`)

- Seed de catalogo: `src/Lojinha.Api/Migrations/CatalogSeedSql.g.cs`
- Importacao de planilha deve permanecer apenas offline.
- Refresh seguro de seed em bases existentes deve usar migration dedicada para `CatalogSeedSql.Up`.
- Markup visivel de encomendas: `2.5` (deve ser preservado no seed estatico).
- Percentuais de acabamento no seed extraido devem ser normalizados para fracao (ex.: `2 -> 0.02`).

## 4) Linha do tempo tecnica (aprendizado por commits)

Resumo dos temas mais recentes identificados no historico Git:

- 2026-05-21
  - Perfil `Revendedor` com escopo de dashboard/vendas/produtos/financeiro.
  - Restricoes de acoes financeiras/feiras para perfil revendedor.
  - Ajuste de anos dos KPIs para refletir dados existentes.
- 2026-05-17
  - Melhorias de UX/UI em botoes e acoes de tabela.
  - Ajustes de layout e responsividade em Projetos.
  - Fluxo de Projetos: filamento padrao PLA 120, filtros rapidos, reimpressao e autoordenacao de mesas.
- 2026-05-15
  - Melhorias no rateio de taxa em feiras.
- 2026-05-14 a 2026-05-13
  - Correcao de migracao legada e recalculo de lucro em vendas.
  - Correcao de filtros de busca de produtos e regras de roteamento/restock.
- 2026-05-12 a 2026-05-05
  - Correcao de exclusao e ajustes gerais de estabilidade.
  - Evolucao de modulo de Personalizados, filtros, escopo de acesso e experiencia de cadastro.

## 5) Lacunas e como evoluir este banco

- Lacuna atual: nao ha historico de turns/checkpoints disponivel no indice local para recuperar texto completo de conversas antigas.
- Evolucao recomendada:
  - Manter este banco como referencia oficial interna para continuidade.
  - Acrescentar novos aprendizados ao final de cada tarefa concluida.
  - Versionar sempre junto das alteracoes de codigo relacionadas.
