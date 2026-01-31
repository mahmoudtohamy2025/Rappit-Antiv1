import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncContextService provides request-scoped context storage
 * using Node.js AsyncLocalStorage for correlation ID propagation.
 */
@Injectable()
export class AsyncContextService {
    private readonly storage = new AsyncLocalStorage<Map<string, any>>();

    /**
     * Run a callback with a new async context
     */
    run<T>(callback: () => T): T {
        const store = new Map<string, any>();
        return this.storage.run(store, callback);
    }

    /**
     * Set a value in the current async context
     */
    set(key: string, value: any): void {
        const store = this.storage.getStore();
        if (store) {
            store.set(key, value);
        }
    }

    /**
     * Get a value from the current async context
     */
    get<T>(key: string): T | undefined {
        const store = this.storage.getStore();
        return store?.get(key);
    }

    /**
     * Get the current correlation ID
     */
    getCorrelationId(): string | undefined {
        return this.get<string>('correlationId');
    }
}
