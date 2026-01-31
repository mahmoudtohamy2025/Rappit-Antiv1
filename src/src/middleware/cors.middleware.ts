import { Logger } from '@nestjs/common';

/**
 * CORS Origin Validator
 * 
 * Implements secure CORS origin validation following SEC-01 requirements:
 * - Production: Only explicitly configured origins allowed
 * - Development: Localhost patterns permitted
 * - All rejected origins are logged for security monitoring
 */

const logger = new Logger('CORSMiddleware');

/**
 * Parse CORS_ORIGIN environment variable into array of allowed origins
 * @param corsOrigin - Comma-separated list of allowed origins
 * @returns Array of allowed origin strings
 */
export function parseAllowedOrigins(corsOrigin: string | undefined): string[] {
    if (!corsOrigin || corsOrigin.trim() === '') {
        return [];
    }

    return corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
}

/**
 * Check if an origin matches a localhost pattern
 * Allows localhost with any port in development
 * @param origin - Origin to check
 */
export function isLocalhostOrigin(origin: string): boolean {
    const localhostPatterns = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^http:\/\/\[::1\](:\d+)?$/,
    ];

    return localhostPatterns.some((pattern) => pattern.test(origin));
}

/**
 * Check if an origin is in the allowed list
 * @param origin - Origin to check
 * @param allowedOrigins - Array of allowed origins
 */
export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.includes(origin);
}

/**
 * Validate CORS_ORIGIN configuration for production
 * Throws error if missing or empty in production
 */
export function validateCorsConfig(): void {
    const nodeEnv = process.env.NODE_ENV;
    const corsOrigin = process.env.CORS_ORIGIN;

    if (nodeEnv === 'production') {
        if (!corsOrigin || corsOrigin.trim() === '') {
            throw new Error(
                'CORS_ORIGIN environment variable is required in production. ' +
                'Please configure allowed origins as a comma-separated list.'
            );
        }

        const origins = parseAllowedOrigins(corsOrigin);
        if (origins.length === 0) {
            throw new Error(
                'CORS_ORIGIN environment variable is empty or invalid. ' +
                'Please configure at least one allowed origin.'
            );
        }

        logger.log(`CORS configured with ${origins.length} allowed origin(s)`);
    }
}

/**
 * CORS origin callback function for NestJS
 * Returns true for allowed origins, false for rejected origins
 * Logs all rejected origin attempts for security monitoring
 */
export function corsOriginCallback(
    origin: string | undefined,
    callback: (error: Error | null, origin?: boolean | string) => void,
): void {
    const nodeEnv = process.env.NODE_ENV;
    const corsOrigin = process.env.CORS_ORIGIN;
    const allowedOrigins = parseAllowedOrigins(corsOrigin);

    // No origin header (same-origin request, curl, server-to-server)
    // Allow these requests to proceed
    if (!origin) {
        callback(null, true);
        return;
    }

    // Production: strict origin checking
    if (nodeEnv === 'production') {
        if (isOriginAllowed(origin, allowedOrigins)) {
            callback(null, true);
        } else {
            // Log rejected origin for security monitoring
            logger.warn(
                `CORS request rejected from origin: ${origin}. ` +
                `Allowed origins: ${allowedOrigins.join(', ')}`
            );
            callback(new Error('CORS origin not allowed'), false);
        }
        return;
    }

    // Development/staging: allow configured origins OR localhost
    if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
    }

    if (isLocalhostOrigin(origin)) {
        callback(null, true);
        return;
    }

    // Reject unknown origins even in development
    logger.warn(
        `CORS request rejected from origin: ${origin}. ` +
        `Configure CORS_ORIGIN or use localhost in development.`
    );
    callback(new Error('CORS origin not allowed'), false);
}

/**
 * Get CORS configuration for NestJS
 * Uses custom origin callback for secure validation
 */
export function getCorsConfig() {
    return {
        origin: corsOriginCallback,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'Authorization',
            'X-Correlation-ID',
        ],
        exposedHeaders: ['X-Correlation-ID'],
        maxAge: 86400, // 24 hours
    };
}
