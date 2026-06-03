const https = require('https');

// Test 1: Check if the new slots endpoint returns data (no auth = 401, but lets us see if route exists)
const req1 = https.request({
  hostname: '7afefli-production.up.railway.app',
  path: '/api/v1/slots?salonId=5f8d9447-1116-4580-aa12-9852d62873e2&serviceId=1175dd68-9ad7-4817-821e-e1efb2560ebe&date=2026-06-03',
  method: 'GET',
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('=== Slots endpoint status:', res.statusCode);
    console.log('Body:', d.substring(0, 300));
  });
});
req1.on('error', e => console.error('slots error:', e.message));
req1.end();

// Test 2: Check if profile endpoint exists
const req2 = https.request({
  hostname: '7afefli-production.up.railway.app',
  path: '/api/v1/auth/profiles/me',
  method: 'GET',
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('=== Profile endpoint status:', res.statusCode);
    console.log('Body:', d.substring(0, 200));
  });
});
req2.on('error', e => console.error('profile error:', e.message));
req2.end();
