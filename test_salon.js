const http = require('http');

http.get('http://localhost:3000/api/v1/salons/5f8d9447-1116-4580-aa12-9852d62873e2', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data); });
}).on('error', (err) => {
  console.error(err);
});
