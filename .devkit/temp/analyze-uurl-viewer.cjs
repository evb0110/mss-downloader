const https = require('https');
const fs = require('fs');

async function analyzeUurlViewer() {
    try {
        console.log('=== ANALYZING UURL VIEWER STRUCTURE ===');
        
        // Get the UURL page
        const uurlUrl = 'https://uurl.kbr.be/1558106';
        console.log('Fetching UURL page:', uurlUrl);
        
        const response = await fetch(uurlUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            }
        });
        
        const html = await response.text();
        console.log('HTML length:', html.length);
        
        // Save HTML for analysis
        fs.writeFileSync('.devkit/temp/uurl-viewer-page.html', html);
        console.log('Saved HTML to .devkit/temp/uurl-viewer-page.html');
        
        // Look for JavaScript that might handle image loading
        const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
        console.log('Found script tags:', scriptTags.length);
        
        // Look for any references to image loading mechanisms
        const imageLoadingPatterns = [
            /ajax|xhr|fetch/gi,
            /viewerd\.kbr\.be/gi,
            /\.jpg|\.jpeg|\.png|\.tiff/gi,
            /load|display|show/gi,
            /map=|path=|dir=/gi
        ];
        
        console.log('\n=== ANALYZING IMAGE LOADING PATTERNS ===');
        for (const pattern of imageLoadingPatterns) {
            const matches = html.match(pattern) || [];
            if (matches.length > 0) {
                console.log(`Pattern ${pattern.source}:`, matches.slice(0, 10)); // Show first 10 matches
            }
        }
        
        // Look for any API endpoints or different image serving methods
        console.log('\n=== SEARCHING FOR ALTERNATIVE IMAGE ENDPOINTS ===');
        
        // Check if there are any other domains or endpoints mentioned
        const urlPattern = /https?:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9.\-\/\?=&]+/g;
        const urls = html.match(urlPattern) || [];
        const uniqueUrls = [...new Set(urls)].filter(url => 
            url.includes('kbr.be') || url.includes('image') || url.includes('jpg') || url.includes('jpeg')
        );
        
        console.log('Found KBR-related URLs:', uniqueUrls);
        
        // Try to find the actual viewer implementation
        const viewerPattern = /viewer|display|gallery|image/gi;
        const viewerMatches = html.match(viewerPattern) || [];
        console.log('Viewer-related terms found:', viewerMatches.length);
        
        // Check if the page uses a different approach like IIIF or other protocols
        const iiifPattern = /iiif|manifest|tiles|zoomify|pyramid/gi;
        const iiifMatches = html.match(iiifPattern) || [];
        console.log('IIIF/Tiled image patterns:', iiifMatches.length);
        
        // Look for any form submissions or authentication tokens
        const formPattern = /<form[^>]*>([\s\S]*?)<\/form>/g;
        const forms = html.match(formPattern) || [];
        console.log('Found forms:', forms.length);
        
        if (forms.length > 0) {
            console.log('Form analysis:');
            forms.forEach((form, index) => {
                console.log(`Form ${index + 1}:`, form.substring(0, 200));
            });
        }
        
        // Check for any hidden parameters or tokens
        const hiddenInputPattern = /<input[^>]*type=["']hidden["'][^>]*>/g;
        const hiddenInputs = html.match(hiddenInputPattern) || [];
        console.log('Hidden inputs:', hiddenInputs);
        
        // Check for any meta tags that might give us clues
        const metaPattern = /<meta[^>]*>/g;
        const metaTags = html.match(metaPattern) || [];
        console.log('Meta tags:', metaTags.length);
        
        return {
            success: true,
            htmlLength: html.length,
            scriptTags: scriptTags.length,
            uniqueUrls,
            viewerMatches: viewerMatches.length,
            iiifMatches: iiifMatches.length,
            forms: forms.length,
            hiddenInputs: hiddenInputs.length,
            metaTags: metaTags.length
        };
        
    } catch (error) {
        console.error('Error analyzing UURL viewer:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

analyzeUurlViewer().then(result => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
});