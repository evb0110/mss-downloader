#!/usr/bin/env node

/**
 * Library Validation Protocol - Test fixed libraries and create PDFs for inspection
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const testLibraries = [
    {
        name: 'BDL Servizirl',
        url: 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903',
        expectedPages: 'Multiple',
        issue: 'Enhanced error handling for server connectivity'
    },
    {
        name: 'Manuscripta.at (Vienna)',
        url: 'https://manuscripta.at/diglit/AT5000-963/0001',
        expectedPages: 'From page 1 onward',
        issue: 'Page range detection fixed'
    },
    {
        name: 'BNC Roma',
        url: 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1',
        expectedPages: 'Multiple high-quality',
        issue: 'Maximum resolution implementation'
    },
    {
        name: 'University of Graz',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        expectedPages: '400+',
        issue: 'Verified working correctly'
    },
    {
        name: 'Internet Culturale',
        url: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
        expectedPages: 'Multiple without error pages',
        issue: 'Infinite loop and hanging fixed'
    },
    {
        name: 'e-manuscripta.ch',
        url: 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497',
        expectedPages: '400+',
        issue: 'Multi-method page detection'
    }
];

async function runValidationProtocol() {
    console.log('🧪 Starting Library Validation Protocol...\n');
    console.log('Following CLAUDE.md validation requirements:');
    console.log('1. Test multiple manuscript pages from each library');
    console.log('2. Verify maximum resolution');
    console.log('3. Confirm different page content');
    console.log('4. Create PDFs for manual inspection');
    console.log('5. Wait for user approval\n');
    
    // Create validation summary
    const validationSummary = {
        date: new Date().toISOString(),
        libraries: [],
        totalTested: testLibraries.length,
        status: 'in_progress'
    };
    
    console.log('📋 Libraries to validate:');
    testLibraries.forEach((lib, index) => {
        console.log(`${index + 1}. ${lib.name}`);
        console.log(`   URL: ${lib.url}`);
        console.log(`   Expected: ${lib.expectedPages} pages`);
        console.log(`   Fix: ${lib.issue}\n`);
        
        validationSummary.libraries.push({
            name: lib.name,
            url: lib.url,
            expectedPages: lib.expectedPages,
            issue: lib.issue,
            status: 'pending',
            result: null
        });
    });
    
    // Save validation plan
    fs.writeFileSync(
        '.devkit/validation-current/validation-plan.json',
        JSON.stringify(validationSummary, null, 2)
    );
    
    console.log('📁 Validation folder prepared: .devkit/validation-current/');
    console.log('📄 Validation plan saved: validation-plan.json');
    console.log('\n⚠️ Note: Some libraries may have server connectivity issues');
    console.log('🎯 Focus: Verify implementations handle errors gracefully');
    console.log('\n✅ Ready for validation protocol execution');
    console.log('💡 Next: Run actual tests and create PDFs for inspection');
}

runValidationProtocol().catch(console.error);