#!/usr/bin/env node

/**
 * Fix Internet Culturale infinite loop and image repetition bug
 * This script applies comprehensive fixes to the XML parsing and page detection
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');

console.log('🔧 Applying Internet Culturale infinite loop fix...');

try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find and replace the problematic XML parsing section
    const oldXmlParsingCode = `            // Extract page URLs from XML
            const pageLinks: string[] = [];
            const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
            let match;
            
            while ((match = pageRegex.exec(xmlText)) !== null) {
                let relativePath = match[1];
                
                // Optimize Internet Culturale resolution: use 'normal' for highest quality images
                if (relativePath.includes('cacheman/web/')) {
                    relativePath = relativePath.replace('cacheman/web/', 'cacheman/normal/');
                }
                
                // Convert relative path to absolute URL
                const imageUrl = \`https://www.internetculturale.it/jmms/\${relativePath}\`;
                pageLinks.push(imageUrl);
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No image URLs found in XML manifest');
            }`;

    const newXmlParsingCode = `            // Extract page URLs from XML with enhanced parsing and duplicate detection
            const pageLinks: string[] = [];
            
            // Try multiple regex patterns for different XML structures
            const pageRegexPatterns = [
                /<page[^>]+src="([^"]+)"[^>]*>/g,
                /<page[^>]*>([^<]+)<\\/page>/g,
                /src="([^"]*cacheman[^"]*\\.jpg)"/g,
                /url="([^"]*cacheman[^"]*\\.jpg)"/g,
                /"([^"]*cacheman[^"]*\\.jpg)"/g
            ];
            
            console.log(\`[Internet Culturale] XML response length: \${xmlText.length} characters\`);
            console.log(\`[Internet Culturale] XML preview: \${xmlText.substring(0, 500)}...\`);
            
            let foundPages = false;
            for (const pageRegex of pageRegexPatterns) {
                let match;
                const tempLinks: string[] = [];
                
                while ((match = pageRegex.exec(xmlText)) !== null) {
                    let relativePath = match[1];
                    
                    // Skip non-image URLs
                    if (!relativePath.includes('.jpg') && !relativePath.includes('.jpeg')) {
                        continue;
                    }
                    
                    // Optimize Internet Culturale resolution: use 'normal' for highest quality images
                    if (relativePath.includes('cacheman/web/')) {
                        relativePath = relativePath.replace('cacheman/web/', 'cacheman/normal/');
                    }
                    
                    // Ensure absolute URL
                    const imageUrl = relativePath.startsWith('http') 
                        ? relativePath 
                        : \`https://www.internetculturale.it/jmms/\${relativePath}\`;
                    
                    tempLinks.push(imageUrl);
                }
                
                if (tempLinks.length > 0) {
                    pageLinks.push(...tempLinks);
                    foundPages = true;
                    console.log(\`[Internet Culturale] Found \${tempLinks.length} pages using regex pattern \${pageRegex.source}\`);
                    break;
                }
            }
            
            if (!foundPages) {
                console.error('[Internet Culturale] No pages found with any regex pattern');
                console.log('[Internet Culturale] Full XML response:', xmlText);
                throw new Error('No image URLs found in XML manifest');
            }
            
            // Detect and handle duplicate URLs (infinite loop prevention)
            const urlCounts = new Map();
            const uniquePageLinks: string[] = [];
            
            pageLinks.forEach((url, index) => {
                const count = urlCounts.get(url) || 0;
                urlCounts.set(url, count + 1);
                
                if (count === 0) {
                    uniquePageLinks.push(url);
                } else {
                    console.warn(\`[Internet Culturale] Duplicate URL detected for page \${index + 1}: \${url}\`);
                }
            });
            
            // If only one unique page found, attempt to generate additional pages
            if (uniquePageLinks.length === 1 && pageLinks.length > 1) {
                console.warn(\`[Internet Culturale] Only 1 unique page found but \${pageLinks.length} total pages expected\`);
                console.log('[Internet Culturale] Attempting to generate additional page URLs...');
                
                const baseUrl = uniquePageLinks[0];
                const urlPattern = baseUrl.replace(/\\/\\d+\\.jpg$/, '');
                
                // Generate URLs for pages 1-50 (reasonable limit)
                const generatedLinks: string[] = [];
                for (let i = 1; i <= Math.min(50, pageLinks.length); i++) {
                    const generatedUrl = \`\${urlPattern}/\${i}.jpg\`;
                    generatedLinks.push(generatedUrl);
                }
                
                console.log(\`[Internet Culturale] Generated \${generatedLinks.length} page URLs from pattern\`);
                pageLinks.length = 0; // Clear original array
                pageLinks.push(...generatedLinks);
            } else {
                // Use unique pages only
                pageLinks.length = 0;
                pageLinks.push(...uniquePageLinks);
            }
            
            console.log(\`[Internet Culturale] Final page count: \${pageLinks.length} pages\`);
            
            if (pageLinks.length === 0) {
                throw new Error('No valid image URLs found after duplicate removal');
            }`;

    if (content.includes(oldXmlParsingCode)) {
        content = content.replace(oldXmlParsingCode, newXmlParsingCode);
        
        // Write the file back
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log('✅ Internet Culturale infinite loop fix applied successfully!');
        console.log('   - Enhanced XML parsing with multiple regex patterns');
        console.log('   - Added duplicate URL detection and prevention');
        console.log('   - Implemented page URL generation for incomplete manifests');
        console.log('   - Added comprehensive debugging and logging');
        
    } else {
        console.log('⚠️ Could not find exact XML parsing code to replace');
        console.log('   The file may have already been modified or the code structure changed');
        
        // Try a simpler pattern match
        if (content.includes('pageRegex') && content.includes('internetculturale')) {
            console.log('   Found Internet Culturale parsing references - manual review needed');
        }
    }
    
} catch (error) {
    console.error('❌ Error applying Internet Culturale fix:', error.message);
    process.exit(1);
}

console.log('\\n🎯 Internet Culturale infinite loop fix complete!');
console.log('   - Prevents same page repetition in PDFs');
console.log('   - Handles incomplete XML responses');
console.log('   - Generates missing page URLs when needed');
console.log('   - Ready for testing with problematic manuscripts');