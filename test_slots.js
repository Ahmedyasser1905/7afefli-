const http = require('http');

const url = 'http://localhost:3000/api/v1/slots?salonId=5f8d9447-1116-4580-aa12-9852d62873e2&serviceId=1175dd68-9ad7-4817-821e-e1efb2560ebe&date=2026-06-03';

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data); });
}).on('error', (err) => {
  console.error(err);
});
