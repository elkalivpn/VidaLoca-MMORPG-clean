import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  username?: string;
  role?: UserRole;
  isGuest?: boolean;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}
