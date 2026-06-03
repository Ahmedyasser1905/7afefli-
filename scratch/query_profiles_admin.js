const https = require('https');

const supabaseUrl = 'https://phfwutugsyiutqgippqg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk5OTU4NiwiZXhwIjoyMDk1NTc1NTg2fQ.TZN0y4RHtZqVQ8cqzPV6VM5M0knhIgGZY6ZZmjN7mAw';

function fetchProfilesAdmin() {
  const url = `${supabaseUrl}/rest/v1/profiles?select=id,full_name,role,phone_number`;
  
  const req = https.request(url, {
    method: 'GET',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      try {
        console.log('Profiles:', JSON.stringify(JSON.parse(data), null, 2));
      } catch (e) {
        console.log('Raw Data:', data);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('Error:', e);
  });
  
  req.end();
}

fetchProfilesAdmin();
