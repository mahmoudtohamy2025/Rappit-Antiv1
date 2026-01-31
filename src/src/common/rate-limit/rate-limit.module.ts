import { Module, Global } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * Rate Limit Module
 * 
 * SEC-02: Provides rate limiting functionality
 * 
 * This module is global so RateLimitService can be injected anywhere.
 */
@Global()
@Module({
    providers: [RateLimitService, RateLimitGuard, Reflector],
    exports: [RateLimitService, RateLimitGuard, Reflector],
})
export class RateLimitModule { }
