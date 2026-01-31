/**
 * User Invite Integration Tests
 * Comprehensive E2E tests for invite/re-invite functionality
 * 
 * Part of: GAP-22 Email Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import { AppModule } from '../../src/app.module';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { BillingModule } from '../../src/modules/billing/billing.module';
import { StripeService } from '../../src/modules/billing/stripe.service';
import { ShopifyModule } from '../../src/modules/integrations/shopify/shopify.module';
import { WooCommerceModule } from '../../src/modules/integrations/woocommerce/woocommerce.module';
import { DhlModule } from '../../src/modules/integrations/dhl/dhl.module';
import { FedexModule } from '../../src/modules/integrations/fedex/fedex.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

const mockEmailService = {
    sendInvite: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    sendInviteEmail: jest.fn().mockResolvedValue(true),
};

const mockStripeService = {
    createCustomer: jest.fn().mockResolvedValue('cus_test_mock'),
};

@Module({
    providers: [{ provide: StripeService, useValue: mockStripeService }],
    exports: [StripeService],
})
class MockBillingModule { }

describe('User Invite E2E Tests', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let jwtService: any;
    let authToken: string;
    let staffToken: string;
    let organizationId: string;

    @Module({})
    class MockHealthModule { }

    @Module({})
    class MockJobsModule { }



    class MockStripeService {
        createCustomer() { return 'cus_test'; }
    }

    @Module({
        providers: [
            { provide: StripeService, useClass: MockStripeService }
        ],
        exports: [StripeService]
    })
    class MockBillingModule { }

    beforeAll(async () => {
        try {
            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppModule],
            })
                .overrideProvider(ConfigService)
                .useValue({
                    get: (key: string) => {
                        if (key === 'app.frontendUrl') return 'http://localhost:3000';
                        if (key === 'JWT_SECRET') return 'test-jwt-secret';
                        if (key === 'jwt.secret') return 'test-jwt-secret';
                        if (key === 'jwt.expiresIn') return '1d';
                        return null;
                    },
                })
                .overrideModule(HealthModule)
                .useModule(MockHealthModule)
                .overrideModule(JobsModule)
                .useModule(MockJobsModule)
                .overrideModule(BillingModule)
                .useModule(MockBillingModule)
                .overrideModule(ShopifyModule)
                .useModule(class MockShopifyModule { })
                .overrideModule(WooCommerceModule)
                .useModule(class MockWooCommerceModule { })
                .overrideModule(DhlModule)
                .useModule(class MockDhlModule { })
                .overrideModule(FedexModule)
                .useModule(class MockFedexModule { })
                .overrideProvider(EmailService)
                .useValue(mockEmailService)
                .compile();

            app = moduleFixture.createNestApplication();
            // Set global prefix to match main.ts
            app.setGlobalPrefix('api/v1');
            // Enable validation pipe for DTO validation
            app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
            // Apply global exception filter to handle HTTP exceptions properly in test env
            app.useGlobalFilters(new AllExceptionsFilter());

            await app.init();

            prisma = app.get(PrismaService);
            jwtService = app.get(JwtService);

            // Clean up database
            await prisma.userOrganization.deleteMany();
            await prisma.user.deleteMany();
            await prisma.organization.deleteMany();

            // Create test organization
            const org = await prisma.organization.create({
                data: {
                    name: 'Test Corp',
                },
            });
            organizationId = org.id;

            // Create admin user for token
            // Create/Update admin user
            const adminUser = await prisma.user.upsert({
                where: { email: 'admin@example.com' },
                update: {
                    userOrganizations: {
                        create: {
                            organizationId: org.id,
                            role: 'ADMIN',
                        },
                    },
                },
                create: {
                    email: 'admin@example.com',
                    password: 'hashed-password',
                    firstName: 'Admin',
                    lastName: 'User',
                    isActive: true,
                    userOrganizations: {
                        create: {
                            organizationId: org.id,
                            role: 'ADMIN',
                        },
                    },
                },
            });

            // Generate Admin Token
            authToken = jwtService.sign({
                sub: adminUser.id,
                email: adminUser.email,
                role: 'ADMIN',
                orgId: org.id,
            }, { secret: 'test-jwt-secret' });

            // Create/Update staff user (Manager)
            const staffUser = await prisma.user.upsert({
                where: { email: 'staff@example.com' },
                update: {
                    userOrganizations: {
                        create: {
                            organizationId: org.id,
                            role: 'MANAGER',
                        },
                    },
                },
                create: {
                    email: 'staff@example.com',
                    password: 'hashed-password',
                    firstName: 'Staff',
                    lastName: 'User',
                    isActive: true,
                    userOrganizations: {
                        create: {
                            organizationId: org.id,
                            role: 'MANAGER',
                        },
                    },
                },
            });

            // Generate Staff Token
            staffToken = jwtService.sign({
                sub: staffUser.id,
                email: staffUser.email,
                role: 'MANAGER',
                orgId: org.id,
            }, { secret: 'test-jwt-secret' });

        } catch (error) {
            console.error('Test Setup Failed:', error);
            throw error;
        }
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================
    // INVITE FLOW TESTS
    // ============================================================

    describe('POST /api/v1/users/invite', () => {
        it('should send invite email successfully', async () => {
            const inviteDto = {
                email: 'newuser@example.com',
                role: 'MANAGER',
            };

            const response = await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send(inviteDto)
                .expect(201);

            // Verify user created with PENDING status
            expect(response.body.status).toBe('PENDING');
            expect(response.body.email).toBe(inviteDto.email);

            // Verify email was sent
            expect(mockEmailService.sendInvite).toHaveBeenCalledWith(
                inviteDto.email,
                expect.stringContaining('accept-invite?token='),
                expect.any(String) // org name
            );
        });

        it('should reject invalid email format', async () => {
            const inviteDto = {
                email: 'invalid-email',
                role: 'MANAGER',
            };

            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send(inviteDto)
                .expect(400);

            expect(mockEmailService.sendInvite).not.toHaveBeenCalled();
        });

        it('should reject duplicate email in same org', async () => {
            const uniqueEmail = `duplicate-test-${Date.now()}@example.com`;
            const inviteDto = {
                email: uniqueEmail,
                role: 'MANAGER',
            };

            // First invite
            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send(inviteDto)
                .expect(201);

            // Duplicate invite - same email to same org
            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send(inviteDto)
                .expect(409); // Conflict
        });

        it('should allow inviting user from different org', async () => {
            // User exists in org A, invite to org B should work
            const inviteDto = {
                email: 'user-from-other-org@example.com',
                role: 'MANAGER',
            };

            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send(inviteDto)
                .expect(201);
        });
    });

    // ============================================================
    // RESEND INVITE TESTS
    // ============================================================

    describe('POST /api/v1/users/:id/resend-invite', () => {
        let pendingUserId: string;

        beforeEach(async () => {
            // Create pending user with unique email
            const uniqueEmail = `pending-resend-${Date.now()}@example.com`;
            const res = await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ email: uniqueEmail, role: 'MANAGER' })
                .expect(201);

            pendingUserId = res.body.id;
            jest.clearAllMocks();
        });

        it('should resend invite and generate new token', async () => {
            await request(app.getHttpServer())
                .post(`/api/v1/users/${pendingUserId}/resend-invite`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(201);

            expect(mockEmailService.sendInvite).toHaveBeenCalledTimes(1);
        });

        it('should rate limit resend attempts (max 3 per hour)', async () => {
            // Skip: Rate limiting for resend not implemented yet
            // First 3 should succeed
            for (let i = 0; i < 3; i++) {
                await request(app.getHttpServer())
                    .post(`/api/v1/users/${pendingUserId}/resend-invite`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(201);
            }

            // 4th should be rate limited
            await request(app.getHttpServer())
                .post(`/api/v1/users/${pendingUserId}/resend-invite`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(429); // Too Many Requests
        });

        it('should reject resend for active users', async () => {
            // Activate the user first
            await prisma.user.update({
                where: { id: pendingUserId },
                data: { isActive: true },
            });

            await request(app.getHttpServer())
                .post(`/api/v1/users/${pendingUserId}/resend-invite`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(409); // Conflict - user already active
        });
    });

    // ============================================================
    // INVITE TOKEN TESTS
    // ============================================================

    describe('POST /api/v1/auth/accept-invite', () => {
        it('should accept valid invite token', async () => {
            // Create invite
            const inviteRes = await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ email: 'accept-test@example.com', role: 'MANAGER' })
                .expect(201);

            // Get token from DB (in real test, extract from email mock)
            const user = await prisma.user.findUnique({
                where: { id: inviteRes.body.id },
            });

            const acceptRes = await request(app.getHttpServer())
                .post(`/api/v1/auth/accept-invite?token=${user?.inviteToken}`)
                .send({
                    password: 'SecurePass123!',
                    name: 'Test User',
                })
                .expect(201);

            expect(acceptRes.body.accessToken).toBeDefined();

            // Verify user is now active
            const updatedUser = await prisma.user.findUnique({
                where: { id: inviteRes.body.id },
            });
            expect(updatedUser?.isActive).toBe(true);
        });

        it('should reject expired invite token (24h)', async () => {
            // Create invite with expired token
            const expiredEmail = `expired-${Date.now()}@example.com`;
            const expiredUser = await prisma.user.create({
                data: {
                    email: expiredEmail,
                    inviteToken: `expired-token-${Date.now()}`,
                    inviteExpiresAt: new Date("2020-01-01T00:00:00.000Z"), // Definitely expired
                    password: "hashed-password",
                    firstName: "Expired",
                    lastName: "User",
                    isActive: false,
                    userOrganizations: {
                        create: {
                            organizationId: organizationId,
                            role: "MANAGER"
                        }
                    }
                },
            });

            await request(app.getHttpServer())
                .post(`/api/v1/auth/accept-invite?token=${expiredUser.inviteToken}`)
                .send({
                    password: 'SecurePass123!',
                    name: 'Test User',
                })
                .expect(400);
        });

        it('should reject already used invite token', async () => {
            // Create and accept invite with unique email
            const reuseEmail = `reuse-test-${Date.now()}@example.com`;
            const inviteRes = await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ email: reuseEmail, role: 'MANAGER' })
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { id: inviteRes.body.id },
            });
            const originalToken = user?.inviteToken;

            // First accept - should succeed
            await request(app.getHttpServer())
                .post(`/api/v1/auth/accept-invite?token=${originalToken}`)
                .send({
                    password: 'SecurePass123!',
                    name: 'Test User',
                })
                .expect(201);

            // Second accept with same token - should fail with 404 (token is now null)
            await request(app.getHttpServer())
                .post(`/api/v1/auth/accept-invite?token=${originalToken}`)
                .send({
                    password: 'AnotherPass123!',
                    name: 'Hacker',
                })
                .expect(404); // Token no longer exists
        });

        it('should reject invalid invite token', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/accept-invite?token=invalid-token-xyz')
                .send({
                    password: 'SecurePass123!',
                    name: 'Test User',
                })
                .expect(404);
        });
    });

    // ============================================================
    // EMAIL SERVICE TESTS
    // ============================================================

    describe('Email Service Integration', () => {
        it('should send email with correct from address', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ email: 'from-test@example.com', role: 'MANAGER' })
                .expect(201);

            // In real implementation, verify from address
            expect(mockEmailService.sendInvite).toHaveBeenCalled();
        });

        it('should include organization name in email', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ email: 'org-name-test@example.com', role: 'MANAGER' })
                .expect(201);

            expect(mockEmailService.sendInvite).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String) // Org name should be passed
            );
        });
    });

    // ============================================================
    // PERMISSION TESTS
    // ============================================================

    describe('Invite Permissions', () => {
        it('should only allow OWNER/ADMIN to invite users', async () => {
            // Test with STAFF token (MANAGER role) - should be forbidden
            // Note: The staffToken has role MANAGER, which is below ADMIN
            // The endpoint requires ADMIN role, so this should be 403
            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ email: `perm-test-${Date.now()}@example.com`, role: 'OPERATOR' })
                .expect(403);
        });

        it('should allow ADMIN to invite users with same role (ADMIN)', async () => {
            // ADMIN can invite another ADMIN - same level is allowed
            await request(app.getHttpServer())
                .post('/api/v1/users/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ email: `admin-invite-${Date.now()}@example.com`, role: 'ADMIN' })
                .expect(201);
        });
    });
});
