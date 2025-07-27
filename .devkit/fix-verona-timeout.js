const fs = require('fs');
const path = require('path');

// Fix for Verona timeout issues
const sharedManifestLoadersPath = path.join(__dirname, '../src/shared/SharedManifestLoaders.js');

console.log('Fixing Verona timeout issues...\n');

// Read the file
let content = fs.readFileSync(sharedManifestLoadersPath, 'utf8');

// Fix 1: Increase timeout for Verona to 120 seconds
const timeoutPattern = /requestOptions\.timeout = 60000; \/\/ 60 seconds for Verona/;
if (content.match(timeoutPattern)) {
    content = content.replace(timeoutPattern, 
        'requestOptions.timeout = 120000; // 120 seconds for Verona (increased for reliability)');
    console.log('✓ Increased Verona timeout to 120 seconds');
} else {
    console.log('⚠️  Timeout pattern not found');
}

// Fix 2: Add better error handling for ETIMEDOUT
const errorHandlerPattern = /req\.on\('error', reject\);/g;
const enhancedErrorHandler = `req.on('error', (error) => {
                if (error.code === 'ETIMEDOUT' && (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it'))) {
                    reject(new Error('Verona server connection timeout (ETIMEDOUT). The server may be experiencing high load. Please try again in a few moments.'));
                } else {
                    reject(error);
                }
            });`;

content = content.replace(errorHandlerPattern, enhancedErrorHandler);
console.log('✓ Added enhanced error handling for ETIMEDOUT');

// Fix 3: Add connection pooling for Verona
const httpsRequirePattern = /const https = eval\("require\('https'\)"\);/;
if (content.match(httpsRequirePattern)) {
    const httpsWithAgent = `const https = eval("require('https')");
        
        // Connection pooling agent for Verona to handle connection issues
        const veronaAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 5,
            maxFreeSockets: 2,
            timeout: 120000
        });`;
    
    content = content.replace(httpsRequirePattern, httpsWithAgent);
    console.log('✓ Added connection pooling for Verona');
    
    // Also update the request to use the agent
    const requestOptionsPattern = /if \(url\.includes\('nuovabibliotecamanoscritta\.it'\) \|\| url\.includes\('nbm\.regione\.veneto\.it'\)\) \{\s*requestOptions\.timeout = \d+;[^}]*\}/;
    
    const updatedOptions = `if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
                requestOptions.timeout = 120000; // 120 seconds for Verona (increased for reliability)
                requestOptions.agent = veronaAgent; // Use connection pooling
            }`;
    
    content = content.replace(requestOptionsPattern, updatedOptions);
    console.log('✓ Updated request options to use agent');
}

// Fix 4: Add progress monitoring for long requests
const fetchVeronaPattern = /async fetchVeronaIIIFManifest\(manifestUrl\) \{/;
if (content.match(fetchVeronaPattern)) {
    const enhancedFetch = `async fetchVeronaIIIFManifest(manifestUrl) {
        console.log('[Verona] Fetching IIIF manifest from:', manifestUrl);
        
        // Add timeout monitoring
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Verona manifest fetch timeout after 2 minutes')), 120000);
        });
        
        try {
            const response = await Promise.race([
                this.fetchWithRetry(manifestUrl),
                timeoutPromise
            ]);`;
    
    content = content.replace(fetchVeronaPattern, enhancedFetch);
    console.log('✓ Added timeout monitoring for manifest fetch');
    
    // Also need to close the try block properly
    const oldTryBlock = /const response = await this\.fetchWithRetry\(manifestUrl\);/;
    if (!content.match(oldTryBlock)) {
        // Find the closing of the function and add the catch block
        const functionEndPattern = /(\s+)return \{ images \};\s*\}/;
        const enhancedEnd = `$1return { images };
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.error('[Verona] Manifest fetch timed out');
                throw new Error('Verona server is not responding. Please try again later.');
            }
            throw error;
        }
    }`;
        content = content.replace(functionEndPattern, enhancedEnd);
    }
}

// Write the fixed file
fs.writeFileSync(sharedManifestLoadersPath, content);

console.log('\n✅ Verona timeout fixes applied successfully!');
console.log('\nChanges made:');
console.log('1. Increased timeout from 60s to 120s');
console.log('2. Enhanced ETIMEDOUT error messages');
console.log('3. Added connection pooling for better reliability');
console.log('4. Added timeout monitoring for manifest fetches');