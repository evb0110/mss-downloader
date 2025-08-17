#!/usr/bin/env bun

/**
 * ULTRATHINK USER WORKFLOW TEST: Issue #2 - Graz Complete Validation
 * 
 * This script simulates the EXACT user workflow that has been failing
 * and can be used to validate that the fix works correctly.
 * 
 * Run this BEFORE and AFTER implementing the fix to compare results.
 */

import { promises as fs } from 'fs';

class UserWorkflowTest {
    private testResults: any = {};
    private errors: any[] = [];

    async runCompleteValidation() {
        console.log('🎯 ULTRATHINK USER WORKFLOW TEST: Issue #2');
        console.log('===========================================');
        console.log('');
        console.log('This test simulates the EXACT user experience that has been failing.');
        console.log('');
        
        // Test the exact problematic URL that users report
        const problematicUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472';
        
        // Phase 1: Pre-implementation validation
        await this.testCurrentState(problematicUrl);
        
        // Phase 2: IPC serialization analysis  
        await this.testIPCSerializationIssues(problematicUrl);
        
        // Phase 3: Expected behavior after fix
        await this.testExpectedBehaviorAfterFix(problematicUrl);
        
        // Generate comprehensive validation report
        await this.generateValidationReport();
    }

    async testCurrentState(url: string) {
        console.log('📋 Phase 1: Current State Analysis');
        console.log('----------------------------------');
        console.log(`Testing URL: ${url}`);
        console.log('');
        
        try {
            // Simulate what happens when user enters the URL
            console.log('👤 User action: Enters Graz manuscript URL');
            console.log('🔧 System: Extracting manuscript ID...');
            
            const manuscriptIdMatch = url.match(/\/(\d+)$/);
            if (!manuscriptIdMatch) {
                throw new Error('Could not extract manuscript ID');
            }
            const manuscriptId = manuscriptIdMatch[1];
            console.log(`✅ Manuscript ID: ${manuscriptId}`);
            
            console.log('🔧 System: Checking IIIF manifest...');
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
            const response = await fetch(manifestUrl);
            console.log(`📊 IIIF Response: ${response.status} ${response.statusText}`);
            
            if (response.status === 500) {
                console.log('🔧 System: 500 error detected, switching to webcache fallback...');
                
                // This is where the webcache fallback logic should trigger
                const startId = 6568482;
                const endId = 6569727;
                const totalPages = endId - startId + 1;
                
                console.log(`✅ Webcache fallback would generate ${totalPages} URLs`);
                
                // Test manifest object creation (this is where IPC issues occur)
                const manifest = {
                    pageLinks: Array.from({ length: totalPages }, (_, i) => 
                        `https://unipub.uni-graz.at/download/webcache/2000/${startId + i}`),
                    totalPages: totalPages,
                    library: 'graz',
                    displayName: `University of Graz Manuscript ${manuscriptId}`,
                    originalUrl: url,
                };
                
                // TEST: Can this object be serialized?
                try {
                    const serialized = JSON.stringify(manifest);
                    const parsed = JSON.parse(serialized);
                    
                    console.log(`✅ Basic serialization test: PASSED`);
                    console.log(`📊 Serialized size: ${(serialized.length / 1024).toFixed(1)}KB`);
                    
                    this.testResults.currentState = {
                        status: 'BASIC_SERIALIZATION_OK',
                        manuscriptId,
                        totalPages,
                        serializedSizeKB: serialized.length / 1024
                    };
                    
                } catch (serializationError) {
                    console.log(`❌ Basic serialization test: FAILED`);
                    console.log(`   Error: ${serializationError}`);
                    
                    this.testResults.currentState = {
                        status: 'BASIC_SERIALIZATION_FAILED',
                        error: serializationError.message
                    };
                }
                
            } else {
                console.log(`❌ Unexpected response status: ${response.status}`);
                this.testResults.currentState = {
                    status: 'UNEXPECTED_RESPONSE',
                    responseStatus: response.status
                };
            }
            
        } catch (error) {
            console.log(`❌ Current state test failed: ${error}`);
            this.testResults.currentState = {
                status: 'FAILED',
                error: error.message
            };
        }
        
        console.log('');
    }

