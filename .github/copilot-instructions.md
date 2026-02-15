# Rappit - GitHub Copilot Instructions

## Project Overview

Rappit is a production-ready, multi-tenant SaaS operations hub for MENA e-commerce merchants. The platform integrates with Shopify and WooCommerce for order management, and DHL/FedEx for shipping operations.

### Architecture

This project has two frontend implementations:
- **Primary UI**: React 18 + Vite + TypeScript (root level, port 3000)
- **Next.js Frontend**: Next.js 14 + TypeScript (src/next-app/, for SSR features)
- **Backend**: NestJS + TypeScript + Express (nested in src/src/, default port 3000)
- **Database**: PostgreSQL + Prisma ORM
- **Queue System**: BullMQ + Redis
- **Testing**: Jest (unit/integration) + Playwright (e2e)
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: TanStack Query (React Query)

## Multi-Tenant Architecture

This is a **multi-tenant SaaS application**. Always remember:

1. **Organization Isolation**: All data queries MUST be scoped by `organizationId`
2. **Authentication Required**: All routes are protected by default (use `@Public()` decorator for exceptions)
3. **Role-Based Access Control (RBAC)**: Use `@Roles()` decorator for role-specific endpoints
4. **Available Roles**: `ADMIN`, `MANAGER`, `OPERATOR`

### Authentication Patterns

```typescript
// Get current user in NestJS controllers
async myEndpoint(@CurrentUser() user: CurrentUserPayload) {
  console.log(user.userId, user.organizationId, user.role);
}

// Get organization ID
async myEndpoint(@CurrentOrganization() orgId: string) {
  return this.service.findAll(orgId);
}

// Mark route as public
@Public()
@Post('login')
async login() { ... }

// Require specific role
@Roles('ADMIN')
@Post('users')
async inviteUser() { ... }
```

## Code Conventions

### TypeScript

- **Strict Mode**: Use TypeScript with decorators enabled
- **No Implicit Any**: Avoid `any` types; use explicit types
- **Interfaces over Types**: Prefer interfaces for object shapes
- **Path Aliases**: Use `@common/*`, `@modules/*`, `@config/*` for imports in backend
- **Frontend Aliases**: Use `@/*` for imports in frontend components

### NestJS Backend

- **Module Structure**: Follow NestJS module organization (module, controller, service, DTOs)
- **Dependency Injection**: Use constructor-based DI for all services
- **Decorators**: Use NestJS decorators (`@Injectable()`, `@Controller()`, `@Module()`)
- **Guards**: All routes protected by `JwtAuthGuard` and `RolesGuard` by default
- **DTOs**: Use `class-validator` and `class-transformer` for validation
- **Error Handling**: Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- **Swagger**: Document all endpoints with `@ApiOperation()`, `@ApiResponse()` decorators

### Prisma Database

- **Transactions**: Use Prisma transactions for multi-step operations
- **Soft Deletes**: Use `isActive` flags instead of hard deletes
- **Timestamps**: All models have `createdAt` and `updatedAt`
- **Organization Scoping**: Always filter by `organizationId` in queries
- **Indexes**: Performance-critical fields are indexed

### Order State Machine

Orders follow an 11-state lifecycle:
```
NEW → PROCESSING → PICKING → PICKED → PACKING → PACKED → READY_TO_SHIP 
→ SHIPPED → IN_TRANSIT → DELIVERED / CANCELLED
```

**Important**: State transitions are validated. Use `OrdersService.updateOrderStatus()` method.

### Inventory Model C

The inventory system uses **Model C** (reserve-on-order, deduct-on-ship):
1. Order placed → Reserve inventory (`InventoryReservation`)
2. Order shipped → Deduct inventory (`InventoryLevel`)
3. Order cancelled → Release reservation

### Integration Patterns

- **Correlation ID Tracing**: All integration requests include `X-Correlation-ID` header
- **Integration Logging**: Log all external API calls to `IntegrationLog` table
- **Webhook Idempotency**: Track processed webhooks in `ProcessedWebhookEvent` table
- **Encrypted Credentials**: Store API keys encrypted in `Channel.config` JSON field
- **SKU Mapping**: Products from external channels mapped via `UnmappedItem` and `ChannelMapping`

### React/Vite Frontend (Primary)

- **Component Pattern**: Functional components with React hooks
- **RTL Support**: UI supports right-to-left (Arabic) layout
- **Shadcn/ui Pattern**: UI components follow shadcn/ui conventions
- **State Management**: Use TanStack Query for server state
- **Forms**: Use `react-hook-form` for form handling
- **Styling**: Use Tailwind CSS utilities; avoid inline styles

