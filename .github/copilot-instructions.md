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

## Development Commands

### Primary Frontend (Root - Vite)
```bash
npm run dev          # Start Vite dev server (port 3000)
npm run build        # Build for production
```

### Alternative Frontend (Next.js)
```bash
# The src directory contains Next.js frontend setup
cd src
npm run dev          # Start Next.js dev server (uses src/package.json)
npm run build        # Build for production
npm run start        # Start production server
```

### Backend (NestJS - src/src/)
```bash
# Backend shares dependencies with root package.json
# Development typically done through Docker or direct execution
docker-compose up -d         # Start PostgreSQL + Redis
# Then run the backend with: npm run start:dev (if configured)
# Or compile and run: npx ts-node src/src/main.ts
```

**Note**: Backend defaults to port 3000 but can be configured via `PORT` environment variable to avoid conflicts with frontend.

### Database
```bash
npm run prisma:migrate     # Create and run migration
npm run prisma:deploy      # Deploy migrations (production)
npm run prisma:seed        # Seed demo data
npm run prisma:studio      # Open Prisma Studio GUI
npx prisma generate        # Regenerate Prisma Client
```

### Testing
```bash
npm run test              # Run Jest unit tests
npm run test:e2e          # Run Playwright e2e tests
npm run test:e2e:ui       # Run Playwright with UI
npm run test:e2e:debug    # Debug Playwright tests
```

### Docker
```bash
docker-compose up -d      # Start PostgreSQL + Redis
docker-compose down       # Stop all services
docker-compose logs -f    # View logs
```

## Common Pitfalls to Avoid

1. **Forgetting Organization Scope**: Always filter by `organizationId` in database queries
2. **Invalid State Transitions**: Don't directly update order status; use `OrdersService.updateOrderStatus()`
3. **Inventory Race Conditions**: Use Prisma transactions for inventory operations
4. **Missing Authentication**: Don't forget `@Public()` on truly public routes
5. **Hardcoded IDs**: Never hardcode UUIDs; use environment variables or generate them
6. **Missing Correlation IDs**: Always pass correlation ID through integration chains
7. **Not Handling Webhooks Idempotently**: Check `ProcessedWebhookEvent` before processing
8. **Forgetting to Release Reservations**: Always release inventory when orders are cancelled

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

## File Structure

```
/ (root)
  /src               # Main source directory containing both frontend and backend
    /src/            # NestJS backend source code
      /common        # Shared utilities, guards, decorators
      /config        # Configuration files
      /modules       # Feature modules (auth, orders, inventory, etc.)
        /integrations  # External integrations (Shopify, WooCommerce, DHL, FedEx)
      /services      # Business logic services
      /controllers   # API controllers
    /prisma          # Database schema and migrations
    /test            # Backend unit and integration tests
    /next-app/       # Next.js frontend application
    /components      # React components (for Next.js frontend)
    /app             # Next.js app directory
    /lib             # Frontend utilities
  /App.tsx           # Root Vite React app entry
  /components/       # Vite React UI components
  /vite.config.ts    # Vite configuration for primary UI
```

**Note**: The project has a nested structure with `src/src/` containing the NestJS backend code.

## Getting Started

1. **Setup**: Run `./setup-auth.sh` for initial setup
2. **Start Services**: `docker-compose up -d` for PostgreSQL + Redis
3. **Migrate Database**: `npm run prisma:migrate`
4. **Seed Data**: `npm run prisma:seed`
5. **Start Dev Server**: `npm run start:dev` (backend) or `npm run dev` (frontend)

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
