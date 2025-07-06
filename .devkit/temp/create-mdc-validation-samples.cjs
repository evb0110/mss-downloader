#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create validation samples for MDC Catalonia
async function createMDCValidationSamples() {
    console.log('📚 Creating MDC Catalonia validation samples...\n');
    
    // Create validation directory
    const validationDir = './CURRENT-VALIDATION';
    if (!fs.existsSync(validationDir)) {
        fs.mkdirSync(validationDir, { recursive: true });
    }
    
    // Test cases
    const testCases = [
        {
            name: 'MDC-Catalonia-Small-Sample',
            collection: 'incunableBC',
            itemId: '49455',
            maxPages: 5,
            description: 'Small sample from incunableBC collection (5 pages)'
        },
        {
            name: 'MDC-Catalonia-Large-Sample',  
            collection: 'incunableBC',
            itemId: '175331',
            maxPages: 10,
            description: 'Large manuscript sample from incunableBC collection (10 pages)'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`📖 Creating sample: ${testCase.name}`);
        console.log(`📄 Description: ${testCase.description}`);
        
        try {
            // Get compound object structure
            const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${testCase.collection}/${testCase.itemId}/json`;
            const compoundResponse = await fetch(compoundUrl);
            const compoundData = await compoundResponse.json();
            
            // Handle both direct page array and nested node.page structure
            let pageArray = compoundData.page;
            if (!pageArray && compoundData.node && compoundData.node.page) {
                pageArray = compoundData.node.page;
            }
            
            if (!pageArray || !Array.isArray(pageArray)) {
                console.log('❌ No page structure found');
                continue;
            }
            
            console.log(`📊 Found ${pageArray.length} total pages, downloading ${testCase.maxPages} pages`);
            
            // Download images
            const imagePaths = [];
            const maxPages = Math.min(testCase.maxPages, pageArray.length);
            
            for (let i = 0; i < maxPages; i++) {
                const page = pageArray[i];
                if (!page.pageptr) continue;
                
                const pageId = page.pageptr;
                const imageUrl = `https://mdc.csuc.cat/iiif/2/${testCase.collection}:${pageId}/full/max/0/default.jpg`;
                
                console.log(`📥 Downloading page ${i + 1}: ${page.pagetitle || 'Untitled'} (${pageId})`);
                
                try {
                    const imageResponse = await fetch(imageUrl);
                    if (!imageResponse.ok) {
                        console.log(`❌ Failed to download page ${pageId}: ${imageResponse.status}`);
                        continue;
                    }
                    
                    const imageBuffer = await imageResponse.arrayBuffer();
                    const imagePath = path.join(validationDir, `${testCase.name}-page-${(i + 1).toString().padStart(3, '0')}.jpg`);
                    fs.writeFileSync(imagePath, Buffer.from(imageBuffer));
                    
                    imagePaths.push(imagePath);
                    console.log(`✅ Saved: ${path.basename(imagePath)}`);
                    
                } catch (error) {
                    console.log(`❌ Error downloading page ${pageId}: ${error.message}`);
                }
                
                // Small delay
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`\n✅ Sample created: ${imagePaths.length} images downloaded`);
            
        } catch (error) {
            console.log(`❌ Error creating sample: ${error.message}`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    }
    
    console.log('🎉 MDC Catalonia validation samples created!');
    console.log(`📁 Check the files in: ${validationDir}`);
}

// Run the validation
createMDCValidationSamples().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
});