### Next.js Frontend (Secondary, src/next-app/)

- **Usage**: Used for specific features requiring SSR
- **Client Components**: Mark with `'use client'` when needed for interactivity
- **Middleware**: Custom authentication middleware for route protection

### Testing Conventions

- **Test Files**: Use `.spec.ts` for Jest tests, `.test.ts` for integration tests
- **Test Structure**: Follow Arrange-Act-Assert pattern
- **Test Database**: Use `setupTestDB()`, `teardownTestDB()`, `clearTables()` helpers
- **Seeding**: Use helper functions from `test/helpers/seedData.ts`
- **Mocking**: Mock external integrations (Shopify, WooCommerce, DHL, FedEx)
- **E2E Tests**: Use Playwright for frontend end-to-end tests

## Build, Run, and Validation Commands

### Building the Application

**Frontend (Vite - Primary UI)**:
```bash
npm run build  # Takes ~30-60 seconds
# Output: dist/ directory
# Runs: vite build
```

**Backend (NestJS)**:
```bash
cd src
npx tsc --noEmit  # Type check only (takes ~10-15 seconds)
# Note: NestJS backend runs via ts-node in development, no build step required
```

**IMPORTANT Build Dependencies:**
- ALWAYS run `npx prisma generate` before building if schema changed
- ALWAYS run `npm ci` before building in CI environments

### Running the Application

**Development Mode:**

1. **Frontend (Vite)** - Port 3000:
   ```bash
   npm run dev
   # Opens on http://localhost:3000
   # Hot-reload enabled
   ```

2. **Backend (NestJS)** - Default Port 3000 (configure via PORT env var):
   ```bash
   npm run start:dev  # Uses ts-node with watch mode
   # OR
   npm run start:api  # Uses NestJS CLI with watch mode
   # Both commands auto-reload on file changes
   # Takes ~10-15 seconds to start
   ```
   
   **Note**: To avoid port conflicts, set `PORT=3001` in backend .env file when running both frontend and backend simultaneously.

3. **Alternative Frontend (Next.js)** - For SSR features:
   ```bash
   cd src/next-app
   npm run dev
   ```

**Production Mode:**
```bash
npm run build     # Build frontend
npm run start     # Start production server (if configured)
```

### Testing

**CRITICAL**: Tests require PostgreSQL and Redis to be running.

**Test Environment Setup (run these FIRST):**
```bash
# 1. Start test databases
docker-compose -f src/docker-compose.test.yml up -d
# OR
docker-compose -f src/docker-compose.yml up -d postgres redis

# 2. Set test environment variables
export DATABASE_URL="postgresql://rappit_test:rappit_test_pass@localhost:5433/rappit_test"
export REDIS_HOST="localhost"
export REDIS_PORT="6380"
export NODE_ENV="test"

# 3. Run migrations on test database
cd src
npx prisma migrate deploy
```

**Running Tests:**

```bash
# Unit tests only (fastest, ~10-30 seconds)
npm run test:unit
# Uses: jest src/test/unit --runInBand

# Integration tests (~30-60 seconds)
npm run test:integration
# Requires: PostgreSQL + Redis running

# All tests (~60-120 seconds)
npm test
# Uses: jest --runInBand --config src/jest.config.js

# E2E tests (~60-180 seconds)
npm run test:e2e
# Requires: Full application running

# Frontend tests
npm run test:frontend
# Uses: jest --config jest.config.frontend.js

# With coverage (~90-180 seconds)
npm run test:coverage
# Generates: coverage/ directory
# Thresholds: 85% global, 95% for billing/inventory modules

# CI test mode
npm run test:ci
# Uses: jest --ci --coverage --maxWorkers=2
```

**Test Troubleshooting:**
- If tests hang: Check Docker containers are running (`docker ps`)
- If "connection refused": Verify DATABASE_URL points to correct port (5433 for test DB)
- If "timeout": Increase Jest timeout in test files or use `--testTimeout=30000`
- Use `--runInBand` flag to run tests serially (avoids race conditions)

### Database Operations

