#!/usr/bin/env node

/**
 * Apply enhanced BDL fix with better error handling and retry logic
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');

console.log('🔧 Applying enhanced BDL fix...');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Enhance the error handling section
    const oldErrorHandling = `            } catch (fetchError: any) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('BDL API request timed out. The server may be experiencing high load.');
                }
                throw fetchError;`;

    const newErrorHandling = `            } catch (fetchError: any) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('BDL API request timed out. The BDL server (bdl.servizirl.it) may be experiencing high load or temporary connectivity issues. Please try again later.');
                }
                if (fetchError.message?.includes('fetch failed')) {
                    throw new Error('BDL server is currently unreachable. The BDL service (bdl.servizirl.it) may be temporarily down. Please check your internet connection and try again later.');
                }
                if (fetchError.message?.includes('HTTP 5')) {
                    throw new Error('BDL server is experiencing internal errors. Please try again in a few minutes.');
                }
                throw fetchError;`;

    // 2. Reduce timeout to be more responsive
    const oldTimeout = `{ initialTimeout: 45000, maxTimeout: 120000 }`;
    const newTimeout = `{ initialTimeout: 30000, maxTimeout: 90000 }`;

    // Apply fixes
    let changes = 0;
    
    if (content.includes(oldErrorHandling)) {
        content = content.replace(oldErrorHandling, newErrorHandling);
        console.log('✅ Enhanced error handling applied');
        changes++;
    } else {
        console.log('⚠️ Could not find exact error handling pattern to replace');
    }
    
    if (content.includes(oldTimeout)) {
        content = content.replace(oldTimeout, newTimeout);
        console.log('✅ Reduced timeout for faster feedback');
        changes++;
    } else {
        console.log('⚠️ Could not find timeout configuration to update');
    }
    
    if (changes > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Applied ${changes} enhancements to BDL implementation`);
    } else {
        console.log('⚠️ No changes applied - file may already be updated');
    }
    
} catch (error) {
    console.error('❌ Error applying BDL fix:', error.message);
    process.exit(1);
}

console.log('\n🎯 Enhanced BDL fix complete!');
console.log('📋 Improvements:');
console.log('  - Better error messages for server connectivity issues');
console.log('  - Faster timeout for more responsive feedback');
console.log('  - Clearer guidance for users when BDL server is down');