#!/usr/bin/env node

const { promises: fs } = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const https = require('https');
const { JSDOM } = require('jsdom');

const VALIDATION_FOLDER = path.join(__dirname, 'validation-results', new Date().toISOString().split('T')[0]);
const TEST_LIBRARIES = [
    {
        name: 'BDL_Servizirl',
        url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903',
        library: 'bdl'
    },
    {
        name: 'Verona',
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        library: 'verona'
    },
    {
        name: 'Vienna_Manuscripta',
        url: 'https://manuscripta.at/diglit/AT5000-71/0011',
        library: 'vienna_manuscripta'
    },
    {
        name: 'BNE_Spain',
        url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
        library: 'bne'
    },
    {
        name: 'MDC_Catalonia', 
        url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
        library: 'mdc_catalonia'
    },
    {
        name: 'Grenoble',
        url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        library: 'grenoble'
    },
    {
        name: 'Karlsruhe',
        url: 'https://digital.blb-karlsruhe.de/blbhs/content/titleinfo/3464606',
        library: 'karlsruhe'
    },
    {
        name: 'Florence',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515',
        library: 'florence'
    },
    {
        name: 'Library_of_Congress',
        url: 'https://www.loc.gov/item/2010414164/',
        library: 'loc'
    },
    {
        name: 'University_of_Graz',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        library: 'graz'
    }
];

const IIIF_RESOLUTIONS = [
    'full/full/0/default.jpg',
    'full/max/0/default.jpg',
    'full/4000,/0/default.jpg',
    'full/3000,/0/default.jpg',
    'full/2000,/0/default.jpg',
    'full/1500,/0/default.jpg',
    'full/1000,/0/default.jpg'
];

class ValidationScript {
    constructor() {
        this.results = [];
    }

