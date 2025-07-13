const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * CRITICAL: Fix ES module issues inside ASAR files
 * This script extracts ASAR, fixes all package.json files, and repacks
 */
module.exports = async function(context) {
  const { appOutDir } = context;
  console.log('🔧 Fixing ES modules inside ASAR files:', appOutDir);
  
  try {
    // Find all ASAR files
    const asarFiles = findAsarFiles(appOutDir);
    console.log(`📦 Found ${asarFiles.length} ASAR files to process`);
    
    for (const asarPath of asarFiles) {
      await processAsarFile(asarPath);
    }
    
    console.log('✅ All ASAR files processed successfully');
  } catch (error) {
    console.error('❌ ASAR processing failed:', error.message);
    throw error;
  }
};

function findAsarFiles(dir) {
  const asarFiles = [];
  
  function searchDir(currentDir) {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          searchDir(fullPath);
        } else if (item.name.endsWith('.asar')) {
          asarFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  searchDir(dir);
  return asarFiles;
}

async function processAsarFile(asarPath) {
  console.log(`🔄 Processing ASAR: ${asarPath}`);
  
  const asarDir = path.dirname(asarPath);
  const asarName = path.basename(asarPath, '.asar');
  const extractDir = path.join(asarDir, `${asarName}_extracted`);
  const backupPath = `${asarPath}.backup`;
  
  try {
    // Create backup
    fs.copyFileSync(asarPath, backupPath);
    
    // Extract ASAR
    execSync(`npx asar extract "${asarPath}" "${extractDir}"`, { stdio: 'pipe' });
    
    // Fix all package.json and JavaScript files
    const fixedCount = fixPackageJsonFiles(extractDir);
    console.log(`📝 Fixed ${fixedCount} files (package.json and .js files)`);
    
    if (fixedCount > 0) {
      // Repack ASAR
      execSync(`npx asar pack "${extractDir}" "${asarPath}"`, { stdio: 'pipe' });
      console.log(`✅ Repacked ASAR: ${asarPath}`);
    }
    
    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(backupPath);
    
  } catch (error) {
    console.error(`❌ Failed to process ${asarPath}:`, error.message);
    
    // Restore backup
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, asarPath);
      fs.unlinkSync(backupPath);
    }
    
    // Cleanup
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    
    throw error;
  }
}

function fixPackageJsonFiles(dir) {
  let fixedCount = 0;
  
  function processDir(currentDir) {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          processDir(fullPath);
        } else if (item.name === 'package.json') {
          if (fixPackageJson(fullPath)) {
            fixedCount++;
          }
        } else if (item.name.endsWith('.js')) {
          if (fixJavaScriptFile(fullPath)) {
            fixedCount++;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  processDir(dir);
  return fixedCount;
}

function fixPackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const packageData = JSON.parse(content);
    
    if (packageData.type === 'module') {
      console.log(`🔄 Converting ${filePath} from ES module to CommonJS`);
      packageData.type = 'commonjs';
      fs.writeFileSync(filePath, JSON.stringify(packageData, null, 2));
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`⚠️ Could not process ${filePath}:`, error.message);
    return false;
  }
}

function fixJavaScriptFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let newContent = content;
    
    // Convert ES module imports to CommonJS requires
    // Handle various import patterns including node: imports
    const patterns = [
      // import process from 'node:process';
      /import\s+(\w+)\s+from\s+['"`]node:(\w+)['"`];?/g,
      // import { something } from 'node:module';
      /import\s+\{([^}]+)\}\s+from\s+['"`]node:(\w+)['"`];?/g,
      // import * as name from 'module';
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`];?/g,
      // import name from 'module';
      /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`];?/g,
      // import { named } from 'module';
      /import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`];?/g,
      // import 'module';
      /import\s+['"`]([^'"`]+)['"`];?/g
    ];
    
    // Apply each pattern sequentially
    patterns.forEach((pattern, index) => {
      newContent = newContent.replace(pattern, (...args) => {
        modified = true;
        const match = args[0];
        
        if (index === 0) {
          // import process from 'node:process';
          const [, varName, moduleName] = args;
          return `const ${varName} = require('${moduleName}');`;
        } else if (index === 1) {
          // import { something } from 'node:module';
          const [, namedImports, moduleName] = args;
          const named = namedImports.split(',').map(n => n.trim()).filter(n => n);
          return `const { ${named.join(', ')} } = require('${moduleName}');`;
        } else if (index === 2) {
          // import * as name from 'module';
          const [, varName, modulePath] = args;
          return `const ${varName} = require('${modulePath}');`;
        } else if (index === 3) {
          // import name from 'module';
          const [, varName, modulePath] = args;
          return `const ${varName} = require('${modulePath}');`;
        } else if (index === 4) {
          // import { named } from 'module';
          const [, namedImports, modulePath] = args;
          const named = namedImports.split(',').map(n => n.trim()).filter(n => n);
          return `const { ${named.join(', ')} } = require('${modulePath}');`;
        } else if (index === 5) {
          // import 'module';
          const [, modulePath] = args;
          return `require('${modulePath}');`;
        }
        
        return match;
      });
    });
    
    // Convert ES module exports to CommonJS
    newContent = newContent.replace(/export\s+default\s+/g, 'module.exports = ');
    newContent = newContent.replace(/export\s+\{([^}]+)\}/g, (match, exports) => {
      modified = true;
      const exportList = exports.split(',').map(e => e.trim()).filter(e => e);
      return exportList.map(exp => `module.exports.${exp} = ${exp};`).join('\n');
    });
    newContent = newContent.replace(/export\s+(?:const|let|var|function|class)\s+(\w+)/g, (match, name) => {
      modified = true;
      return match.replace('export ', '') + `\nmodule.exports.${name} = ${name};`;
    });
    
    if (modified) {
      console.log(`🔧 Converting ES module syntax in ${filePath}`);
      fs.writeFileSync(filePath, newContent, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`⚠️ Could not process JS file ${filePath}:`, error.message);
    return false;
  }
}