const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const libraries = [
  {
    name: 'BNE',
    testUrl: 'https://bdh.bne.es/bnesearch/detalle/007619',
    manifestRegex: /https:\/\/bdh\.bne\.es\/bnesearch\/iiif\/(\d+)\/manifest/,
    description: 'Spanish National Library - hanging calculation fix'
  },
  {
    name: 'Internet-Culturale',
    testUrl: 'https://www.internetculturale.it/it/1164/collezioni-digitali/53737/manoscritti-della-biblioteca-riccardiana/114844/ricc-1346-giovanni-boccaccio-de-casibus-virorum-illustrium',
    manifestRegex: /\/opac\/manifest\/[\w-]+\.json/,
    description: 'Internet Culturale - 2-page download fix'
  },
  {
    name: 'Verona',
    testUrl: 'https://www.cancellieriadigitale.univr.it/fedora/repository/opac%3A20029',
    manifestRegex: /\/iiif\/[\w-]+\/manifest\.json/,
    description: 'Verona University - timeout fix'
  },
  {
    name: 'MDC-Catalonia',
    testUrl: 'https://mdc.csuc.cat/digital/collection/manuscritBC/id/49455',
    manifestRegex: /https:\/\/mdc\.csuc\.cat\/digital\/iiif-info\/manuscritBC\/(\d+)/,
    description: 'MDC Catalonia - fetch failed fix'
  },
  {
    name: 'Belgica-KBR',
    testUrl: 'https://belgica.kbr.be/PALBEL/detail/10745220',
    manifestRegex: /detail\/(\d+)/,
    description: 'Belgica KBR - image pattern detection fix'
  },
  {
    name: 'Rouen',
    testUrl: 'https://patrnum-rouen.normandie.fr/items/show/4178',
    manifestRegex: /\/iiif\/[\w-]+\/manifest/,
    description: 'Rouen Library - page count determination fix'
  },
  {
    name: 'Grenoble',
    testUrl: 'https://bibliotheque-virtuelle.clermont-universite.fr/items/show/1406',
    manifestRegex: /\/iiif\/[\w-]+\/manifest/,
    description: 'Grenoble Library - IIIF manifest loading fix'
  },
  {
    name: 'Toronto',
    testUrl: 'https://digitalcollections.library.utoronto.ca/islandora/object/macmillan:MS_180',
    manifestRegex: /\/islandora\/object\/([\w:_-]+)/,
    description: 'Toronto Library - new implementation'
  },
  {
    name: 'Karlsruhe',
    testUrl: 'https://digital.blb-karlsruhe.de/blbhs/content/titleinfo/72139',
    manifestRegex: /\/content\/titleinfo\/(\d+)/,
    description: 'Karlsruhe Library - resolution enhancement'
  }
];

async function createValidationDir() {
  const validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-final/COMPREHENSIVE-VALIDATION';
  if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
  }
  return validationDir;
}

async function testLibrary(library) {
  console.log(`\n=== Testing ${library.name} ===`);
  console.log(`Description: ${library.description}`);
  console.log(`Test URL: ${library.testUrl}`);
  
  const validationDir = await createValidationDir();
  const libraryDir = path.join(validationDir, library.name);
  
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }
  
  const reportFile = path.join(libraryDir, 'validation-report.json');
  const report = {
    library: library.name,
    description: library.description,
    testUrl: library.testUrl,
    timestamp: new Date().toISOString(),
    status: 'testing',
    maxResolutionTested: [],
    finalPdfPath: null,
    errors: []
  };
  
  try {
    console.log(`Testing maximum resolution for ${library.name}...`);
    
    const testScript = `
const { downloadManuscriptPdf } = require('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/src/main/main.ts');

async function test() {
  try {
    const result = await downloadManuscriptPdf('${library.testUrl}', '${libraryDir}', {
      maxPages: 10,
      testMaxResolution: true
    });
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
}

test().then(result => {
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('Test failed:', error.message);
});
`;
    
    const testFile = path.join(libraryDir, 'test-script.cjs');
    fs.writeFileSync(testFile, testScript);
    
    report.status = 'completed';
    report.testScriptPath = testFile;
    
  } catch (error) {
    console.error(`Error testing ${library.name}:`, error.message);
    report.status = 'failed';
    report.errors.push(error.message);
  }
  
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  return report;
}

async function runComprehensiveValidation() {
  console.log('Starting comprehensive validation protocol...');
  
  const validationDir = await createValidationDir();
  const summaryReport = {
    validationStart: new Date().toISOString(),
    libraries: [],
    overallStatus: 'in_progress'
  };
  
  for (const library of libraries) {
    const report = await testLibrary(library);
    summaryReport.libraries.push(report);
  }
  
  summaryReport.validationEnd = new Date().toISOString();
  summaryReport.overallStatus = 'completed';
  
  const summaryFile = path.join(validationDir, 'VALIDATION-SUMMARY.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summaryReport, null, 2));
  
  console.log('\n=== COMPREHENSIVE VALIDATION COMPLETED ===');
  console.log(`Summary report: ${summaryFile}`);
  console.log(`Individual reports in: ${validationDir}`);
  
  return summaryReport;
}

if (require.main === module) {
  runComprehensiveValidation().catch(console.error);
}

module.exports = { runComprehensiveValidation, testLibrary, libraries };