import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get current organization ID from authenticated user
 * Usage: @CurrentOrganization() organizationId: string
 * Alias: @OrganizationId() organizationId: string
 */
export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.organizationId;
  },
);

// Alias for compatibility
export const OrganizationId = CurrentOrganization;
