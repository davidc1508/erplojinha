#!/bin/bash
set -e

REPO_DIR=~/lojinha/repo
BACKUP_DIR="$REPO_DIR/backups"
DUMP_FILE="lojinha-latest.dump"
PREV_FILE="lojinha-previous.dump"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Sync repo para garantir base limpa
cd "$REPO_DIR"
git fetch origin
git reset --hard origin/main

# Rotaciona: o dump anterior (ultimo commitado) vira lojinha-previous.dump
# antes de gerar o novo, para manter sempre as duas ultimas versoes no repo.
if [ -f "$BACKUP_DIR/$DUMP_FILE" ]; then
  mv -f "$BACKUP_DIR/$DUMP_FILE" "$BACKUP_DIR/$PREV_FILE"
fi

# Dump do banco via container (formato custom, compressão máxima)
docker exec lojinha-postgres pg_dump \
  -U lojinha \
  -d lojinha \
  -Fc \
  -Z 9 \
  > "$BACKUP_DIR/$DUMP_FILE"

# Mantem somente as duas ultimas versoes do dump
find "$BACKUP_DIR" -name '*.dump' ! -name "$DUMP_FILE" ! -name "$PREV_FILE" -delete

# Commit e push
cd "$REPO_DIR"
git config user.email 'oracle-backup@lojinha'
git config user.name 'Oracle Backup'
git add -f "backups/$DUMP_FILE"
[ -f "$BACKUP_DIR/$PREV_FILE" ] && git add -f "backups/$PREV_FILE"
if git diff --cached --quiet; then
  echo "Nenhuma alteracao no dump — nada a commitar."
  exit 0
fi
git commit -m "backup: dump automatico $DATE"
git push origin main

echo "Backup concluido: $DATE"
