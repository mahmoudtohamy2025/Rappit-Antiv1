/**
 * Shipping Account Controller Unit Tests
 * Tests for TASK-012: Implement Shipping Account Carrier API Test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ShippingAccountController } from '@controllers/shipping-account.controller';
import { PrismaService } from '@common/database/prisma.service';
import * as encryption from '@helpers/encryption';

// Mock fetch globally
global.fetch = jest.fn();

// Mock encryption helpers
jest.mock('@helpers/encryption', () => ({
  encrypt: jest.fn((data) => `encrypted:${data}`),
  decrypt: jest.fn((data) => data.replace('encrypted:', '')),
}));

describe('ShippingAccountController - Connection Tests', () => {
  let controller: ShippingAccountController;
  let prisma: PrismaService;

  const mockOrganizationId = 'org-123';
  const mockAccountId = 'account-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingAccountController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            shippingAccount: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            shipment: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<ShippingAccountController>(
      ShippingAccountController,
    );
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('testConnection - DHL', () => {
    it('should successfully test valid DHL credentials', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'DHL',
        name: 'Test DHL Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: 'test-dhl-key',
          apiSecret: 'test-dhl-secret',
          accountNumber: '123456789',
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      // Mock successful DHL API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          accountNumber: '123456789',
          status: 'active',
        }),
      });

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
      expect(result.data.carrier).toBe('DHL');
      expect(result.data.message).toContain('DHL connection successful');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dhl.com'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'DHL-API-Key': 'test-dhl-key',
          }),
        }),
      );
    });

    it('should fail test with invalid DHL credentials', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'DHL',
        name: 'Test DHL Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: 'invalid-key',
          apiSecret: 'invalid-secret',
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      // Mock failed DHL API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CONNECTION_FAILED');
      expect(result.error.message).toContain('DHL connection failed');
      expect(result.error.message).toContain('401');
    });

    it('should fail test with missing DHL credentials', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'DHL',
        name: 'Test DHL Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: null,
          apiSecret: null,
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
      expect(result.error.message).toContain('DHL credentials incomplete');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors for DHL', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'DHL',
        name: 'Test DHL Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: 'test-key',
          apiSecret: 'test-secret',
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network timeout'),
      );

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CONNECTION_ERROR');
      expect(result.error.message).toContain('Connection error');
      expect(result.error.message).toContain('Network timeout');
    });
  });

  describe('testConnection - FedEx', () => {
    it('should successfully test valid FedEx credentials', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'FEDEX',
        name: 'Test FedEx Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: 'test-fedex-key',
          apiSecret: 'test-fedex-secret',
          accountNumber: '987654321',
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      // Mock successful FedEx OAuth response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'test-token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
      expect(result.data.carrier).toBe('FEDEX');
      expect(result.data.message).toContain('FedEx connection successful');
      expect(result.data.tokenReceived).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('fedex.com/oauth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should fail test with invalid FedEx credentials', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'FEDEX',
        name: 'Test FedEx Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: 'invalid-key',
          apiSecret: 'invalid-secret',
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      // Mock failed FedEx OAuth response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid client credentials',
      });

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CONNECTION_FAILED');
      expect(result.error.message).toContain('FedEx connection failed');
      expect(result.error.message).toContain('401');
    });

    it('should fail test with missing FedEx credentials', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'FEDEX',
        name: 'Test FedEx Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: null,
          apiSecret: null,
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
      expect(result.error.message).toContain('FedEx credentials incomplete');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors for FedEx', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'FEDEX',
        name: 'Test FedEx Account',
        credentials: 'encrypted:' + JSON.stringify({
          apiKey: 'test-key',
          apiSecret: 'test-secret',
        }),
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('ECONNREFUSED'),
      );

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CONNECTION_ERROR');
      expect(result.error.message).toContain('Connection error');
      expect(result.error.message).toContain('ECONNREFUSED');
    });
  });

  describe('testConnection - General', () => {
    it('should return not found for non-existent account', async () => {
      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(null);

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, 'invalid-id');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toContain('Shipping account not found');
    });

    it('should return error for unsupported carrier type', async () => {
      const mockAccount = {
        id: mockAccountId,
        organizationId: mockOrganizationId,
        carrierType: 'UPS',
        name: 'Test UPS Account',
        credentials: 'encrypted:{}',
        testMode: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.shippingAccount.findFirst as jest.Mock).mockResolvedValue(
        mockAccount,
      );

      const req = { user: { orgId: mockOrganizationId } };
      const result = await controller.testConnection(req, mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNSUPPORTED_CARRIER');
      expect(result.error.message).toContain('not supported');
    });
  });
});
