const fs = require('fs');
const path = require('path');

/**
 * TARGETED: Only fix the specific pdf-lib ES module issue
 * Minimal processing for maximum performance
 */
module.exports = async function(context) {
  const { appOutDir, electronPlatformName, arch } = context;
  
  if (arch !== 'arm64' || electronPlatformName !== 'win32') {
    console.log(`⏭️ Skipping ARM64 fixes for ${electronPlatformName}-${arch}`);
    return;
  }
  
  console.log(`🎯 Applying targeted ARM64 fixes for ${electronPlatformName}-${arch}`);
  
  try {
    const { execSync } = require('child_process');
    const asarFile = path.join(appOutDir, 'resources', 'app.asar');
    const tempDir = path.join(path.dirname(appOutDir), 'temp-arm64-fix');
    
    if (!fs.existsSync(asarFile)) {
      console.log('⚠️ ASAR file not found, skipping fix');
      return;
    }
    
    // Extract ASAR temporarily
    console.log('📦 Extracting ASAR for targeted fixes...');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    execSync(`npx asar extract "${asarFile}" "${tempDir}"`);
    
    // ONLY fix pdf-lib - nothing else
    const pdfLibPath = path.join(tempDir, 'node_modules', 'pdf-lib');
    if (fs.existsSync(pdfLibPath)) {
      console.log('🔧 Fixing pdf-lib ES module issue...');
      
      // Remove ES module directory
      const esDir = path.join(pdfLibPath, 'es');
      if (fs.existsSync(esDir)) {
        fs.rmSync(esDir, { recursive: true, force: true });
        console.log('🗑️ Removed pdf-lib ES module directory');
      }
      
      // Fix package.json
      const packageJsonPath = path.join(pdfLibPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageData.module) {
          delete packageData.module;
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
          console.log('📝 Fixed pdf-lib package.json');
        }
      }
    }
    
    // Repack ASAR
    console.log('📦 Repacking ASAR...');
    fs.unlinkSync(asarFile);
    execSync(`npx asar pack "${tempDir}" "${asarFile}"`);
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('✅ ARM64 fixes completed successfully');
    
  } catch (error) {
    console.error('❌ ARM64 fix failed:', error.message);
    // Don't throw - let the build continue
  }
};