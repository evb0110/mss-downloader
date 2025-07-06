const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test one library at a time with known working URLs
const testUrls = [
  {
    name: 'BDL_Servizirl_Test',
    url: 'https://servizirl.bdl.servizirl.it/vufind/Record/UBO4189969/Description#tabnav',
    timeout: 60000
  },
  {
    name: 'Gallica_Control_Test', 
    url: 'https://gallica.bnf.fr/ark:/12148/btv1b10722208f',
    timeout: 30000
  }
];

async function testSingleUrl(urlData) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing ${urlData.name}...`);
    console.log(`URL: ${urlData.url}`);
    
    const outputPath = path.join(__dirname, '../../CURRENT-VALIDATION', `${urlData.name}.pdf`);
    
    const electronPath = path.join(__dirname, '../../node_modules/.bin/electron');
    const mainPath = path.join(__dirname, '../../dist/main/main.js');
    
    const child = spawn(electronPath, [
      mainPath,
      '--test-mode',
      '--url', urlData.url,
      '--output', outputPath,
      '--pages', '2'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      if (output.includes('Progress:') || output.includes('Downloaded:')) {
        process.stdout.write('.');
      }
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      console.log(`\n❌ ${urlData.name}: Timeout after ${urlData.timeout/1000}s`);
      resolve({ success: false, name: urlData.name, error: 'Timeout' });
    }, urlData.timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`\n✅ ${urlData.name}: Success (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve({ success: true, name: urlData.name, size: stats.size });
      } else {
        console.log(`\n❌ ${urlData.name}: Failed (code: ${code})`);
        if (stderr) console.log(`Error: ${stderr.slice(-300)}`);
        resolve({ success: false, name: urlData.name, error: stderr || `Exit code: ${code}` });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`\n❌ ${urlData.name}: Process error - ${error.message}`);
      resolve({ success: false, name: urlData.name, error: error.message });
    });
  });
}

async function main() {
  console.log('🧪 Quick validation test for BDL Servizirl fix...\n');
  
  for (const urlData of testUrls) {
    const result = await testSingleUrl(urlData);
    
    if (result.success) {
      console.log(`📁 PDF created: CURRENT-VALIDATION/${result.name}.pdf`);
    } else {
      console.log(`💥 Failed: ${result.error}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Quick validation test completed');
}

main().catch(console.error);