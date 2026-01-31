/**
 * Security Module
 * 
 * Provides security services for OAuth callbacks and general security measures.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OAuthCallbackSecurityService } from './oauth-callback-security.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [OAuthCallbackSecurityService],
    exports: [OAuthCallbackSecurityService],
})
export class SecurityModule { }
