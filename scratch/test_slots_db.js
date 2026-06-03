const https = require('https');

const supabaseUrl = 'https://phfwutugsyiutqgippqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTk1ODYsImV4cCI6MjA5NTU3NTU4Nn0.BjThpoDrhxIg-isCS4tE178jUsXorQZos8G1gFUZb6U';

const salonId = '5f8d9447-1116-4580-aa12-9852d62873e2';
const serviceId = '1175dd68-9ad7-4817-821e-e1efb2560ebe';
const date = '2026-06-03';

function requestSupabase(path) {
  return new Promise((resolve, reject) => {
    const url = `${supabaseUrl}/rest/v1/${path}`;
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

async function run() {
  try {
    console.log('--- Fetching Service duration ---');
    const service = await requestSupabase(`services?id=eq.${serviceId}&salon_id=eq.${salonId}&select=duration_minutes`);
    console.log('Service:', service);

    console.log('--- Fetching Salon open/close time ---');
    const salon = await requestSupabase(`salons?id=eq.${salonId}&select=open_time,close_time,working_days`);
    console.log('Salon:', salon);

    console.log('--- Fetching Booked Reservations ---');
    const reservations = await requestSupabase(`reservations?salon_id=eq.${salonId}&appointment_date=eq.${date}&status=in.("Pending","Confirmed")&select=start_time,end_time`);
    console.log('Reservations:', reservations);

  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
