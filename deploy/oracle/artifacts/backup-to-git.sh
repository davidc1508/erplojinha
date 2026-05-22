#!/bin/bash
set -e

REPO_DIR=~/lojinha/repo
BACKUP_DIR="$REPO_DIR/backups"
DUMP_FILE="lojinha-latest.dump"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Sync repo para garantir base limpa
cd "$REPO_DIR"
git fetch origin
git reset --hard origin/main

# Dump do banco via container (formato custom, compressão máxima)
docker exec lojinha-postgres pg_dump \
  -U lojinha \
  -d lojinha \
  -Fc \
  -Z 9 \
  > "$BACKUP_DIR/$DUMP_FILE"

# Remove dumps antigos mantendo somente lojinha-latest.dump
find "$BACKUP_DIR" -name '*.dump' ! -name "$DUMP_FILE" -delete

# Commit e push
cd "$REPO_DIR"
git config user.email 'oracle-backup@lojinha'
git config user.name 'Oracle Backup'
git add "backups/$DUMP_FILE"
if git diff --cached --quiet; then
  echo "Nenhuma alteracao no dump — nada a commitar."
  exit 0
fi
git commit -m "backup: dump automatico $DATE"
git push origin main

echo "Backup concluido: $DATE"
