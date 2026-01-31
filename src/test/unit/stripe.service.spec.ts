/**
 * StripeService Unit Tests (BILL-06)
 * 
 * Tests Stripe customer creation:
 * - Customer payload formatted correctly
 * - stripeCustomerId returned on success
 * - Returns null on API error (doesn't throw)
 * - Error logged for investigation
 */

import { ConfigService } from '@nestjs/config';

// Create mock functions
const mockCustomersCreate = jest.fn();
const mockCustomersRetrieve = jest.fn();
const mockCustomersUpdate = jest.fn();
const mockBillingPortalSessionsCreate = jest.fn();

// Mock Stripe BEFORE importing StripeService
jest.mock('stripe', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            customers: {
                create: mockCustomersCreate,
                retrieve: mockCustomersRetrieve,
                update: mockCustomersUpdate,
            },
            billingPortal: {
                sessions: {
                    create: mockBillingPortalSessionsCreate,
                },
            },
        })),
    };
});

// Import AFTER mock is set up
import { StripeService } from '../../src/modules/billing/stripe.service';

describe('StripeService', () => {
    let service: StripeService;
    let mockConfigService: Partial<ConfigService>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
                if (key === 'NODE_ENV') return 'test';
                return undefined;
            }),
        };

        service = new StripeService(mockConfigService as ConfigService);
    });

    describe('isConfigured', () => {
        it('should return true when Stripe secret key is configured', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false when Stripe secret key is not configured', () => {
            const unconfiguredConfig = {
                get: jest.fn().mockReturnValue(undefined),
            };
            const unconfiguredService = new StripeService(unconfiguredConfig as any);
            expect(unconfiguredService.isConfigured()).toBe(false);
        });
    });

    describe('createCustomer', () => {
        it('should create customer with correct payload', async () => {
            const mockCustomer = { id: 'cus_test123' };
            mockCustomersCreate.mockResolvedValue(mockCustomer);

            const result = await service.createCustomer(
                'org-123',
                'Test Org',
                'test@example.com',
            );

            expect(mockCustomersCreate).toHaveBeenCalledWith({
                email: 'test@example.com',
                name: 'Test Org',
                metadata: {
                    organizationId: 'org-123',
                    environment: 'test',
                    createdAt: expect.any(String),
                },
            });
            expect(result).toBe('cus_test123');
        });

        it('should return stripeCustomerId on success', async () => {
            mockCustomersCreate.mockResolvedValue({ id: 'cus_abc123' });

            const result = await service.createCustomer(
                'org-456',
                'Another Org',
                'another@example.com',
            );

            expect(result).toBe('cus_abc123');
        });

        it('should return null on API error (not throw)', async () => {
            mockCustomersCreate.mockRejectedValue(new Error('Stripe API error'));

            const result = await service.createCustomer(
                'org-123',
                'Test Org',
                'test@example.com',
            );

            expect(result).toBeNull();
        });

        it('should log error when API fails', async () => {
            const loggerSpy = jest.spyOn(service['logger'], 'error');
            mockCustomersCreate.mockRejectedValue(new Error('Rate limit exceeded'));

            await service.createCustomer('org-123', 'Test Org', 'test@example.com');

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });

        it('should return null when Stripe is not configured', async () => {
            const unconfiguredConfig = {
                get: jest.fn().mockReturnValue(undefined),
            };
            const unconfiguredService = new StripeService(unconfiguredConfig as any);

            const result = await unconfiguredService.createCustomer(
                'org-123',
                'Test Org',
                'test@example.com',
            );

            expect(result).toBeNull();
        });
    });

    describe('getCustomer', () => {
        it('should retrieve customer by ID', async () => {
            const mockCustomer = { id: 'cus_test123', email: 'test@example.com' };
            mockCustomersRetrieve.mockResolvedValue(mockCustomer);

            const result = await service.getCustomer('cus_test123');

            expect(mockCustomersRetrieve).toHaveBeenCalledWith('cus_test123');
            expect(result).toEqual(mockCustomer);
        });

        it('should return null for deleted customer', async () => {
            mockCustomersRetrieve.mockResolvedValue({ deleted: true });

            const result = await service.getCustomer('cus_deleted');

            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            mockCustomersRetrieve.mockRejectedValue(new Error('Not found'));

            const result = await service.getCustomer('cus_invalid');

            expect(result).toBeNull();
        });
    });

    describe('updateCustomer', () => {
        it('should update customer with provided data', async () => {
            mockCustomersUpdate.mockResolvedValue({
                id: 'cus_test123',
                email: 'updated@example.com',
            });

            const result = await service.updateCustomer('cus_test123', {
                email: 'updated@example.com',
            });

            expect(mockCustomersUpdate).toHaveBeenCalledWith('cus_test123', {
                email: 'updated@example.com',
            });
            expect(result?.email).toBe('updated@example.com');
        });

        it('should return null on error', async () => {
            mockCustomersUpdate.mockRejectedValue(new Error('Update failed'));

            const result = await service.updateCustomer('cus_test123', {});

            expect(result).toBeNull();
        });
    });

    describe('createBillingPortalSession', () => {
        it('should create billing portal session and return URL', async () => {
            mockBillingPortalSessionsCreate.mockResolvedValue({
                url: 'https://billing.stripe.com/session_123',
            });

            const result = await service.createBillingPortalSession(
                'cus_test123',
                'https://app.example.com/settings',
            );

            expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
                customer: 'cus_test123',
                return_url: 'https://app.example.com/settings',
            });
            expect(result).toBe('https://billing.stripe.com/session_123');
        });

        it('should return null on error', async () => {
            mockBillingPortalSessionsCreate.mockRejectedValue(new Error('Failed'));

            const result = await service.createBillingPortalSession(
                'cus_test123',
                'https://example.com',
            );

            expect(result).toBeNull();
        });
    });
});
