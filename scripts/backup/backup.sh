#!/bin/bash
#
# Rappit Database Backup Script (DB-02)
#
# Creates a full PostgreSQL backup using pg_dump
# For soft launch: stores locally with 30-day retention
# Upgrade path: add S3 upload for production
#
# Usage: ./backup.sh [config_file]
# Schedule: Daily at 02:00 UTC (add to crontab)
#   0 2 * * * /path/to/backup.sh /path/to/config.env
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load configuration
CONFIG_FILE="${1:-$(dirname "$0")/config.env}"
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
else
    echo -e "${RED}Error: Configuration file not found: $CONFIG_FILE${NC}"
    echo "Copy config.env.example to config.env and configure your settings"
    exit 1
fi

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-rappit}"
DB_USER="${DB_USER:-rappit_user}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rappit}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENVIRONMENT="${ENVIRONMENT:-development}"
LOG_DIR="${LOG_DIR:-/var/log/rappit-backup}"

# Create directories if they don't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/rappit_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Alert function (for future PagerDuty integration)
send_alert() {
    local severity=$1
    local message=$2
    
    log "ALERT" "[$severity] $message"
    
    # Future: Add PagerDuty integration
    # if [[ -n "${PAGERDUTY_SERVICE_KEY:-}" ]]; then
    #     curl -X POST https://events.pagerduty.com/v2/enqueue \
    #         -H 'Content-Type: application/json' \
    #         -d "{
    #             \"routing_key\": \"$PAGERDUTY_SERVICE_KEY\",
    #             \"event_action\": \"trigger\",
    #             \"payload\": {
    #                 \"summary\": \"$message\",
    #                 \"severity\": \"$severity\",
    #                 \"source\": \"rappit-backup\"
    #             }
    #         }"
    # fi
}

# Check previous backup size (for anomaly detection)
check_backup_size() {
    local new_size=$1
    local previous_backup=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -2 | tail -1)
    
    if [[ -n "$previous_backup" && -f "$previous_backup" ]]; then
        local prev_size=$(stat -f%z "$previous_backup" 2>/dev/null || stat -c%s "$previous_backup" 2>/dev/null || echo 0)
        
        if [[ $prev_size -gt 0 ]]; then
            local diff_percent=$(( (new_size - prev_size) * 100 / prev_size ))
            local abs_diff=${diff_percent#-}  # Absolute value
            
            if [[ $abs_diff -gt 20 ]]; then
                send_alert "warning" "Backup size changed by ${diff_percent}% (previous: ${prev_size}, current: ${new_size})"
            fi
        fi
    fi
}

# Main backup function
perform_backup() {
    log "INFO" "Starting backup of database: $DB_NAME"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Backup file: $BACKUP_FILE"
    
    local start_time=$(date +%s)
    
    # Perform backup using pg_dump
    if PGPASSWORD="${PGPASSWORD:-}" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --verbose \
        2>> "$LOG_FILE" | gzip > "$BACKUP_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local backup_size=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
        
        log "INFO" "${GREEN}Backup completed successfully${NC}"
        log "INFO" "Duration: ${duration} seconds"
        log "INFO" "Backup size: $(numfmt --to=iec-i --suffix=B $backup_size 2>/dev/null || echo "${backup_size} bytes")"
        
        # Check for size anomalies
        check_backup_size "$backup_size"
        
        # Verify backup integrity
        if gzip -t "$BACKUP_FILE" 2>/dev/null; then
            log "INFO" "Backup integrity verified (gzip test passed)"
        else
            send_alert "error" "Backup integrity check failed"
            return 1
        fi
        
        # Future: Add S3 upload here
        # if [[ -n "${S3_BUCKET:-}" ]]; then
        #     log "INFO" "Uploading to S3: s3://${S3_BUCKET}/"
        #     aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/$(basename $BACKUP_FILE)"
        # fi
        
        return 0
    else
        log "ERROR" "${RED}Backup failed${NC}"
        send_alert "critical" "Database backup failed for $DB_NAME ($ENVIRONMENT)"
        return 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up backups older than $RETENTION_DAYS days"
    
    local deleted_count=0
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            rm -f "$file"
            log "INFO" "Deleted old backup: $(basename "$file")"
            ((deleted_count++))
        fi
    done < <(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null)
    
    log "INFO" "Cleanup complete. Deleted $deleted_count old backup(s)"
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "Backup Summary"
    echo "=========================================="
    echo "Database: $DB_NAME"
    echo "Environment: $ENVIRONMENT"
    echo "Backup File: $BACKUP_FILE"
    echo "Log File: $LOG_FILE"
    echo ""
    
    # Show recent backups
    echo "Recent backups:"
    ls -lh "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}Rappit Database Backup${NC}"
    echo "======================================"
    
    # Perform backup
    if perform_backup; then
        # Cleanup old backups after successful backup
        cleanup_old_backups
        print_summary
        exit 0
    else
        print_summary
        exit 1
    fi
}

main
