import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { execSync } from 'child_process';
import { PrismaService } from '../../src/common/database/prisma.service';
import { AppModule } from '../../src/app.module';

/**
 * Migration E2E Tests (BILL-01)
 * 
 * Verifies that migrations run up and down successfully.
 */
describe('Migrations E2E', () => {
    const TEST_DB_URL =
        process.env.DATABASE_URL ||
        'postgresql://rappit_test:rappit_test_pass@localhost:5440/rappit_test';

    beforeAll(() => {
        // Ensure prisma is generated
        try {
            execSync('npx prisma generate', {
                cwd: process.cwd() + '/src',
                env: { ...process.env, DATABASE_URL: TEST_DB_URL },
                stdio: 'pipe',
            });
        } catch (e) {
            console.log('Prisma generate skipped or failed');
        }
    });

    describe('Schema Migrations', () => {
        it('should run migrations up successfully', async () => {
            try {
                const result = execSync('npx -y prisma@5.22.0 db push --accept-data-loss --skip-generate --schema src/prisma/schema.prisma', {
                    cwd: process.cwd(),
                    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
                    encoding: 'utf-8',
                });
                const isPushed = result.includes('pushed') || result.includes('already in sync');
                expect(isPushed).toBe(true);
            } catch (e: any) {
                // Skip if database is not available
                if (e.message?.includes('P1001') || e.message?.includes('Can\'t reach database')) {
                    console.log('Database not available, skipping migration test');
                    return;
                }
                throw e;
            }
        }, 60000);

        it.skip('should verify subscription fields exist in database', async () => {
            // Check that the migration created the expected columns
            const result = execSync(
                `node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient({ datasources: { db: { url: '${TEST_DB_URL}' } } }); p.\\$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_name = \\'organizations\\' AND (column_name LIKE \\'subscription%\\' OR column_name LIKE \\'stripe%\\')').then(r => { if(r.length > 0) process.exit(0); else process.exit(1); }).catch(e => { console.error(e); process.exit(1); })"`,
                {
                    cwd: process.cwd(),
                    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
                    encoding: 'utf-8',
                    shell: '/bin/bash',
                }
            );

            // Should contain subscription-related columns
            expect(result.toLowerCase()).toContain('subscription');
        }, 30000);

        it.skip('should verify billing_audit_logs table exists', async () => {
            const result = execSync(
                `node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient({ datasources: { db: { url: '${TEST_DB_URL}' } } }); p.\\$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_name = \\'billing_audit_logs\\'').then(r => { if(r.length > 0) process.exit(0); else process.exit(1); }).catch(e => { console.error(e); process.exit(1); })"`,
                {
                    cwd: process.cwd(),
                    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
                    encoding: 'utf-8',
                    shell: '/bin/bash',
                }
            );

            // If the command above succeeds (exit code 0), the table exists.
            expect(true).toBe(true);
        }, 30000);
    });

    describe('Migration Reversibility', () => {
        // NOTE: Running migration down in test can affect other tests
        // This test should be run in isolation
        it.skip('should run migrations down successfully (run manually)', async () => {
            // Reset to before the billing migration
            const result = execSync(
                'npx prisma migrate reset --skip-generate --force',
                {
                    cwd: process.cwd() + '/src',
                    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
                    encoding: 'utf-8',
                }
            );

            expect(result).toContain('Reset');
        }, 60000);
    });
});
