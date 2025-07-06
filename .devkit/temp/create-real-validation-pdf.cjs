const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Critical libraries that had blocking errors and need real PDF validation
const criticalLibraries = [
  {
    name: 'BDL_Servizirl_HANGING_FIX',
    url: 'https://servizirl.bdl.servizirl.it/vufind/Record/UBO4189969/Description#tabnav',
    issue: 'Was hanging on image validation - should now complete quickly',
    timeout: 90000 // 90 seconds - should be much faster now
  },
  {
    name: 'E_Manuscripta_URL_FIX', 
    url: 'https://www.e-manuscripta.ch/zuzcmi/content/titleinfo/6842158',
    issue: 'URL generation was failing - should now work with dynamic library identifier',
    timeout: 60000
  },
  {
    name: 'University_Graz_TIMEOUT_FIX',
    url: 'https://gams.uni-graz.at/o:depcha.book.1506/sdef:TEI/get?mode=view',
    issue: 'Was timing out at 60s - should now work with 90s timeout',
    timeout: 120000 // Give extra time to test the timeout fix
  },
  {
    name: 'Internet_Culturale_XML_FIX',
    url: 'https://www.internetculturale.it/it/1/search?q=manoscritti&instance=magindice',
    issue: 'XML parsing was failing - should now work with enhanced regex',
    timeout: 90000
  }
];

async function createCriticalValidationPDF(library) {
  return new Promise((resolve) => {
    console.log(`\n🔥 CRITICAL TEST: ${library.name}`);
    console.log(`Issue: ${library.issue}`);
    console.log(`URL: ${library.url}`);
    console.log(`Timeout: ${library.timeout/1000}s`);
    
    const outputPath = path.join(__dirname, '../../CURRENT-VALIDATION', `${library.name}.pdf`);
    
    // Start the electron app in test mode
    const electronPath = path.join(__dirname, '../../node_modules/.bin/electron');
    const mainPath = path.join(__dirname, '../../dist/main/main.js');
    
    const child = spawn(electronPath, [
      mainPath,
      '--test-download',
      '--url', library.url,
      '--output', outputPath,
      '--pages', '3',
      '--timeout', (library.timeout / 1000).toString()
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      }
    });

    let stdout = '';
    let stderr = '';
    let progressSeen = false;
    let downloadStarted = false;
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Track progress indicators
      if (output.includes('Manifest loaded') || output.includes('Starting download')) {
        downloadStarted = true;
        console.log('   📋 Manifest loaded, download starting...');
      }
      
      if (output.includes('Progress:') || output.includes('Downloaded:') || output.includes('Page ')) {
        if (!progressSeen) {
          progressSeen = true;
          console.log('   📥 Download progress detected...');
        }
        process.stdout.write('.');
      }
      
      if (output.includes('PDF created') || output.includes('Download completed')) {
        console.log('\n   ✅ PDF creation completed!');
      }
    });
    
    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      
      // Log critical errors immediately
      if (error.includes('Error:') || error.includes('Failed:')) {
        console.log(`   ❌ Error: ${error.slice(0, 100)}`);
      }
    });
    
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      console.log(`\n   ⏰ TIMEOUT after ${library.timeout/1000}s`);
      resolve({ 
        success: false, 
        name: library.name, 
        error: 'Timeout',
        downloadStarted,
        progressSeen
      });
    }, library.timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`\n   ✅ SUCCESS: ${library.name} (${sizeMB}MB)`);
        resolve({ 
          success: true, 
          name: library.name, 
          size: stats.size,
          downloadStarted,
          progressSeen
        });
      } else {
        console.log(`\n   ❌ FAILED: ${library.name} (exit code: ${code})`);
        if (stderr) {
          console.log(`   Error details: ${stderr.slice(-200)}`);
        }
        resolve({ 
          success: false, 
          name: library.name, 
          error: stderr || `Exit code: ${code}`,
          downloadStarted,
          progressSeen
        });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`\n   ❌ PROCESS ERROR: ${error.message}`);
      resolve({ 
        success: false, 
        name: library.name, 
        error: error.message,
        downloadStarted: false,
        progressSeen: false
      });
    });
  });
}

async function main() {
  console.log('🔥 CRITICAL VALIDATION: Testing 4 libraries with blocking errors');
  console.log('=' .repeat(70));
  console.log('These libraries had download-preventing bugs that are now fixed:');
  console.log('1. BDL Servizirl - Hanging on image validation');
  console.log('2. e-manuscripta.ch - URL generation failure'); 
  console.log('3. University of Graz - Timeout issues');
  console.log('4. Internet Culturale - XML parsing failure');
  console.log('');
  
  const results = [];
  
  for (let i = 0; i < criticalLibraries.length; i++) {
    const library = criticalLibraries[i];
    console.log(`\n[${i + 1}/${criticalLibraries.length}] Testing ${library.name}...`);
    
    try {
      const result = await createCriticalValidationPDF(library);
      results.push(result);
      
      // Brief pause between tests
      if (i < criticalLibraries.length - 1) {
        console.log('   ⏳ Waiting 3s before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.log(`   ❌ EXCEPTION: ${error.message}`);
      results.push({ 
        success: false, 
        name: library.name, 
        error: error.message,
        downloadStarted: false,
        progressSeen: false
      });
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('🔥 CRITICAL VALIDATION RESULTS');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ SUCCESSFUL: ${successful.length}/${criticalLibraries.length}`);
  successful.forEach(r => {
    const sizeMB = (r.size / 1024 / 1024).toFixed(2);
    console.log(`   ✅ ${r.name} - ${sizeMB}MB PDF created`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED: ${failed.length}/${criticalLibraries.length}`);
    failed.forEach(r => {
      console.log(`   ❌ ${r.name}`);
      console.log(`      Error: ${r.error?.slice(0, 100) || 'Unknown'}`);
      console.log(`      Download started: ${r.downloadStarted ? 'Yes' : 'No'}`);
      console.log(`      Progress seen: ${r.progressSeen ? 'Yes' : 'No'}`);
    });
  }
  
  console.log(`\n📁 PDFs location: CURRENT-VALIDATION/`);
  
  if (successful.length === criticalLibraries.length) {
    console.log('\n🎉 ALL CRITICAL FIXES VALIDATED!');
    console.log('All 4 libraries that had blocking errors now work correctly.');
    console.log('Ready for user approval and version bump.');
  } else {
    console.log('\n⚠️ Some critical fixes still have issues.');
    console.log('Please review the failed tests above.');
  }
  
  process.exit(successful.length === criticalLibraries.length ? 0 : 1);
}

main().catch(console.error);