```bash
cd src  # IMPORTANT: All Prisma commands run from src/ directory

# Generate Prisma Client (ALWAYS after schema changes)
npx prisma generate  # Takes ~10-15 seconds

# Create new migration (development)
npx prisma migrate dev --name description_of_change
# Takes ~5-10 seconds, prompts for migration name

# Deploy migrations (production/CI)
npx prisma migrate deploy  # Takes ~5-10 seconds

# Seed demo data
npm run prisma:seed  # Takes ~5 seconds
# Creates 3 demo users: admin@rappit.demo, manager@rappit.demo, operator@rappit.demo

# Open Prisma Studio (database GUI)
npm run prisma:studio
# Opens on http://localhost:5555

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
# Takes ~10-15 seconds, includes re-seeding
```

### Docker Commands

```bash
# Start all services (PostgreSQL + Redis)
docker-compose -f src/docker-compose.yml up -d
# Takes ~10-15 seconds for containers to be ready

# Start specific service
docker-compose -f src/docker-compose.yml up -d postgres

# Stop all services
docker-compose -f src/docker-compose.yml down

# View logs
docker-compose -f src/docker-compose.yml logs -f

# Check service health
docker ps | grep rappit
docker-compose -f src/docker-compose.yml ps
```

### Linting and Formatting

```bash
# Run ESLint (if configured)
npm run lint 2>/dev/null || echo "Lint not configured"

# Format check with Prettier
npm run format:check 2>/dev/null || npx prettier --check "src/**/*.{ts,tsx,js,jsx}"

# Auto-fix formatting
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"
```

## Common Pitfalls to Avoid

### Critical Issues

1. **Forgetting Organization Scope**: 
   - ALWAYS filter by `organizationId` in database queries
   - Example: `await prisma.order.findMany({ where: { organizationId } })`
   - Failing to do this causes data leakage between tenants (security vulnerability)

2. **Invalid State Transitions**: 
   - DON'T directly update order status: `order.status = 'SHIPPED'`
   - DO use: `await OrdersService.updateOrderStatus(orderId, 'SHIPPED')`
   - The state machine validates transitions: NEW → PROCESSING → ... → DELIVERED

3. **Inventory Race Conditions**: 
   - ALWAYS use Prisma transactions for inventory operations
   - Example:
     ```typescript
     await prisma.$transaction(async (tx) => {
       await tx.inventoryLevel.update(...);
       await tx.inventoryReservation.create(...);
     });
     ```

4. **Missing Authentication**: 
   - All routes are protected by default
   - DON'T forget `@Public()` decorator on truly public routes (login, register, health checks)
   - Example: `@Public() @Post('login')`

5. **Hardcoded IDs**: 
   - NEVER hardcode UUIDs in code
   - DO use environment variables or generate them: `uuid.v4()`

6. **Missing Correlation IDs**: 
   - ALWAYS pass `X-Correlation-ID` header through integration chains
   - Used for tracing requests across services (Shopify → Backend → DHL)

7. **Not Handling Webhooks Idempotently**: 
   - ALWAYS check `ProcessedWebhookEvent` table before processing webhook
   - Use webhook ID or event ID to prevent duplicate processing

8. **Forgetting to Release Reservations**: 
   - ALWAYS release inventory when orders are cancelled
   - Use: `await InventoryService.releaseReservation(orderId)`

### Build and Environment Issues

9. **Prisma Client Not Found**:
   - ALWAYS run `npx prisma generate` after:
     - First `npm install`
     - Any schema changes
     - Switching branches that change schema
   - Takes ~10-15 seconds to complete

10. **Database Connection Errors**:
    - Verify PostgreSQL is running: `docker ps | grep postgres`
    - Check DATABASE_URL in .env file
    - Wait 5-10 seconds after `docker-compose up` for DB to be ready
    - Use `docker-compose exec postgres pg_isready` to verify

11. **Port Conflicts**:
    - Frontend (Vite) defaults to port 3000
    - Backend (NestJS) also defaults to port 3000
    - Set `PORT=3001` in backend .env to avoid conflicts
    - Test DB uses port 5433, dev DB uses port 5432

12. **Missing Dependencies After Pull**:
    - ALWAYS run `npm install` after pulling changes
    - In CI, use `npm ci` for faster, deterministic installs
    - Check if package-lock.json changed in git diff

13. **Test Database Issues**:
    - Tests use separate database on port 5433 (not 5432)
    - Set DATABASE_URL correctly for tests
    - Run migrations on test DB: `npx prisma migrate deploy`
    - Use docker-compose.test.yml for test containers

14. **Redis Connection Issues**:
    - Verify Redis is running: `docker ps | grep redis`
    - Check REDIS_HOST and REDIS_PORT in .env
    - Test DB Redis uses port 6380, dev uses port 6379

