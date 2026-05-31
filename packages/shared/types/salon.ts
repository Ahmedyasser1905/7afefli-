// packages/shared/types/salon.ts

export type SubscriptionStatus = 'Trial' | 'Active' | 'Expired';

export interface Salon {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  wilaya: string;
  address: string;
  latitude: number;
  longitude: number;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  is_approved: boolean;
  is_sponsored: boolean;
  sponsored_until: string | null;
  open_time: string;   // "09:00"
  close_time: string;  // "21:00"
  working_days: number[];
  average_rating: number;
  total_reviews: number;
  force_closed: boolean;
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
  profile_id: string;
  role: string;
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
  created_at: string;
  // Joined
  profiles?: { full_name: string; avatar_url: string | null };
}
