/**
 * COMPREHENSIVE FIX for "Unsupported library" errors
 * Based on ultra-deep analysis findings
 */

import { promises as fs } from 'fs';

async function fixUnsupportedLibraryErrors() {
    console.log('🔧 FIXING UNSUPPORTED LIBRARY ERRORS');
    console.log('='=50);

    const sharedLoaderPath = '/Users/evb/WebstormProjects/mss-downloader/src/shared/SharedManifestLoaders.ts';
    const enhancedServicePath = '/Users/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts';

    // Read files
    let sharedLoaderContent = await fs.readFile(sharedLoaderPath, 'utf8');
    let enhancedServiceContent = await fs.readFile(enhancedServicePath, 'utf8');

    console.log('📋 PHASE 1: Fix routing mismatches in EnhancedManuscriptDownloaderService');
    
    // Fix routing mismatches identified in audit
    const routingFixes = [
        { from: "case 'vienna_manuscripta':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('vienna', originalUrl);", 
          to: "case 'vienna_manuscripta':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('vienna_manuscripta', originalUrl);" },
        
        { from: "case 'monte_cassino':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('montecassino', originalUrl);", 
          to: "case 'monte_cassino':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('monte_cassino', originalUrl);" },
          
        { from: "case 'omnes_vallicelliana':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('omnesvallicelliana', originalUrl);", 
          to: "case 'omnes_vallicelliana':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('omnes_vallicelliana', originalUrl);" },
          
        { from: "case 'iccu_api':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('iccu', originalUrl);", 
          to: "case 'iccu_api':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('iccu_api', originalUrl);" }
    ];

    for (const fix of routingFixes) {
        if (enhancedServiceContent.includes(fix.from)) {
            enhancedServiceContent = enhancedServiceContent.replace(fix.from, fix.to);
            console.log(`✅ Fixed routing mismatch: ${fix.from.match(/case '([^']+)'/)?.[1]}`);
        }
    }

    console.log('\n📦 PHASE 2: Add missing switch cases to SharedManifestLoaders');
    
    // Find the location to add missing cases
    const switchEndPattern = /case 'bl':\s*return await this\.getBritishLibraryManifest\(url\);\s*default:\s*throw new Error\(`Unsupported library: \$\{libraryId\}`\);/;
    
    // Missing cases based on audit results
    const missingCases = [
        "case 'cambridge':\n                return await this.getCambridgeManifest(url);",
        "case 'cecilia':\n                return await this.getCeciliaManifest(url);",
        "case 'cologne':\n                return await this.getCologneManifest(url);",
        "case 'czech':\n                return await this.getCzechManifest(url);",
        "case 'diamm':\n                return await this.getDiammManifest(url);",
        "case 'dijon':\n                return await this.getDijonManifest(url);",
        "case 'durham':\n                return await this.getDurhamManifest(url);",
        "case 'emanuscripta':\n                return await this.getEManuscriptaManifest(url);",
        "case 'europeana':\n                return await this.getEuropeanaManifest(url);",
        "case 'florus':\n                return await this.getFlorusManifest(url);",
        "case 'freiburg':\n                return await this.getFreiburgManifest(url);",
        "case 'fulda':\n                return await this.getFuldaManifest(url);",
        "case 'gallica':\n                return await this.getGallicaManifest(url);",
        "case 'generic_iiif':\n                return await this.getGenericIIIFManifest(url);",
        "case 'iccu':\n                return await this.getICCUManifest(url);",
        "case 'iccu_api':\n                return await this.getICCUApiManifest(url);",
        "case 'internet_culturale':\n                return await this.getInternetCulturaleManifest(url);",
        "case 'irht':\n                return await this.getIRHTManifest(url);",
        "case 'isos':\n                return await this.getIsosManifest(url);",
        "case 'laon':\n                return await this.getLaonManifest(url);",
        "case 'manuscripta':\n                return await this.getManuscriptaManifest(url);",
        "case 'mdc':\n                return await this.getMDCManifest(url);",
        "case 'mira':\n                return await this.getMiraManifest(url);",
        "case 'modena':\n                return await this.getModenaManifest(url);",
        "case 'monte_cassino':\n                return await this.getMonteCassinoManifest(url);",
        "case 'montecassino':\n                return await this.getMonteCassinoManifest(url);",
        "case 'nypl':\n                return await this.getNYPLManifest(url);",
        "case 'omnes_vallicelliana':\n                return await this.getOmnesVallicellianManifest(url);",
        "case 'omnesvallicelliana':\n                return await this.getOmnesVallicellianManifest(url);",
        "case 'parker':\n                return await this.getParkerManifest(url);",
        "case 'rbme':\n                return await this.getRBMEManifest(url);",
        "case 'rouen':\n                return await this.getRouenManifest(url);",
        "case 'saint_omer':\n                return await this.getSaintOmerManifest(url);",
        "case 'saintomer':\n                return await this.getSaintOmerManifest(url);",
        "case 'sharedcanvas':\n                return await this.getSharedCanvasManifest(url);",
        "case 'trinity_cam':\n                return await this.getTrinityManifest(url);",
        "case 'ugent':\n                return await this.getUGentManifest(url);",
        "case 'unicatt':\n                return await this.getUnicattManifest(url);",
        "case 'unifr':\n                return await this.getUnifrManifest(url);",
        "case 'vallicelliana':\n                return await this.getVallicellianManifest(url);",
        "case 'vatlib':\n                return await this.getVaticanManifest(url);",
        "case 'vienna':\n                return await this.getViennaManifest(url);",
        "case 'wolfenbuettel':\n                return await this.getWolfenbuettelManifest(url);"
    ];

    // Add missing cases before the default case
    const newSwitchContent = missingCases.join('\n            ') + '\n            case \'bl\':\n                return await this.getBritishLibraryManifest(url);\n            default:\n                throw new Error(`Unsupported library: ${libraryId}`);';
    
    sharedLoaderContent = sharedLoaderContent.replace(
        /case 'bl':\s*return await this\.getBritishLibraryManifest\(url\);\s*default:\s*throw new Error\(`Unsupported library: \$\{libraryId\}`\);/,
        newSwitchContent
    );

    console.log(`✅ Added ${missingCases.length} missing switch cases to SharedManifestLoaders`);

    // Write back the files
    await fs.writeFile(enhancedServicePath, enhancedServiceContent, 'utf8');
    await fs.writeFile(sharedLoaderPath, sharedLoaderContent, 'utf8');

    console.log('\n✅ FIXES APPLIED SUCCESSFULLY');
    console.log('Next step: Run the audit again to verify all fixes work correctly');
}

// Only run if called directly
if (require.main === module) {
    fixUnsupportedLibraryErrors().catch(console.error);
}

export { fixUnsupportedLibraryErrors };