15. **JWT Token Errors**:
    - Ensure JWT_SECRET in .env is at least 32 characters
    - Tokens expire after 7 days (configurable via JWT_EXPIRES_IN)
    - For local dev, use setup script to generate secure secret

### Testing Issues

16. **Tests Hanging**:
    - Use `--runInBand` flag to run tests serially
    - Check Docker services are running
    - Increase timeout: `jest --testTimeout=30000`
    - Use `--detectOpenHandles` to find unclosed connections

17. **Integration Test Failures**:
    - Ensure test database is clean before running
    - Use provided test helpers: `setupTestDB()`, `clearTables()`
    - Mock external services (Shopify, WooCommerce, DHL, FedEx)

18. **Coverage Thresholds**:
    - Global coverage must be ≥85%
    - Billing and inventory modules must be ≥95%
    - Run `npm run test:coverage` to check
    - Thresholds configured in jest.config.js

## Security Best Practices

- **Passwords**: Hashed with bcrypt (12 rounds)
- **JWTs**: Expire in 7 days; stored in httpOnly cookies (frontend)
- **Secrets**: Store in `.env.local` or `.env` files (never commit)
- **Input Validation**: Use class-validator DTOs for all incoming data
- **SQL Injection**: Prisma ORM handles parameterization automatically
- **CORS**: Configure appropriately for production
- **Rate Limiting**: Implement for public endpoints

## API Documentation

When running backend on default port 3000:
- **Swagger UI**: http://localhost:3000/api/docs
- **API Base URL**: http://localhost:3000/api/v1
- **Health Check**: http://localhost:3000/api/v1/health

**Note**: Configure different ports for frontend and backend via environment variables to avoid conflicts.

## CI/CD Workflows

### GitHub Actions Pipelines

The repository uses GitHub Actions for CI/CD. Workflows are in `.github/workflows/`:

**CI Workflow** (`.github/workflows/ci.yml`) - Runs on every PR to main/develop:

1. **Lint Job**:
   - Runs ESLint and Prettier checks
   - Command: `npm run lint` and `npm run format:check`
   - Takes ~30-60 seconds

2. **Type Check Job**:
   - Validates TypeScript types
   - Generates Prisma Client first
   - Command: `npx tsc --noEmit`
   - Takes ~10-20 seconds

3. **Unit Tests Job**:
   - Runs unit tests only
   - Command: `npm run test:unit`
   - Takes ~10-30 seconds

4. **Integration Tests Job**:
   - Spins up PostgreSQL (port 5433) and Redis (port 6380)
   - Runs database migrations
   - Command: `npm run test:integration`
   - Takes ~30-90 seconds

5. **Coverage Check Job**:
   - Runs all tests with coverage reporting
   - Command: `npm run test:coverage`
   - Uploads coverage to Codecov
   - **Required thresholds**: 85% global, 95% for billing/inventory
   - Takes ~60-180 seconds

6. **Security Scan Job**:
   - Runs `npm audit` for known vulnerabilities
   - Optionally runs Snyk scan (if SNYK_TOKEN configured)
   - Takes ~20-40 seconds

**CD Workflow** (`.github/workflows/cd.yml`) - Runs on push to main:
- Deploys to staging/production (if configured)

### Running CI Checks Locally

To replicate CI checks before pushing:

```bash
# 1. Install dependencies
npm ci

# 2. Run Prisma generation
cd src && npx prisma generate && cd ..

# 3. Lint
npm run lint 2>/dev/null || npx prettier --check "src/**/*.{ts,tsx}"

# 4. Type check
npx tsc --noEmit

# 5. Start test databases
docker-compose -f src/docker-compose.yml up -d

# 6. Run tests
npm run test:unit
npm run test:integration  # Requires databases
npm run test:coverage     # Full coverage report

# 7. Security scan
npm audit --audit-level=high
```

### CI Troubleshooting

- **"Prisma Client not found"**: Ensure `npx prisma generate` runs before tests
- **"Database connection failed"**: Check PostgreSQL service is healthy in CI
- **"Tests timeout"**: Increase `testTimeout` in jest.config.js
- **"Coverage below threshold"**: Add tests or adjust thresholds in jest.config.js
- **"npm audit failures"**: Update vulnerable packages or add exceptions

## File Structure and Key Locations

