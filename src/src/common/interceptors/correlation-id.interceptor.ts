import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AsyncContextService } from '../context/async-context.service';

/**
 * CorrelationIdInterceptor standardizes correlation ID handling:
 * - Uses existing X-Correlation-ID header if valid
 * - Generates new UUID if missing or invalid
 * - Sets correlation ID in response header
 * - Stores in async context for logging/tracing
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
    private readonly MAX_CORRELATION_ID_LENGTH = 64;
    private readonly VALID_PATTERN = /^[a-zA-Z0-9\-_]+$/;

    constructor(private readonly asyncContext: AsyncContextService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest();
        const response = httpContext.getResponse();

        // Extract correlation ID from header (case-insensitive)
        let correlationId = this.extractCorrelationId(request.headers);

        // Validate and sanitize
        if (!this.isValidCorrelationId(correlationId)) {
            correlationId = uuidv4();
        }

        // Store in async context
        this.asyncContext.set('correlationId', correlationId);

        // Set response header
        response.setHeader('X-Correlation-ID', correlationId);

        return next.handle();
    }

    private extractCorrelationId(headers: Record<string, any>): string | undefined {
        // Case-insensitive header lookup
        const headerName = Object.keys(headers).find(
            (key) => key.toLowerCase() === 'x-correlation-id',
        );
        return headerName ? headers[headerName] : undefined;
    }

    private isValidCorrelationId(id: string | undefined): boolean {
        if (!id || id.length === 0) {
            return false;
        }
        if (id.length > this.MAX_CORRELATION_ID_LENGTH) {
            return false;
        }
        if (!this.VALID_PATTERN.test(id)) {
            return false;
        }
        return true;
    }
}
