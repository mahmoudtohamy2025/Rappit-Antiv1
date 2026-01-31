import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdInterceptor } from '../../src/common/interceptors/correlation-id.interceptor';
import { AsyncContextService } from '../../src/common/context/async-context.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

/**
 * OBS-03: Correlation ID Standardization Tests
 * 
 * Tests cover:
 * 1. Generate UUID when no header present
 * 2. Use provided header value
 * 3. Response includes correlation ID header
 * 4. Context stores correlation ID
 * 5. Invalid format triggers new UUID generation
 * 6. Concurrent requests maintain isolation
 */
describe('OBS-03 Correlation ID Standardization', () => {
    let interceptor: CorrelationIdInterceptor;
    let asyncContext: AsyncContextService;

    const createMockExecutionContext = (headers: Record<string, string> = {}): ExecutionContext => {
        const mockRequest = {
            headers: {
                'x-correlation-id': headers['x-correlation-id'],
                ...headers,
            },
        };
        const mockResponse = {
            setHeader: jest.fn(),
        };

        return {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
            }),
            getType: () => 'http',
        } as unknown as ExecutionContext;
    };

    const createMockCallHandler = (): CallHandler => ({
        handle: () => of({ success: true }),
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CorrelationIdInterceptor,
                {
                    provide: AsyncContextService,
                    useValue: {
                        set: jest.fn(),
                        get: jest.fn(),
                        run: jest.fn((callback) => callback()),
                    },
                },
            ],
        }).compile();

        interceptor = module.get<CorrelationIdInterceptor>(CorrelationIdInterceptor);
        asyncContext = module.get<AsyncContextService>(AsyncContextService);
        jest.clearAllMocks();
    });

    describe('Happy Paths', () => {
        it('should generate UUID when no X-Correlation-ID header present', async () => {
            const context = createMockExecutionContext({});
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            expect(asyncContext.set).toHaveBeenCalledWith(
                'correlationId',
                expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
            );
        });

        it('should use provided X-Correlation-ID header value', async () => {
            const providedId = 'client-provided-correlation-id';
            const context = createMockExecutionContext({ 'x-correlation-id': providedId });
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            expect(asyncContext.set).toHaveBeenCalledWith('correlationId', providedId);
        });

        it('should set X-Correlation-ID header in response', async () => {
            const context = createMockExecutionContext({});
            const handler = createMockCallHandler();
            const mockResponse = context.switchToHttp().getResponse();

            await interceptor.intercept(context, handler).toPromise();

            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                'X-Correlation-ID',
                expect.any(String),
            );
        });

        it('should store correlation ID in async context', async () => {
            const context = createMockExecutionContext({});
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            expect(asyncContext.set).toHaveBeenCalledWith('correlationId', expect.any(String));
        });

        it('should support case-insensitive header lookup', async () => {
            const providedId = 'case-insensitive-id';
            const mockRequest = {
                headers: {
                    'X-CORRELATION-ID': providedId, // uppercase
                },
            };
            const mockResponse = { setHeader: jest.fn() };
            const context = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                    getResponse: () => mockResponse,
                }),
                getType: () => 'http',
            } as unknown as ExecutionContext;
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            expect(asyncContext.set).toHaveBeenCalledWith('correlationId', providedId);
        });
    });

    describe('Edge Cases', () => {
        it('should generate new UUID when header value exceeds 64 characters', async () => {
            const tooLongId = 'a'.repeat(65);
            const context = createMockExecutionContext({ 'x-correlation-id': tooLongId });
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            expect(asyncContext.set).toHaveBeenCalledWith(
                'correlationId',
                expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
            );
        });

        it('should generate new UUID when header is empty string', async () => {
            const context = createMockExecutionContext({ 'x-correlation-id': '' });
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            expect(asyncContext.set).toHaveBeenCalledWith(
                'correlationId',
                expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
            );
        });

        it('should sanitize header values with special characters', async () => {
            const maliciousId = '<script>alert(1)</script>';
            const context = createMockExecutionContext({ 'x-correlation-id': maliciousId });
            const handler = createMockCallHandler();

            await interceptor.intercept(context, handler).toPromise();

            // Should generate new UUID for invalid format
            expect(asyncContext.set).toHaveBeenCalledWith(
                'correlationId',
                expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
            );
        });
    });

    describe('Concurrency', () => {
        it('should maintain isolated correlation IDs for concurrent requests', async () => {
            const handler = createMockCallHandler();

            // Simulate two concurrent requests
            const context1 = createMockExecutionContext({ 'x-correlation-id': 'request-1' });
            const context2 = createMockExecutionContext({ 'x-correlation-id': 'request-2' });

            const [result1, result2] = await Promise.all([
                interceptor.intercept(context1, handler).toPromise(),
                interceptor.intercept(context2, handler).toPromise(),
            ]);

            // Both should complete successfully with different IDs
            expect(asyncContext.set).toHaveBeenCalledWith('correlationId', 'request-1');
            expect(asyncContext.set).toHaveBeenCalledWith('correlationId', 'request-2');
        });
    });
});

describe('AsyncContextService', () => {
    let service: AsyncContextService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AsyncContextService],
        }).compile();

        service = module.get<AsyncContextService>(AsyncContextService);
    });

    it('should store and retrieve values within run context', () => {
        service.run(() => {
            service.set('testKey', 'testValue');
            expect(service.get('testKey')).toBe('testValue');
        });
    });

    it('should return undefined for non-existent keys', () => {
        service.run(() => {
            expect(service.get('nonExistent')).toBeUndefined();
        });
    });

    it('should return undefined when called outside run context', () => {
        expect(service.get('testKey')).toBeUndefined();
    });
});