```
/ (root)
  /.github/
    /workflows/          # CI/CD pipelines
      ci.yml             # Pull request checks (lint, test, coverage)
      cd.yml             # Deployment workflow
    copilot-instructions.md  # This file (Copilot configuration)
  
  /src/                  # Main source directory
    /src/                # NestJS backend source code
      /common/           # Shared utilities
        /decorators/     # Custom decorators (@CurrentUser, @Public, @Roles)
        /guards/         # Auth guards (JwtAuthGuard, RolesGuard)
        /interceptors/   # Request/response interceptors
        /filters/        # Exception filters
      /config/           # Configuration modules
        database.config.ts
        jwt.config.ts
        redis.config.ts
      /modules/          # Feature modules (NestJS structure)
        /auth/           # Authentication module
          auth.controller.ts
          auth.service.ts
          dto/           # Login, Register DTOs
        /organizations/  # Organization management
        /users/          # User management
        /orders/         # Order management (11-state machine)
        /inventory/      # Inventory management (Model C)
        /products/       # Product catalog
        /channels/       # Integration channels
        /integrations/   # External service integrations
          /shopify/      # Shopify integration
          /woocommerce/  # WooCommerce integration
          /dhl/          # DHL shipping integration
          /fedex/        # FedEx shipping integration
      /test/             # Test files
        /unit/           # Unit tests
        /integration/    # Integration tests
        /helpers/        # Test utilities (setupTestDB, seedData)
    
    /prisma/             # Database schema and migrations
      schema.prisma      # Prisma schema (single source of truth)
      /migrations/       # Migration history
      seed.ts            # Database seeding script
    
    /next-app/           # Next.js frontend (SSR features)
      /app/              # Next.js 14 app directory
      /components/       # Next.js React components
      /lib/              # Frontend utilities
      /scripts/          # Setup scripts
      package.json       # Next.js dependencies
    
    docker-compose.yml   # Development Docker setup
    docker-compose.test.yml  # Test environment Docker
    .env.test            # Test environment variables
    jest.config.js       # Jest configuration for backend tests
    tsconfig.json        # TypeScript configuration
    setup-auth.sh        # Automated setup script
  
  /components/           # Vite React UI components (Primary frontend)
    /ui/                 # Shadcn/ui components
    /forms/              # Form components
    /layouts/            # Layout components
  
  /scripts/              # Utility scripts
    fedex-admin.sh       # FedEx admin tools
    fedex-test-suite.sh  # FedEx testing
    shopify-admin.sh     # Shopify admin tools
    shopify-test-suite.sh # Shopify testing
  
  /docs/                 # Additional documentation
  
  # Root configuration files
  package.json           # Root dependencies (includes both frontend and backend)
  package-lock.json      # Locked dependencies
  vite.config.ts         # Vite configuration (primary frontend)
  jest.config.frontend.js # Jest config for frontend tests
  .env.example           # Example environment variables
  .gitignore             # Git ignore rules
  README.md              # Basic project info
  
  # Key documentation files
  SHOPIFY_COMPLETE.md    # Shopify integration guide
  FEDEX_INTEGRATION.md   # FedEx integration guide
```

**Note**: The project has a nested structure with `src/src/` containing the NestJS backend code.

### Important Configuration Files

- **Backend Config**: `src/src/config/` - Database, JWT, Redis configuration
- **Prisma Schema**: `src/prisma/schema.prisma` - Database models and relations
- **Jest Config**: `src/jest.config.js` - Test configuration with coverage thresholds
- **TypeScript Config**: `src/tsconfig.json` - Compiler options with decorators enabled
- **Docker Compose**: `src/docker-compose.yml` - Local development services
- **CI Workflow**: `.github/workflows/ci.yml` - Automated testing pipeline
- **Environment**: `.env.example` - Template for environment variables

### Where to Make Changes

**Adding a new API endpoint:**
1. Create DTO in `src/src/modules/{module}/dto/`
2. Add method to service in `src/src/modules/{module}/{module}.service.ts`
3. Add route to controller in `src/src/modules/{module}/{module}.controller.ts`
4. Add tests in `src/test/unit/` and `src/test/integration/`

