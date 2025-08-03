#!/usr/bin/env node

// Test the scope issue by simulating the problematic code pattern

function simulateMunichError() {
    const downloadStartTime = Date.now();
    let manifest = undefined;
    let filepath = undefined;
    let validImagePaths = [];
    
    try {
        // Simulate manifest loading
        manifest = { library: 'munich', totalPages: 64 };
        
        // Simulate image downloading
        const imagePaths = ['img1.jpg', 'img2.jpg', null, 'img4.jpg'];
        
        // This is the fixed line - no const redeclaration
        validImagePaths = imagePaths.filter(Boolean);
        
        if (validImagePaths.length === 0) {
            throw new Error('No images were successfully downloaded');
        }
        
        console.log('✅ SUCCESS: validImagePaths accessible:', validImagePaths.length, 'images');
        
        // Simulate a different error
        throw new Error('Simulated PDF creation error');
        
    } catch (error) {
        console.log('In catch block...');
        console.log('Error:', error.message);
        
        // This is where the error was happening - validImagePaths should now be accessible
        try {
            console.log('validImagePaths in catch block:', validImagePaths);
            console.log('validImagePaths.length:', validImagePaths.length);
            console.log('✅ SUCCESS: validImagePaths is accessible in catch block!');
        } catch (scopeError) {
            console.log('❌ FAILED: validImagePaths is not defined in catch block');
            console.log('Scope error:', scopeError.message);
        }
    }
}

simulateMunichError();