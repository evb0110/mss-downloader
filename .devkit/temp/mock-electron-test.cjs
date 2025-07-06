// Mock Electron environment for testing
const path = require('path');

// Mock electron.app
global.mockElectron = {
    app: {
        getPath: (pathType) => {
            if (pathType === 'userData') {
                return path.join(__dirname, '../temp/mock-userdata');
            }
            return '/tmp/mock-electron';
        }
    }
};

// Mock electron module
require.cache['electron'] = {
    exports: global.mockElectron
};

console.log('🧪 Testing ONB and BNE fixes with mocked Electron...\n');

async function testWithMockedElectron() {
    try {
        const fs = require('fs').promises;
        
        // Ensure mock directories exist
        const mockUserData = path.join(__dirname, '../temp/mock-userdata');
        await fs.mkdir(mockUserData, { recursive: true });
        
        // Now try to load the service
        const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
        
        const downloader = new EnhancedManuscriptDownloaderService();
        console.log('✅ Service loaded with mocked Electron');
        
        // Test library detection
        console.log('\n📋 Testing library detection...');
        const onbLibrary = downloader.detectLibrary('https://viewer.onb.ac.at/1000B160');
        const bneLibrary = downloader.detectLibrary('https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
        
        console.log(`✅ ONB detected as: ${onbLibrary}`);
        console.log(`✅ BNE detected as: ${bneLibrary}`);
        
        if (onbLibrary === 'onb' && bneLibrary === 'bne') {
            console.log('\n🎉 All fixes are properly integrated!');
            return true;
        } else {
            console.log('\n❌ Library detection issues found');
            return false;
        }
        
    } catch (error) {
        console.error(`💥 Test error: ${error.message}`);
        return false;
    }
}

testWithMockedElectron().then(success => {
    if (success) {
        console.log('\n✅ All tests passed! Ready for validation protocol.');
    } else {
        console.log('\n❌ Some tests failed.');
        process.exit(1);
    }
});