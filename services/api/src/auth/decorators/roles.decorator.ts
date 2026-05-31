// services/api/src/auth/decorators/roles.decorator.ts
// Decorator to specify required roles for a route

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict route access to specific roles.
 * Must be used together with SupabaseAuthGuard and RolesGuard.
 * 
 * Usage:
 * ```
 * @Roles('Coiffeur')
 * @UseGuards(SupabaseAuthGuard, RolesGuard)
 * @Post()
 * createSalon() { ... }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
