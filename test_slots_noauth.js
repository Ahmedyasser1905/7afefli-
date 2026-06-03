const http = require('http');

const url = 'http://localhost:3000/api/v1/slots?salonId=5f8d9447-1116-4580-aa12-9852d62873e2&serviceId=1175dd68-9ad7-4817-821e-e1efb2560ebe&date=2026-06-03';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/slots?salonId=5f8d9447-1116-4580-aa12-9852d62873e2&serviceId=1175dd68-9ad7-4817-821e-e1efb2560ebe&date=2026-06-03',
  method: 'GET',
  headers: {
    // We need a real token - let's check the server response without auth first
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data.substring(0, 500));
  });
});
req.on('error', (err) => console.error(err));
req.end();
