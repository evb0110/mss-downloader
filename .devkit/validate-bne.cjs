const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function fetchBNEPage(pageNum, docId = '0000007619') {
    const url = `https://bdh-rd.bne.es/pdf.raw?query=id:${docId}&page=${pageNum}&pdf=true`;
    
    return new Promise((resolve, reject) => {
        const options = {
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 30000
        };
        
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer);
            });
        }).on('error', reject);
    });
}

async function createBNEValidationPDF() {
    const outputDir = path.join(__dirname, 'validation-results', '2025-07-22', 'BNE_Spain');
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log('Downloading BNE Spain manuscript pages...');
    
    // Download 10 pages
    const pdfFiles = [];
    for (let i = 1; i <= 10; i++) {
        try {
            console.log(`  Downloading page ${i}...`);
            const pdfBuffer = await fetchBNEPage(i);
            const pdfPath = path.join(outputDir, `page_${String(i).padStart(3, '0')}.pdf`);
            await fs.writeFile(pdfPath, pdfBuffer);
            console.log(`    Saved: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
            pdfFiles.push(pdfPath);
        } catch (error) {
            console.error(`    Failed page ${i}:`, error.message);
        }
    }
    
    if (pdfFiles.length === 0) {
        throw new Error('No pages downloaded successfully');
    }
    
    // Merge PDFs
    console.log('\nMerging PDFs...');
    const finalPdf = path.join(outputDir, 'BNE_Spain_validation.pdf');
    const command = `pdfunite ${pdfFiles.map(f => `"${f}"`).join(' ')} "${finalPdf}"`;
    
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`Created: ${finalPdf}`);
        
        // Validate with poppler
        console.log('\nValidating PDF...');
        const info = execSync(`pdfinfo "${finalPdf}"`, { encoding: 'utf8' });
        console.log(info);
        
        // Clean up individual PDFs
        for (const pdf of pdfFiles) {
            await fs.unlink(pdf);
        }
        
        console.log('\nBNE validation complete!');
    } catch (error) {
        console.error('Error merging PDFs:', error.message);
    }
}

createBNEValidationPDF().catch(console.error);