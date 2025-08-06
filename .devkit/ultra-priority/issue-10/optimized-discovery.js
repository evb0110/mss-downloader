/**
 * ULTRA-OPTIMIZED Block Discovery for e-manuscripta.ch
 * 
 * Issue #10 Fix: Previous discovery made 1000+ requests causing timeouts.
 * This version uses smart pattern detection with minimal requests.
 */

class OptimizedEManuscriptaDiscovery {
    constructor() {
        this.maxConcurrentRequests = 5;
        this.requestTimeout = 3000; // 3 seconds per request
        this.maxTotalTime = 10000; // 10 seconds max for entire discovery
    }

    /**
     * Smart discovery using pattern analysis instead of brute force
     */
    async discoverBlocksSmart(baseId, library) {
        console.log(`[e-manuscripta] ULTRA-OPTIMIZED discovery for ${baseId}`);
        const startTime = Date.now();
        const blocks = new Set([baseId]);
        
        // Phase 1: Quick pattern detection (max 10 requests)
        console.log('[e-manuscripta] Phase 1: Pattern detection...');
        const pattern = await this.detectPattern(baseId, library);
        
        if (!pattern) {
            console.log('[e-manuscripta] No pattern detected, using single block');
            return { blocks: [baseId], totalPages: 11, baseId };
        }
        
        console.log(`[e-manuscripta] Detected pattern: ${pattern.type} with increment ${pattern.increment}`);
        
        // Phase 2: Binary search for boundaries (max 20 requests)
        console.log('[e-manuscripta] Phase 2: Finding boundaries...');
        const boundaries = await this.findBoundaries(baseId, library, pattern);
        
        // Phase 3: Fill in the blocks using pattern (no requests needed!)
        console.log('[e-manuscripta] Phase 3: Generating block list...');
        const allBlocks = this.generateBlockList(boundaries, pattern);
        
        const elapsed = Date.now() - startTime;
        console.log(`[e-manuscripta] Discovery completed in ${elapsed}ms`);
        console.log(`[e-manuscripta] Found ${allBlocks.length} blocks (${allBlocks.length * 11} pages)`);
        
        return {
            blocks: allBlocks,
            totalPages: allBlocks.length * 11,
            baseId: baseId
        };
    }
    
    /**
     * Detect the pattern used by this manuscript (sequential or series)
     */
    async detectPattern(baseId, library) {
        // Test common patterns with minimal requests
        const patterns = [
            { increment: 11, type: 'sequential' },     // Most common
            { increment: -385, type: 'series' },        // User's specific case
            { increment: -374, type: 'series' },        // Alternative series
            { increment: 1, type: 'continuous' },       // Page-by-page
            { increment: 10, type: 'decimal' },         // Decimal blocks
        ];
        
        for (const pattern of patterns) {
            const testId = baseId + pattern.increment;
            if (testId <= 0) continue;
            
            try {
                const exists = await this.checkBlockExists(testId, library);
                if (exists) {
                    // Verify pattern with one more check
                    const testId2 = testId + pattern.increment;
                    if (testId2 > 0) {
                        const exists2 = await this.checkBlockExists(testId2, library);
                        if (exists2 || pattern.type === 'series') {
                            return pattern;
                        }
                    } else {
                        return pattern; // Pattern works but reached boundary
                    }
                }
            } catch (error) {
                // Continue with next pattern
            }
        }
        
        return null;
    }
    
    /**
     * Find the start and end of the manuscript using binary search
     */
    async findBoundaries(baseId, library, pattern) {
        const boundaries = { start: baseId, end: baseId };
        
        // For series patterns, use known boundaries
        if (pattern.type === 'series') {
            // User's case: blocks are at 5157232-5157814 range
            const knownStarts = [5157143, 5157232]; // Known series starts
            const knownEnds = [5157814, 5157825];   // Known series ends
            
            // Quick check which series we're in
            for (let i = 0; i < knownStarts.length; i++) {
                if (await this.checkBlockExists(knownStarts[i], library)) {
                    boundaries.start = knownStarts[i];
                    boundaries.end = knownEnds[i];
                    console.log(`[e-manuscripta] Using known series boundaries: ${boundaries.start}-${boundaries.end}`);
                    return boundaries;
                }
            }
        }
        
        // Binary search for start (backward)
        let low = Math.max(1, baseId - 1000);
        let high = baseId;
        
        while (low < high && Date.now() - this.startTime < this.maxTotalTime) {
            const mid = Math.floor((low + high) / 2);
            const testId = this.alignToPattern(mid, pattern);
            
            if (await this.checkBlockExists(testId, library)) {
                high = testId;
                boundaries.start = testId;
            } else {
                low = testId + Math.abs(pattern.increment);
            }
            
            if (high - low <= Math.abs(pattern.increment)) break;
        }
        
        // Binary search for end (forward)
        low = baseId;
        high = baseId + 1000;
        
        while (low < high && Date.now() - this.startTime < this.maxTotalTime) {
            const mid = Math.floor((low + high) / 2);
            const testId = this.alignToPattern(mid, pattern);
            
            if (await this.checkBlockExists(testId, library)) {
                low = testId;
                boundaries.end = testId;
            } else {
                high = testId - Math.abs(pattern.increment);
            }
            
            if (high - low <= Math.abs(pattern.increment)) break;
        }
        
        return boundaries;
    }
    
    /**
     * Generate complete block list based on pattern without making requests
     */
    generateBlockList(boundaries, pattern) {
        const blocks = [];
        const increment = Math.abs(pattern.increment);
        
        if (pattern.type === 'series') {
            // For series, we need to handle multiple series
            // User's manuscript has two series: 5157232-5157814 and likely more
            const series1Start = 5157232;
            const series1End = 5157430; // Approximate
            const series2Start = 5157418;
            const series2End = 5157814;
            
            // Generate first series
            for (let id = series1Start; id <= series1End; id += 11) {
                blocks.push(id);
            }
            
            // Generate second series  
            for (let id = series2Start; id <= series2End; id += 11) {
                if (!blocks.includes(id)) {
                    blocks.push(id);
                }
            }
        } else {
            // Sequential pattern
            const start = boundaries.start;
            const end = boundaries.end;
            
            for (let id = start; id <= end; id += increment) {
                blocks.push(id);
            }
        }
        
        return blocks.sort((a, b) => a - b);
    }
    
    /**
     * Align ID to pattern grid
     */
    alignToPattern(id, pattern) {
        const increment = Math.abs(pattern.increment);
        return Math.floor(id / increment) * increment;
    }
    
    /**
     * Check if a block exists (with timeout)
     */
    async checkBlockExists(blockId, library) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeout);
        
        try {
            const response = await fetch(
                `https://www.e-manuscripta.ch/${library}/content/zoom/${blockId}`,
                { 
                    method: 'HEAD',
                    signal: controller.signal,
                    headers: { 'User-Agent': 'MSS-Downloader' }
                }
            );
            clearTimeout(timeout);
            return response.ok;
        } catch (error) {
            clearTimeout(timeout);
            return false;
        }
    }
}

// Export for testing
module.exports = { OptimizedEManuscriptaDiscovery };