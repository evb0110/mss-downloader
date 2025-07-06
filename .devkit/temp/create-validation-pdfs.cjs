const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const validationUrls = [
  {
    name: 'BDL_Servizirl_Validation',
    url: 'https://servizirl.bdl.servizirl.it/vufind/Record/UBO4189969/Description#tabnav',
    library: 'BDL Servizirl',
    description: 'Test hanging fix - should complete quickly'
  },
  {
    name: 'Manuscripta_AT_Validation', 
    url: 'https://manuscripta.at/hs_detail.php?ID=39239',
    library: 'Manuscripta.at',
    description: 'Verify existing functionality works'
  },
  {
    name: 'BNC_Roma_Validation',
    url: 'https://www.libroantico.bnc.roma.sbn.it/index.php?it/297/manoscritti-digitalizzati',
    library: 'BNC Roma',
    description: 'Test server accessibility and implementation'
  },
  {
    name: 'University_Graz_Validation',
    url: 'https://gams.uni-graz.at/o:depcha.book.1506/sdef:TEI/get?mode=view',
    library: 'University of Graz', 
    description: 'Test timeout fix (90s timeout multiplier)'
  },
  {
    name: 'Internet_Culturale_Validation',
    url: 'https://www.internetculturale.it/it/1/search?q=manoscritti&instance=magindice',
    library: 'Internet Culturale',
    description: 'Test XML parsing and duplicate URL detection fix'
  },
  {
    name: 'E_Manuscripta_CH_Validation',
    url: 'https://www.e-manuscripta.ch/zuzcmi/content/titleinfo/6842158',
    library: 'e-manuscripta.ch',
    description: 'Test dynamic URL generation fix'
  }
];

async function createValidationPdf(urlData, index) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Creating ${urlData.name} (${index + 1}/6) ===`);
    console.log(`Library: ${urlData.library}`);
    console.log(`Description: ${urlData.description}`);
    console.log(`URL: ${urlData.url}`);
    
    const outputPath = path.join(__dirname, '../../CURRENT-VALIDATION', `${urlData.name}.pdf`);
    
    const electronPath = path.join(__dirname, '../../node_modules/.bin/electron');
    const mainPath = path.join(__dirname, '../../dist/main/main.js');
    
    const child = spawn(electronPath, [
      mainPath,
      '--test-mode',
      '--url', urlData.url,
      '--output', outputPath,
      '--pages', '3'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Timeout after 120s for ${urlData.name}`));
    }, 120000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`✅ ${urlData.name}: Created successfully (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve({ success: true, name: urlData.name, size: stats.size });
      } else {
        console.log(`❌ ${urlData.name}: Failed (code: ${code})`);
        if (stderr) console.log(`Error: ${stderr.slice(-200)}`);
        resolve({ success: false, name: urlData.name, error: stderr || `Exit code: ${code}` });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ ${urlData.name}: Process error - ${error.message}`);
      reject(error);
    });
  });
}

async function main() {
  console.log('🔍 Creating validation PDFs for all 6 fixed libraries...\n');
  
  const results = [];
  
  for (let i = 0; i < validationUrls.length; i++) {
    try {
      const result = await createValidationPdf(validationUrls[i], i);
      results.push(result);
      
      // Small delay between downloads
      if (i < validationUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`❌ ${validationUrls[i].name}: Exception - ${error.message}`);
      results.push({ success: false, name: validationUrls[i].name, error: error.message });
    }
  }
  
  console.log('\n📊 VALIDATION SUMMARY:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/6`);
  successful.forEach(r => {
    const sizeMB = (r.size / 1024 / 1024).toFixed(2);
    console.log(`   • ${r.name} (${sizeMB}MB)`);
  });
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/6`);
    failed.forEach(r => {
      console.log(`   • ${r.name}: ${r.error?.slice(0, 100) || 'Unknown error'}`);
    });
  }
  
  console.log(`\n📁 All PDFs saved to: CURRENT-VALIDATION/`);
  process.exit(successful.length === 6 ? 0 : 1);
}

main().catch(console.error);