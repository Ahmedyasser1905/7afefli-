// packages/shared/types/salon.ts

export type SubscriptionStatus = 'Trial' | 'Active' | 'Expired';

export interface Salon {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  wilaya: string;
  commune: string | null;  // fix H5: was missing from type
  address: string;
  phone: string | null;    // fix H5: was missing from type
  latitude: number;
  longitude: number;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  is_approved: boolean;
  is_sponsored: boolean;
  sponsored_until: string | null;
  is_featured?: boolean;
  has_premium_badge?: boolean;
  marketing_included?: boolean;
  priority_support?: boolean;
  open_time: string;   // "09:00"
  close_time: string;  // "21:00"
  working_days: number[];
  average_rating: number;
  total_reviews: number;
  /** @deprecated use is_manually_closed instead — column dropped in migration 20260609180000 */
  force_closed?: boolean;
  is_manually_closed: boolean;  // fix M6: force_closed was dropped in DB, this is the live column
  is_open_24h?: boolean;
  is_currently_open?: boolean;
  status_label?: 'open' | 'closed' | 'open_24h' | 'manually_closed';
  created_at: string;
  updated_at: string;
  image_url: string | null;
  // Joined fields (optional)
  profiles?: { full_name: string; phone_number: string | null };
  services?: Service[];
  distance_km?: number;
}

export interface Service {
  id: string;
  salon_id: string;
  service_name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalonStaff {
  id: string;
  salon_id: string;
  profile_id: string | null;
  role: string;
  custom_name: string | null;
  avatar_url: string | null;
  created_at: string;
  // Joined
  profiles?: { full_name: string; avatar_url: string | null };
}

export interface PortfolioPhoto {
  id: string;
  salon_id: string;
  uploader_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  url?: string; // Generated public URL
}

export interface Review {
  id: string;
  reservation_id: string;
  client_id: string;
  salon_id: string;
  rating: number;
  comment: string | null;
  response: string | null;
  response_date: string | null;
  created_at: string;
  // Joined
  profiles?: { full_name: string; avatar_url: string | null };
}
