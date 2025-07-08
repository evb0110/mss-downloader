
const { execSync } = require('child_process');
const fs = require('fs');

// Create a test script to validate metadata extraction
const testCode = `
import { app } from 'electron';
app.whenReady().then(async () => {
    try {
        const { EnhancedManuscriptDownloaderService } = require('./src/main/services/EnhancedManuscriptDownloaderService');
        const service = new EnhancedManuscriptDownloaderService();
        
        // Test metadata extraction with mock manifest data
        const mockManifest = {
            label: "Roma, Biblioteca Vallicelliana, Manoscritti, ms. B 50",
            metadata: [
                { label: "Description", value: "Membranaceo; cc. IV + 148 + I" },
                { label: "Identifier", value: "0000016463" }
            ]
        };
        
        const physicalDesc = service.extractPhysicalDescription(mockManifest);
        const cnmdId = service.extractCNMDIdentifier(mockManifest);
        const expectedFolios = service.parseExpectedFolioCount(physicalDesc);
        
        console.log('Physical Description:', physicalDesc);
        console.log('CNMD ID:', cnmdId);
        console.log('Expected Folios:', expectedFolios);
        
        app.quit();
    } catch (error) {
        console.error('Error:', error.message);
        app.quit();
    }
});
`;

fs.writeFileSync('./test-metadata.js', testCode);
const result = execSync('npm run dev:headless', { cwd: process.cwd(), timeout: 10000 });
console.log(result.toString());
