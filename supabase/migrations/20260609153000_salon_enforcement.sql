-- Add commune and phone columns to salons table
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS commune TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update existing salons with placeholder data so they aren't immediately blocked if they existed
UPDATE public.salons SET commune = 'Alger Centre' WHERE commune IS NULL;
UPDATE public.salons SET phone = '0550000000' WHERE phone IS NULL;
