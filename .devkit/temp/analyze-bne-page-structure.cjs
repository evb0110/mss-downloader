const https = require('https');
const http = require('http');

// Analyze BNE page structure to understand the page detection mechanism
async function analyzeBnePageStructure() {
    console.log('Analyzing BNE page structure for: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
    
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    try {
        const response = await fetch(url);
        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const html = await response.text();
            console.log('HTML Response Length:', html.length);
            
            // Look for image patterns
            const imagePatterns = [
                /src="([^"]*\.(jpg|jpeg|png|gif).*?)"/gi,
                /url\(['"]*([^'"]*\.(jpg|jpeg|png|gif).*?)['"]*\)/gi,
                /https?:\/\/[^"'\s>]+\.(jpg|jpeg|png|gif)/gi,
                /"([^"]*ImageProxy[^"]*?)"/gi,
                /"([^"]*pdf\.raw[^"]*?)"/gi,
                /"([^"]*image[^"]*?)"/gi
            ];
            
            console.log('\nSearching for image patterns...');
            imagePatterns.forEach((pattern, index) => {
                const matches = html.match(pattern);
                if (matches) {
                    console.log(`Pattern ${index + 1} matches:`, matches.slice(0, 5)); // Show first 5 matches
                }
            });
            
            // Look for JavaScript that might contain image URLs
            const jsPatterns = [
                /ImageProxy[^"']*?\?[^"']*?/gi,
                /pdf\.raw[^"']*?\?[^"']*?/gi,
                /id=\d+[^"']*?page=\d+/gi,
                /totalPages?\s*[=:]\s*(\d+)/gi,
                /numPages?\s*[=:]\s*(\d+)/gi,
                /pageCount\s*[=:]\s*(\d+)/gi
            ];
            
            console.log('\nSearching for JavaScript patterns...');
            jsPatterns.forEach((pattern, index) => {
                const matches = html.match(pattern);
                if (matches) {
                    console.log(`JS Pattern ${index + 1} matches:`, matches.slice(0, 5));
                }
            });
            
            // Look for script tags that might contain configuration
            const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
            if (scriptMatches) {
                console.log('\nAnalyzing script tags...');
                scriptMatches.forEach((script, index) => {
                    if (script.includes('ImageProxy') || script.includes('pdf.raw') || script.includes('totalPages') || script.includes('numPages')) {
                        console.log(`Script ${index + 1} (relevant):`, script.substring(0, 500));
                    }
                });
            }
            
            // Look for META tags or other configuration
            const metaMatches = html.match(/<meta[^>]*>/gi);
            if (metaMatches) {
                console.log('\nMeta tags:');
                metaMatches.forEach(meta => {
                    if (meta.includes('page') || meta.includes('image') || meta.includes('total')) {
                        console.log(meta);
                    }
                });
            }
            
            // Try to find the actual image URL in the HTML
            console.log('\nLooking for specific BNE image URL patterns...');
            const bneImagePatterns = [
                /bdh-rd\.bne\.es\/[^"']*?ImageProxy[^"']*?/gi,
                /bdh-rd\.bne\.es\/[^"']*?pdf\.raw[^"']*?/gi,
                /bdh-rd\.bne\.es\/[^"']*?image[^"']*?/gi,
                /ImageProxy\?[^"']*?id=\d+[^"']*?/gi
            ];
            
            bneImagePatterns.forEach((pattern, index) => {
                const matches = html.match(pattern);
                if (matches) {
                    console.log(`BNE Pattern ${index + 1} matches:`, matches);
                }
            });
            
        } else {
            console.error('Failed to fetch BNE page:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('Error analyzing BNE page structure:', error.message);
    }
}

analyzeBnePageStructure().catch(console.error);