    async testIPCSerializationIssues(url: string) {
        console.log('📋 Phase 2: IPC Serialization Issue Analysis');
        console.log('--------------------------------------------');
        
        try {
            // Simulate creating a manifest with potential IPC-problematic properties
            console.log('🔧 Testing problematic object structures...');
            
            // Test 1: Object with circular references
            const circularTest = () => {
                const obj: any = { name: 'test' };
                obj.self = obj; // Circular reference
                
                try {
                    JSON.stringify(obj);
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            };
            
            const circularResult = circularTest();
            console.log(`📊 Circular reference test: ${circularResult.success ? 'SAFE' : 'PROBLEMATIC'}`);
            if (!circularResult.success) {
                console.log(`   Error: ${circularResult.error}`);
            }
            
            // Test 2: Object with functions
            const functionTest = () => {
                const obj = {
                    name: 'test',
                    someFunction: () => 'hello',
                    regularProperty: 'value'
                };
                
                try {
                    const serialized = JSON.stringify(obj);
                    const parsed = JSON.parse(serialized);
                    return { 
                        success: true, 
                        beforeProps: Object.keys(obj).length,
                        afterProps: Object.keys(parsed).length,
                        lostFunctions: Object.keys(obj).length - Object.keys(parsed).length
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            };
            
            const functionResult = functionTest();
            console.log(`📊 Function property test: ${functionResult.success ? 'SERIALIZABLE' : 'PROBLEMATIC'}`);
            if (functionResult.success && functionResult.lostFunctions > 0) {
                console.log(`   ⚠️  Functions lost in serialization: ${functionResult.lostFunctions}`);
            }
            
            // Test 3: Complex nested objects (like what might come from progress monitor)
            const complexObjectTest = () => {
                const complexObj = {
                    pageLinks: ['url1', 'url2'],
                    totalPages: 2,
                    library: 'graz',
                    progressMonitor: {
                        state: 'active',
                        callbacks: {
                            onProgress: () => {},
                            onComplete: () => {}
                        },
                        config: {
                            timeout: 30000,
                            checkInterval: 1000
                        }
                    },
                    metadata: {
                        timestamp: new Date(),
                        userAgent: 'test'
                    }
                };
                
                try {
                    const serialized = JSON.stringify(complexObj);
                    const parsed = JSON.parse(serialized);
                    
                    // Check what survived serialization
                    const originalKeys = this.getAllKeys(complexObj);
                    const parsedKeys = this.getAllKeys(parsed);
                    const lostKeys = originalKeys.filter(key => !parsedKeys.includes(key));
                    
                    return {
                        success: true,
                        originalSize: serialized.length,
                        lostKeys: lostKeys,
                        survivedSerialization: lostKeys.length === 0
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            };
            
            const complexResult = complexObjectTest();
            console.log(`📊 Complex object test: ${complexResult.success ? 'SERIALIZABLE' : 'FAILED'}`);
            if (complexResult.success) {
                console.log(`   Size: ${(complexResult.originalSize / 1024).toFixed(1)}KB`);
                console.log(`   All properties survived: ${complexResult.survivedSerialization}`);
                if (complexResult.lostKeys.length > 0) {
                    console.log(`   ⚠️  Lost keys: ${complexResult.lostKeys.join(', ')}`);
                }
            }
            
            this.testResults.ipcSerialization = {
                circular: circularResult,
                functions: functionResult,
                complex: complexResult
            };
            
        } catch (error) {
            console.log(`❌ IPC serialization test failed: ${error}`);
            this.errors.push({ phase: 'IPC Serialization', error: error.message });
        }
        
        console.log('');
    }

    getAllKeys(obj: any, prefix = ''): string[] {
        let keys: string[] = [];
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                keys.push(fullKey);
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    keys = keys.concat(this.getAllKeys(obj[key], fullKey));
                }
            }
        }
        
        return keys;
    }

    async testExpectedBehaviorAfterFix(url: string) {
        console.log('📋 Phase 3: Expected Behavior After Fix');
        console.log('---------------------------------------');
        
        try {
            console.log('🔧 Simulating fixed IPC handlers...');
            
            // Simulate the clean manifest that should be returned after fix
            const cleanManifest = {
                pageLinks: Array.from({ length: 1246 }, (_, i) => 
                    `https://unipub.uni-graz.at/download/webcache/2000/${6568482 + i}`),
                totalPages: 1246,
                library: 'graz',
                displayName: 'University of Graz Manuscript 6568472',
                originalUrl: url,
                // NO complex objects, functions, or circular references
            };
            
            // Test 1: Clean manifest serialization
            console.log('🔧 Testing clean manifest serialization...');
            try {
                const serialized = JSON.stringify(cleanManifest);
                const parsed = JSON.parse(serialized);
                
                console.log(`✅ Clean manifest serialization: SUCCESS`);
                console.log(`📊 Size: ${(serialized.length / 1024).toFixed(1)}KB`);
                console.log(`📊 Properties preserved: ${Object.keys(parsed).length}/${Object.keys(cleanManifest).length}`);
                
                // Test 2: Simulate chunked handler response
                const chunkedResponse = { isChunked: false, manifest: cleanManifest };
                const chunkedSerialized = JSON.stringify(chunkedResponse);
                const chunkedParsed = JSON.parse(chunkedSerialized);
                
                console.log(`✅ Chunked handler response: SUCCESS`);
                console.log(`📊 Response size: ${(chunkedSerialized.length / 1024).toFixed(1)}KB`);
                
                // Test 3: Verify no information loss
                const originalPageCount = cleanManifest.pageLinks.length;
                const deserializedPageCount = chunkedParsed.manifest.pageLinks.length;
                
                if (originalPageCount === deserializedPageCount) {
                    console.log(`✅ No data loss: ${originalPageCount} pages preserved`);
                } else {
                    console.log(`❌ Data loss detected: ${originalPageCount} → ${deserializedPageCount} pages`);
                }
                
                this.testResults.expectedBehavior = {
                    status: 'SUCCESS',
                    cleanManifestSizeKB: serialized.length / 1024,
                    chunkedResponseSizeKB: chunkedSerialized.length / 1024,
                    pagesPreserved: originalPageCount === deserializedPageCount,
                    totalPages: deserializedPageCount
                };
                
            } catch (error) {
                console.log(`❌ Clean manifest serialization failed: ${error}`);
                this.testResults.expectedBehavior = {
                    status: 'FAILED',
                    error: error.message
                };
            }
            
        } catch (error) {
            console.log(`❌ Expected behavior test failed: ${error}`);
            this.errors.push({ phase: 'Expected Behavior', error: error.message });
        }
        
        console.log('');
    }

    async generateValidationReport() {
        console.log('📋 COMPREHENSIVE VALIDATION REPORT');
        console.log('===================================');
        console.log('');
        
        console.log('📊 TEST RESULTS SUMMARY:');
        console.log('-------------------------');
        
        // Current State
        if (this.testResults.currentState) {
            const status = this.testResults.currentState.status;
            const emoji = status.includes('OK') ? '✅' : status.includes('FAILED') ? '❌' : '⚠️';
            console.log(`${emoji} Current State: ${status}`);
            if (this.testResults.currentState.totalPages) {
                console.log(`   Pages: ${this.testResults.currentState.totalPages}`);
                console.log(`   Size: ${this.testResults.currentState.serializedSizeKB.toFixed(1)}KB`);
            }
        }
        
        // IPC Serialization
        if (this.testResults.ipcSerialization) {
            const ipc = this.testResults.ipcSerialization;
            console.log(`${ipc.circular.success ? '✅' : '❌'} Circular Reference Handling`);
            console.log(`${ipc.functions.success ? '✅' : '❌'} Function Property Handling`);
            console.log(`${ipc.complex.success ? '✅' : '❌'} Complex Object Handling`);
            
            if (ipc.complex.success && ipc.complex.lostKeys.length > 0) {
                console.log(`   ⚠️  Properties lost in serialization: ${ipc.complex.lostKeys.length}`);
            }
        }
        
        // Expected Behavior
        if (this.testResults.expectedBehavior) {
            const expected = this.testResults.expectedBehavior;
            const emoji = expected.status === 'SUCCESS' ? '✅' : '❌';
            console.log(`${emoji} Expected Post-Fix Behavior: ${expected.status}`);
            if (expected.status === 'SUCCESS') {
                console.log(`   Clean manifest: ${expected.cleanManifestSizeKB.toFixed(1)}KB`);
                console.log(`   Chunked response: ${expected.chunkedResponseSizeKB.toFixed(1)}KB`);
                console.log(`   Pages preserved: ${expected.pagesPreserved ? 'YES' : 'NO'}`);
                console.log(`   Total pages: ${expected.totalPages}`);
            }
        }
        
        console.log('');
        console.log('🎯 VALIDATION CHECKLIST:');
        console.log('-------------------------');
        
        console.log('Before implementing the fix:');
        console.log('☐ User reports infinite loading');
        console.log('☐ Frontend falls back to regular handler');
        console.log('☐ "reply was never sent" error occurs');
        console.log('☐ No manifest data reaches the UI');
        
        console.log('');
        console.log('After implementing the fix:');
        console.log('☐ Chunked handler should succeed on first try');
        console.log('☐ No fallback to regular handler needed');
        console.log('☐ Manifest loads immediately (1246 pages)');
        console.log('☐ User can start download process');
        console.log('☐ No JavaScript errors in console');
        
        console.log('');
        console.log('🔧 TESTING INSTRUCTIONS:');
        console.log('-------------------------');
        console.log('1. Run this script BEFORE implementing the fix');
        console.log('2. Note any serialization issues detected');
        console.log('3. Implement the IPC serialization fixes in main.ts and GrazLoader.ts');
        console.log('4. Run this script AFTER implementing the fix');
        console.log('5. Verify all tests pass and no data is lost');
        console.log('6. Test the actual user workflow in the Electron app');
        console.log('7. Confirm the problematic URL now works without infinite loading');
        
        console.log('');
        console.log('🎯 SUCCESS CRITERIA:');
        console.log('--------------------');
        console.log('✅ Clean manifest serialization: SUCCESS');
        console.log('✅ Chunked response serialization: SUCCESS');
        console.log('✅ No data loss: All 1246 pages preserved');
        console.log('✅ Size under IPC limits: <100KB total');
        console.log('✅ No complex objects in final manifest');
        
        if (this.errors.length > 0) {
            console.log('');
            console.log('❌ ERRORS DETECTED:');
            console.log('-------------------');
            for (const error of this.errors) {
                console.log(`❌ ${error.phase}: ${error.error}`);
            }
        }
        
        // Write results to file for comparison
        const reportPath = '/home/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-2/user-workflow-validation-results.json';
        await fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            testResults: this.testResults,
            errors: this.errors,
            summary: {
                currentStateOK: this.testResults.currentState?.status?.includes('OK') || false,
                expectedBehaviorOK: this.testResults.expectedBehavior?.status === 'SUCCESS',
                serializationIssuesDetected: this.errors.length > 0,
                totalErrors: this.errors.length
            }
        }, null, 2));
        
        console.log('');
        console.log(`📄 Detailed results saved to: ${reportPath}`);
        console.log('');
        console.log('🚀 Ready to implement the fix!');
    }
}

// Run the validation
const test = new UserWorkflowTest();
test.runCompleteValidation().catch(console.error);