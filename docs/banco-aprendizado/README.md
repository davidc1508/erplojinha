# Banco de Aprendizado da Lojinha

Gerado em: 2026-05-22

Este diretório consolida o conhecimento recuperável das sessões anteriores para consulta rápida e continuidade de trabalho.

## Fontes usadas

- Histórico local de sessões reindexado (metadados de sessão).
- Logs de debug de sessão disponíveis no VS Code (`main.jsonl` e `models.json`).
- Memória persistida do repositório (`/memories/repo/seed-pricing.md`).
- Histórico Git do projeto (mensagens de commit).

## Conteúdo

- `sessions-index.json`: índice completo das sessões anteriores encontradas no histórico local.
- `knowledge-bank.md`: visão consolidada de regras, decisões e evolução do projeto.

## Limitações atuais dos dados históricos

- O índice local não contém turns, arquivos referenciados nem checkpoints das sessões anteriores (campos vazios no reindex atual).
- Os logs de sessão disponíveis preservam principalmente metadados de inicialização de sessão.
- Para garantir rastreabilidade, este banco explicita essas lacunas em vez de inferir conteúdo inexistente.

## Atualização futura

Quando houver novo histórico no índice local, atualizar:

1. `sessions-index.json` com as novas sessões.
2. `knowledge-bank.md` com aprendizados/decisões adicionais.
