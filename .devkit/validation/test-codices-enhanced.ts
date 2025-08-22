#!/usr/bin/env bun

/**
 * Enhanced Codices Library Loader Test
 * Tests improved pattern matching for manifest discovery
 */

async function testEnhancedManifestDiscovery(url: string): Promise<any> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status}`);
        }

        const html = await response.text();
        
        // Enhanced patterns for manifest discovery
        const manifestPatterns = [
            /["']([^"']*iiif[^"']*manifest[^"']*)["']/gi,
            /["']([^"']*manifest\.json[^"']*)["']/gi,
            /data-manifest=["']([^"']+)["']/gi,
            /manifest:\s*["']([^"']+)["']/gi,
            // Look for UUID patterns that might be manifest IDs
            /["']([^"']*iiif[^"']*\/[a-f0-9-]{36}[^"']*)["']/gi,
            /["'](https:\/\/[^"']*codices\.at\/iiif\/[a-f0-9-]{36}[^"']*)["']/gi,
            // Look for JavaScript variables
            /manifestUrl[^=]*=\s*["']([^"']+)["']/gi,
            /manifest[^=]*=\s*["']([^"']+)["']/gi,
            // Look in script content
            /iiif\/[a-f0-9-]{36}/gi
        ];

        const foundUrls = new Set<string>();
        const foundUuids = new Set<string>();

        for (const pattern of manifestPatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                let manifestUrl = match[1] || match[0];
                
                console.log(`🔍 Found potential match: "${manifestUrl}"`);
                
                // If we found just a UUID, construct the full manifest URL
                if (/^[a-f0-9-]{36}$/.test(manifestUrl)) {
                    foundUuids.add(manifestUrl);
                    manifestUrl = `https://admont.codices.at/iiif/${manifestUrl}`;
                } else if (/iiif\/[a-f0-9-]{36}$/.test(manifestUrl) && !manifestUrl.startsWith('http')) {
                    const uuid = manifestUrl.match(/[a-f0-9-]{36}$/)?.[0];
                    if (uuid) foundUuids.add(uuid);
                    manifestUrl = `https://admont.codices.at/${manifestUrl}`;
                } else if (manifestUrl.startsWith('http') && manifestUrl.includes('iiif')) {
                    const uuid = manifestUrl.match(/[a-f0-9-]{36}/)?.[0];
                    if (uuid) foundUuids.add(uuid);
                }
                
                if (manifestUrl.includes('iiif')) {
                    foundUrls.add(manifestUrl);
                }
            }
        }

        // Also look for UUIDs in the raw HTML without quotes
        const rawUuidMatches = html.matchAll(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi);
        for (const match of rawUuidMatches) {
            foundUuids.add(match[1]);
            const potentialManifestUrl = `https://admont.codices.at/iiif/${match[1]}`;
            foundUrls.add(potentialManifestUrl);
            console.log(`🔍 Found raw UUID: ${match[1]}`);
        }

        return {
            manifestUrls: [...foundUrls],
            uuids: [...foundUuids],
            htmlLength: html.length,
            hasScripts: html.includes('<script'),
            hasIiif: html.includes('iiif'),
            sample: html.substring(0, 1000) // First 1000 chars for debugging
        };
    } catch (error) {
        throw new Error(`Enhanced discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function resolveUrl(url: string, baseUrl: string): string {
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        const base = new URL(baseUrl);
        return new URL(url, base).toString();
    } catch {
        return url;
    }
}

async function testManifestUrl(manifestUrl: string): Promise<boolean> {
    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) return false;
        
        const manifest = await response.json();
        return manifest.type === 'Manifest' || manifest['@type'] === 'sc:Manifest';
    } catch {
        return false;
    }
}

async function main() {
    const testUrl = 'https://admont.codices.at/codices/169/90299';
    
    console.log('🧪 Enhanced Codices Manifest Discovery Test\n');
    console.log(`📚 Testing: ${testUrl}`);
    console.log('─'.repeat(80));

    try {
        const discovery = await testEnhancedManifestDiscovery(testUrl);
        
        console.log('\n📋 Discovery Results:');
        console.log(`Found ${discovery.manifestUrls.length} potential manifest URLs`);
        console.log(`Found ${discovery.uuids.length} UUIDs`);
        console.log(`Page length: ${discovery.htmlLength} chars`);
        console.log(`Has scripts: ${discovery.hasScripts}`);
        console.log(`Contains 'iiif': ${discovery.hasIiif}`);

        if (discovery.uuids.length > 0) {
            console.log('\n📝 Found UUIDs:');
            discovery.uuids.forEach((uuid, i) => {
                console.log(`  ${i + 1}. ${uuid}`);
            });
        }

        if (discovery.manifestUrls.length > 0) {
            console.log('\n🔍 Testing manifest URLs:');
            for (const url of discovery.manifestUrls) {
                console.log(`Testing: ${url}`);
                const isValid = await testManifestUrl(url);
                console.log(`  ${isValid ? '✅' : '❌'} ${isValid ? 'Valid manifest' : 'Invalid/inaccessible'}`);
                
                if (isValid) {
                    console.log('\n🎉 SUCCESS! Found working manifest URL');
                    return;
                }
            }
        }

        if (discovery.manifestUrls.length === 0) {
            console.log('\n🔍 No manifest URLs found. Sample page content:');
            console.log(discovery.sample);
            
            console.log('\n💡 Trying known working manifest for comparison...');
            const knownManifest = 'https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701';
            const knownWorks = await testManifestUrl(knownManifest);
            console.log(`Known manifest (${knownManifest}): ${knownWorks ? '✅ Works' : '❌ Failed'}`);
        }

    } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n📝 Analysis: The page may load manifest URLs dynamically via JavaScript');
    console.log('🔧 Consider implementing alternative strategies like API discovery or site-specific patterns');
}

main().catch(console.error);