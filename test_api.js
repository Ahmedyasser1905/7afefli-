const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/slots?salonId=11111111-1111-1111-1111-111111111111&serviceId=22222222-2222-2222-2222-222222222222&date=2026-06-03',
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
