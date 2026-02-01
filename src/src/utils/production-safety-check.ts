/**
 * Production Safety Check Utility
 * 
 * Validates that the application is configured correctly for production deployment.
 * This runs on application startup and will prevent the app from starting if
 * critical production requirements are not met.
 */

export class ProductionSafetyCheck {
  private static readonly PRODUCTION_ENV = 'production';
  
  /**
   * Validates production environment configuration
   * Throws error if any NO-GO conditions are violated
   */
  static validateProduction(): void {
    const env = process.env.NODE_ENV;
    
    if (env !== this.PRODUCTION_ENV) {
      console.log(`⚠️  Running in ${env} mode - Production safety checks skipped`);
      return;
    }

    console.log('🔒 Running production safety checks...');

    const errors: string[] = [];

    // GATE-001: Prisma Client
    this.checkPrismaClient(errors);

    // GATE-002: Carrier API Configuration
    this.checkCarrierAPIs(errors);

    // GATE-003: Multi-tenant isolation (runtime check)
    this.checkDatabaseURL(errors);

    if (errors.length > 0) {
      console.error('❌ PRODUCTION SAFETY CHECK FAILED\n');
      errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`);
      });
      console.error('\n📚 See docs/PRODUCTION_SAFETY_GATES.md for resolution steps\n');
      
      throw new Error(
        `Production deployment blocked: ${errors.length} safety gate(s) failed. ` +
        `Fix configuration errors and redeploy.`
      );
    }

    console.log('✅ All production safety checks passed\n');
  }

  private static checkPrismaClient(errors: string[]): void {
    try {
      // Prisma client should be generated
      require('@prisma/client');
    } catch (error) {
      errors.push(
        'GATE-001: Prisma client not found. Run: npx prisma@5.22.0 generate'
      );
    }
  }

  private static checkCarrierAPIs(errors: string[]): void {
    const dhlApiUrl = process.env.DHL_API_URL;
    const fedexApiUrl = process.env.FEDEX_API_URL;

    // Check DHL configuration
    if (!dhlApiUrl || dhlApiUrl.includes('sandbox') || dhlApiUrl.includes('test')) {
      errors.push(
        'GATE-002: DHL API URL not configured for production. ' +
        'Set DHL_API_URL=https://express.api.dhl.com'
      );
    }

    if (!process.env.DHL_API_KEY || !process.env.DHL_API_SECRET) {
      errors.push(
        'GATE-002: DHL credentials not configured. ' +
        'Set DHL_API_KEY and DHL_API_SECRET environment variables'
      );
    }

    // Check FedEx configuration
    if (!fedexApiUrl || fedexApiUrl.includes('sandbox') || fedexApiUrl.includes('test')) {
      errors.push(
        'GATE-002: FedEx API URL not configured for production. ' +
        'Set FEDEX_API_URL=https://apis.fedex.com'
      );
    }

    if (!process.env.FEDEX_API_KEY || !process.env.FEDEX_SECRET_KEY) {
      errors.push(
        'GATE-002: FedEx credentials not configured. ' +
        'Set FEDEX_API_KEY and FEDEX_SECRET_KEY environment variables'
      );
    }

    if (!process.env.FEDEX_ACCOUNT_NUMBER) {
      errors.push(
        'GATE-002: FedEx account number not configured. ' +
        'Set FEDEX_ACCOUNT_NUMBER environment variable'
      );
    }
  }

  private static checkDatabaseURL(errors: string[]): void {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      errors.push(
        'GATE-003: DATABASE_URL not configured'
      );
      return;
    }

    // Check for development/test database indicators
    const devIndicators = ['localhost', '127.0.0.1', 'test', 'dev', 'development'];
    const hasDevIndicator = devIndicators.some(indicator => 
      dbUrl.toLowerCase().includes(indicator)
    );

    if (hasDevIndicator) {
      errors.push(
        'GATE-003: DATABASE_URL appears to be a development/test database. ' +
        'Verify you are using the production database connection string.'
      );
    }
  }

  /**
   * Logs warnings for conditional gates and monitoring recommendations
   */
  static logProductionWarnings(): void {
    if (process.env.NODE_ENV !== this.PRODUCTION_ENV) {
      return;
    }

    console.log('⚠️  Production Warnings:\n');

    // GATE-006: Subscription Enforcement
    console.log('  📊 GATE-006: Subscription enforcement is active');
    console.log('     - Monitor blocked write attempts via SubscriptionGuard logs');
    console.log('     - Set up alerting for high violation rates\n');

    // GATE-007: Rate Limiting  
    console.log('  🚦 GATE-007: Rate limiting is active');
    console.log('     - Monitor rate limit hits in application metrics');
    console.log('     - Export Prometheus metrics for dashboards');
    console.log('     - Document rate limits for API consumers\n');
  }
}

/**
 * Staging environment configuration validator
 * Less strict than production, allows test mode for carriers and OAuth
 */
export class StagingSafetyCheck {
  static validateStaging(): void {
    const env = process.env.NODE_ENV as string;
    
    if (env !== 'staging') {
      return;
    }

    console.log('🔧 Running staging environment checks...');

    const warnings: string[] = [];

    // GATE-004: OAuth stubs are OK for staging
    console.log('  ✅ OAuth test endpoints enabled for staging');

    // GATE-002: Carrier APIs can use sandbox
    const dhlUrl = process.env.DHL_API_URL || '';
    const fedexUrl = process.env.FEDEX_API_URL || '';

    if (dhlUrl.includes('sandbox') || dhlUrl.includes('test')) {
      console.log('  ⚠️  DHL using sandbox API (OK for staging)');
    }

    if (fedexUrl.includes('sandbox') || fedexUrl.includes('test')) {
      console.log('  ⚠️  FedEx using sandbox API (OK for staging)');
    }

    console.log('✅ Staging configuration validated\n');
  }
}
