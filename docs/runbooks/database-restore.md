# Database Restore Runbook

## Overview

This runbook provides step-by-step procedures for restoring the Rappit database from backup.

## Recovery Time Objectives (RTO)

| Environment | Target RTO | Typical Restore Time |
|-------------|------------|---------------------|
| Production | 2 hours | 30-60 minutes |
| Staging | 4 hours | 30-60 minutes |

## Prerequisites

- PostgreSQL client tools (`psql`, `pg_restore`)
- Database credentials (host, port, user, password)
- Access to backup files

## Locate Backup Files

```bash
# List available backups (most recent first)
ls -lt /var/backups/rappit/*.sql.gz

# Check backup sizes
ls -lh /var/backups/rappit/*.sql.gz
```

## Restore Procedures

### Option 1: Using Restore Script (Recommended)

```bash
# Navigate to backup scripts
cd /path/to/rappit/scripts/backup

# Configure environment
cp config.env.example config.env
# Edit config.env with your database credentials

# Run restore
./restore.sh /var/backups/rappit/rappit_production_YYYYMMDD_HHMMSS.sql.gz
```

### Option 2: Manual Restore

```bash
# Set database password
export PGPASSWORD='your_password'

# Create target database
psql -h localhost -U rappit_user -d postgres -c "CREATE DATABASE rappit_restored;"

# Restore from backup
gunzip -c /var/backups/rappit/backup.sql.gz | psql -h localhost -U rappit_user -d rappit_restored
```

## Verification Checklist

After restore, verify:

- [ ] Database connection works
- [ ] Organization count matches expected
- [ ] Order count is reasonable
- [ ] User accounts exist
- [ ] No application errors

```bash
# Quick verification queries
psql -h localhost -U rappit_user -d rappit_restored << EOF
SELECT COUNT(*) as organizations FROM organizations;
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as orders FROM orders;
SELECT COUNT(*) as inventory FROM inventory_levels;
EOF
```

## Rollback (If Restore Fails)

```bash
# Drop failed restore
psql -h localhost -U rappit_user -d postgres -c "DROP DATABASE rappit_restored;"

# Try older backup
./restore.sh /var/backups/rappit/older_backup.sql.gz
```

## Post-Restore Steps

1. Update application configuration to point to restored database
2. Restart application services
3. Verify application functionality
4. Monitor logs for errors

## Escalation

If restore fails or takes longer than RTO:

1. Check logs: `/var/log/rappit-backup/restore_*.log`
2. Contact: Database Administrator
3. Document: Incident timeline and actions taken

## Future: AWS S3 Restore

When backups are stored in S3:

```bash
# Download from S3
aws s3 cp s3://rappit-backups-us-east-1-production/backup.sql.gz /tmp/

# Restore
./restore.sh /tmp/backup.sql.gz
```
