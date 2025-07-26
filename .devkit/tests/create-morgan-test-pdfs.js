const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function createMorganTestPDFs() {
    console.log('📚 Creating Morgan Library test PDFs...\n');
    
    // Create clean output directory
    const outputDir = path.join(process.cwd(), '.devkit', 'validation', 'morgan-library-fixed');
    
    // Clean up old validation folders
    const validationRoot = path.join(process.cwd(), '.devkit', 'validation');
    if (fs.existsSync(validationRoot)) {
        await execAsync(`rm -rf "${validationRoot}"`);
    }
    
    fs.mkdirSync(outputDir, { recursive: true });
    
    const manuscripts = [
        {
            id: 'lindau-gospels',
            name: 'Lindau Gospels',
            pages: [
                { num: 1, file: '76874/m1-front-cover.jpg' },
                { num: 2, file: '76874/m2-front-pastedown.jpg' },
                { num: 3, file: '76874/001r.jpg' },
                { num: 4, file: '76874/001v.jpg' },
                { num: 5, file: '76874/002r.jpg' },
                { num: 6, file: '76874/002v.jpg' },
                { num: 7, file: '76874/003r.jpg' },
                { num: 8, file: '76874/003v.jpg' },
                { num: 9, file: '76874/004r.jpg' },
                { num: 10, file: '76874/004v.jpg' }
            ]
        },
        {
            id: 'arenberg-gospels',
            name: 'Arenberg Gospels',
            pages: [
                { num: 1, file: '159161/159161v_0017.jpg' },
                { num: 2, file: '159161/159161v_0019.jpg' },
                { num: 3, file: '159161/159161v_0021.jpg' },
                { num: 4, file: '159161/159161v_0023.jpg' },
                { num: 5, file: '159161/159161v_0025.jpg' },
                { num: 6, file: '159161/159161v_0027.jpg' },
                { num: 7, file: '159161/159161v_0029.jpg' },
                { num: 8, file: '159161/159161v_0031.jpg' },
                { num: 9, file: '159161/159161v_0033.jpg' },
                { num: 10, file: '159161/159161v_0035.jpg' }
            ]
        }
    ];
    
    for (const manuscript of manuscripts) {
        console.log(`\n📖 Processing ${manuscript.name}...`);
        const downloadedImages = [];
        
        for (const page of manuscript.pages) {
            const imageUrl = `https://www.themorgan.org/sites/default/files/facsimile/${page.file}`;
            console.log(`  Downloading page ${page.num}...`);
            
            try {
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    console.error(`    ❌ Failed: ${response.status}`);
                    continue;
                }
                
                const buffer = await response.arrayBuffer();
                const imagePath = path.join(outputDir, `${manuscript.id}-page-${String(page.num).padStart(3, '0')}.jpg`);
                fs.writeFileSync(imagePath, Buffer.from(buffer));
                downloadedImages.push(imagePath);
                
                const stats = fs.statSync(imagePath);
                console.log(`    ✅ Downloaded: ${(stats.size / 1024).toFixed(2)} KB`);
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`    ❌ Error: ${error.message}`);
            }
        }
        
        // Create PDF
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(outputDir, `${manuscript.name.replace(/\s+/g, '-')}.pdf`);
            console.log(`\n  Creating PDF: ${path.basename(pdfPath)}`);
            
            try {
                await execAsync(`convert ${downloadedImages.map(p => `"${p}"`).join(' ')} "${pdfPath}"`);
                
                const pdfStats = fs.statSync(pdfPath);
                console.log(`  ✅ PDF created: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Validate PDF
                const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
                const pagesLine = stdout.split('\n').find(line => line.includes('Pages:'));
                console.log(`  ${pagesLine}`);
                
            } catch (error) {
                console.error(`  ❌ Error creating PDF: ${error.message}`);
            }
        }
    }
    
    console.log('\n\n✅ Morgan Library validation complete!');
    console.log('Opening folder for inspection...');
    
    // Open the folder
    await execAsync(`open "${outputDir}"`);
}

createMorganTestPDFs().catch(console.error);