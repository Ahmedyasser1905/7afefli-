const https = require('https');

const supabaseUrl = 'https://phfwutugsyiutqgippqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTk1ODYsImV4cCI6MjA5NTU3NTU4Nn0.BjThpoDrhxIg-isCS4tE178jUsXorQZos8G1gFUZb6U';

function fetchSalonDetails() {
  const url = `${supabaseUrl}/rest/v1/salons?select=id,name,open_time,close_time,working_days,is_approved,force_closed`;
  
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
      console.log('Status Code:', res.statusCode);
      console.log('Salons:', JSON.stringify(JSON.parse(data), null, 2));
    });
  });
  
  req.on('error', (e) => {
    console.error('Error fetching salons:', e);
  });
  
  req.end();
}

fetchSalonDetails();
