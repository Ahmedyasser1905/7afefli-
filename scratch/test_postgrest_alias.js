const https = require('https');

const supabaseUrl = 'https://phfwutugsyiutqgippqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTk1ODYsImV4cCI6MjA5NTU3NTU4Nn0.BjThpoDrhxIg-isCS4tE178jUsXorQZos8G1gFUZb6U';

function testQuery() {
  const url = `${supabaseUrl}/rest/v1/salons?select=*,profiles:owner_id(full_name,phone_number)&order=created_at.desc&limit=2`;
  
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
      try {
        console.log('Result:', JSON.stringify(JSON.parse(data), null, 2));
      } catch (e) {
        console.log('Raw Data:', data);
      }
    });
  });
  
  req.on('error', e => console.error(e));
  req.end();
}

testQuery();
