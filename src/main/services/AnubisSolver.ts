/**
 * AnubisSolver - Solves Anubis proof-of-work challenges for anti-bot protection
 * 
 * Anubis is an anti-bot system that uses proof-of-work challenges similar to Hashcash.
 * It's used by libraries like Linz to prevent automated scraping while allowing 
 * legitimate users to access content.
 * 
 * ULTRATHINK TODO EXECUTION AGENT #1 - Issue #37 Solution
 */

import crypto from 'crypto';

export interface AnubisChallenge {
    algorithm: string;
    difficulty: number;
    report_as?: number;
    challenge: string;
    challengeId?: string;
}

export interface AnubisSolution {
    nonce: number;
    hash: string;
    challengeId?: string;
}

export class AnubisSolver {
    /**
     * Extract Anubis challenge from HTML page
     */
    extractChallengeFromPage(html: string): AnubisChallenge | null {
        try {
            // Look for the anubis_challenge script tag
            const challengeMatch = html.match(/<script id="anubis_challenge"[^>]*>(.*?)<\/script>/s);
            if (!challengeMatch) {
                console.log('[AnubisSolver] No anubis_challenge script found');
                return null;
            }

            const challengeJson = challengeMatch[1]?.trim();
            if (!challengeJson) {
                console.log('[AnubisSolver] No challenge JSON content found');
                return null;
            }
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

    /**
     * Solve the Anubis proof-of-work challenge
     */
    async solveChallenge(challenge: AnubisChallenge): Promise<AnubisSolution | null> {
        console.log(`[AnubisSolver] Solving challenge with difficulty ${challenge.difficulty}`);
        
        const startTime = Date.now();
        let nonce = 0;
        const maxAttempts = Math.pow(2, challenge.difficulty + 14); // Higher limit for difficulty 4+
        
        try {
            while (nonce < maxAttempts) {
                // Create the proof-of-work string
                const proofString = `${challenge.challenge}:${nonce}`;
                
                // Calculate hash using the specified algorithm
                let hash: string;
                if (challenge.algorithm === 'fast' || !challenge.algorithm) {
                    // Use SHA-256 for 'fast' algorithm
                    hash = crypto.createHash('sha256').update(proofString).digest('hex');
                } else {
                    // Fallback to SHA-256 for unknown algorithms
                    hash = crypto.createHash('sha256').update(proofString).digest('hex');
                }
                
                // Check if the hash meets the difficulty requirement
                // Difficulty typically means the hash should start with a certain number of zeros
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
                
                // Log progress every 10000 attempts
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

    /**
     * Submit the solution to get the verification cookie
     */
    async submitSolution(solution: AnubisSolution, baseUrl: string, fetchFunction: any): Promise<boolean> {
        try {
            // Construct the solution submission URL
            const submitUrl = `${baseUrl}/.within.website/x/cmd/anubis/submit`;
            
            console.log(`[AnubisSolver] Submitting solution to ${submitUrl}`);
            
            const response = await fetchFunction(submitUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': baseUrl
                },
                body: JSON.stringify({
                    nonce: solution.nonce,
                    hash: solution.hash
                })
            });
            
            if (response.ok) {
                console.log('[AnubisSolver] Solution submitted successfully');
                return true;
            } else {
                console.error(`[AnubisSolver] Solution submission failed: ${response.status}`);
                return false;
            }
            
        } catch (error) {
            console.error('[AnubisSolver] Error submitting solution:', error);
            return false;
        }
    }
}