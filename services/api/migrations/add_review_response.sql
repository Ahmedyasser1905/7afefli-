-- Migration: Add review_response column if it doesn't exist
-- Used by barbers to reply to client reviews

ALTER TABLE reviews 
  ADD COLUMN IF NOT EXISTS owner_response TEXT,
  ADD COLUMN IF NOT EXISTS owner_response_at TIMESTAMPTZ;

-- Index for quick lookup of unanswered reviews
CREATE INDEX IF NOT EXISTS idx_reviews_no_response 
  ON reviews(salon_id, created_at DESC) 
  WHERE owner_response IS NULL;
