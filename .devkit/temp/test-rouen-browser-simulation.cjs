#!/usr/bin/env node

const https = require('https');
const { execSync } = require('child_process');

// Test if images work with a full browser simulation
async function testWithCurl() {
  console.log('Testing Rouen library image access with different methods...\n');

  const testUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.highres';
  const viewerUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom';

  // Test 1: Basic curl
  console.log('🔍 Test 1: Basic curl request');
  try {
    const result1 = execSync(`curl -I -L "${testUrl}" 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    console.log(result1.includes('200') ? '✅ Basic curl works' : '❌ Basic curl failed');
  } catch (e) {
    console.log('❌ Basic curl failed');
  }

  // Test 2: With User-Agent
  console.log('\n🔍 Test 2: With User-Agent');
  try {
    const result2 = execSync(`curl -I -L -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${testUrl}" 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    console.log(result2.includes('200') ? '✅ User-Agent works' : '❌ User-Agent failed');
  } catch (e) {
    console.log('❌ User-Agent failed');
  }

  // Test 3: With Referer
  console.log('\n🔍 Test 3: With Referer header');
  try {
    const result3 = execSync(`curl -I -L -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${testUrl}" 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    console.log(result3.includes('200') ? '✅ Referer works' : '❌ Referer failed');
    if (result3.includes('200')) {
      console.log('Full response:', result3);
    }
  } catch (e) {
    console.log('❌ Referer failed');
  }

  // Test 4: With session simulation
  console.log('\n🔍 Test 4: With session cookie simulation');
  try {
    // First get the main page to establish session
    const sessionResult = execSync(`curl -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -L -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${viewerUrl}" >/dev/null 2>&1; curl -I -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${testUrl}" 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    console.log(sessionResult.includes('200') ? '✅ Session simulation works' : '❌ Session simulation failed');
    if (sessionResult.includes('200')) {
      console.log('Response headers:', sessionResult);
    }
  } catch (e) {
    console.log('❌ Session simulation failed');
  }

  // Test 5: Try different resolution
  console.log('\n🔍 Test 5: Testing medium resolution');
  const medresUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.medres';
  try {
    const result5 = execSync(`curl -I -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${medresUrl}" 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    console.log(result5.includes('200') ? '✅ Medium resolution works' : '❌ Medium resolution failed');
  } catch (e) {
    console.log('❌ Medium resolution failed');
  }

  // Test 6: Check if we need to download actual image
  console.log('\n🔍 Test 6: Try downloading actual image');
  try {
    const downloadResult = execSync(`curl -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${testUrl}" -o /tmp/rouen_test.jpg -w "%{http_code},%{size_download}" 2>/dev/null || echo "FAILED"`, { encoding: 'utf8' });
    
    if (downloadResult.includes('200')) {
      console.log('✅ Image download successful');
      console.log('Download info:', downloadResult);
      
      // Check file size
      try {
        const fileInfo = execSync('ls -la /tmp/rouen_test.jpg 2>/dev/null || echo "No file"', { encoding: 'utf8' });
        console.log('File info:', fileInfo.trim());
      } catch (e) {
        console.log('❌ File not created');
      }
    } else {
      console.log('❌ Image download failed');
    }
  } catch (e) {
    console.log('❌ Image download failed');
  }

  // Test alternative URL patterns
  console.log('\n🔍 Test 7: Testing alternative URL patterns');
  const altUrls = [
    'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1',
    'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.jpg',
    'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.image',
    'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1/full/max/0/default.jpg'
  ];

  for (const altUrl of altUrls) {
    try {
      const altResult = execSync(`curl -I -c /tmp/rouen_cookies.txt -b /tmp/rouen_cookies.txt -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Referer: ${viewerUrl}" "${altUrl}" 2>/dev/null | head -1 || echo "FAILED"`, { encoding: 'utf8' });
      console.log(`${altUrl}: ${altResult.includes('200') ? '✅' : '❌'} ${altResult.trim()}`);
    } catch (e) {
      console.log(`${altUrl}: ❌ Failed`);
    }
  }
}

testWithCurl().catch(console.error);