# Local Staging Environment

Complete local staging environment with Docker Compose for testing all integrations.

## Quick Start

```bash
# 1. Start all services
docker-compose -f docker-compose.staging.yml up -d

# 2. Wait for services to be ready (about 2 minutes)
docker-compose -f docker-compose.staging.yml logs -f

# 3. Run database migrations
DATABASE_URL=postgresql://rappit_staging:rappit_staging_pass@localhost:5434/rappit_staging \
  npx prisma migrate deploy

# 4. Access services
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Rappit API** | http://localhost:3000 | - |
| **WooCommerce Store** | http://localhost:8080 | - |
| **WooCommerce Admin** | http://localhost:8080/wp-admin | Set during install |
| **ngrok Dashboard** | http://localhost:4040 | - |

## Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5434 | Staging database |
| Redis | 6381 | Cache/queues |
| WooCommerce | 8080 | Test store |
| Rappit API | 3000 | NestJS API |

## Setup WooCommerce API Keys

1. Go to http://localhost:8080/wp-admin
2. Complete WordPress installation
3. Go to: WooCommerce > Settings > Advanced > REST API
4. Click "Add key" and set permissions to "Read/Write"
5. Copy keys to `.env.staging`

## Enable Webhooks (for Shopify/WooCommerce testing)

```bash
# Start ngrok to expose local API
docker-compose -f docker-compose.staging.yml --profile webhooks up -d ngrok

# Get public URL from ngrok dashboard
open http://localhost:4040
```

## Stop Environment

```bash
docker-compose -f docker-compose.staging.yml down

# Remove all data (fresh start)
docker-compose -f docker-compose.staging.yml down -v
```
