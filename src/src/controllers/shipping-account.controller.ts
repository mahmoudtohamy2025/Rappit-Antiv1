import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '@common/database/prisma.service';
import { AuthGuard } from '@guards/auth.guard';
import { RequireRole } from '@decorators/require-role.decorator';
import { UserRole } from '@prisma/client';
import { encrypt, decrypt } from '@helpers/encryption';

/**
 * Shipping Account Controller
 * 
 * CRUD operations for shipping accounts with encrypted credential storage.
 * 
 * Security:
 * - OPERATIONS+ required for create/update/delete
 * - All operations organization-scoped
 * - Credentials encrypted at rest
 */
@ApiTags('Shipping Accounts')
@ApiBearerAuth()
@Controller('shipping-accounts')
@UseGuards(AuthGuard)
export class ShippingAccountController {
  constructor(private prisma: PrismaService) {}

  /**
   * Create shipping account
   * 
   * POST /shipping-accounts
   */
  @Post()
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create shipping account' })
  async create(@Request() req, @Body() body: any) {
    const { orgId } = req.user;

    // Validate input
    this.validateCreateInput(body);

    // Encrypt credentials
    const encryptedCredentials = encrypt(JSON.stringify(body.credentials));

    // Create account
    const account = await this.prisma.shippingAccount.create({
      data: {
        organizationId: orgId,
        carrierType: body.carrierType,
        name: body.name,
        credentials: encryptedCredentials as any,
        testMode: body.testMode ?? false,
        webhookSecret: body.webhookSecret,
        isActive: true,
      },
    });

    return {
      success: true,
      data: {
        id: account.id,
        name: account.name,
        carrierType: account.carrierType,
        testMode: account.testMode,
        isActive: account.isActive,
        createdAt: account.createdAt,
      },
    };
  }

  /**
   * List shipping accounts
   * 
   * GET /shipping-accounts
   */
  @Get()
  @ApiOperation({ summary: 'List shipping accounts' })
  async list(@Request() req) {
    const { orgId } = req.user;

    const accounts = await this.prisma.shippingAccount.findMany({
      where: {
        organizationId: orgId,
      },
      select: {
        id: true,
        name: true,
        carrierType: true,
        testMode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT return credentials
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: accounts,
    };
  }

  /**
   * Get shipping account details
   * 
   * GET /shipping-accounts/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get shipping account' })
  async get(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    const account = await this.prisma.shippingAccount.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      select: {
        id: true,
        name: true,
        carrierType: true,
        testMode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT return credentials
      },
    });

    if (!account) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Shipping account not found',
        },
      };
    }

    return {
      success: true,
      data: account,
    };
  }

  /**
   * Update shipping account
   * 
   * PUT /shipping-accounts/:id
   */
  @Put(':id')
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update shipping account' })
  async update(@Request() req, @Param('id') id: string, @Body() body: any) {
    const { orgId } = req.user;

    // Verify account exists and belongs to org
    const existing = await this.prisma.shippingAccount.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Shipping account not found',
        },
      };
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.credentials !== undefined) {
      // Encrypt new credentials
      updateData.credentials = encrypt(JSON.stringify(body.credentials));
    }

    if (body.testMode !== undefined) {
      updateData.testMode = body.testMode;
    }

