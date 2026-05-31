const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://phfwutugsyiutqgippqg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTk1ODYsImV4cCI6MjA5NTU3NTU4Nn0.BjThpoDrhxIg-isCS4tE178jUsXorQZos8G1gFUZb6U'
);

async function run() {
  const query = `
    INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true) ON CONFLICT DO NOTHING;

    CREATE TABLE IF NOT EXISTS portfolio_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
      uploader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      caption TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
      client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
