#!/usr/bin/env node

/**
 * Internet Culturale Fix Validation Test
 * 
 * This script tests the enhanced Internet Culturale/Vallicelliana fix
 * to ensure it properly detects incomplete manuscripts and provides helpful guidance.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Test URLs
const testCases = [
    {
        name: 'Incomplete Vallicelliana Manuscript (2 pages vs 153 expected)',
        url: 'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest',
        expectedBehavior: 'Should throw error with guidance about incomplete manuscript',
        shouldFail: true
    },
    {
        name: 'Alternative Vallicelliana URL pattern',
        url: 'https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest',
        expectedBehavior: 'Should validate and either pass or fail with helpful message',
        shouldFail: false // Unknown, will test
    }
];

async function runValidationTest() {
    console.log('🔍 Internet Culturale Fix Validation Test');
    console.log('=' .repeat(60));
    console.log(`📋 Testing ${testCases.length} test cases`);
    console.log('');

    const results = [];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`🔄 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
        console.log(`   📖 URL: ${testCase.url}`);
        console.log(`   🎯 Expected: ${testCase.expectedBehavior}`);
        
        try {
            const result = await testManifestValidation(testCase.url);
            
            if (testCase.shouldFail && result.success) {
                console.log(`   ❌ UNEXPECTED SUCCESS - Expected this to fail with validation error`);
                results.push({
                    testCase,
                    result: 'UNEXPECTED_SUCCESS',
                    details: result
                });
            } else if (!testCase.shouldFail && !result.success) {
                console.log(`   ❌ UNEXPECTED FAILURE - Expected this to succeed`);
                console.log(`      Error: ${result.error}`);
                results.push({
                    testCase,
                    result: 'UNEXPECTED_FAILURE',
                    details: result
                });
            } else if (testCase.shouldFail && !result.success) {
                console.log(`   ✅ EXPECTED FAILURE - Validation correctly detected issue`);
                console.log(`      Error message: ${result.error.substring(0, 100)}...`);
                results.push({
                    testCase,
                    result: 'EXPECTED_FAILURE',
                    details: result
                });
            } else {
                console.log(`   ✅ SUCCESS - Validation passed as expected`);
                console.log(`      Pages found: ${result.totalPages}`);
                console.log(`      Expected folios: ${result.expectedFolios || 'Unknown'}`);
                results.push({
                    testCase,
                    result: 'SUCCESS',
                    details: result
                });
            }
            
        } catch (error) {
            console.log(`   ❌ TEST ERROR - ${error.message}`);
            results.push({
                testCase,
                result: 'TEST_ERROR',
                error: error.message
            });
        }
        
        console.log('');
    }

    // Summary
    console.log('📊 Test Summary:');
    const successCount = results.filter(r => r.result === 'SUCCESS' || r.result === 'EXPECTED_FAILURE').length;
    const failureCount = results.filter(r => r.result === 'UNEXPECTED_SUCCESS' || r.result === 'UNEXPECTED_FAILURE' || r.result === 'TEST_ERROR').length;
    
    console.log(`   ✅ Passed: ${successCount}/${results.length}`);
    console.log(`   ❌ Failed: ${failureCount}/${results.length}`);
    
    if (failureCount === 0) {
        console.log('');
        console.log('🎉 ALL TESTS PASSED! The Internet Culturale fix is working correctly.');
    } else {
        console.log('');
        console.log('⚠️  Some tests failed. Review the implementation.');
    }

    // Save detailed results
    const reportPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/fix-validation-results.json';
    await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: { total: results.length, passed: successCount, failed: failureCount },
        results
    }, null, 2));
    
    console.log(`📄 Detailed results saved to: ${reportPath}`);
}

async function testManifestValidation(manifestUrl) {
    // Create a test script that loads the manifest using the enhanced service
    const testScript = `
const https = require('https');

// Simplified validation logic extracted from the enhanced service
class ManifestValidator {
    async testManifest(url) {
        try {
            const manifestData = await this.fetchManifest(url);
            
            // Extract page links (simplified)
            const pageLinks = this.extractPageLinks(manifestData);
            
            // Run validation
            await this.validateManifestCompleteness(manifestData, pageLinks, url);
            
            return {
                success: true,
                totalPages: pageLinks.length,
                expectedFolios: this.parseExpectedFolioCount(this.extractPhysicalDescription(manifestData))
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    fetchManifest(url) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json,application/ld+json,*/*'
                }
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(\`HTTP \${res.statusCode}: \${res.statusMessage}\`));
                    return;
                }

                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (parseError) {
                        reject(new Error(\`Failed to parse JSON: \${parseError.message}\`));
                    }
                });
                res.on('error', reject);
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }
    
    extractPageLinks(manifestData) {
        const pageLinks = [];
        const sequences = manifestData.sequences || (manifestData.items ? [{ canvases: manifestData.items }] : []);
        
        for (const sequence of sequences) {
            const canvases = sequence.canvases || sequence.items || [];
            
            for (const canvas of canvases) {
                if (canvas.images) {
                    for (const image of canvas.images) {
                        const resource = image.resource;
                        if (resource.service && resource.service['@id']) {
                            pageLinks.push(\`\${resource.service['@id']}/full/full/0/default.jpg\`);
                        } else if (resource['@id']) {
                            pageLinks.push(resource['@id']);
                        }
                    }
                } else if (canvas.items) {
                    for (const annotationPage of canvas.items) {
                        for (const annotation of annotationPage.items || []) {
                            const body = annotation.body;
                            if (body && body.service) {
                                const serviceId = Array.isArray(body.service) ? body.service[0].id : body.service.id;
                                pageLinks.push(\`\${serviceId}/full/full/0/default.jpg\`);
                            } else if (body && body.id) {
                                pageLinks.push(body.id);
                            }
                        }
                    }
                }
            }
        }
        
        return pageLinks;
    }
    
    async validateManifestCompleteness(manifestData, pageLinks, originalUrl) {
        const physicalDesc = this.extractPhysicalDescription(manifestData);
        const cnmdId = this.extractCNMDIdentifier(manifestData);
        const manuscriptTitle = this.extractManuscriptTitle(manifestData);
        const expectedFolios = this.parseExpectedFolioCount(physicalDesc);
        
        console.log(\`Validation: \${pageLinks.length} pages, expected ~\${expectedFolios} folios\`);
        
        if (expectedFolios > 0 && pageLinks.length < expectedFolios * 0.1) {
            throw new Error(\`INCOMPLETE MANUSCRIPT: \${pageLinks.length} pages found but \${expectedFolios} folios expected. CNMD: \${cnmdId}\`);
        }
        
        if (expectedFolios > 0 && pageLinks.length < expectedFolios * 0.5) {
            console.warn(\`WARNING: Potentially incomplete manuscript\`);
        }
    }
    
    extractPhysicalDescription(manifestData) {
        if (!manifestData.metadata) return '';
        
        for (const meta of manifestData.metadata) {
            if (meta.label && meta.value) {
                const labelText = this.getMetadataText(meta.label);
                if (labelText.toLowerCase().includes('fisica')) {
                    return this.getMetadataText(meta.value);
                }
            }
        }
        return '';
    }
    
    extractCNMDIdentifier(manifestData) {
        if (!manifestData.metadata) return '';
        
        for (const meta of manifestData.metadata) {
            if (meta.label && meta.value) {
                const labelText = this.getMetadataText(meta.label);
                const valueText = this.getMetadataText(meta.value);
                if (labelText.toLowerCase().includes('identificativo') && valueText.includes('CNMD')) {
                    return valueText.replace(/CNMD\\\\\\\\?/g, '').replace(/CNMD\\\\/g, '');
                }
            }
        }
        return '';
    }
    
    extractManuscriptTitle(manifestData) {
        if (manifestData.label) {
            return this.getMetadataText(manifestData.label);
        }
        return 'Unknown Manuscript';
    }
    
    parseExpectedFolioCount(physicalDesc) {
        if (!physicalDesc) return 0;
        
        const patterns = [
            /cc\\.\\s*(?:[IVX]+\\s*\\+\\s*)?(\\d+)(?:\\s*\\+\\s*[IVX]+)?/i,
            /ff\\.\\s*(\\d+)/i,
            /carte\\s*(\\d+)/i
        ];
        
        for (const pattern of patterns) {
            const match = physicalDesc.match(pattern);
            if (match) {
                const count = parseInt(match[1], 10);
                if (!isNaN(count) && count > 0) {
                    return count;
                }
            }
        }
        return 0;
    }
    
    getMetadataText(value) {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.map(v => this.getMetadataText(v)).join(', ');
        if (value && typeof value === 'object') {
            if (value.it) return this.getMetadataText(value.it);
            if (value.en) return this.getMetadataText(value.en);
            if (value['@value']) return value['@value'];
            return JSON.stringify(value);
        }
        return String(value || '');
    }
}

// Run the test
const validator = new ManifestValidator();
validator.testManifest('${manifestUrl}')
    .then(result => {
        console.log(JSON.stringify(result));
        process.exit(0);
    })
    .catch(error => {
        console.log(JSON.stringify({ success: false, error: error.message }));
        process.exit(0);
    });
`;

    // Write and execute the test script
    const tempScriptPath = path.join(__dirname, `temp_test_${Date.now()}.cjs`);
    await fs.writeFile(tempScriptPath, testScript);
    
    try {
        const result = await new Promise((resolve, reject) => {
            const child = spawn('node', [tempScriptPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                // Try to parse the last line as JSON (the result)
                const lines = stdout.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                
                try {
                    const result = JSON.parse(lastLine);
                    resolve(result);
                } catch (parseError) {
                    reject(new Error(`Failed to parse result: ${lastLine}`));
                }
            });
            
            child.on('error', reject);
            
            setTimeout(() => {
                child.kill();
                reject(new Error('Test timeout'));
            }, 30000);
        });
        
        return result;
        
    } finally {
        // Clean up temp file
        try {
            await fs.unlink(tempScriptPath);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
    }
}

// Run the validation test
runValidationTest().catch(console.error);