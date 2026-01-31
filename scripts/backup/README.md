# Backup Scripts

Database backup and restore scripts for Rappit.

## Quick Start

```bash
# 1. Configure
cp config.env.example config.env
# Edit config.env with your database credentials

# 2. Create backup
export PGPASSWORD='your_password'
./backup.sh

# 3. Restore from backup
./restore.sh /var/backups/rappit/your_backup.sql.gz
```

## Scripts

| Script | Purpose |
|--------|---------|
| `backup.sh` | Full PostgreSQL backup with logging |
| `restore.sh` | Restore with verification |
| `rotate-backups.sh` | Cleanup old backups |
| `config.env.example` | Configuration template |

## Scheduling Backups

Add to crontab for daily backups at 02:00 UTC:

```bash
# Edit crontab
crontab -e

# Add this line
0 2 * * * PGPASSWORD='your_password' /path/to/scripts/backup/backup.sh /path/to/config.env
```

## Configuration

Copy `config.env.example` to `config.env` and set:

- `DB_HOST` - Database hostname
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `BACKUP_DIR` - Where to store backups
- `RETENTION_DAYS` - How long to keep backups (default: 30)

## Upgrade to AWS S3

When ready for production, uncomment S3 sections in `backup.sh`:

1. Set `S3_BUCKET` in config.env
2. Configure AWS CLI credentials
3. Uncomment S3 upload code in backup.sh

## See Also

- [Database Restore Runbook](../../docs/runbooks/database-restore.md)
