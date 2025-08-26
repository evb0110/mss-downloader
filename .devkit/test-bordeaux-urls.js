// Test script to check actual Bordeaux URL patterns
const https = require('https');

const testUrls = [
  // Current failing patterns
  'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0001',
  'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0001.xml',
  'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0001.dzi',
  
  // Possible alternatives
  'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0001_files/14/0_0.jpg',
  'https://selene.bordeaux.fr/thumb/1024/330636101_MS_0778/330636101_MS_0778_0001.jpg',
  'https://selene.bordeaux.fr/thumb/full/330636101_MS_0778/330636101_MS_0778_0001.jpg',
  'https://selene.bordeaux.fr/viewer/330636101_MS_0778/330636101_MS_0778_0001.jpg'
];

async function testUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      console.log(`${res.statusCode} - ${url}`);
      resolve(res.statusCode);
    });
    
    req.on('error', (err) => {
      console.log(`ERR - ${url} - ${err.message}`);
      resolve('ERR');
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`TIMEOUT - ${url}`);
      resolve('TIMEOUT');
    });
    
    req.end();
  });
}

async function testAll() {
  console.log('Testing Bordeaux URL patterns...');
  for (const url of testUrls) {
    await testUrl(url);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
}

testAll();