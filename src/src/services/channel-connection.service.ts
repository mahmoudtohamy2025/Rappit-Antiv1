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
  ): Promise<{ success: boolean; message: string; details?: any }> {
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
   * Test Shopify connection with real API call
   * 
   * Makes a GET request to /admin/api/2024-01/shop.json to validate credentials.
   * 
   * @param credentials - Decrypted Shopify credentials
   * @returns Test result with shop details on success
   */
  private async testShopifyConnection(
    credentials: Record<string, any>,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const { shopDomain, accessToken } = credentials;

    if (!shopDomain || !accessToken) {
      return {
        success: false,
        message: 'Missing Shopify credentials (shopDomain or accessToken)',
      };
    }

    const apiVersion = '2024-01';
    const url = `https://${shopDomain}/admin/api/${apiVersion}/shop.json`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        this.logger.log(`Shopify connection successful for ${shopDomain}`);
        return {
          success: true,
          message: 'Connected to Shopify successfully',
          details: {
            shopName: data.shop?.name,
            shopDomain: data.shop?.domain,
            email: data.shop?.email,
            currency: data.shop?.currency,
            timezone: data.shop?.timezone,
          },
        };
      }

      // Handle specific error codes
      if (response.status === 401) {
        return {
          success: false,
          message: 'Authentication failed: Invalid access token',
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          message: 'Authorization failed: Access token does not have required permissions',
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          message: 'Shop not found: Invalid shop domain',
        };
      }

      return {
        success: false,
        message: `Shopify API error: HTTP ${response.status}`,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timeout: Shopify API did not respond in time',
        };
      }

      this.logger.error(`Shopify connection test failed: ${error.message}`);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Test WooCommerce connection with real API call
   * 
   * Makes a GET request to /wp-json/wc/v3/system_status to validate credentials.
   * Uses OAuth1 signature for authentication.
   * 
   * @param credentials - Decrypted WooCommerce credentials
   * @returns Test result with system status on success
   */
  private async testWooCommerceConnection(
    credentials: Record<string, any>,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const { siteUrl, consumerKey, consumerSecret } = credentials;

    if (!siteUrl || !consumerKey || !consumerSecret) {
      return {
        success: false,
        message: 'Missing WooCommerce credentials (siteUrl, consumerKey, or consumerSecret)',
      };
    }

    // Normalize site URL
    const baseUrl = siteUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wc/v3/system_status`;

    try {
      // WooCommerce can use either OAuth1 or Basic Auth depending on SSL
      // For HTTPS, we can use Basic Auth which is simpler and works reliably
      const isHttps = baseUrl.startsWith('https://');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      let response: Response;

      if (isHttps) {
        // Use Basic Auth for HTTPS
        const authString = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
      } else {
        // Use OAuth1 for HTTP
        const oauthParams = this.createWooCommerceOAuth1Params(
          'GET',
          endpoint,
          consumerKey,
          consumerSecret,
        );

        const urlWithOAuth = new URL(endpoint);
        Object.entries(oauthParams).forEach(([key, value]) => {
          urlWithOAuth.searchParams.append(key, value);
        });

        response = await fetch(urlWithOAuth.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        this.logger.log(`WooCommerce connection successful for ${siteUrl}`);
        return {
          success: true,
          message: 'Connected to WooCommerce successfully',
          details: {
            environment: {
              homeUrl: data.environment?.home_url,
              siteUrl: data.environment?.site_url,
              wcVersion: data.environment?.version,
              wpVersion: data.environment?.wp_version,
            },
          },
        };
      }

      // Handle specific error codes
      if (response.status === 401) {
        return {
          success: false,
          message: 'Authentication failed: Invalid consumer key or secret',
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          message: 'Authorization failed: API key does not have required permissions',
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          message: 'WooCommerce REST API not found: Check if WooCommerce is installed and REST API is enabled',
        };
      }

      return {
        success: false,
        message: `WooCommerce API error: HTTP ${response.status}`,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timeout: WooCommerce API did not respond in time',
        };
      }

      this.logger.error(`WooCommerce connection test failed: ${error.message}`);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Create OAuth1 parameters for WooCommerce (HTTP only)
   * 
   * @param method - HTTP method
   * @param url - Full URL
   * @param consumerKey - Consumer key
   * @param consumerSecret - Consumer secret
   * @returns OAuth1 parameters including signature
   */
  private createWooCommerceOAuth1Params(
    method: string,
    url: string,
    consumerKey: string,
    consumerSecret: string,
  ): Record<string, string> {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA256',
      oauth_version: '1.0',
    };

    // Parse URL
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

    // Collect all parameters
    const allParams: Record<string, string> = { ...oauthParams };
    urlObj.searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Create parameter string (sorted alphabetically)
    const sortedKeys = Object.keys(allParams).sort();
    const parameterString = sortedKeys
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    // Create signature base string
    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(baseUrl),
      encodeURIComponent(parameterString),
    ].join('&');

    // Create signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&`;

    // Generate signature
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    return oauthParams;
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