    async init() {
        await fs.mkdir(VALIDATION_FOLDER, { recursive: true });
        console.log(`Created validation folder: ${VALIDATION_FOLDER}`);
    }

    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.fetchUrl(url, options);
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`  Retry ${i + 1}/${retries} after error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    async fetchUrl(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': options.headers?.Accept || '*/*',
                    ...options.headers
                },
                timeout: 30000
            };

            const req = https.request(requestOptions, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    this.fetchUrl(redirectUrl, options).then(resolve).catch(reject);
                    return;
                }

                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        buffer: () => Promise.resolve(buffer),
                        text: () => Promise.resolve(buffer.toString()),
                        json: () => Promise.resolve(JSON.parse(buffer.toString()))
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async getManifestForLibrary(library) {
        console.log(`  Fetching manifest for ${library.name}...`);
        
        try {
            // Special handling for different libraries
            switch (library.library) {
                case 'bdl':
                    return await this.getBDLManifest(library.url);
                case 'verona':
                    return await this.getVeronaManifest(library.url);
                case 'vienna_manuscripta':
                    return await this.getViennaManuscriptaManifest(library.url);
                case 'bne':
                    return await this.getBNEManifest(library.url);
                case 'mdc_catalonia':
                    return await this.getMDCCataloniaManifest(library.url);
                case 'grenoble':
                    return await this.getGrenobleManifest(library.url);
                case 'karlsruhe':
                    return await this.getKarlsruheManifest(library.url);
                case 'florence':
                    return await this.getFlorenceManifest(library.url);
                case 'loc':
                    return await this.getLibraryOfCongressManifest(library.url);
                case 'graz':
                    return await this.getGrazManifest(library.url);
                default:
                    throw new Error(`Unsupported library: ${library.library}`);
            }
        } catch (error) {
            console.error(`  Error getting manifest: ${error.message}`);
            throw error;
        }
    }

    async getBDLManifest(url) {
        const match = url.match(/BDL-OGGETTO-(\d+)/);
        if (!match) throw new Error('Invalid BDL URL');
        
        const objectId = match[1];
        const manifestUrl = `https://www.bdl.servizirl.it/bdl/api/v1/oggetto/${objectId}/manifest`;
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (const canvas of manifest.sequences[0].canvases) {
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${images.length + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    async getVeronaManifest(url) {
        const match = url.match(/codice=(\d+)/);
        if (!match) throw new Error('Invalid Verona URL');
        
        const codice = match[1];
        
        // Mapping from codice to manifest ID
        const manifestMappings = {
            '12': 'CXLV1331',
            '14': 'CVII1001',
            '15': 'LXXXIX841',
            '17': 'msClasseIII81'
        };
        
        const manifestId = manifestMappings[codice];
        if (!manifestId) {
            throw new Error(`Unknown Verona manuscript code: ${codice}`);
        }
        
        // Use the IIIF manifest from nbm.regione.veneto.it
        const manifestUrl = `https://nbm.regione.veneto.it/manifest/${manifestId}.json`;
        
        try {
            const manifestResponse = await this.fetchWithRetry(manifestUrl);
            if (!manifestResponse.ok) throw new Error(`Manifest fetch failed: ${manifestResponse.status}`);
            
            const manifest = await manifestResponse.json();
            const images = [];
            
            // Extract images from IIIF manifest
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases.slice(0, 10); // First 10 pages
                
                for (const canvas of canvases) {
                    if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                        const resource = canvas.images[0].resource;
                        // Use service URL for high quality if available
                        let imageUrl = resource['@id'] || resource.id;
                        
                        if (resource.service && resource.service['@id']) {
                            // Use IIIF Image API for full resolution
                            imageUrl = resource.service['@id'] + '/full/full/0/default.jpg';
                        }
                        
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${images.length + 1}`
                        });
                    }
                }
            }
            
            if (images.length === 0) {
                throw new Error('No images found in manifest');
            }
            
            return { images };
        } catch (error) {
            // If IIIF fails, throw error (no fallback to broken ICCU approach)
            throw new Error(`Failed to load Verona manifest: ${error.message}`);
        }
    }

    async getViennaManuscriptaManifest(url) {
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);
        
        const html = await response.text();
        
        // Extract manuscript ID from URL
        const urlMatch = url.match(/\/diglit\/(AT\d+-\d+)/);
        if (!urlMatch) throw new Error('Invalid Vienna Manuscripta URL');
        const manuscriptId = urlMatch[1];
        
        // Extract page range from pageInfo object
        const pageInfoMatch = html.match(/const pageInfo = ({[\s\S]*?});/);
        if (!pageInfoMatch) throw new Error('Could not find pageInfo');
        
        // For validation, we'll get the first 10 pages by checking sequential URLs
        const images = [];
        
        // Based on the user's examples, we need to build the image URL pattern
        // Extract the manuscript parts (e.g., AT5000-71 -> AT/5000/AT5000-71)
        const parts = manuscriptId.match(/(AT)(\d+)-(\d+)/);
        if (!parts) throw new Error('Invalid manuscript ID format');
        
        const [, prefix, num1, num2] = parts;
        const basePath = `https://manuscripta.at/images/${prefix}/${num1}/${manuscriptId}`;
        
        // Get first 10 pages
        for (let pageNum = 1; pageNum <= 10; pageNum++) {
            const paddedPage = String(pageNum).padStart(3, '0');
            // Vienna Manuscripta uses folio notation (001r, 001v, 002r, 002v, etc.)
            // For simplicity in validation, we'll just get recto pages
            const imageUrl = `${basePath}/${manuscriptId}_${paddedPage}r.jpg`;
            images.push({
                url: imageUrl,
                label: `Page ${paddedPage}r`
            });
        }
        
        return { images };
    }

    async getBNEManifest(url) {
        const match = url.match(/id=(\d+)/);
        if (!match) throw new Error('Invalid BNE URL');
        
        const docId = match[1];
        const infoUrl = `https://bdh-rd.bne.es/vid_json.do?id=${docId}`;
        
        const response = await this.fetchWithRetry(infoUrl);
        if (!response.ok) throw new Error(`Failed to fetch info: ${response.status}`);
        
        const data = await response.json();
        const images = [];
        
        if (data.pages && Array.isArray(data.pages)) {
            for (let i = 0; i < Math.min(data.pages.length, 10); i++) {
                const page = data.pages[i];
                const imageUrl = `https://bdh-rd.bne.es/zoom.do?id=${docId}&pagina=${i + 1}&tipo=JPG&imagen=1`;
                images.push({
                    url: imageUrl,
                    label: `Page ${i + 1}`
                });
            }
        }
        
        return { images };
    }

    async getMDCCataloniaManifest(url) {
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);
        
        const html = await response.text();
        const manifestMatch = html.match(/iiifManifest['"]\s*:\s*['"]([^'"]+)['"]/);
        
        if (!manifestMatch) throw new Error('Could not find IIIF manifest URL');
        
        const manifestUrl = manifestMatch[1];
        const manifestResponse = await this.fetchWithRetry(manifestUrl);
        
        if (!manifestResponse.ok) throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
        
        const manifest = await manifestResponse.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (let i = 0; i < Math.min(manifest.sequences[0].canvases.length, 10); i++) {
                const canvas = manifest.sequences[0].canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    async getGrenobleManifest(url) {
        const match = url.match(/ark:\/(\d+\/\w+)/);
        if (!match) throw new Error('Invalid Grenoble URL');
        
        const arkId = match[1];
        const manifestUrl = `https://bm-grenoble.mediatheque-numerique.fr/iiif/3/manifests/ark:/${arkId}/manifest.json`;
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.items) {
            for (let i = 0; i < Math.min(manifest.items.length, 10); i++) {
                const item = manifest.items[i];
                if (item.items && item.items[0] && item.items[0].items && item.items[0].items[0] && item.items[0].items[0].body) {
                    images.push({
                        url: item.items[0].items[0].body.id,
                        label: item.label?.none?.[0] || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    async getKarlsruheManifest(url) {
        const match = url.match(/titleinfo\/(\d+)/);
        if (!match) throw new Error('Invalid Karlsruhe URL');
        
        const titleId = match[1];
        const manifestUrl = `https://digital.blb-karlsruhe.de/i3f/v20/${titleId}/manifest`;
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (let i = 0; i < Math.min(manifest.sequences[0].canvases.length, 10); i++) {
                const canvas = manifest.sequences[0].canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    async getFlorenceManifest(url) {
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);
        
        const html = await response.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        const images = [];
        const imageElements = doc.querySelectorAll('img[data-original]');
        
        for (let i = 0; i < Math.min(imageElements.length, 10); i++) {
            const img = imageElements[i];
            const imageUrl = img.getAttribute('data-original');
            if (imageUrl) {
                images.push({
                    url: new URL(imageUrl, url).href,
                    label: `Page ${i + 1}`
                });
            }
        }
        
        return { images };
    }

    async getLibraryOfCongressManifest(url) {
        const match = url.match(/item\/(\d+)/);
        if (!match) throw new Error('Invalid Library of Congress URL');
        
        const itemId = match[1];
        const manifestUrl = `https://www.loc.gov/item/${itemId}/manifest.json`;
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (let i = 0; i < Math.min(manifest.sequences[0].canvases.length, 10); i++) {
                const canvas = manifest.sequences[0].canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    async getGrazManifest(url) {
        const match = url.match(/titleinfo\/(\d+)/);
        if (!match) throw new Error('Invalid Graz URL');
        
        const titleId = match[1];
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${titleId}/manifest`;
        
        const response = await this.fetchWithRetry(manifestUrl, {}, 5);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (let i = 0; i < Math.min(manifest.sequences[0].canvases.length, 10); i++) {
                const canvas = manifest.sequences[0].canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    async testLibrary(library) {
        console.log(`\n=== Testing ${library.name} ===`);
        console.log(`URL: ${library.url}`);
        
        const libraryFolder = path.join(VALIDATION_FOLDER, library.name);
        await fs.mkdir(libraryFolder, { recursive: true });
        
        const result = {
            library: library.name,
            url: library.url,
            success: false,
            error: null,
            pdfPath: null,
            pageCount: 0,
            maxResolution: null,
            fileSize: 0,
            popplerValid: false
        };

        try {
            const manifest = await this.getManifestForLibrary(library);
            if (!manifest || !manifest.images || manifest.images.length === 0) {
                throw new Error('No images found in manifest');
            }

            console.log(`  Found ${manifest.images.length} pages in manifest`);
            
            const maxPages = Math.min(10, manifest.images.length);
            const selectedImages = manifest.images.slice(0, maxPages);
            
            console.log(`  Testing IIIF resolutions for maximum quality...`);
            const maxResolution = await this.findMaxResolution(selectedImages[0], libraryFolder);
            console.log(`  Maximum resolution found: ${maxResolution}`);
            result.maxResolution = maxResolution;

            console.log(`  Downloading ${maxPages} pages at maximum resolution...`);
            const downloadedImages = [];
            
            for (let i = 0; i < selectedImages.length; i++) {
                const image = selectedImages[i];
                const imageUrl = this.applyResolution(image.url, maxResolution);
                console.log(`    Downloading page ${i + 1}/${maxPages}...`);
                
                const response = await this.fetchWithRetry(imageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download image: ${response.status}`);
                }
                
                const buffer = await response.buffer();
                const imagePath = path.join(libraryFolder, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                await fs.writeFile(imagePath, buffer);
                
                downloadedImages.push({
                    path: imagePath,
                    buffer: buffer
                });
                
                console.log(`      Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
            }

            console.log(`  Creating PDF...`);
            const pdfDoc = await PDFDocument.create();
            
            for (const img of downloadedImages) {
                try {
                    const jpgImage = await pdfDoc.embedJpg(img.buffer);
                    const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
                    page.drawImage(jpgImage, {
                        x: 0,
                        y: 0,
                        width: jpgImage.width,
                        height: jpgImage.height
                    });
                } catch (embedError) {
                    console.warn(`    Warning: Could not embed image, skipping: ${embedError.message}`);
                }
            }

            const pdfBytes = await pdfDoc.save();
            const pdfPath = path.join(libraryFolder, `${library.name}_validation.pdf`);
            await fs.writeFile(pdfPath, pdfBytes);
            
            result.pdfPath = pdfPath;
            result.pageCount = pdfDoc.getPageCount();
            result.fileSize = pdfBytes.length;

            console.log(`  PDF created: ${pdfPath}`);
            console.log(`  File size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

            console.log(`  Validating with poppler...`);
            try {
                execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf8' });
                result.popplerValid = true;
                console.log(`  ✓ PDF validation passed`);
            } catch (error) {
                console.error(`  ✗ PDF validation failed: ${error.message}`);
            }

            result.success = true;
            
        } catch (error) {
            console.error(`  Error testing ${library.name}: ${error.message}`);
            result.error = error.message;
        }

        this.results.push(result);
        return result;
    }

    async findMaxResolution(firstImage, libraryFolder) {
        let maxResolution = IIIF_RESOLUTIONS[0];
        let maxSize = 0;

        for (const resolution of IIIF_RESOLUTIONS) {
            try {
                const testUrl = this.applyResolution(firstImage.url, resolution);
                console.log(`    Testing resolution: ${resolution}`);
                
                const response = await this.fetchWithRetry(testUrl);
                if (!response.ok) continue;
                
                const buffer = await response.buffer();
                const size = buffer.length;
                
                console.log(`      Size: ${(size / 1024).toFixed(2)} KB`);
                
                if (size > maxSize) {
                    maxSize = size;
                    maxResolution = resolution;
                }
            } catch (error) {
                console.log(`      Failed: ${error.message}`);
            }
        }

        return maxResolution;
    }

    applyResolution(url, resolution) {
        if (url.includes('/full/full/')) {
            return url.replace('/full/full/', `/${resolution.replace('.jpg', '')}/`);
        }
        if (url.includes('/full/max/')) {
            return url.replace('/full/max/', `/${resolution.replace('.jpg', '')}/`);
        }
        if (url.match(/\/full\/\d+,\//)) {
            return url.replace(/\/full\/\d+,\//, `/${resolution.replace('.jpg', '')}/`);
        }
        return url;
    }

    async createFinalValidationFolder() {
        const finalFolder = path.join(VALIDATION_FOLDER, 'FINAL_VALIDATION');
        await fs.mkdir(finalFolder, { recursive: true });

        console.log('\n=== Creating final validation folder ===');
        
        for (const result of this.results) {
            if (result.success && result.pdfPath) {
                const fileName = path.basename(result.pdfPath);
                const destPath = path.join(finalFolder, fileName);
                await fs.copyFile(result.pdfPath, destPath);
                console.log(`  Copied: ${fileName}`);
            }
        }

        await this.createValidationReport(finalFolder);
        
        return finalFolder;
    }

    async createValidationReport(folder) {
        const reportPath = path.join(folder, 'VALIDATION_REPORT.md');
        
        let report = '# Library Validation Report\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;
        
        report += '## Summary\n';
        const successCount = this.results.filter(r => r.success).length;
        report += `- Total libraries tested: ${this.results.length}\n`;
        report += `- Successful: ${successCount}\n`;
        report += `- Failed: ${this.results.length - successCount}\n\n`;
        
        report += '## Detailed Results\n\n';
        
        for (const result of this.results) {
            report += `### ${result.library}\n`;
            report += `- URL: ${result.url}\n`;
            report += `- Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}\n`;
            
            if (result.success) {
                report += `- Pages downloaded: ${result.pageCount}\n`;
                report += `- Max resolution: ${result.maxResolution}\n`;
                report += `- PDF size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB\n`;
                report += `- Poppler validation: ${result.popplerValid ? 'PASSED' : 'FAILED'}\n`;
            } else {
                report += `- Error: ${result.error}\n`;
            }
            report += '\n';
        }

        await fs.writeFile(reportPath, report);
        console.log(`\nValidation report created: ${reportPath}`);
    }

    async run() {
        try {
            await this.init();
            
            for (const library of TEST_LIBRARIES) {
                await this.testLibrary(library);
            }

            const finalFolder = await this.createFinalValidationFolder();
            
            console.log('\n=== VALIDATION COMPLETE ===');
            console.log(`Final validation folder: ${finalFolder}`);
            console.log('Opening folder...');
            
            if (process.platform === 'darwin') {
                execSync(`open "${finalFolder}"`);
            } else if (process.platform === 'win32') {
                execSync(`start "" "${finalFolder}"`);
            }
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    }
}

const validator = new ValidationScript();
validator.run().catch(console.error);