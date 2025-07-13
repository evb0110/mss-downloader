const fs = require('fs');
const path = require('path');

/**
 * SIMPLE: Minimal ARM64 fix - only target the specific pdf-lib issue
 * Avoid breaking working dependencies
 */
module.exports = async function(context) {
  const { appOutDir, electronPlatformName, arch } = context;
  
  if (arch !== 'arm64' || electronPlatformName !== 'win32') {
    return;
  }
  
  console.log(`🔧 Applying minimal ARM64 fixes: ${appOutDir}`);
  console.log('🔧 ARM64 script is executing for:', electronPlatformName, arch);
  
  try {
    const appPath = path.join(appOutDir, 'resources', 'app');
    
    if (!fs.existsSync(appPath)) {
      return;
    }
    
    // ONLY fix the specific pdf-lib issue that's causing the error
    const pdfLibPath = path.join(appPath, 'node_modules', 'pdf-lib');
    if (fs.existsSync(pdfLibPath)) {
      console.log('🔧 Fixing pdf-lib ES module issue');
      fixPdfLibPackageJson(pdfLibPath);
    }
    
    console.log('✅ Applied minimal ARM64 fixes');
    
  } catch (error) {
    console.error('❌ ARM64 fix failed:', error.message);
    throw error;
  }
};

function fixPdfLibPackageJson(pdfLibPath) {
  const packageJsonPath = path.join(pdfLibPath, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      let modified = false;
      
      // Force CommonJS by removing ES module entry points
      if (packageData.module) {
        delete packageData.module;
        modified = true;
      }
      
      if (packageData.type === 'module') {
        packageData.type = 'commonjs';
        modified = true;
      }
      
      // Ensure main points to CommonJS version
      if (packageData.main !== 'cjs/index.js') {
        packageData.main = 'cjs/index.js';
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
        console.log('📝 Fixed pdf-lib package.json for ARM64');
      }
      
      // CRITICAL: Remove the problematic ES module directory entirely
      const esDir = path.join(pdfLibPath, 'es');
      if (fs.existsSync(esDir)) {
        fs.rmSync(esDir, { recursive: true, force: true });
        console.log('🗑️ Removed pdf-lib ES module directory for ARM64');
      }
      
    } catch (error) {
      console.warn('⚠️ Could not fix pdf-lib package.json:', error.message);
    }
  }
}