    if (body.webhookSecret !== undefined) {
      updateData.webhookSecret = body.webhookSecret;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    // Update account
    const account = await this.prisma.shippingAccount.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      data: {
        id: account.id,
        name: account.name,
        carrierType: account.carrierType,
        testMode: account.testMode,
        isActive: account.isActive,
        updatedAt: account.updatedAt,
      },
    };
  }

  /**
   * Delete shipping account
   * 
   * DELETE /shipping-accounts/:id
   */
  @Delete(':id')
  @RequireRole(UserRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete shipping account' })
  async delete(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    // Check if account has active shipments
    const activeShipments = await this.prisma.shipment.count({
      where: {
        shippingAccountId: id,
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'],
        },
      },
    });

    if (activeShipments > 0) {
      return {
        success: false,
        error: {
          code: 'HAS_ACTIVE_SHIPMENTS',
          message: 'Cannot delete account with active shipments',
        },
      };
    }

    // Delete account
    await this.prisma.shippingAccount.delete({
      where: {
        id,
        organizationId: orgId,
      },
    });

    return {
      success: true,
    };
  }

  /**
   * Test connection
   * 
   * POST /shipping-accounts/:id/test-connection
   */
  @Post(':id/test-connection')
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Test shipping account connection' })
  async testConnection(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    const account = await this.prisma.shippingAccount.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!account) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Shipping account not found',
        },
      };
    }

    // Decrypt credentials
    let credentials: any;
    try {
      const credentialsString = typeof account.credentials === 'string'
        ? account.credentials
        : JSON.stringify(account.credentials);
      
      // Try to decrypt, or parse as JSON if not encrypted
      try {
        credentials = JSON.parse(decrypt(credentialsString));
      } catch {
        // Credentials might not be encrypted (legacy or test mode)
        credentials = typeof account.credentials === 'string'
          ? JSON.parse(account.credentials)
          : account.credentials;
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt shipping account credentials',
        },
      };
    }

    // Test connection based on carrier type
    if (account.carrierType === 'DHL') {
      return this.testDHLConnection(credentials, account.testMode);
    } else if (account.carrierType === 'FEDEX') {
      return this.testFedExConnection(credentials, account.testMode);
    }

    return {
      success: false,
      error: {
        code: 'UNSUPPORTED_CARRIER',
        message: `Unsupported carrier type: ${account.carrierType}`,
      },
    };
  }

  /**
   * Test DHL connection with real API call
   * 
   * Makes a request to DHL API to validate credentials.
   * 
   * @param credentials - Decrypted DHL credentials
   * @param testMode - Whether to use test/sandbox environment
   */
  private async testDHLConnection(
    credentials: any,
    testMode: boolean,
  ): Promise<any> {
    const { apiKey, apiSecret } = credentials;

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'DHL credentials must include apiKey and apiSecret',
        },
      };
    }

    // DHL Express API URLs
    const baseUrl = testMode
      ? 'https://express.api.dhl.com/mydhlapi/test'
      : 'https://express.api.dhl.com/mydhlapi';

    // Use the address validation endpoint to test credentials
    const endpoint = `${baseUrl}/address-validate`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      // DHL uses Basic Auth with apiKey:apiSecret
      const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      // Make a simple address validation request to test credentials
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          type: 'delivery',
          countryCode: 'SA',
          postalCode: '12345',
          cityName: 'Riyadh',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok || response.status === 400) {
        // 400 might be returned for invalid address data, but if we got this far,
        // the credentials are valid (authentication passed)
        return {
          success: true,
          data: {
            connected: true,
            message: 'Connected to DHL API successfully',
            carrier: 'DHL',
            testMode,
          },
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Authentication failed: Invalid DHL API credentials',
          },
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: {
            code: 'AUTH_FORBIDDEN',
            message: 'Authorization failed: DHL API credentials do not have required permissions',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `DHL API error: HTTP ${response.status}`,
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Connection timeout: DHL API did not respond in time',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: `Connection failed: ${error.message}`,
        },
      };
    }
  }

  /**
   * Test FedEx connection with real API call
   * 
   * Uses OAuth2 token endpoint to validate credentials.
   * 
   * @param credentials - Decrypted FedEx credentials
   * @param testMode - Whether to use test/sandbox environment
   */
  private async testFedExConnection(
    credentials: any,
    testMode: boolean,
  ): Promise<any> {
    const { apiKey, apiSecret, accountNumber } = credentials;

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'FedEx credentials must include apiKey and apiSecret',
        },
      };
    }

    // FedEx API URLs
    const baseUrl = testMode
      ? 'https://apis-sandbox.fedex.com'
      : 'https://apis.fedex.com';

    // Use OAuth2 token endpoint to validate credentials
    const tokenEndpoint = `${baseUrl}/oauth/token`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      // FedEx OAuth2 uses form-urlencoded
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', apiKey);
      formData.append('client_secret', apiSecret);

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const tokenData = await response.json();
        return {
          success: true,
          data: {
            connected: true,
            message: 'Connected to FedEx API successfully',
            carrier: 'FEDEX',
            testMode,
            tokenScope: tokenData.scope,
          },
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Authentication failed: Invalid FedEx API credentials',
          },
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: {
            code: 'AUTH_FORBIDDEN',
            message: 'Authorization failed: FedEx API credentials do not have required permissions',
          },
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `FedEx API error: ${errorData.error_description || `HTTP ${response.status}`}`,
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Connection timeout: FedEx API did not respond in time',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: `Connection failed: ${error.message}`,
        },
      };
    }
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  private validateCreateInput(body: any): void {
    const required = ['name', 'carrierType', 'credentials'];

    for (const field of required) {
      if (!body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!['DHL', 'FEDEX'].includes(body.carrierType)) {
      throw new Error('Invalid carrierType. Must be DHL or FEDEX');
    }

    // Validate credentials structure based on carrier
    if (body.carrierType === 'DHL') {
      if (!body.credentials.apiKey || !body.credentials.apiSecret) {
        throw new Error('DHL credentials must include apiKey and apiSecret');
      }
    } else if (body.carrierType === 'FEDEX') {
      if (!body.credentials.apiKey || !body.credentials.apiSecret) {
        throw new Error('FedEx credentials must include apiKey and apiSecret');
      }
    }
  }
}
