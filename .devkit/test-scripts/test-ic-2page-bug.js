const fs = require('fs');
const path = require('path');

// Import the actual service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');

// Create service instance
const service = new EnhancedManuscriptDownloaderService();

// Test URLs that might show the 2-page issue
const TEST_URLS = [
    {
        url: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
        name: 'BNCF B.R.231 (should have 573 pages)'
    },
    {
        url: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI',
        name: 'Laurenziana Plutei 21.29'
    },
    {
        url: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ainternetculturale.sbn.it%3A21%3ABO0049%3ACSTOR020-00013&mode=all&teca=Archiginnasio',
        name: 'Archiginnasio CSTOR020-00013'
    }
];

async function testInternetCulturaleManifest(url, name) {
    console.log('\n' + '='.repeat(60));
    console.log(`Testing: ${name}`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(60));
    
    try {
        // Load manifest using the actual service method
        const manifest = await service.loadInternetCulturaleManifest(url);
        
        console.log('\nManifest loaded successfully:');
        console.log(`- Display name: ${manifest.displayName}`);
        console.log(`- Total pages: ${manifest.totalPages}`);
        console.log(`- Page links count: ${manifest.pageLinks.length}`);
        console.log(`- Library: ${manifest.library}`);
        
        // Check for duplicate URLs
        const uniqueUrls = new Set(manifest.pageLinks);
        console.log(`- Unique URLs: ${uniqueUrls.size}`);
        
        if (uniqueUrls.size < manifest.pageLinks.length) {
            console.log('\n⚠️  DUPLICATE URLS DETECTED!');
            console.log(`Expected ${manifest.pageLinks.length} unique URLs but found only ${uniqueUrls.size}`);
            
            // Find duplicates
            const urlCounts = new Map();
            manifest.pageLinks.forEach(url => {
                const count = urlCounts.get(url) || 0;
                urlCounts.set(url, count + 1);
            });
            
            urlCounts.forEach((count, url) => {
                if (count > 1) {
                    console.log(`\nDuplicate URL (appears ${count} times):`);
                    console.log(url);
                }
            });
        }
        
        // Show first few URLs
        console.log('\nFirst 5 page URLs:');
        manifest.pageLinks.slice(0, 5).forEach((url, i) => {
            console.log(`${i + 1}: ${url}`);
        });
        
        // Check if only 2 pages
        if (manifest.totalPages === 2 && name.includes('should have')) {
            console.log('\n❌ BUG REPRODUCED: Only 2 pages loaded when more expected!');
        } else if (manifest.totalPages < 10) {
            console.log('\n⚠️  WARNING: Very few pages loaded (' + manifest.totalPages + ')');
        } else {
            console.log('\n✓ Manifest loaded with expected number of pages');
        }
        
        return manifest;
        
    } catch (error) {
        console.error('\n❌ Error loading manifest:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        return null;
    }
}

async function runTests() {
    console.log('Testing Internet Culturale manifest loading...');
    console.log('Looking for cases where only 2 pages are loaded instead of full manuscript');
    
    // First build the service
    console.log('\nBuilding service...');
    try {
        const { execSync } = require('child_process');
        execSync('npm run build:main', { stdio: 'inherit' });
    } catch (error) {
        console.error('Build failed:', error.message);
        return;
    }
    
    // Test each URL
    const results = [];
    for (const { url, name } of TEST_URLS) {
        const manifest = await testInternetCulturaleManifest(url, name);
        if (manifest) {
            results.push({
                name,
                totalPages: manifest.totalPages,
                uniqueUrls: new Set(manifest.pageLinks).size,
                hasDuplicates: new Set(manifest.pageLinks).size < manifest.pageLinks.length
            });
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    results.forEach(result => {
        const status = result.totalPages === 2 ? '❌' : 
                      result.totalPages < 10 ? '⚠️' : '✓';
        console.log(`${status} ${result.name}: ${result.totalPages} pages${result.hasDuplicates ? ' (has duplicates)' : ''}`);
    });
    
    const hasIssue = results.some(r => r.totalPages === 2);
    if (hasIssue) {
        console.log('\n❌ ISSUE CONFIRMED: Some manuscripts only load 2 pages!');
    } else {
        console.log('\n✓ All manuscripts loaded with expected page counts');
    }
}

// Run tests
runTests().catch(console.error);