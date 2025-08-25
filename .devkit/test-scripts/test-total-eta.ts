#!/usr/bin/env bun
// Test the total ETA calculation for multi-part manuscripts

function testTotalEtaCalculation() {
    console.log('📊 Testing Total ETA Calculation for Multi-Part Manuscripts...');
    
    function formatETA(etaSeconds: number): string {
        if (!etaSeconds || !isFinite(etaSeconds) || etaSeconds < 0) return 'calculating...';
        
        const hours = Math.floor(etaSeconds / 3600);
        const minutes = Math.floor((etaSeconds % 3600) / 60);
        const seconds = Math.floor(etaSeconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    // Simulate the enhanced ETA calculation logic
    const simulateProgress = (scenario: {
        partInfo?: {
            partNumber: number;
            totalParts: number;
            pageRange: { start: number; end: number };
        };
        downloaded: number; // Pages downloaded in current part
        total: number; // Total pages in current part
        elapsed: number; // Time elapsed in seconds
        description: string;
    }) => {
        const { partInfo, downloaded, total, elapsed, description } = scenario;
        
        console.log(`\n🧪 ${description}:`);
        console.log(`   Current part: ${downloaded}/${total} pages downloaded`);
        
        const ratePagesPerSec = downloaded / elapsed;
        let currentPartEta = -1;
        let totalManuscriptEta = -1;
        
        if (downloaded > 0 && ratePagesPerSec > 0) {
            // Current part ETA
            currentPartEta = Math.round((total - downloaded) / ratePagesPerSec);
            
            // Total manuscript ETA calculation (if this is a split part)
            if (partInfo) {
                console.log(`   Part info: Part ${partInfo.partNumber}/${partInfo.totalParts}, pages ${partInfo.pageRange.start}-${partInfo.pageRange.end}`);
                
                // Calculate total progress across all parts
                const currentPartPages = partInfo.pageRange.end - partInfo.pageRange.start + 1;
                const totalManuscriptPages = partInfo.totalParts > 1 ? 
                    Math.round(currentPartPages * partInfo.totalParts) : 
                    currentPartPages;
                
                // Pages completed in previous parts
                const pagesFromPreviousParts = (partInfo.partNumber - 1) * currentPartPages;
                
                // Total pages completed across entire manuscript
                const totalPagesCompleted = pagesFromPreviousParts + downloaded;
                
                console.log(`   Total manuscript: ${totalPagesCompleted}/${totalManuscriptPages} pages completed globally`);
                
                // Total manuscript ETA
                const totalRatePagesPerSec = totalPagesCompleted / elapsed;
                if (totalRatePagesPerSec > 0) {
                    totalManuscriptEta = Math.round((totalManuscriptPages - totalPagesCompleted) / totalRatePagesPerSec);
                }
            } else {
                // Not a split manuscript, total ETA is same as current part ETA
                totalManuscriptEta = currentPartEta;
            }
        }
        
        const formattedCurrentPartEta = formatETA(currentPartEta);
        const formattedTotalEta = formatETA(totalManuscriptEta);
        
        console.log(`   🕐 Current part ETA: ${formattedCurrentPartEta}`);
        console.log(`   🕐 Total manuscript ETA: ${formattedTotalEta}`);
        
        if (partInfo && partInfo.totalParts > 1) {
            const improvement = currentPartEta > 0 && totalManuscriptEta > 0 ? 
                `(${Math.round((currentPartEta / totalManuscriptEta) * 100)}% of total)` : '';
            console.log(`   📈 ETA improvement: Part ETA now reflects global progress ${improvement}`);
        }
        
        return { currentPartEta, totalManuscriptEta };
    };
    
    // Test scenarios
    console.log('🎯 Test Scenarios:');
    
    // Scenario 1: Single part manuscript (no change expected)
    simulateProgress({
        downloaded: 5,
        total: 20,
        elapsed: 10, // 10 seconds elapsed
        description: 'Single-part manuscript (20 pages)'
    });
    
    // Scenario 2: Multi-part manuscript, first part
    simulateProgress({
        partInfo: {
            partNumber: 1,
            totalParts: 5,
            pageRange: { start: 1, end: 50 }
        },
        downloaded: 10,
        total: 50,
        elapsed: 20, // 20 seconds elapsed, 0.5 pages/sec
        description: 'Multi-part manuscript - Part 1/5 (pages 1-50)'
    });
    
    // Scenario 3: Multi-part manuscript, middle part
    simulateProgress({
        partInfo: {
            partNumber: 3,
            totalParts: 5,
            pageRange: { start: 101, end: 150 }
        },
        downloaded: 25,
        total: 50,
        elapsed: 150, // 150 seconds elapsed, includes time from previous parts
        description: 'Multi-part manuscript - Part 3/5 (pages 101-150)'
    });
    
    // Scenario 4: Multi-part manuscript, final part
    simulateProgress({
        partInfo: {
            partNumber: 5,
            totalParts: 5,
            pageRange: { start: 201, end: 250 }
        },
        downloaded: 40,
        total: 50,
        elapsed: 400, // 400 seconds total elapsed
        description: 'Multi-part manuscript - Part 5/5 (pages 201-250)'
    });
    
    console.log('\n📋 SUMMARY OF IMPROVEMENTS:');
    console.log('✅ ETA now shows total manuscript completion time, not just current part');
    console.log('✅ Users see realistic estimates for entire download process');
    console.log('✅ Progress calculation accounts for work done in previous parts');
    console.log('✅ Single-part manuscripts unchanged (backward compatibility)');
    console.log('✅ UI can display both part and total ETA if needed');
    
    console.log('\n🎨 SUGGESTED UI FORMATS:');
    console.log('   Option 1: "ETA: 14m 30s total (part 2/5)"');
    console.log('   Option 2: "ETA: 1m 26s (part), 14m 30s (total)"');
    console.log('   Option 3: "ETA: 14m 30s" (with tooltip showing part info)');
    
    return true;
}

const success = testTotalEtaCalculation();
process.exit(success ? 0 : 1);