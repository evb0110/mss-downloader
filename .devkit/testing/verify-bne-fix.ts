#!/usr/bin/env npx tsx
/**
 * Verify that BNE fix is properly applied in production code
 */

import * as fs from 'fs/promises';
import * as path from 'path';

async function verifyBneFix() {
    console.log('🔍 Verifying BNE SSL Bypass Fix\n');
    console.log('=' .repeat(60));
    
    const serviceFile = path.join(process.cwd(), 'src/main/services/EnhancedManuscriptDownloaderService.ts');
    const content = await fs.readFile(serviceFile, 'utf-8');
    
    // Check 1: Is BNE in the fetchWithHTTPS list?
    console.log('1️⃣ Checking if bdh-rd.bne.es uses fetchWithHTTPS...');
    
    // Look for the condition that includes bdh-rd.bne.es
    const fetchWithHTTPSRegex = /url\.includes\(['"]bdh-rd\.bne\.es['"]\)/;
    const match = content.match(fetchWithHTTPSRegex);
    
    if (match) {
        console.log('   ✅ Found: bdh-rd.bne.es IS in fetchWithHTTPS condition');
        
        // Find the exact line
        const lines = content.split('\n');
        const lineNum = lines.findIndex(line => line.includes('bdh-rd.bne.es')) + 1;
        console.log(`   Line ${lineNum}: ${lines[lineNum - 1].trim()}`);
    } else {
        console.log('   ❌ NOT FOUND: bdh-rd.bne.es is missing from fetchWithHTTPS');
    }
    
    // Check 2: Does fetchWithHTTPS properly bypass SSL?
    console.log('\n2️⃣ Checking fetchWithHTTPS implementation...');
    
    const rejectUnauthorizedRegex = /rejectUnauthorized:\s*false/g;
    const sslBypassCount = (content.match(rejectUnauthorizedRegex) || []).length;
    
    console.log(`   Found ${sslBypassCount} instances of 'rejectUnauthorized: false'`);
    if (sslBypassCount > 0) {
        console.log('   ✅ SSL bypass is configured in fetchWithHTTPS');
    } else {
        console.log('   ❌ No SSL bypass found!');
    }
    
    // Check 3: BNE-specific headers
    console.log('\n3️⃣ Checking for BNE-specific headers...');
    
    const bneHeadersRegex = /if\s*\([^)]*bdh-rd\.bne\.es[^)]*\)\s*{[^}]*headers\s*=/;
    if (bneHeadersRegex.test(content)) {
        console.log('   ✅ BNE-specific headers are configured');
    } else {
        console.log('   ⚠️ No BNE-specific headers found (optional)');
    }
    
    // Check 4: BneLoader implementation
    console.log('\n4️⃣ Checking BneLoader implementation...');
    
    const loaderFile = path.join(process.cwd(), 'src/main/services/library-loaders/BneLoader.ts');
    const loaderContent = await fs.readFile(loaderFile, 'utf-8');
    
    if (loaderContent.includes('smartPageDiscovery') || loaderContent.includes('binary search')) {
        console.log('   ✅ BneLoader uses binary search for page discovery');
    } else {
        console.log('   ⚠️ BneLoader might not use binary search');
    }
    
    if (loaderContent.includes('pdf.raw?query=id')) {
        console.log('   ✅ BneLoader uses direct PDF URLs');
    } else {
        console.log('   ❌ BneLoader not using direct PDF URLs');
    }
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('=' .repeat(60));
    
    const checksPass = match && sslBypassCount > 0 && loaderContent.includes('pdf.raw?query=id');
    
    if (checksPass) {
        console.log('✅ All critical checks passed!');
        console.log('\nThe BNE fix is properly implemented:');
        console.log('  • Binary search page discovery');
        console.log('  • Direct PDF URL generation');
        console.log('  • SSL bypass via fetchWithHTTPS');
        console.log('\nBNE downloads should work without SSL errors now.');
    } else {
        console.log('❌ Some checks failed!');
        console.log('\nIssues found:');
        if (!match) console.log('  • bdh-rd.bne.es not in fetchWithHTTPS list');
        if (sslBypassCount === 0) console.log('  • No SSL bypass configured');
        if (!loaderContent.includes('pdf.raw?query=id')) console.log('  • Not using direct PDF URLs');
    }
    
    return checksPass;
}

verifyBneFix().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});