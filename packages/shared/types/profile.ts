// packages/shared/types/profile.ts

export type UserRole = 'Client' | 'Coiffeur' | 'Admin';

export interface Profile {
  id: string;
  full_name: string;
  phone_number: string | null;
  role: UserRole;
  avatar_url: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}
