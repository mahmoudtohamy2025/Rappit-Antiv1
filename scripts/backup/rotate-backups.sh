#!/bin/bash
#
# Rappit Backup Rotation Script (DB-02)
#
# Removes backups older than retention period
# Called automatically by backup.sh or can be run manually
#
# Usage: ./rotate-backups.sh [retention_days]
#

set -euo pipefail

# Load configuration
SCRIPT_DIR="$(dirname "$0")"
CONFIG_FILE="${SCRIPT_DIR}/config.env"
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Override retention from argument if provided
RETENTION_DAYS="${1:-${RETENTION_DAYS:-30}}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rappit}"

echo "Backup Rotation"
echo "==============="
echo "Backup directory: $BACKUP_DIR"
echo "Retention period: $RETENTION_DAYS days"
echo ""

# Count backups before
before_count=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "Backups before: $before_count"

# Find and delete old backups
deleted=0
while IFS= read -r file; do
    if [[ -n "$file" ]]; then
        echo "Deleting: $(basename "$file")"
        rm -f "$file"
        ((deleted++))
    fi
done < <(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null)

# Count after
after_count=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "Summary:"
echo "  Deleted: $deleted backup(s)"
echo "  Remaining: $after_count backup(s)"
echo ""

# List remaining backups
if [[ $after_count -gt 0 ]]; then
    echo "Current backups:"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -10
fi
