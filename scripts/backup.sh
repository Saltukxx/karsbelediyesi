#!/usr/bin/env bash
# Kars Belediyesi — otomatik yedekleme
# Kullanım: npm run backup  (veya crontab: 0 3 * * * cd /path/to/proje && bash scripts/backup.sh)
#
# - PostgreSQL dump'ı (docker exec kars-postgres pg_dump) → backups/kars-YYYY-MM-DD.sql.gz
# - Fotoğraf klasörü (UPLOAD_DIR, varsayılan apps/web/data/uploads) → backups/uploads-YYYY-MM-DD.tar.gz
# - 14 günden eski yedekleri siler

set -euo pipefail

PROJE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJE_DIR/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-$PROJE_DIR/apps/web/data/uploads}"
CONTAINER="${POSTGRES_CONTAINER:-kars-postgres}"
DB_USER="${POSTGRES_USER:-kars}"
DB_NAME="${POSTGRES_DB:-kars_belediyesi}"
SAKLAMA_GUN=14
TARIH="$(date +%F)"

mkdir -p "$BACKUP_DIR"

echo "[backup] PostgreSQL dump alınıyor ($CONTAINER / $DB_NAME)..."
if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/kars-$TARIH.sql.gz"; then
  echo "[backup] HATA: pg_dump başarısız. Konteyner çalışıyor mu? (docker compose up -d postgres)" >&2
  rm -f "$BACKUP_DIR/kars-$TARIH.sql.gz"
  exit 1
fi
echo "[backup] Veritabanı → $BACKUP_DIR/kars-$TARIH.sql.gz ($(du -h "$BACKUP_DIR/kars-$TARIH.sql.gz" | cut -f1))"

if [ -d "$UPLOAD_DIR" ]; then
  echo "[backup] Fotoğraf klasörü arşivleniyor ($UPLOAD_DIR)..."
  tar -czf "$BACKUP_DIR/uploads-$TARIH.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "[backup] Fotoğraflar → $BACKUP_DIR/uploads-$TARIH.tar.gz ($(du -h "$BACKUP_DIR/uploads-$TARIH.tar.gz" | cut -f1))"
else
  echo "[backup] Fotoğraf klasörü yok, atlanıyor: $UPLOAD_DIR"
fi

echo "[backup] $SAKLAMA_GUN günden eski yedekler temizleniyor..."
find "$BACKUP_DIR" -name "kars-*.sql.gz" -mtime +"$SAKLAMA_GUN" -delete
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +"$SAKLAMA_GUN" -delete

echo "[backup] Tamamlandı: $(ls "$BACKUP_DIR" | wc -l | tr -d ' ') dosya mevcut."
