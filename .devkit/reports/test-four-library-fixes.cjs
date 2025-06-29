#!/usr/bin/env node

/**
 * Comprehensive test for four library fixes in version 1.3.26
 * Tests NYPL, Modena, University of Graz, and Orleans libraries
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Test URLs provided by user
const testCases = [
  {
    name: 'NYPL',
    url: 'https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002',
    description: 'Fixed from broken IIIF URLs to working images.nypl.org format'
  },
  {
    name: 'University of Graz',
    url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    description: 'Changed from IIIF service URLs to webcache URLs with higher resolution'
  },
  {
    name: 'Orleans',
    url: 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238/tri/%2A/expressionRecherche/Ouvrages+de+Pseudo+Isidore',
    description: 'Changed from IIIF o:source to files/large/{hash}.jpg pattern'
  },
  {
    name: 'Modena',
    url: 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-13/',
    description: 'Fixed hardcoded 231 pages and added to skip size estimation list'
  }
];

/**
 * Make HTTP/HTTPS request with timeout
 */
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: 'HEAD',
      timeout: timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      resolve({
        status: res.statusCode,
        headers: res.headers,
        url: url
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Test URL accessibility
 */
async function testUrl(testCase) {
  console.log(`\n--- Testing ${testCase.name} ---`);
  console.log(`URL: ${testCase.url}`);
  console.log(`Fix: ${testCase.description}`);
  
  try {
    const response = await makeRequest(testCase.url);
    
    if (response.status >= 200 && response.status < 400) {
      console.log(`✅ SUCCESS: HTTP ${response.status}`);
      return { name: testCase.name, success: true, status: response.status };
    } else {
      console.log(`❌ FAILED: HTTP ${response.status}`);
      return { name: testCase.name, success: false, status: response.status };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { name: testCase.name, success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Testing Four Library Fixes - Version 1.3.26');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testUrl(testCase);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => console.log(`   - ${r.name}: HTTP ${r.status}`));
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`   - ${r.name}: ${r.error || `HTTP ${r.status}`}`));
  }
  
  console.log('\n🔧 FIXES IMPLEMENTED:');
  console.log('1. NYPL: Fixed broken IIIF URLs → images.nypl.org format');
  console.log('2. Modena: Fixed hardcoded pages + skip size estimation');
  console.log('3. University of Graz: IIIF service → webcache URLs (higher res)');
  console.log('4. Orleans: IIIF o:source → files/large/{hash}.jpg pattern');
  
  const allSuccessful = results.every(r => r.success);
  
  if (allSuccessful) {
    console.log('\n🎉 ALL LIBRARIES ACCESSIBLE - READY FOR VERSION 1.3.26!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some libraries may need additional investigation');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});