**Modifying database schema:**
1. Update `src/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Update affected services and DTOs
4. Regenerate Prisma Client: `npx prisma generate`

**Adding a new integration:**
1. Create module in `src/src/modules/integrations/{service}/`
2. Implement service class with correlation ID tracking
3. Add integration logging to `IntegrationLog` table
4. Handle webhooks with idempotency (`ProcessedWebhookEvent`)
5. Add tests with mocked external API calls

**Adding UI components:**
- Primary UI: Add to `/components/` (Vite + React)
- Next.js UI: Add to `src/next-app/components/`
- Use shadcn/ui patterns and Tailwind CSS

**Adding tests:**
- Unit tests: `src/test/unit/{module}/`
- Integration tests: `src/test/integration/`
- E2E tests: `src/test/*.e2e-spec.ts`
- Frontend tests: Root level, matching component structure

## Environment Setup and Prerequisites

### Required Software
- **Node.js**: Version 18.x (specified in CI workflow)
- **Docker & Docker Compose**: Latest version for PostgreSQL and Redis
- **npm**: Comes with Node.js

### Initial Setup Steps (Run these in order)

**ALWAYS follow this exact sequence for initial setup:**

1. **Install dependencies** (takes ~60 seconds):
   ```bash
   npm ci  # Use 'npm ci' for CI/CD, 'npm install' for local dev
   ```

2. **Create environment file** (if not exists):
   ```bash
   cd src
   # Either copy from example or run setup script
   cp ../.env.example .env.local
   # OR run the automated setup script
   ./setup-auth.sh  # This handles steps 2-6 automatically
   ```

3. **Start Docker services** (PostgreSQL + Redis):
   ```bash
   # From project root
   docker-compose -f src/docker-compose.yml up -d postgres redis
   
   # Verify services are running
   docker ps | grep rappit
   ```
   
   **Expected services:**
   - `rappit-postgres` on port 5432
   - `rappit-redis` on port 6379
   
   **Wait time**: 5-10 seconds for PostgreSQL to become ready

4. **Generate Prisma Client** (takes ~10-15 seconds):
   ```bash
   cd src
   npx prisma generate
   ```
   
   **IMPORTANT**: ALWAYS run this after any changes to `prisma/schema.prisma` or after `npm install`

5. **Run database migrations** (takes ~5-10 seconds):
   ```bash
   cd src
   npx prisma migrate deploy  # For production/CI
   # OR
   npx prisma migrate dev      # For local development (prompts for migration name)
   ```

6. **Seed demo data** (optional, takes ~5 seconds):
   ```bash
   npm run prisma:seed
   ```

### Quick Setup (Automated)

For fastest setup, use the provided script (handles steps 2-6):
```bash
cd src
chmod +x setup-auth.sh
./setup-auth.sh
```

**Total time**: ~2 minutes including Docker container startup

## Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@rappit.demo | admin123 | ADMIN |
| manager@rappit.demo | manager123 | MANAGER |
| operator@rappit.demo | operator123 | OPERATOR |

## Additional Resources

- **Quick Start**: See `src/QUICK_START.md`
- **Project Status**: See `src/PROJECT_COMPLETE.md`
- **Auth Guide**: See `src/AUTH_IMPLEMENTATION.md`
- **Testing Guide**: See `src/AUTH_TESTING.md`
- **Schema Docs**: See `src/SCHEMA_DOCUMENTATION.md`

## Instructions for Coding Agents

**TRUST THESE INSTRUCTIONS**: The information in this file has been validated and tested. Only search for additional information if something is unclear or appears incorrect.

**Before making changes:**
1. Review the relevant module structure in the file tree above
2. Check multi-tenant requirements (ALWAYS scope by `organizationId`)
3. Identify affected areas: backend services, DTOs, Prisma schema, tests
4. Plan minimal changes needed

**After making changes:**
1. Run Prisma generation if schema changed: `npx prisma generate`
2. Run type checking: `npx tsc --noEmit`
3. Run affected tests: `npm run test:unit` or `npm run test:integration`
4. Verify changes don't break multi-tenancy or security

**Common workflows:**
- **New feature**: DTOs → Service → Controller → Tests → Documentation
- **Bug fix**: Reproduce → Fix → Test → Verify no regression
- **Schema change**: Update schema → Migrate → Generate client → Update code → Test
- **Integration**: Service class → Correlation ID tracking → Webhook handler → Tests with mocks

**Time estimates** (use these for timeout planning):
- Install dependencies: ~60 seconds
- Prisma generate: ~10-15 seconds
- Database migrations: ~5-10 seconds
- Build frontend: ~30-60 seconds
- Run unit tests: ~10-30 seconds
- Run integration tests: ~30-90 seconds
- Full test suite with coverage: ~90-180 seconds

**Error patterns to watch for:**
- Database connection errors → Check Docker services
- Prisma Client errors → Run `npx prisma generate`
- Port conflicts → Check PORT environment variable
- Test timeouts → Increase timeout or check for unclosed connections
- Migration failures → Check schema syntax and existing migrations
