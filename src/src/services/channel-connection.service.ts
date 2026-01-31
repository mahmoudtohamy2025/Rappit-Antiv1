import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import * as crypto from 'crypto';

/**
 * Channel Connection Service
 * 
 * Manages channel connections with secure credential storage.
 * 
 * Features:
 * - CRUD operations for channel connections
 * - Encrypted credential storage
 * - Credential validation
 * - Webhook secret generation
 * - OAuth token management
 */
@Injectable()
export class ChannelConnectionService {
  private readonly logger = new Logger(ChannelConnectionService.name);

  // Encryption key from environment (in production, use KMS or secure vault)
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private prisma: PrismaService) {
    // Get encryption key from environment
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateDefaultKey();

    if (!process.env.ENCRYPTION_KEY) {
      this.logger.warn(
        'ENCRYPTION_KEY not set in environment. Using default key (NOT SECURE FOR PRODUCTION)',
      );
    }
  }

  /**
   * Generate default encryption key (DEV ONLY)
   */
  private generateDefaultKey(): string {
    // In production, NEVER use a default key
    // Use AWS KMS, HashiCorp Vault, or similar
    return crypto
      .createHash('sha256')
      .update('rappit-dev-encryption-key')
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Create channel connection
   * 
   * @param organizationId - Organization ID
   * @param data - Channel data
   * @returns Created channel
   */
  async createConnection(
    organizationId: string,
    data: {
      name: string;
      type: 'SHOPIFY' | 'WOOCOMMERCE';
      credentials: {
        // Shopify
        shopDomain?: string;
        accessToken?: string;
        // WooCommerce
        siteUrl?: string;
        consumerKey?: string;
        consumerSecret?: string;
      };
      webhookSecret?: string;
    },
  ) {
    this.logger.log(
      `Creating ${data.type} connection for organization ${organizationId}`,
    );

    // Validate credentials based on type
    this.validateCredentials(data.type, data.credentials);

    // Encrypt sensitive credentials
    const encryptedConfig = this.encryptCredentials({
      ...data.credentials,
      webhookSecret: data.webhookSecret || this.generateWebhookSecret(),
    });

    // Create channel
    const channel = await this.prisma.channel.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        config: encryptedConfig,
        isActive: true,
      },
    });

    this.logger.log(`Channel connection created: ${channel.id}`);

    return channel;
  }

  /**
   * Update channel connection
   * 
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   * @param data - Update data
   */
  async updateConnection(
    channelId: string,
    organizationId: string,
    data: {
      name?: string;
      credentials?: Record<string, any>;
      webhookSecret?: string;
      isActive?: boolean;
    },
  ) {
    this.logger.log(`Updating channel connection: ${channelId}`);

    // Get existing channel
    const channel = await this.getConnection(channelId, organizationId);

    // Decrypt existing config
    const existingConfig = this.decryptCredentials(channel.config);

    // Merge credentials
    const newConfig = {
      ...existingConfig,
      ...data.credentials,
    };

    if (data.webhookSecret) {
      newConfig.webhookSecret = data.webhookSecret;
    }

    // Encrypt updated config
    const encryptedConfig = this.encryptCredentials(newConfig);

    // Update channel
    const updated = await this.prisma.channel.update({
      where: {
        id: channelId,
        organizationId, // Ensure org ownership
      },
      data: {
        name: data.name,
        config: encryptedConfig,
        isActive: data.isActive,
      },
    });

    this.logger.log(`Channel connection updated: ${channelId}`);

    return updated;
  }

  /**
   * Get channel connection
   * 
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   * @returns Channel with decrypted credentials
   */
  async getConnection(channelId: string, organizationId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId, // Ensure org ownership
      },
    });

    if (!channel) {
      throw new NotFoundException(`Channel not found: ${channelId}`);
    }

    return channel;
  }

  /**
   * Get decrypted credentials
   * 
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   * @returns Decrypted credentials
   */
  async getCredentials(channelId: string, organizationId: string) {
    const channel = await this.getConnection(channelId, organizationId);
    return this.decryptCredentials(channel.config);
  }

  /**
   * Delete channel connection
   * 
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   */
  async deleteConnection(channelId: string, organizationId: string) {
    this.logger.log(`Deleting channel connection: ${channelId}`);

    await this.prisma.channel.delete({
      where: {
        id: channelId,
        organizationId, // Ensure org ownership
      },
    });

    this.logger.log(`Channel connection deleted: ${channelId}`);
  }

  /**
   * List channel connections
   * 
   * @param organizationId - Organization ID
   * @param type - Filter by type
   * @returns List of channels (credentials NOT decrypted for list view)
   */
  async listConnections(organizationId: string, type?: string) {
    return this.prisma.channel.findMany({
      where: {
        organizationId,
        type: type as any,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT include config in list view for security
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Validate credentials
   */
  private validateCredentials(
    type: string,
    credentials: Record<string, any>,
  ): void {
    if (type === 'SHOPIFY') {
      if (!credentials.shopDomain || !credentials.accessToken) {
        throw new BadRequestException(
          'Shopify credentials require shopDomain and accessToken',
        );
      }

      // Validate shop domain format
      if (!credentials.shopDomain.includes('.myshopify.com')) {
        throw new BadRequestException(
          'Invalid Shopify shop domain. Must include .myshopify.com',
        );
      }
    } else if (type === 'WOOCOMMERCE') {
      if (!credentials.siteUrl || !credentials.consumerKey || !credentials.consumerSecret) {
        throw new BadRequestException(
          'WooCommerce credentials require siteUrl, consumerKey, and consumerSecret',
        );
      }

      // Validate site URL format
      try {
        new URL(credentials.siteUrl);
      } catch (error) {
        throw new BadRequestException('Invalid WooCommerce site URL');
      }
    } else {
      throw new BadRequestException(`Unknown channel type: ${type}`);
    }
  }

  /**
   * Encrypt credentials
   * 
   * Uses AES-256-GCM for encryption.
   * In production, use AWS KMS or similar for key management.
   */
  private encryptCredentials(credentials: Record<string, any>): any {
    const text = JSON.stringify(credentials);

    // Generate IV (Initialization Vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey, 'hex'),
      iv,
    );

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Return encrypted data with IV and auth tag
    return {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt credentials
   */
  private decryptCredentials(encryptedConfig: any): Record<string, any> {
    // Check if already decrypted (for backward compatibility)
    if (!encryptedConfig.encrypted) {
      return encryptedConfig;
    }

    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey, 'hex'),
        Buffer.from(encryptedConfig.iv, 'hex'),
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedConfig.authTag, 'hex'));

      // Decrypt
      let decrypted = decipher.update(encryptedConfig.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error(`Failed to decrypt credentials: ${error.message}`);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Test connection (validate credentials with external API)
   * 
   * @param channelId - Channel ID
   * @param organizationId - Organization ID
   * @returns Test result
   */
  async testConnection(
    channelId: string,
    organizationId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Testing connection: ${channelId}`);

    const channel = await this.getConnection(channelId, organizationId);
    const credentials = this.decryptCredentials(channel.config);

    if (channel.type === 'SHOPIFY') {
      return this.testShopifyConnection(credentials);
    } else if (channel.type === 'WOOCOMMERCE') {
      return this.testWooCommerceConnection(credentials);
    }

    return {
      success: false,
      message: 'Unknown channel type',
    };
  }

  /**
   * Test Shopify connection with actual API call
   */
  private async testShopifyConnection(
    credentials: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const shopDomain = credentials.shopDomain;
      const accessToken = credentials.accessToken;

      if (!shopDomain || !accessToken) {
        return {
          success: false,
          message: 'Missing Shopify credentials',
        };
      }

      // Make actual API call to Shopify
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/shop.json`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected to Shopify store: ${data.shop?.name || shopDomain}`,
        };
      } else {
        const errorText = await response.text();
        this.logger.error(
          `Shopify connection test failed: ${response.status} - ${errorText}`,
        );
        return {
          success: false,
          message: `Shopify connection failed: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      this.logger.error(`Shopify connection test error: ${error.message}`);
      return {
        success: false,
        message: `Connection error: ${error.message}`,
      };
    }
  }

  /**
   * Test WooCommerce connection with actual API call
   */
  private async testWooCommerceConnection(
    credentials: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const siteUrl = credentials.siteUrl;
      const consumerKey = credentials.consumerKey;
      const consumerSecret = credentials.consumerSecret;

      if (!siteUrl || !consumerKey || !consumerSecret) {
        return {
          success: false,
          message: 'Missing WooCommerce credentials',
        };
      }

      // Create Basic Auth header
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
        'base64',
      );

      // Make actual API call to WooCommerce
      const response = await fetch(
        `${siteUrl}/wp-json/wc/v3/system_status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected to WooCommerce site: ${data.environment?.site_url || siteUrl}`,
        };
      } else {
        const errorText = await response.text();
        this.logger.error(
          `WooCommerce connection test failed: ${response.status} - ${errorText}`,
        );
        return {
          success: false,
          message: `WooCommerce connection failed: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      this.logger.error(`WooCommerce connection test error: ${error.message}`);
      return {
        success: false,
        message: `Connection error: ${error.message}`,
      };
    }
  }

  /**
   * Rotate webhook secret
   * 
   * @param channelId - Channel ID
   * @param organizationId - Organization ID
   * @returns New webhook secret
   */
  async rotateWebhookSecret(
    channelId: string,
    organizationId: string,
  ): Promise<string> {
    this.logger.log(`Rotating webhook secret for channel: ${channelId}`);

    const newSecret = this.generateWebhookSecret();

    await this.updateConnection(channelId, organizationId, {
      webhookSecret: newSecret,
    });

    return newSecret;
  }
}
