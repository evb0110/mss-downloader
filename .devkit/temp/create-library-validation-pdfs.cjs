const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Use the same approach as the working test files
const validationLibraries = [
  {
    name: 'Gallica_BnF_Control',
    url: 'https://gallica.bnf.fr/ark:/12148/btv1b10722208f',
    description: 'Control test - known working library',
    expectedPages: 3
  },
  {
    name: 'BDL_Servizirl_Fixed',
    url: 'https://servizirl.bdl.servizirl.it/vufind/Record/UBO4189969/Description#tabnav',
    description: 'Test BDL hanging fix',
    expectedPages: 3
  },
  {
    name: 'E_Manuscripta_Fixed',
    url: 'https://www.e-manuscripta.ch/zuzcmi/content/titleinfo/6842158',
    description: 'Test e-manuscripta URL generation fix',
    expectedPages: 3
  }
];

async function createValidationPDF(library) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing ${library.name}...`);
    console.log(`Description: ${library.description}`);
    console.log(`URL: ${library.url}`);
    
    const outputPath = path.join(__dirname, '../../CURRENT-VALIDATION', `${library.name}.pdf`);
    
    // Use the same approach as the working tests
    const child = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        TEST_URL: library.url,
        TEST_OUTPUT: outputPath,
        TEST_PAGES: library.expectedPages.toString(),
        NODE_ENV: 'test'
      }
    });

    let stdout = '';
    let stderr = '';
    let appStarted = false;
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Look for app startup indicators
      if (output.includes('Electron app started') || output.includes('Ready to show')) {
        appStarted = true;
        console.log('✅ App started, beginning test...');
      }
      
      if (output.includes('PDF created') || output.includes('Download completed')) {
        console.log('✅ Download completed');
      }
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Give it 60 seconds to complete
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      console.log(`\n⏰ ${library.name}: Timeout after 60s`);
      resolve({ 
        success: false, 
        name: library.name, 
        error: 'Timeout',
        appStarted 
      });
    }, 60000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`\n✅ ${library.name}: Success (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve({ 
          success: true, 
          name: library.name, 
          size: stats.size,
          appStarted 
        });
      } else {
        console.log(`\n❌ ${library.name}: Failed (code: ${code})`);
        if (stderr) console.log(`Error: ${stderr.slice(-300)}`);
        resolve({ 
          success: false, 
          name: library.name, 
          error: stderr || `Exit code: ${code}`,
          appStarted 
        });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`\n❌ ${library.name}: Process error - ${error.message}`);
      resolve({ 
        success: false, 
        name: library.name, 
        error: error.message,
        appStarted: false 
      });
    });
  });
}

async function main() {
  console.log('🧪 Creating validation PDFs for fixed libraries...\n');
  
  // Ensure output directory exists
  const outputDir = path.join(__dirname, '../../CURRENT-VALIDATION');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const results = [];
  
  for (const library of validationLibraries) {
    try {
      const result = await createValidationPDF(library);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`❌ ${library.name}: Exception - ${error.message}`);
      results.push({ 
        success: false, 
        name: library.name, 
        error: error.message,
        appStarted: false 
      });
    }
  }
  
  console.log('\n📊 VALIDATION SUMMARY:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${validationLibraries.length}`);
  successful.forEach(r => {
    const sizeMB = (r.size / 1024 / 1024).toFixed(2);
    console.log(`   • ${r.name} (${sizeMB}MB)`);
  });
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${validationLibraries.length}`);
    failed.forEach(r => {
      console.log(`   • ${r.name}: ${r.error?.slice(0, 100) || 'Unknown error'}`);
      if (!r.appStarted) {
        console.log(`     └─ App startup issue detected`);
      }
    });
  }
  
  console.log(`\n📁 All PDFs saved to: CURRENT-VALIDATION/`);
  
  if (successful.length === validationLibraries.length) {
    console.log('\n🎉 ALL VALIDATION TESTS PASSED!');
    console.log('Ready for user approval and version bump.');
  } else {
    console.log('\n⚠️ Some validation tests failed.');
    console.log('Please review the errors above.');
  }
}

main().catch(console.error);