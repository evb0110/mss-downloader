#!/usr/bin/env node

/**
 * Test individual issues with production code
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const issues = {
    issue_4: {
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        title: 'морган'
    },
    issue_5: {
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        title: 'Флоренция'
    }
};

async function testIssue(issueId) {
    const config = issues[issueId];
    console.log(`\nTesting ${issueId}: ${config.title}`);
    console.log(`URL: ${config.url}`);
    
    const loader = new SharedManifestLoaders();
    
    try {
        const manifest = await loader.getManifest(config.url);
        
        if (manifest && manifest.pages && manifest.pages.length > 0) {
            console.log(`✅ SUCCESS: Loaded ${manifest.pages.length} pages`);
            console.log(`   Title: ${manifest.title || 'Unknown'}`);
            console.log(`   First page: ${manifest.pages[0].url}`);
            return true;
        } else {
            console.log(`⚠️ Manifest loaded but no pages found`);
            return false;
        }
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        
        // Show where it failed
        if (error.stack) {
            const match = error.stack.match(/SharedManifestLoaders\.js:(\d+)/);
            if (match) {
                console.log(`   Failed at line ${match[1]} in SharedManifestLoaders.js`);
            }
        }
        return false;
    }
}

// Test each issue
(async () => {
    for (const issueId of Object.keys(issues)) {
        await testIssue(issueId);
    }
})();