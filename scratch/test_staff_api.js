const https = require('https');

const salonId = '5f8d9447-1116-4580-aa12-9852d62873e2';

function getRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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
    const url = `https://7afefli-production.up.railway.app/api/v1/salons/${salonId}/staff`;
    console.log('Fetching staff from production:', url);
    const res = await getRequest(url);
    console.log('Status:', res.status);
    console.log('Response:', res.data);
  } catch (err) {
    console.error(err);
  }
}

run();
