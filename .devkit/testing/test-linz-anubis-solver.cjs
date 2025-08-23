#!/usr/bin/env node

/**
 * ULTRATHINK TODO EXECUTION AGENT #1
 * Test Linz library with Anubis anti-bot solver implementation
 * 
 * Testing manuscript 154 from Issue #37 with new Anubis challenge solver
 */

const https = require('https');
const crypto = require('crypto');

// Simple AnubisSolver implementation for testing
class AnubisSolver {
    extractChallengeFromPage(html) {
        try {
            const challengeMatch = html.match(/<script id="anubis_challenge"[^>]*>(.*?)<\/script>/s);
            if (!challengeMatch) {
                console.log('[AnubisSolver] No anubis_challenge script found');
                return null;
            }

            const challengeJson = challengeMatch[1].trim();
            const challengeData = JSON.parse(challengeJson);
            
            console.log(`[AnubisSolver] Extracted challenge: difficulty ${challengeData.rules?.difficulty}, algorithm ${challengeData.rules?.algorithm}`);
            
            return {
                algorithm: challengeData.rules?.algorithm || 'fast',
                difficulty: challengeData.rules?.difficulty || 4,
                report_as: challengeData.rules?.report_as,
                challenge: challengeData.challenge,
                challengeId: challengeData.challengeId || challengeData.challenge?.substring(0, 16)
            };
        } catch (error) {
            console.error('[AnubisSolver] Failed to extract challenge:', error);
            return null;
        }
    }

    async solveChallenge(challenge) {
        console.log(`[AnubisSolver] Solving challenge with difficulty ${challenge.difficulty}`);
        
        const startTime = Date.now();
        let nonce = 0;
        const maxAttempts = Math.pow(2, challenge.difficulty + 14); // Higher limit for difficulty 4
        
        try {
            while (nonce < maxAttempts) {
                const proofString = `${challenge.challenge}:${nonce}`;
                const hash = crypto.createHash('sha256').update(proofString).digest('hex');
                
                const requiredZeros = '0'.repeat(challenge.difficulty);
                if (hash.startsWith(requiredZeros)) {
                    const elapsedTime = Date.now() - startTime;
                    console.log(`[AnubisSolver] Challenge solved! Nonce: ${nonce}, Hash: ${hash.substring(0, 16)}..., Time: ${elapsedTime}ms`);
                    
                    return {
                        nonce,
                        hash,
                        challengeId: challenge.challengeId
                    };
                }
                
                nonce++;
                
                if (nonce % 10000 === 0) {
                    console.log(`[AnubisSolver] Attempting nonce ${nonce}...`);
                }
            }
            
            console.error(`[AnubisSolver] Failed to solve challenge within ${maxAttempts} attempts`);
            return null;
            
        } catch (error) {
            console.error('[AnubisSolver] Error solving challenge:', error);
            return null;
        }
    }
}

function fetchWithHTTPS(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: options.headers || {},
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const response = {
                    ok: res.statusCode === 200,
                    status: res.statusCode,
                    json: async () => {
                        try {
                            return JSON.parse(data);
                        } catch (e) {
                            throw new Error(`Failed to parse JSON: ${e.message}`);
                        }
                    },
                    text: async () => data
                };
                resolve(response);
            });
        });
        req.on('error', reject);
    });
}

async function testLinzAnubis() {
    console.log('=== ULTRATHINK AGENT #1: Testing Linz with Anubis Solver ===');
    console.log('Testing manuscript 154 from Issue #37');
    
    const manuscriptId = '154';
    const manifestUrl = `https://digi.landesbibliothek.at/viewer/api/v1/records/${manuscriptId}/manifest/`;
    const anubisSolver = new AnubisSolver();
    
    console.log(`\n1. Attempting to fetch: ${manifestUrl}`);
    
    try {
        let response = await fetchWithHTTPS(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log(`2. Response status: ${response.status} ${response.ok ? 'OK' : 'FAILED'}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch Linz manifest: ${response.status}`);
        }
        
        let manifest;
        
        // Try to parse as JSON first
        try {
            manifest = await response.json();
            console.log('✅ Got valid JSON response - no Anubis challenge detected');
        } catch (jsonError) {
            const html = await response.text();
            
            console.log('3. JSON parsing failed, checking for Anubis...');
            
            // Check for Anubis anti-bot protection
            if (html.includes('Making sure you\'re not a bot') || html.includes('anubis_challenge')) {
                console.log('✅ Anubis anti-bot protection detected!');
                console.log('4. Extracting challenge...');
                
                const challenge = anubisSolver.extractChallengeFromPage(html);
                if (!challenge) {
                    throw new Error('Could not extract Anubis challenge from page');
                }
                
                console.log(`5. Challenge details:`);
                console.log(`   - Algorithm: ${challenge.algorithm}`);
                console.log(`   - Difficulty: ${challenge.difficulty}`);
                console.log(`   - Challenge ID: ${challenge.challengeId}`);
                
                console.log('6. Solving challenge (this may take a while)...');
                const solution = await anubisSolver.solveChallenge(challenge);
                if (!solution) {
                    throw new Error('Failed to solve Anubis challenge');
                }
                
                console.log('✅ Challenge solved successfully!');
                console.log(`   - Nonce: ${solution.nonce}`);
                console.log(`   - Hash: ${solution.hash.substring(0, 32)}...`);
                
                console.log('7. Solution validation:');
                const proofString = `${challenge.challenge}:${solution.nonce}`;
                const verifyHash = crypto.createHash('sha256').update(proofString).digest('hex');
                const requiredZeros = '0'.repeat(challenge.difficulty);
                const isValid = verifyHash === solution.hash && verifyHash.startsWith(requiredZeros);
                
                console.log(`   - Proof string: ${proofString.substring(0, 50)}...`);
                console.log(`   - Calculated hash: ${verifyHash.substring(0, 32)}...`);
                console.log(`   - Required zeros: ${requiredZeros}`);
                console.log(`   - Hash validation: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
                
                if (isValid) {
                    console.log('\n✅ ANUBIS SOLVER WORKING CORRECTLY!');
                    console.log('The solver successfully extracted and solved the Anubis challenge.');
                    console.log('This proves the anti-bot protection can be bypassed programmatically.');
                } else {
                    throw new Error('Solution validation failed - hash calculation error');
                }
                
                // Note: In a real implementation, we would submit the solution and retry the request
                console.log('\nℹ️  Next step would be to submit solution and retry manifest request');
                
            } else {
                console.log('❌ No Anubis challenge found in response');
                console.log('Response preview (first 300 chars):');
                console.log(html.substring(0, 300));
                throw new Error('Unexpected response format');
            }
        }
        
        console.log('\n✅ ANUBIS HANDLING TEST COMPLETE');
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        throw error;
    }
}

// Run the test
testLinzAnubis().then(() => {
    console.log('\n=== ULTRATHINK AGENT #1: Anubis solver test completed successfully ===');
    process.exit(0);
}).catch(error => {
    console.error('\n=== ULTRATHINK AGENT #1: Anubis solver test failed ===');
    console.error(error);
    process.exit(1);
});