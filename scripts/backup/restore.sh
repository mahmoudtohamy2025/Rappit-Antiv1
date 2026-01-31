#!/bin/bash
#
# Rappit Database Restore Script (DB-02)
#
# Restores a PostgreSQL database from a backup file
# Includes data verification and timing for RTO compliance
#
# Usage: ./restore.sh <backup_file> [target_database]
#
# Examples:
#   ./restore.sh /var/backups/rappit/rappit_production_20241229_020000.sql.gz
#   ./restore.sh backup.sql.gz rappit_staging
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load configuration
SCRIPT_DIR="$(dirname "$0")"
CONFIG_FILE="${SCRIPT_DIR}/config.env"
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-rappit_user}"
LOG_DIR="${LOG_DIR:-/var/log/rappit-backup}"

# Parse arguments
BACKUP_FILE="${1:-}"
TARGET_DB="${2:-${DB_NAME:-rappit_restored}}"

if [[ -z "$BACKUP_FILE" ]]; then
    echo -e "${RED}Error: Backup file required${NC}"
    echo ""
    echo "Usage: $0 <backup_file> [target_database]"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR:-/var/backups/rappit}"/*.sql.gz 2>/dev/null | tail -10 || echo "No backups found"
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Create log directory
mkdir -p "$LOG_DIR"

# Generate log filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/restore_${TIMESTAMP}.log"

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Verify backup integrity
verify_backup() {
    log "INFO" "Verifying backup integrity: $BACKUP_FILE"
    
    if gzip -t "$BACKUP_FILE" 2>/dev/null; then
        log "INFO" "${GREEN}Backup integrity verified${NC}"
        return 0
    else
        log "ERROR" "${RED}Backup file is corrupted${NC}"
        return 1
    fi
}

# Create target database
create_database() {
    log "INFO" "Creating target database: $TARGET_DB"
    
    # Check if database exists
    if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$TARGET_DB"; then
        log "WARN" "${YELLOW}Database $TARGET_DB already exists${NC}"
        
        echo -e "${YELLOW}Warning: Database '$TARGET_DB' already exists.${NC}"
        echo "This will DROP the existing database and recreate it."
        read -p "Continue? (yes/no): " confirm
        
        if [[ "$confirm" != "yes" ]]; then
            log "INFO" "Restore cancelled by user"
            exit 0
        fi
        
        log "INFO" "Dropping existing database: $TARGET_DB"
        PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE \"$TARGET_DB\";" postgres
    fi
    
    log "INFO" "Creating database: $TARGET_DB"
    PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$TARGET_DB\";" postgres
}

# Perform restore
perform_restore() {
    log "INFO" "Starting restore to database: $TARGET_DB"
    log "INFO" "Backup file: $BACKUP_FILE"
    
    local start_time=$(date +%s)
    
    # Decompress and restore
    if gunzip -c "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD:-}" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TARGET_DB" \
        --quiet \
        2>> "$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "INFO" "${GREEN}Restore completed successfully${NC}"
        log "INFO" "Duration: ${duration} seconds"
        
        # Document timing for RTO compliance
        echo ""
        echo "=========================================="
        echo "RTO COMPLIANCE CHECK"
        echo "=========================================="
        echo "Restore Duration: ${duration} seconds ($(($duration / 60)) minutes)"
        echo ""
        echo "Target RTO:"
        echo "  - Production: 2 hours (7200 seconds)"
        echo "  - Staging: 4 hours (14400 seconds)"
        echo ""
        
        if [[ $duration -lt 7200 ]]; then
            echo -e "${GREEN}✓ Within Production RTO${NC}"
        else
            echo -e "${YELLOW}⚠ Exceeds Production RTO target${NC}"
        fi
        
        return 0
    else
        log "ERROR" "${RED}Restore failed${NC}"
        return 1
    fi
}

# Verify restored data
verify_data() {
    log "INFO" "Verifying restored data..."
    
    echo ""
    echo "Data Verification:"
    echo "=================="
    
    # Count key tables
    local tables=("organizations" "users" "orders" "inventory_levels" "channels")
    
    for table in "${tables[@]}"; do
        local count=$(PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "N/A")
        echo "  $table: $(echo $count | tr -d ' ') records"
    done
    
    echo ""
    log "INFO" "Data verification complete"
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "Restore Summary"
    echo "=========================================="
    echo "Backup File: $BACKUP_FILE"
    echo "Target Database: $TARGET_DB"
    echo "Log File: $LOG_FILE"
    echo ""
    echo "To connect to restored database:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TARGET_DB"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}Rappit Database Restore${NC}"
    echo "======================================"
    echo ""
    
    # Show backup info
    local backup_size=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "Backup File: $BACKUP_FILE"
    echo "Backup Size: $backup_size"
    echo "Target Database: $TARGET_DB"
    echo ""
    
    # Confirm restore
    echo -e "${YELLOW}Warning: This will create/replace database '$TARGET_DB'${NC}"
    read -p "Continue with restore? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        echo "Restore cancelled."
        exit 0
    fi
    
    echo ""
    
    # Execute restore steps
    log "INFO" "=== Starting Database Restore ==="
    
    if ! verify_backup; then
        exit 1
    fi
    
    if ! create_database; then
        exit 1
    fi
    
    if ! perform_restore; then
        exit 1
    fi
    
    verify_data
    print_summary
    
    log "INFO" "=== Restore Complete ==="
    echo -e "${GREEN}Restore completed successfully!${NC}"
}

main
