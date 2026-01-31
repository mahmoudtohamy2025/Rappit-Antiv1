/**
 * Channel Connection Service Unit Tests
 * Tests for TASK-011: Implement Channel Connection Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ChannelConnectionService } from '@services/channel-connection.service';
import { PrismaService } from '@common/database/prisma.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('ChannelConnectionService - Connection Tests', () => {
  let service: ChannelConnectionService;
  let prisma: PrismaService;

  const mockOrganizationId = 'org-123';
  const mockChannelId = 'channel-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelConnectionService,
        {
          provide: PrismaService,
          useValue: {
            channel: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ChannelConnectionService>(ChannelConnectionService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('testConnection - Shopify', () => {
    it('should successfully test valid Shopify connection', async () => {
      // Mock channel data
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'SHOPIFY',
        name: 'Test Shopify Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      // Mock the database call
      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      // Mock successful Shopify API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          shop: {
            name: 'Test Store',
            domain: 'test-store.myshopify.com',
          },
        }),
      });

      // Spy on decryptCredentials to return mock credentials
      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        shopDomain: 'test-store.myshopify.com',
        accessToken: 'test-token',
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected to Shopify store');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-store.myshopify.com/admin/api/2024-01/shop.json',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Shopify-Access-Token': 'test-token',
          }),
        }),
      );
    });

    it('should fail test with invalid Shopify credentials', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'SHOPIFY',
        name: 'Test Shopify Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      // Mock failed Shopify API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid access token',
      });

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        shopDomain: 'test-store.myshopify.com',
        accessToken: 'invalid-token',
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Shopify connection failed');
      expect(result.message).toContain('401');
    });

    it('should fail test with missing Shopify credentials', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'SHOPIFY',
        name: 'Test Shopify Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        shopDomain: null,
        accessToken: null,
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing Shopify credentials');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors for Shopify', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'SHOPIFY',
        name: 'Test Shopify Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error: ECONNREFUSED'),
      );

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        shopDomain: 'test-store.myshopify.com',
        accessToken: 'test-token',
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection error');
      expect(result.message).toContain('Network error');
    });
  });

  describe('testConnection - WooCommerce', () => {
    it('should successfully test valid WooCommerce connection', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'WOOCOMMERCE',
        name: 'Test WooCommerce Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      // Mock successful WooCommerce API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          environment: {
            site_url: 'https://test-store.com',
            version: '8.0.0',
          },
        }),
      });

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        siteUrl: 'https://test-store.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected to WooCommerce site');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-store.com/wp-json/wc/v3/system_status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
          }),
        }),
      );
    });

    it('should fail test with invalid WooCommerce credentials', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'WOOCOMMERCE',
        name: 'Test WooCommerce Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      // Mock failed WooCommerce API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid consumer key',
      });

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        siteUrl: 'https://test-store.com',
        consumerKey: 'invalid-key',
        consumerSecret: 'invalid-secret',
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('WooCommerce connection failed');
      expect(result.message).toContain('401');
    });

    it('should fail test with missing WooCommerce credentials', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'WOOCOMMERCE',
        name: 'Test WooCommerce Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        siteUrl: 'https://test-store.com',
        consumerKey: null,
        consumerSecret: null,
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing WooCommerce credentials');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors for WooCommerce', async () => {
      const mockChannel = {
        id: mockChannelId,
        organizationId: mockOrganizationId,
        type: 'WOOCOMMERCE',
        name: 'Test WooCommerce Store',
        config: {
          encrypted: true,
          data: 'encrypted-data',
          iv: 'test-iv',
          authTag: 'test-auth-tag',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
      };

      (prisma.channel.findFirst as jest.Mock).mockResolvedValue(mockChannel);

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network timeout'),
      );

      jest.spyOn(service as any, 'decryptCredentials').mockReturnValue({
        siteUrl: 'https://test-store.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      });

      const result = await service.testConnection(
        mockChannelId,
        mockOrganizationId,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection error');
      expect(result.message).toContain('Network timeout');
    });
  });
});
