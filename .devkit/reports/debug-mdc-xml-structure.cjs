#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

async function debugMDCXMLStructure() {
    console.log('Debugging MDC Catalonia XML structure...');
    
    const compoundXmlUrl = 'https://mdc.csuc.cat/utils/getfile/collection/incunableBC/id/175331';
    
    try {
        const response = await new Promise((resolve, reject) => {
            https.get(compoundXmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, data }));
            }).on('error', reject);
        });
        
        console.log(`Status: ${response.statusCode}`);
        console.log(`Data length: ${response.data.length} bytes`);
        
        // Save the XML for inspection
        const xmlFile = '.devkit/reports/mdc-catalonia-validation/compound-object.xml';
        fs.writeFileSync(xmlFile, response.data);
        console.log(`XML saved to: ${xmlFile}`);
        
        // Show first 2000 characters
        console.log('\n=== XML Content Preview ===');
        console.log(response.data.substring(0, 2000));
        
        // Try different regex patterns
        const patterns = [
            /<page><pageptr>([^<]+)<\/pageptr><pagetitle>([^<]*)<\/pagetitle><pagefile>([^<]+)<\/pagefile>/g,
            /<page>.*?<pageptr>([^<]+)<\/pageptr>.*?<\/page>/gs,
            /<pageptr>([^<]+)<\/pageptr>/g,
            /<pagetitle>([^<]*)<\/pagetitle>/g,
            /<pagefile>([^<]+)<\/pagefile>/g,
            /<page[^>]*>.*?<\/page>/gs
        ];
        
        console.log('\n=== Pattern Matching Tests ===');
        patterns.forEach((pattern, index) => {
            const matches = response.data.match(pattern);
            console.log(`Pattern ${index + 1}: ${matches ? matches.length : 0} matches`);
            if (matches && matches.length > 0) {
                console.log(`First match: ${matches[0].substring(0, 200)}...`);
            }
        });
        
        // Look for other possible structures
        console.log('\n=== Searching for Alternative Structures ===');
        const alternativePatterns = [
            'object',
            'item', 
            'document',
            'file',
            'compound',
            'page'
        ];
        
        alternativePatterns.forEach(tag => {
            const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
            const matches = response.data.match(regex);
            console.log(`<${tag}> tags: ${matches ? matches.length : 0}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugMDCXMLStructure();