const https = require('https');

const supabaseUrl = 'https://phfwutugsyiutqgippqg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk5OTU4NiwiZXhwIjoyMDk1NTc1NTg2fQ.TZN0y4RHtZqVQ8cqzPV6VM5M0knhIgGZY6ZZmjN7mAw';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTk1ODYsImV4cCI6MjA5NTU3NTU4Nn0.BjThpoDrhxIg-isCS4tE178jUsXorQZos8G1gFUZb6U';

const email = `testuser_${Date.now()}@gmail.com`;
const password = 'TestPassword123!';

function postRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', e => reject(e));
    req.write(JSON.stringify(body));
    req.end();
  });
}

function getRequest(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

async function run() {
  try {
    console.log('--- Registering confirmed user via Admin API ---');
    const signup = await postRequest(`${supabaseUrl}/auth/v1/admin/users`, {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }, {
      email,
      password,
      email_confirm: true
    });
    
    console.log('Admin Signup status:', signup.status);
    if (signup.status >= 300) {
      console.error('Admin Signup failed:', signup.data);
      return;
    }

    console.log('--- Logging in temporary user ---');
    const login = await postRequest(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      'apikey': supabaseKey
    }, { email, password });

    console.log('Login status:', login.status);
    if (login.status >= 300) {
      console.error('Login failed:', login.data);
      return;
    }

    const token = login.data.access_token;
    console.log('Token acquired successfully.');

    console.log('--- Calling production Railway /slots endpoint ---');
    const slotsUrl = 'https://7afefli-production.up.railway.app/api/v1/slots?salonId=5f8d9447-1116-4580-aa12-9852d62873e2&serviceId=1175dd68-9ad7-4817-821e-e1efb2560ebe&date=2026-06-04';
    
    const slots = await getRequest(slotsUrl, {
      'Authorization': `Bearer ${token}`
    });

    console.log('Slots API response status:', slots.status);
    console.log('Slots length:', Array.isArray(slots.data) ? slots.data.length : 'not an array');
    console.log('Slots response:', slots.data);

  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
