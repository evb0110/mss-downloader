/**
 * Anubis Proof-of-Work Challenge Solver
 * Solves SHA256 proof-of-work challenges as required by Techaro Anubis anti-bot protection
 * Based on the official Anubis implementation from https://github.com/TecharoHQ/anubis
 */

export interface AnubisChallenge {
    random: string;
    difficulty: number;
    challengeId: string;
}

export interface AnubisSolution {
    hash: string;
    nonce: number;
    challengeId: string;
    elapsedTime: number;
}

export class AnubisSolver {
    /**
     * Calculate SHA256 hash using Node.js crypto or Web Crypto API
     */
    private async calculateSHA256(data: string): Promise<ArrayBuffer> {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            // Browser/Web environment
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            return await crypto.subtle.digest('SHA-256', dataBuffer);
        } else {
            // Node.js environment
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256');
            hash.update(data);
            const buffer = hash.digest();
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
    }

    /**
     * Convert ArrayBuffer to hex string
     */
    private toHexString(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Validate if hash meets the difficulty requirement
     */
    private validateHash(hashArray: Uint8Array, difficulty: number): boolean {
        const requiredZeroBytes = Math.floor(difficulty / 2);
        const isDifficultyOdd = difficulty % 2 !== 0;

        // Check required zero bytes
        for (let i = 0; i < requiredZeroBytes; i++) {
            if (hashArray[i] !== 0) {
                return false;
            }
        }

        // Check partial byte for odd difficulties
        if (isDifficultyOdd && requiredZeroBytes < hashArray.length) {
            if ((hashArray[requiredZeroBytes] >> 4) !== 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Solve the Anubis proof-of-work challenge
     */
    async solveChallenge(challenge: AnubisChallenge, maxAttempts: number = 1000000): Promise<AnubisSolution> {
        console.log(`[Anubis] Solving challenge with difficulty ${challenge.difficulty}, max attempts: ${maxAttempts}`);
        
        const startTime = Date.now();
        let nonce = 0;

        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const data = challenge.random + nonce.toString();
            const hashBuffer = await this.calculateSHA256(data);
            const hashArray = new Uint8Array(hashBuffer);

            if (this.validateHash(hashArray, challenge.difficulty)) {
                const elapsedTime = Date.now() - startTime;
                const hash = this.toHexString(hashBuffer);
                
                console.log(`[Anubis] Challenge solved! Nonce: ${nonce}, Hash: ${hash}, Time: ${elapsedTime}ms`);
                
                return {
                    hash,
                    nonce,
                    challengeId: challenge.challengeId,
                    elapsedTime
                };
            }

            nonce++;

            // Progress logging every 10k attempts
            if (attempts > 0 && attempts % 10000 === 0) {
                const elapsed = Date.now() - startTime;
                const rate = Math.round(attempts / (elapsed / 1000));
                console.log(`[Anubis] Progress: ${attempts} attempts, ${rate} H/s`);
            }
        }

        throw new Error(`Failed to solve Anubis challenge after ${maxAttempts} attempts`);
    }

    /**
     * Extract challenge parameters from Anubis challenge page
     */
    extractChallengeFromPage(html: string): AnubisChallenge | null {
        try {
            // Look for Anubis challenge script tag (new format)
            const anubisScriptMatch = html.match(/<script id="anubis_challenge" type="application\/json">([^<]+)<\/script>/);
            if (anubisScriptMatch && anubisScriptMatch[1]) {
                const challengeData = JSON.parse(anubisScriptMatch[1]);
                if (challengeData.challenge && challengeData.rules?.difficulty !== undefined) {
                    return {
                        random: challengeData.challenge,
                        difficulty: challengeData.rules.difficulty,
                        challengeId: challengeData.id || challengeData.challenge_id || 'challenge'
                    };
                }
            }

            // Look for challenge data in script tags or meta tags (legacy format)
            const scriptMatch = html.match(/window\.challenge\s*=\s*({[^}]+})/);
            if (scriptMatch) {
                const challengeData = JSON.parse(scriptMatch[1]);
                if (challengeData.random && challengeData.difficulty !== undefined) {
                    return {
                        random: challengeData.random,
                        difficulty: challengeData.difficulty,
                        challengeId: challengeData.id || challengeData.challengeId || 'unknown'
                    };
                }
            }

            // Alternative: look for meta tags
            const randomMatch = html.match(/<meta name="challenge-random" content="([^"]+)"/);
            const difficultyMatch = html.match(/<meta name="challenge-difficulty" content="([^"]+)"/);
            const idMatch = html.match(/<meta name="challenge-id" content="([^"]+)"/);

            if (randomMatch?.[1] && difficultyMatch?.[1]) {
                return {
                    random: randomMatch[1],
                    difficulty: parseInt(difficultyMatch[1]),
                    challengeId: idMatch?.[1] || 'unknown'
                };
            }

            // Look for data attributes in HTML elements
            const dataMatch = html.match(/data-challenge="([^"]+)"/);
            if (dataMatch?.[1]) {
                const challengeData = JSON.parse(atob(dataMatch[1])); // base64 decode if needed
                return {
                    random: challengeData.random,
                    difficulty: challengeData.difficulty,
                    challengeId: challengeData.id || 'unknown'
                };
            }

            return null;
        } catch (error) {
            console.error('[Anubis] Failed to extract challenge from page:', error);
            return null;
        }
    }

    /**
     * Submit the solved challenge to get the verification cookie
     */
    async submitSolution(
        originalUrl: string, 
        solution: AnubisSolution, 
        fetchFunction: any
    ): Promise<{ cookie: string; success: boolean }> {
        try {
            // Build the Anubis submission URL based on the original URL's domain
            const originalUrlObj = new URL(originalUrl);
            const basePrefix = `${originalUrlObj.protocol}//${originalUrlObj.host}`;
            const submitUrl = new URL(`${basePrefix}/.within.website/x/cmd/anubis/api/pass-challenge`);
            
            submitUrl.searchParams.set('id', solution.challengeId);
            submitUrl.searchParams.set('response', solution.hash);
            submitUrl.searchParams.set('nonce', solution.nonce.toString());
            submitUrl.searchParams.set('redir', originalUrl);
            submitUrl.searchParams.set('elapsedTime', solution.elapsedTime.toString());

            console.log(`[Anubis] Submitting solution to: ${submitUrl.toString()}`);

            const response = await fetchFunction(submitUrl.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.ok) {
                // Extract the verification cookie from Set-Cookie headers
                const setCookieHeader = response.headers ? response.headers['set-cookie'] : undefined;
                const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : 
                    (typeof setCookieHeader === 'string' ? [setCookieHeader] : []);
                
                const verificationCookie = cookies.find(cookie => 
                    cookie && cookie.includes('anubis-cookie-verification')
                );

                if (verificationCookie) {
                    console.log('[Anubis] Solution accepted, received verification cookie');
                    return {
                        cookie: verificationCookie,
                        success: true
                    };
                }
            }

            console.error(`[Anubis] Solution submission failed: ${response.status}`);
            return { cookie: '', success: false };

        } catch (error) {
            console.error('[Anubis] Error submitting solution:', error);
            return { cookie: '', success: false };
        }
    }
}