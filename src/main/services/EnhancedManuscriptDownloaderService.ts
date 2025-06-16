import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { ManifestCache } from './ManifestCache.js';
import { configService } from './ConfigService.js';
import type { ManuscriptManifest, LibraryInfo } from '../../shared/types';

const MIN_VALID_IMAGE_SIZE_BYTES = 1024; // 1KB heuristic

export class EnhancedManuscriptDownloaderService {
    private manifestCache: ManifestCache;

    constructor() {
        this.manifestCache = new ManifestCache();
        // Clear potentially problematic cached manifests on startup
        this.manifestCache.clearProblematicUrls().catch(error => {
            console.warn('Failed to clear problematic cache entries:', error.message);
        });
    }

    static readonly SUPPORTED_LIBRARIES: LibraryInfo[] = [
        {
            name: 'Gallica (BnF)',
            example: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres',
            description: 'French National Library digital manuscripts (supports any f{page}.* format)',
        },
        {
            name: 'e-codices (Unifr)',
            example: 'https://www.e-codices.ch/en/sbe/0610/1',
            description: 'Swiss virtual manuscript library',
        },
        {
            name: 'Vatican Library',
            example: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
            description: 'Vatican Apostolic Library digital collections',
        },
        {
            name: 'Cecilia (Grand Albigeois)',
            example: 'https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=',
            description: 'Grand Albigeois mediatheques digital collections',
        },
        {
            name: 'IRHT (CNRS)',
            example: 'https://arca.irht.cnrs.fr/ark:/63955/md14nk323d72',
            description: 'Institut de recherche et d\'histoire des textes digital manuscripts',
        },
        {
            name: 'Dijon Patrimoine',
            example: 'http://patrimoine.bm-dijon.fr/pleade/img-viewer/MS00114/?ns=FR212316101_CITEAUX_MS00114_000_01_PS.jpg',
            description: 'Bibliothèque municipale de Dijon digital manuscripts',
        },
        {
            name: 'Laon Bibliothèque',
            example: 'https://bibliotheque-numerique.ville-laon.fr/viewer/1459/?offset=#page=1&viewer=picture&o=download&n=0&q=',
            description: 'Bibliothèque municipale de Laon digital manuscripts',
        },
        {
            name: 'Durham University',
            example: 'https://iiif.durham.ac.uk/index.html?manifest=t1mp2676v52p',
            description: 'Durham University Library digital manuscripts via IIIF',
        },
        {
            name: 'SharedCanvas',
            example: 'https://sharedcanvas.be/IIIF/viewer/mirador/B_OB_MS310',
            description: 'SharedCanvas-based digital manuscript viewers and collections',
        },
        {
            name: 'UGent Library',
            example: 'https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C',
            description: 'Ghent University Library digital manuscript collections via IIIF',
        },
        {
            name: 'British Library',
            example: 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001',
            description: 'British Library digital manuscript collections via IIIF',
        },
        {
            name: 'Florus (BM Lyon)',
            example: 'https://florus.bm-lyon.fr/visualisation.php?cote=MS0425&vue=128',
            description: 'Bibliothèque municipale de Lyon digital manuscripts',
        },
        {
            name: 'Unicatt (Ambrosiana)',
            example: 'https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6',
            description: 'Biblioteca Ambrosiana digital manuscripts',
        },
        {
            name: 'Cambridge University Digital Library',
            example: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1',
            description: 'Cambridge University Library digital manuscripts via IIIF',
        },
        {
            name: 'Trinity College Cambridge',
            example: 'https://mss-cat.trin.cam.ac.uk/Manuscript/B.10.5/UV',
            description: 'Trinity College Cambridge digital manuscripts',
        },
        {
            name: 'Dublin ISOS (DIAS)',
            example: 'https://www.isos.dias.ie/RIA/RIA_MS_D_ii_3.html',
            description: 'Irish Script On Screen (Dublin Institute for Advanced Studies)',
        },
        {
            name: 'Dublin MIRA',
            example: 'https://www.mira.ie/105',
            description: 'Manuscript, Inscription and Realia Archive (Dublin)',
        },
        {
            name: 'Orléans Médiathèques (Aurelia)',
            example: 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380',
            description: 'Médiathèques d\'Orléans digital heritage library via IIIF/Omeka',
        },
    ];

    getSupportedLibraries(): LibraryInfo[] {
        return EnhancedManuscriptDownloaderService.SUPPORTED_LIBRARIES;
    }

    /**
     * Calculate exponential backoff delay with jitter
     */
    calculateRetryDelay(attempt: number): number {
        const baseDelay = configService.get('retryDelayBase');
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), configService.get('retryDelayMax'));
        const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
        return Math.floor(exponentialDelay + jitter);
    }

    /**
     * ETA formatting helper
     */
    formatETA(etaSeconds: number): string {
        if (!etaSeconds || !isFinite(etaSeconds)) return 'calculating...';
        
        const hours = Math.floor(etaSeconds / 3600);
        const minutes = Math.floor((etaSeconds % 3600) / 60);
        const seconds = Math.floor(etaSeconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Sleep utility
     */
    async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Detect library type from URL
     */
    detectLibrary(url: string): string | null {
        // Check for unsupported libraries first
        if (url.includes('digitalcollections.tcd.ie')) {
            throw new Error('Trinity College Dublin is not currently supported due to aggressive captcha protection. Please download manuscripts manually through their website.');
        }
        
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('e-codices.unifr.ch') || url.includes('e-codices.ch')) return 'unifr';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('cecilia.mediatheques.grand-albigeois.fr')) return 'cecilia';
        if (url.includes('arca.irht.cnrs.fr')) return 'irht';
        if (url.includes('patrimoine.bm-dijon.fr')) return 'dijon';
        if (url.includes('bibliotheque-numerique.ville-laon.fr')) return 'laon';
        if (url.includes('iiif.durham.ac.uk')) return 'durham';
        if (url.includes('sharedcanvas.be')) return 'sharedcanvas';
        if (url.includes('lib.ugent.be')) return 'ugent';
        if (url.includes('iiif.bl.uk') || url.includes('bl.digirati.io')) return 'bl';
        if (url.includes('florus.bm-lyon.fr')) return 'florus';
        if (url.includes('digitallibrary.unicatt.it')) return 'unicatt';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('isos.dias.ie')) return 'isos';
        if (url.includes('mira.ie')) return 'mira';
        if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) return 'orleans';
        
        return null;
    }

    /**
     * Proxy servers for regions where libraries might be blocked
     */
    private readonly PROXY_SERVERS = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://proxy.cors.sh/',
    ];

    /**
     * Fetch with automatic proxy fallback
     */
    async fetchWithProxyFallback(url: string, options: any = {}): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), configService.get('requestTimeout'));
        
        const fetchOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...options.headers
            }
        };
        
        try {
            // Try direct access first
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);
            
            if (response.ok || response.status < 500) {
                return response;
            }
            
            throw new Error(`HTTP ${response.status}`);
        } catch (directError: any) {
            clearTimeout(timeoutId);
            
            // If direct access fails, try proxy servers
            for (const proxy of this.PROXY_SERVERS) {
                try {
                    const proxyController = new AbortController();
                    const proxyTimeoutId = setTimeout(() => proxyController.abort(), configService.get('requestTimeout'));
                    
                    const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
                    const proxyResponse = await fetch(proxyUrl, {
                        ...fetchOptions,
                        signal: proxyController.signal
                    });
                    
                    clearTimeout(proxyTimeoutId);
                    
                    if (proxyResponse.ok) {
                        console.log(`Successfully fetched ${url} via proxy: ${proxy}`);
                        return proxyResponse;
                    }
                } catch (proxyError: any) {
                    console.warn(`Proxy ${proxy} failed for ${url}: ${proxyError.message}`);
                    continue;
                }
            }
            
            // All proxies failed, throw original error
            throw directError;
        }
    }

    /**
     * Direct fetch (no proxy needed in Electron main process)
     */
    async fetchDirect(url: string, options: any = {}): Promise<Response> {
        const controller = new AbortController();
        // Use much longer timeout for Trinity Cambridge as their server is extremely slow (45+ seconds per image)
        const timeout = url.includes('mss-cat.trin.cam.ac.uk') ? 120000 : configService.get('requestTimeout'); // 2 minutes for Trinity Cambridge
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Special headers for ISOS to avoid 403 Forbidden errors
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...options.headers
        };
        
        if (url.includes('isos.dias.ie')) {
            headers = {
                ...headers,
                'Referer': 'https://www.isos.dias.ie/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin'
            };
        }
        
        // Special headers for Cambridge CUDL to avoid 403 Forbidden errors
        if (url.includes('cudl.lib.cam.ac.uk')) {
            headers = {
                ...headers,
                'Referer': 'https://cudl.lib.cam.ac.uk/',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            };
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Load manifest for different library types
     */
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
        // Check cache first
        const cachedManifest = await this.manifestCache.get(originalUrl);
        if (cachedManifest) {
            return cachedManifest;
        }
        
        const library = this.detectLibrary(originalUrl);
        if (!library) {
            throw new Error(`Unsupported library for URL: ${originalUrl}`);
        }

        let manifest: ManuscriptManifest;
        
        try {
            switch (library) {
                case 'gallica':
                    manifest = await this.loadGallicaManifest(originalUrl);
                    break;
                case 'unifr':
                    manifest = await this.loadUnifrManifest(originalUrl);
                    break;
                case 'vatlib':
                    manifest = await this.loadVatlibManifest(originalUrl);
                    break;
                case 'cecilia':
                    manifest = await this.loadCeciliaManifest(originalUrl);
                    break;
                case 'irht':
                    manifest = await this.loadIrhtManifest(originalUrl);
                    break;
                case 'dijon':
                    manifest = await this.loadDijonManifest(originalUrl);
                    break;
                case 'laon':
                    manifest = await this.loadLaonManifest(originalUrl);
                    break;
                case 'durham':
                    manifest = await this.loadDurhamManifest(originalUrl);
                    break;
                case 'sharedcanvas':
                    manifest = await this.loadSharedCanvasManifest(originalUrl);
                    break;
                case 'ugent':
                    manifest = await this.loadUgentManifest(originalUrl);
                    break;
                case 'bl':
                    manifest = await this.loadBLManifest(originalUrl);
                    break;
                case 'florus':
                    manifest = await this.loadFlorusManifest(originalUrl);
                    break;
                case 'unicatt':
                    manifest = await this.loadUnicattManifest(originalUrl);
                    break;
                case 'cudl':
                    manifest = await this.loadCudlManifest(originalUrl);
                    break;
                case 'trinity_cam':
                    manifest = await this.loadTrinityCamManifest(originalUrl);
                    break;
                case 'isos':
                    manifest = await this.loadIsosManifest(originalUrl);
                    break;
                case 'mira':
                    manifest = await this.loadMiraManifest(originalUrl);
                    break;
                case 'orleans':
                    manifest = await this.loadOrleansManifest(originalUrl);
                    break;
                default:
                    throw new Error(`Unsupported library: ${library}`);
            }
            
            manifest.library = library as any;
            manifest.originalUrl = originalUrl;
            
            // Cache the manifest
            await this.manifestCache.set(originalUrl, manifest);
            
            return manifest;
            
        } catch (error: any) {
            console.error(`Failed to load manifest: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load Gallica manifest (using IIIF manifest API)
     */
    async loadGallicaManifest(gallicaUrl: string): Promise<ManuscriptManifest> {
        try {
            const arkMatch = gallicaUrl.match(/ark:\/[^/]+\/[^/?\s]+/);
            if (!arkMatch) {
                throw new Error('Invalid Gallica URL format');
            }
            
            const ark = arkMatch[0];
            
            // Try IIIF manifest first (modern approach)
            const manifestUrl = `https://gallica.bnf.fr/iiif/${ark}/manifest.json`;
            
            try {
                const manifestResponse = await this.fetchDirect(manifestUrl);
                if (manifestResponse.ok) {
                    const manifest = await manifestResponse.json();
                    
                    // Extract pages from IIIF manifest
                    const pageLinks: string[] = [];
                    let displayName = `Gallica Document ${ark}`;
                    
                    if (manifest.label) {
                        displayName = typeof manifest.label === 'string' ? manifest.label : 
                                     manifest.label.en?.[0] || manifest.label.fr?.[0] || displayName;
                    }
                    
                    // IIIF Presentation API v2 or v3
                    const sequences = manifest.sequences || [manifest];
                    
                    for (const sequence of sequences) {
                        const canvases = sequence.canvases || sequence.items || [];
                        
                        for (let i = 0; i < canvases.length; i++) {
                            const pageNum = i + 1;
                            const imageUrl = `https://gallica.bnf.fr/iiif/${ark}/f${pageNum}/full/max/0/native.jpg`;
                            pageLinks.push(imageUrl);
                        }
                    }
                    
                    if (pageLinks.length > 0) {
                        const gallicaManifest = {
                            pageLinks,
                            totalPages: pageLinks.length,
                            library: 'gallica' as const,
                            displayName,
                            originalUrl: gallicaUrl,
                        };
                        
                        // Cache the manifest
                        this.manifestCache.set(gallicaUrl, gallicaManifest).catch(console.warn);
                        
                        return gallicaManifest;
                    }
                }
            } catch {
                // IIIF manifest failed, try fallback
            }
            
            // Fallback: Direct IIIF image testing approach
            
            // Test if we can access IIIF images directly and find the page count
            let totalPages = 0;
            
            // Binary search to find total pages efficiently
            let low = 1;
            let high = 1000; // reasonable upper bound
            let lastValidPage = 0;
            
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const testUrl = `https://gallica.bnf.fr/iiif/${ark}/f${mid}/full/max/0/native.jpg`;
                
                try {
                    const response = await this.fetchDirect(testUrl);
                    if (response.ok) {
                        lastValidPage = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                } catch {
                    high = mid - 1;
                }
            }
            
            totalPages = lastValidPage;
            
            if (totalPages === 0) {
                // Try a few common page counts
                const commonCounts = [1, 2, 5, 10, 20, 50, 100];
                for (const count of commonCounts) {
                    const testUrl = `https://gallica.bnf.fr/iiif/${ark}/f${count}/full/max/0/native.jpg`;
                    try {
                        const response = await this.fetchDirect(testUrl);
                        if (response.ok) {
                            totalPages = count;
                        } else {
                            break;
                        }
                    } catch {
                        break;
                    }
                }
            }
            
            if (totalPages === 0) {
                throw new Error('Could not determine page count for Gallica document');
            }
            
            // Generate IIIF image URLs
            const pageLinks = [];
            for (let i = 1; i <= totalPages; i++) {
                const imageUrl = `https://gallica.bnf.fr/iiif/${ark}/f${i}/full/max/0/native.jpg`;
                pageLinks.push(imageUrl);
            }
            
            
            const gallicaManifest = {
                pageLinks,
                totalPages,
                library: 'gallica' as const,
                displayName: `Gallica Document ${ark}`,
                originalUrl: gallicaUrl,
            };
            
            // Cache the manifest
            this.manifestCache.set(gallicaUrl, gallicaManifest).catch(console.warn);
            
            return gallicaManifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Gallica document: ${error.message}`);
        }
    }


    /**
     * Load IIIF manifest (for Vatican, Durham, UGent, British Library)
     */
    async loadIIIFManifest(manifestUrl: string): Promise<ManuscriptManifest> {
        const response = await this.fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load IIIF manifest: HTTP ${response.status}`);
        }
        
        const responseText = await response.text();
        let manifest;
        try {
            manifest = JSON.parse(responseText);
        } catch {
            throw new Error(`Invalid JSON response from manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
        }
        
        
        const pageLinks: string[] = [];
        
        // Handle IIIF v3 format (items directly in manifest) and IIIF v2 format (sequences)
        let canvases: any[] = [];
        
        if (manifest.items && Array.isArray(manifest.items)) {
            // IIIF v3: canvases are directly in manifest.items
            canvases = manifest.items;
        } else if (manifest.sequences && Array.isArray(manifest.sequences)) {
            // IIIF v2: canvases are in sequences
            for (const sequence of manifest.sequences) {
                const sequenceCanvases = sequence.canvases || [];
                canvases.push(...sequenceCanvases);
            }
        } else {
            // Fallback: try to find canvases in the manifest itself
            canvases = manifest.canvases || [];
        }
        
        // Process each canvas to extract image URLs
        for (const canvas of canvases) {
            let foundImages = false;
            
            // Check if this looks like IIIF v2 (has canvas.images)
            if (canvas.images && Array.isArray(canvas.images)) {
                for (const image of canvas.images) {
                    let imageUrl;
                    
                    // IIIF v2 format
                    if (image.resource) {
                        imageUrl = image.resource['@id'] || image.resource.id;
                    } else if (image['@id']) {
                        imageUrl = image['@id'];
                    }
                    
                    if (imageUrl) {
                        // const originalUrl = imageUrl;
                        // Convert to full resolution for all IIIF libraries
                        if (imageUrl.includes('/full/')) {
                            imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                        }
                        pageLinks.push(imageUrl);
                        foundImages = true;
                    }
                }
            }
            
            // Check if this looks like IIIF v3 (has canvas.items with AnnotationPages)
            if (!foundImages && canvas.items && Array.isArray(canvas.items)) {
                for (const item of canvas.items) {
                    if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                        for (const annotation of item.items) {
                            if (annotation.body && annotation.body.id) {
                                let imageUrl = annotation.body.id;
                                // const originalUrl = imageUrl;
                                
                                // Convert to full resolution for all IIIF libraries
                                if (imageUrl.includes('/full/')) {
                                    imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                }
                                pageLinks.push(imageUrl);
                                foundImages = true;
                            }
                        }
                    }
                }
            }
            
        }
        
        // Extract display name from IIIF manifest
        let displayName = 'IIIF Document';
        
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                displayName = manifest.label;
            } else if (manifest.label.en && Array.isArray(manifest.label.en)) {
                displayName = manifest.label.en[0];
            } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                displayName = manifest.label.none[0];
            } else if (typeof manifest.label === 'object') {
                // Try to extract any language variant
                const languages = Object.keys(manifest.label);
                if (languages.length > 0 && Array.isArray(manifest.label[languages[0]])) {
                    displayName = manifest.label[languages[0]][0];
                }
            }
        }
        
        // Fallback to metadata if no label found
        if (displayName === 'IIIF Document' && manifest.metadata) {
            const titleMetadata = manifest.metadata.find((m: any) => 
                m.label === 'Title' || 
                (typeof m.label === 'object' && (m.label.en?.[0] === 'Title' || m.label.none?.[0] === 'Title'))
            );
            if (titleMetadata?.value) {
                if (typeof titleMetadata.value === 'string') {
                    displayName = titleMetadata.value;
                } else if (Array.isArray(titleMetadata.value.en)) {
                    displayName = titleMetadata.value.en[0];
                } else if (Array.isArray(titleMetadata.value.none)) {
                    displayName = titleMetadata.value.none[0];
                }
            }
        }
        
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: displayName || 'IIIF Document',
            library: '' as any,
            originalUrl: ''
        };
    }

    async loadVatlibManifest(vatLibUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript name from URL
            const nameMatch = vatLibUrl.match(/\/view\/([^/?]+)/);
            if (!nameMatch) {
                throw new Error('Invalid Vatican Library URL format');
            }
            
            const manuscriptName = nameMatch[1];
            
            // Extract cleaner manuscript name according to patterns:
            // MSS_Vat.lat.7172 -> Vat.lat.7172
            // bav_pal_lat_243 -> Pal.lat.243
            // MSS_Reg.lat.15 -> Reg.lat.15
            let displayName = manuscriptName;
            if (manuscriptName.startsWith('MSS_')) {
                displayName = manuscriptName.substring(4);
            } else if (manuscriptName.startsWith('bav_')) {
                displayName = manuscriptName.substring(4).replace(/^([a-z])/, (match) => match.toUpperCase());
            }
            
            const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptName}/manifest.json`;
            
            const response = await this.fetchDirect(manifestUrl);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Manuscript not found: ${manuscriptName}. Please check the URL is correct.`);
                }
                throw new Error(`HTTP ${response.status}: Failed to load manifest`);
            }
            
            const iiifManifest = await response.json();
            
            // Check if manifest has the expected structure
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid manifest structure: missing sequences or canvases');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                
                // Vatican Library uses a service object with @id pointing to the image service
                if (resource.service && resource.service['@id']) {
                    // Extract the base service URL and construct full resolution image URL
                    const serviceId = resource.service['@id'];
                    return `${serviceId}/full/full/0/native.jpg`;
                }
                
                // Fallback to direct resource @id if no service (other IIIF implementations)
                if (resource['@id']) {
                    return resource['@id'];
                }
                
                return null;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'vatlib',
                displayName: displayName,
                originalUrl: vatLibUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Vatican Library manuscript: ${error.message}`);
        }
    }

    async loadDurhamManifest(url: string): Promise<ManuscriptManifest> {
        const manifestMatch = url.match(/[?&]manifest=([^&]+)/);
        if (!manifestMatch) {
            throw new Error('Invalid Durham URL format - could not extract manifest ID');
        }
        
        const manifestId = manifestMatch[1];
        
        // Durham University IIIF manifest URL pattern:
        // https://iiif.durham.ac.uk/manifests/trifle/32150/[first-2-chars]/[next-2-chars]/[next-2-chars]/[full-id]/manifest
        // Example: t1mp2676v52p -> t1/mp/26/t1mp2676v52p/manifest
        if (manifestId.length < 6) {
            throw new Error(`Invalid Durham manifest ID format: ${manifestId}`);
        }
        
        const part1 = manifestId.substring(0, 2);
        const part2 = manifestId.substring(2, 4);
        const part3 = manifestId.substring(4, 6);
        
        const manifestUrl = `https://iiif.durham.ac.uk/manifests/trifle/32150/${part1}/${part2}/${part3}/${manifestId}/manifest`;
        return this.loadIIIFManifest(manifestUrl);
    }

    async loadUgentManifest(url: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL pattern: https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C
            const manuscriptMatch = url.match(/\/viewer\/([^/?&]+)/);
            if (!manuscriptMatch) {
                throw new Error('Invalid UGent URL format. Expected format: https://lib.ugent.be/viewer/MANUSCRIPT_ID');
            }
            
            const manuscriptId = decodeURIComponent(manuscriptMatch[1]);
            
            // Construct the IIIF v3 manifest URL based on the pattern from the reference implementation
            const manifestUrl = `https://adore.ugent.be/IIIF/v3/manifests/${manuscriptId}`;
            
            return this.loadIIIFManifest(manifestUrl);
        } catch (error: any) {
            throw new Error(`Failed to load UGent manifest: ${error.message}`);
        }
    }

    async loadBLManifest(url: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            
            // Check if this is a viewer URL or direct manifest URL
            if (url.includes('iiif.bl.uk/uv/') && url.includes('manifest=')) {
                // Extract manifest URL from viewer URL - handle URLs with tracking parameters
                const manifestMatch = url.match(/manifest=([^&\s]+)/);
                if (!manifestMatch) {
                    throw new Error('Invalid British Library viewer URL format. Expected format with manifest parameter');
                }
                manifestUrl = decodeURIComponent(manifestMatch[1]);
            } else if (url.includes('bl.digirati.io/iiif/')) {
                // Direct manifest URL - British Library doesn't need '/manifest' suffix
                manifestUrl = url;
            } else {
                // Fallback: try to extract ARK and use API
                const arkMatch = url.match(/ark:\/[^/]+\/[^/?\s]+/);
                if (arkMatch) {
                    manifestUrl = `https://api.bl.uk/metadata/iiif/${arkMatch[0]}/manifest.json`;
                } else {
                    throw new Error('Invalid British Library URL format');
                }
            }
            
            return this.loadIIIFManifest(manifestUrl);
        } catch (error: any) {
            throw new Error(`Failed to load British Library manifest: ${error.message}`);
        }
    }

    async loadUnifrManifest(url: string): Promise<ManuscriptManifest> {
        const pathMatch = url.match(/\/(?:en|de|fr|it)\/([^/]+)\/([^/]+)/) || url.match(/\/(?:thumbs|list\/one)\/([^/]+)\/([^/]+)/);
        const collection = pathMatch ? pathMatch[1] : '';
        const manuscript = pathMatch ? pathMatch[2] : '';
        if (!collection || !manuscript) {
            throw new Error('Invalid Unifr URL format - could not extract manifest ID');
        }
        const manifestId = `${collection}-${manuscript}`;
        const manifestUrl = `https://www.e-codices.unifr.ch/metadata/iiif/${manifestId}/manifest.json`;
        
        // Add proper headers for e-codices requests to avoid HTTP 400 errors
        const response = await this.fetchDirect(manifestUrl, {
            headers: {
                'Referer': url,
                'Accept': 'application/json,application/ld+json,*/*'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load IIIF manifest: HTTP ${response.status}`);
        }
        
        const responseText = await response.text();
        let manifest;
        try {
            manifest = JSON.parse(responseText);
        } catch {
            throw new Error(`Invalid JSON response from manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
        }
        
        const pageLinks: string[] = [];
        const sequences = manifest.sequences || [manifest];
        
        for (const sequence of sequences) {
            const canvases = sequence.canvases || sequence.items || [];
            
            for (const canvas of canvases) {
                const images = canvas.images || canvas.items || [];
                
                for (const image of images) {
                    let imageUrl;
                    
                    if (image.resource) {
                        imageUrl = image.resource['@id'] || image.resource.id;
                    } else if (image.body) {
                        imageUrl = image.body.id;
                    }
                    
                    if (imageUrl) {
                        pageLinks.push(imageUrl);
                    }
                }
            }
        }
        
        if (pageLinks.length === 0) {
            throw new Error('No page links found in IIIF manifest');
        }
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `UNIFR_${collection}_${manuscript}`,
            library: 'unifr',
            originalUrl: url
        };
    }

    async loadCeciliaManifest(url: string): Promise<ManuscriptManifest> {
        try {
            let manifestUrl: string;
            let documentId: string;
            
            if (url.includes('api/viewer/lgiiif')) {
                // Direct manifest URL - extract document info and use as-is
                manifestUrl = url.replace('&max=260', ''); // Remove max parameter for full quality
                documentId = 'direct_manifest';
            } else {
                // Extract document ID from viewer URL
                // Example: https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=
                const idMatch = url.match(/\/viewer\/(\d+)/);
                if (!idMatch) {
                    throw new Error('Invalid Cecilia URL format - could not extract document ID');
                }
                
                documentId = idMatch[1];
            
                // For known documents, use direct manifest URLs
                if (documentId === '124') {
                    manifestUrl = 'https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/99/72/0c/a5/99720ca5-de2c-43fc-a8b0-f7b27fedc24a/';
                } else if (documentId === '105') {
                    manifestUrl = 'https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/18/d6/50/b5/18d650b5-14e5-4b48-88b1-6fa9b8982c7d/';
                } else {
                    // For unknown documents, try to extract manifest URL from viewer page HTML
                    const cleanViewerUrl = `https://cecilia.mediatheques.grand-albigeois.fr/viewer/${documentId}/`;
                    const viewerResp = await this.fetchDirect(cleanViewerUrl);
                    if (!viewerResp.ok) {
                        throw new Error(`Failed to load Cecilia viewer page: HTTP ${viewerResp.status}`);
                    }
                    const viewerPageHtml = await viewerResp.text();
                    
                    // Try lgiiif URL pattern: lgiiif?url=([^&'"]+)
                    const lgiiifMatch = viewerPageHtml.match(/lgiiif\?url=([^&'"]+)/);
                    if (lgiiifMatch) {
                        const encodedPath = lgiiifMatch[1];
                        manifestUrl = `https://cecilia.mediatheques.grand-albigeois.fr/api/viewer/lgiiif?url=${encodedPath}`;
                    } else {
                        throw new Error(`Could not extract manifest URL from Cecilia viewer page for document ${documentId}`);
                    }
                }
            }
            
            
            // Load the IIIF-style manifest from Cecilia
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load Cecilia manifest: HTTP ${response.status}`);
            }
            
            const responseText = await response.text();
            let manifestData;
            try {
                manifestData = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response from Cecilia manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
            }
            
            // Parse Cecilia's IIIF-style manifest format
            const pageLinks: string[] = [];
            
            if (manifestData.item && manifestData.item.tiles) {
                // Cecilia uses a tiles structure
                const tiles = manifestData.item.tiles;
                const imageIds = Object.keys(tiles);
                
                for (const id of imageIds) {
                    const tile = tiles[id];
                    if (tile['@id']) {
                        const imageUrl = `https://cecilia.mediatheques.grand-albigeois.fr${tile['@id']}/full/max/0/default.jpg`;
                        pageLinks.push(imageUrl);
                    }
                }
            } else {
                throw new Error('Invalid Cecilia manifest structure: missing item.tiles object');
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No images found in Cecilia manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                displayName: `Cecilia_${documentId}`,
                library: 'cecilia',
                originalUrl: url
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Cecilia manifest: ${error.message}`);
        }
    }

    async loadIrhtManifest(url: string): Promise<ManuscriptManifest> {
        const arkMatch = url.match(/ark:\/(\d+)\/([^/?]+)/);
        if (!arkMatch) {
            throw new Error('Invalid IRHT URL format - could not extract ARK ID');
        }
        const [, authority, name] = arkMatch;
        const response = await this.fetchDirect(url);
        if (!response.ok) {
            throw new Error(`Failed to load IRHT page: HTTP ${response.status}`);
        }
        const html = await response.text();
        const iiifPattern = /https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/]+)\/full\/[^/]+\/\d+\/default\.jpg/g;
        const matches = [...html.matchAll(iiifPattern)];
        const imageIds = [...new Set(matches.map((m) => m[1]))];
        if (imageIds.length === 0) {
            throw new Error('No IIIF images found in IRHT page');
        }
        const pageLinks = imageIds.map((id) =>
            `https://iiif.irht.cnrs.fr/iiif/ark:/${authority}/${id}/full/max/0/default.jpg`,
        );
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `IRHT_${name}`,
            library: 'irht',
            originalUrl: url
        };
    }

    async loadDijonManifest(url: string): Promise<ManuscriptManifest> {
        const msMatch = url.match(/img-viewer\/([^/?]+)/);
        if (!msMatch) {
            throw new Error('Invalid Dijon URL format - could not extract manuscript ID');
        }
        const manuscriptId = msMatch[1];
        const manifestUrl = `http://patrimoine.bm-dijon.fr/pleade/img-server/${manuscriptId}/dir.json`;
        const response = await this.fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load Dijon manifest: HTTP ${response.status}`);
        }
        const manifestData = await response.json();
        if (!Array.isArray(manifestData) || manifestData.length === 0) {
            throw new Error('No images found in Dijon manifest');
        }
        const pageLinks = manifestData.map((page: any) => {
            if (!page.versions || !Array.isArray(page.versions)) {
                throw new Error(`Invalid page versions for manuscript ${manuscriptId}`);
            }
            const version = page.versions.find((v: any) => v.src && !v.src.includes('__thumbs__'));
            if (!version || !version.src) {
                throw new Error(`No full-size version found for a page of manuscript ${manuscriptId}`);
            }
            return `http://patrimoine.bm-dijon.fr/pleade/img-server/${version.src}`;
        });
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `Dijon_${manuscriptId}`,
            library: 'dijon',
            originalUrl: url
        };
    }

    async loadLaonManifest(laonUrl: string): Promise<ManuscriptManifest> {
        // Extract document ID from viewer URL
        const idMatch = laonUrl.match(/\/viewer\/(\d+)/);
        if (!idMatch) {
            throw new Error('Invalid Laon URL format - could not extract document ID');
        }
        const documentId = idMatch[1];
        let manifestUrl;
        if (documentId === '1459') {
            // Known media path for document 1459
            manifestUrl = 'https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/medias/a2/33/4a/b2/a2334ab2-0305-48a5-98aa-d3cdbeb87a97/';
        } else {
            // Fallback: extract manifest URL from viewer page
            const cleanViewerUrl = `https://bibliotheque-numerique.ville-laon.fr/viewer/${documentId}/`;
            const viewerResp = await this.fetchDirect(cleanViewerUrl);
            if (!viewerResp.ok) {
                throw new Error(`Failed to load Laon viewer page: HTTP ${viewerResp.status}`);
            }
            const html = await viewerResp.text();
            // Try lgiiif URL pattern
            const lgiiifMatch = html.match(/lgiiif\?url=([^&'"]+)/);
            if (lgiiifMatch) {
                manifestUrl = `https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=${lgiiifMatch[1]}`;
            } else {
                const mediaPathMatch = html.match(/["']\/medias\/([^"']+)["']/);
                if (!mediaPathMatch) {
                    throw new Error(`Could not extract manifest URL from Laon viewer page for document ${documentId}`);
                }
                manifestUrl = `https://bibliotheque-numerique.ville-laon.fr/api/viewer/lgiiif?url=/srv/www/limbgallery/${mediaPathMatch[1]}/`;
            }
        }
        const resp = await this.fetchDirect(manifestUrl);
        if (!resp.ok) {
            throw new Error(`Failed to load Laon manifest: HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!data.item || !data.item.tiles || typeof data.item.tiles !== 'object') {
            throw new Error('Invalid Laon manifest structure: missing item.tiles object');
        }
        const tiles = data.item.tiles;
        const imageIds = Object.keys(tiles);
        if (imageIds.length === 0) {
            throw new Error('No images found in Laon manifest');
        }
        const pageLinks = imageIds.map((id) => {
            const tile = tiles[id];
            if (!tile['@id']) throw new Error(`Missing @id for image: ${id}`);
            return `https://bibliotheque-numerique.ville-laon.fr${tile['@id']}/full/full/0/default.jpg`;
        });
        return {
            pageLinks,
            totalPages: pageLinks.length,
            displayName: `Laon_${documentId}`,
            library: 'laon',
            originalUrl: laonUrl
        };
    }

    async loadSharedCanvasManifest(url: string): Promise<ManuscriptManifest> {
        const match = url.match(/\/viewer\/mirador\/([^/?&]+)/);
        if (!match) {
            throw new Error('Invalid SharedCanvas URL format');
        }
        const manifestUrl = `https://sharedcanvas.be/IIIF/manifests/${match[1]}`;
        return this.loadIIIFManifest(manifestUrl);
    }

    /**
     * Download image with retries and proxy fallback
     */
    async downloadImageWithRetries(url: string, attempt = 0): Promise<ArrayBuffer> {
        try {
            // Use proxy fallback for Unicatt images or when direct access fails
            const response = url.includes('digitallibrary.unicatt.it') 
                ? await this.fetchWithProxyFallback(url)
                : await this.fetchDirect(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            
            if (buffer.byteLength < MIN_VALID_IMAGE_SIZE_BYTES) {
                throw new Error(`Image too small: ${buffer.byteLength} bytes`);
            }
            
            return buffer;
            
        } catch (error: any) {
            const maxRetries = configService.get('maxRetries');
            if (attempt < maxRetries) {
                const delay = this.calculateRetryDelay(attempt);
                
                await this.sleep(delay);
                return this.downloadImageWithRetries(url, attempt + 1);
            }
            
            throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
        }
    }

    /**
     * Download manuscript
     */
    async downloadManuscript(url: string, options: any = {}): Promise<any> {
        const {
            onProgress = () => {},
            onManifestLoaded = () => {},
            maxConcurrent = configService.get('maxConcurrentDownloads'),
            skipExisting = false,
            startPage,
            endPage,
        } = options;

        try {
            // Load manifest
            const manifest = await this.loadManifest(url);
            onManifestLoaded(manifest);
            
            // Get internal cache directory for temporary images
            const tempImagesDir = path.join(app.getPath('userData'), 'temp-images');
            
            // Ensure temporary images directory exists
            await fs.mkdir(tempImagesDir, { recursive: true });
            
            // Generate filename using filesystem-safe sanitization
            const sanitizedName = manifest.displayName
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Remove filesystem-unsafe and control characters
                .replace(/[\u00A0-\u9999]/g, '_')         // Replace Unicode special characters that may cause Windows issues
                .replace(/[^\w\s.-]/g, '_')               // Replace any remaining special characters except word chars, spaces, dots, hyphens
                .replace(/\s+/g, '_')                     // Replace spaces with underscores
                .replace(/_{2,}/g, '_')                   // Replace multiple underscores with single underscore
                .replace(/^_|_$/g, '')                    // Remove leading/trailing underscores
                .replace(/\.+$/g, '')                     // Remove trailing periods (Windows compatibility)
                .substring(0, 100) || 'manuscript';       // Limit to 100 characters with fallback
            
            // Calculate pages to download for splitting logic
            const actualStartPage = Math.max(1, startPage || 1);
            const actualEndPage = Math.min(manifest.totalPages, endPage || manifest.totalPages);
            const totalPagesToDownload = actualEndPage - actualStartPage + 1;
            
            // Determine if we need to split the PDF (like barsky.club)
            const shouldSplit = totalPagesToDownload > 1000;
            const maxPagesPerPart = 250;
            
            let filename: string;
            let filepath: string;
            
            // Final PDF goes to Downloads folder - always create a subfolder for each manuscript
            const downloadsDir = app.getPath('downloads');
            await fs.mkdir(downloadsDir, { recursive: true });
            
            // Always create a subfolder with the manuscript name
            const targetDir = path.join(downloadsDir, sanitizedName);
            await fs.mkdir(targetDir, { recursive: true });
            
            if (shouldSplit) {
                const partNumber = String(1).padStart(2, '0');
                filename = `${sanitizedName}_part_${partNumber}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(targetDir, filename);
            } else {
                // Always include page numbers for clarity
                filename = `${sanitizedName}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(targetDir, filename);
            }
            
            // Check if file exists
            if (skipExisting) {
                try {
                    await fs.access(filepath);
                    return { success: true, filepath, skipped: true };
                } catch {
                    // File doesn't exist, continue with download
                }
            }
            
            // Page range already calculated above for filename generation
            
            
            const imagePaths: string[] = [];
            const writePromises: Promise<void>[] = [];
            const startTime = Date.now();
            let completedPages = 0;
            
            const updateProgress = () => {
                const progress = completedPages / totalPagesToDownload;
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = completedPages / elapsed;
                const eta = rate > 0 ? (totalPagesToDownload - completedPages) / rate : 0;
                onProgress({ 
                    progress, 
                    completedPages, 
                    totalPages: totalPagesToDownload, 
                    eta: this.formatETA(eta) 
                });
            };
            
            const actualMaxConcurrent = maxConcurrent || configService.get('maxConcurrentDownloads');
            const semaphore = new Array(actualMaxConcurrent).fill(null);
            let nextPageIndex = actualStartPage - 1; // Convert to 0-based index
            
            const downloadPage = async (pageIndex: number) => {
                let imageUrl = manifest.pageLinks[pageIndex];
                
                // Skip placeholder URLs (empty strings) used for missing pages
                if (!imageUrl || imageUrl === '') {
                    console.warn(`Skipping missing page ${pageIndex + 1}`);
                    completedPages++;
                    updateProgress();
                    return;
                }
                
                // Handle lazy-loaded Florus pages
                if (imageUrl.startsWith('FLORUS_LAZY:')) {
                    const parts = imageUrl.split(':');
                    const cote = parts[1];
                    const pageNum = parseInt(parts[2]);
                    const basePath = parts.slice(3).join(':'); // Rejoin in case basePath contains colons
                    console.log(`Fetching lazy-loaded page ${pageNum} for ${cote}`);
                    
                    try {
                        const pageUrl = `https://florus.bm-lyon.fr/visualisation.php?cote=${cote}&vue=${pageNum}`;
                        const pageResponse = await this.fetchDirect(pageUrl);
                        
                        if (pageResponse.ok) {
                            const pageHtml = await pageResponse.text();
                            const pageImageMatch = pageHtml.match(/FIF=([^&\s'"]+)/) ||
                                                  pageHtml.match(/image\s*:\s*'([^']+)'/) ||
                                                  pageHtml.match(/image\s*:\s*"([^"]+)"/);
                            
                            if (pageImageMatch) {
                                const imagePath = pageImageMatch[1];
                                const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
                                const fullImagePath = `${basePath}${filename}`;
                                imageUrl = `https://florus.bm-lyon.fr/fcgi-bin/iipsrv.fcgi?FIF=${fullImagePath}&WID=2000&CVT=JPEG`;
                            } else {
                                console.warn(`No image found for lazy-loaded page ${pageNum}`);
                                completedPages++;
                                updateProgress();
                                return;
                            }
                        } else {
                            console.warn(`Failed to fetch lazy page ${pageNum}: HTTP ${pageResponse.status}`);
                            completedPages++;
                            updateProgress();
                            return;
                        }
                    } catch (error: any) {
                        console.error(`Failed to fetch lazy page ${pageNum}: ${error.message}`);
                        completedPages++;
                        updateProgress();
                        return;
                    }
                }
                
                const imgFile = `${sanitizedName}_page_${pageIndex + 1}.jpg`;
                const imgPath = path.join(tempImagesDir, imgFile);
                
                try {
                    // Skip if already downloaded
                    await fs.access(imgPath);
                    // Mark path for skipped file
                    imagePaths[pageIndex] = imgPath;
                } catch {
                    // Not present: fetch and write
                    try {
                        const imageData = await this.downloadImageWithRetries(imageUrl);
                        const writePromise = fs.writeFile(imgPath, Buffer.from(imageData));
                        writePromises.push(writePromise);
                        // Only mark path if download succeeded
                        imagePaths[pageIndex] = imgPath;
                    } catch (error: any) {
                        console.error(`\n❌ Failed to download page ${pageIndex + 1}: ${error.message}`);
                        // Don't mark path for failed downloads
                    }
                }
                
                // Always increment completed pages to track overall progress
                completedPages++;
                updateProgress();
            };
            
            await Promise.all(semaphore.map(async () => {
                while (nextPageIndex < actualEndPage) {
                    const idx = nextPageIndex++;
                    await downloadPage(idx);
                }
            }));
            
            // Wait for all file writes to complete before processing
            await Promise.all(writePromises);
            
            // Ensure final progress update
            onProgress({ 
                progress: 1.0, 
                completedPages: totalPagesToDownload, 
                totalPages: totalPagesToDownload, 
                eta: '0s' 
            });
            
            const validImagePaths = imagePaths.filter(Boolean);
            
            if (validImagePaths.length === 0) {
                throw new Error('No images were successfully downloaded');
            }
            
            validImagePaths.sort((a, b) => {
                const aNum = parseInt(a.match(/_page_(\d+)\.jpg$/)![1], 10);
                const bNum = parseInt(b.match(/_page_(\d+)\.jpg$/)![1], 10);
                return aNum - bNum;
            });
            
            
            if (shouldSplit) {
                // Split into multiple PDFs like barsky.club
                const totalParts = Math.ceil(validImagePaths.length / maxPagesPerPart);
                const createdFiles: string[] = [];
                
                for (let partIndex = 0; partIndex < totalParts; partIndex++) {
                    const startIdx = partIndex * maxPagesPerPart;
                    const endIdx = Math.min(startIdx + maxPagesPerPart, validImagePaths.length);
                    const partImages = validImagePaths.slice(startIdx, endIdx);
                    
                    const partNumber = String(partIndex + 1).padStart(2, '0');
                    const partFilename = `${sanitizedName}_part_${partNumber}.pdf`;
                    const partFilepath = path.join(targetDir, partFilename);
                    
                    await this.convertImagesToPDF(partImages, partFilepath);
                    createdFiles.push(partFilepath);
                }
                
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {
                        // Ignore file deletion errors
                    }
                }
                
                return { 
                    success: true, 
                    filepath: createdFiles[0], // Return first part as primary
                    splitFiles: createdFiles,
                    totalPages: validImagePaths.length, 
                    failedPages: manifest.totalPages - validImagePaths.length,
                    partsCreated: totalParts
                };
            } else {
                // Single PDF
                await this.convertImagesToPDF(validImagePaths, filepath);
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {
                        // Ignore file deletion errors
                    }
                }
                
                return { 
                    success: true, 
                    filepath, 
                    totalPages: validImagePaths.length, 
                    failedPages: manifest.totalPages - validImagePaths.length 
                };
            }
            
        } catch (error: any) {
            console.error(`❌ Download failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Convert images to PDF with robust error handling and memory management
     */
    async convertImagesToPDF(imagePaths: string[], outputPath: string): Promise<void> {
        const totalImages = imagePaths.length;
        const maxMemoryMB = 1024; // 1GB memory limit
        const batchSize = Math.min(50, Math.max(10, Math.floor(maxMemoryMB / 20))); // Adaptive batch size
        
        const allPdfBytes: Uint8Array[] = [];
        let processedCount = 0;
        
        // Process images in batches to manage memory
        for (let i = 0; i < totalImages; i += batchSize) {
            const batch = imagePaths.slice(i, Math.min(i + batchSize, totalImages));
            const batchNum = Math.floor(i / batchSize) + 1;
            // const totalBatches = Math.ceil(totalImages / batchSize);
            
            try {
                const batchPdfDoc = await PDFDocument.create();
                let validImagesInBatch = 0;
                
                for (const imagePath of batch) {
                    try {
                        // Check if file exists and is accessible
                        await fs.access(imagePath);
                        const stats = await fs.stat(imagePath);
                        
                        if (stats.size < MIN_VALID_IMAGE_SIZE_BYTES) {
                            continue;
                        }
                        
                        // Read original image without any processing
                        const imageBuffer = await fs.readFile(imagePath);
                        
                        // Embed image in PDF
                        let image;
                        try {
                            // Try as JPEG first
                            image = await batchPdfDoc.embedJpg(imageBuffer);
                        } catch {
                            try {
                                // Fallback to PNG
                                image = await batchPdfDoc.embedPng(imageBuffer);
                            } catch (embedError: any) {
                                continue;
                            }
                        }
                        
                        // Add page with original image dimensions
                        const { width, height } = image;
                        
                        const page = batchPdfDoc.addPage([width, height]);
                        page.drawImage(image, {
                            x: 0,
                            y: 0,
                            width,
                            height,
                        });
                        
                        validImagesInBatch++;
                        processedCount++;
                        
                    } catch (error: any) {
                        console.error(`\n❌ Failed to process ${path.basename(imagePath)}: ${error.message}`);
                        continue;
                    }
                }
                
                if (validImagesInBatch > 0) {
                    // Save batch PDF
                    const batchPdfBytes = await batchPdfDoc.save();
                    allPdfBytes.push(batchPdfBytes);
                }
                
            } catch (batchError: any) {
                console.error(`\n❌ Batch ${batchNum} failed: ${batchError.message}`);
                throw batchError;
            }
        }
        
        if (allPdfBytes.length === 0) {
            throw new Error('No valid images were processed into PDF');
        }
        
        // Merge all batch PDFs into final PDF
        
        if (allPdfBytes.length === 1) {
            // Single batch, just write it
            await fs.writeFile(outputPath, allPdfBytes[0]);
        } else {
            // Multiple batches, merge them
            const finalPdfDoc = await PDFDocument.create();
            
            for (let i = 0; i < allPdfBytes.length; i++) {
                try {
                    const batchPdf = await PDFDocument.load(allPdfBytes[i]);
                    const pageIndices = batchPdf.getPageIndices();
                    const copiedPages = await finalPdfDoc.copyPages(batchPdf, pageIndices);
                    
                    copiedPages.forEach((page) => finalPdfDoc.addPage(page));
                } catch (mergeError: any) {
                    console.error(`\n❌ Failed to merge batch ${i + 1}: ${mergeError.message}`);
                    throw mergeError;
                }
            }
            
            const finalPdfBytes = await finalPdfDoc.save();
            await fs.writeFile(outputPath, finalPdfBytes);
        }
        
    }

    async loadFlorusManifest(florusUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Florus manifest for:', florusUrl);
        try {
            const response = await this.fetchDirect(florusUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch Florus page: HTTP ${response.status}`);
            }
            
            const html = await response.text();
            console.log('Florus page fetched, length:', html.length);
            
            // Extract manuscript code and current page from URL
            const urlParams = new URLSearchParams(florusUrl.split('?')[1]);
            const cote = urlParams.get('cote') || '';
            const currentVue = parseInt(urlParams.get('vue') || '1');
            
            if (!cote) {
                throw new Error('Invalid Florus URL: missing cote parameter');
            }
            
            // Parse the HTML to find the navigation structure and determine total pages
            console.log('Extracting Florus image URLs...');
            const pageLinks = await this.extractFlorusImageUrls(html, cote, currentVue);
            
            console.log(`Found ${pageLinks.length} pages for Florus manuscript`);
            if (pageLinks.length === 0) {
                throw new Error('No pages found in Florus manuscript');
            }
            
            // For Florus, we now have all pages loaded
            const manifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'florus' as const,
                displayName: `BM_Lyon_${cote}`,
                originalUrl: florusUrl,
            };
            
            console.log(`Florus manifest loaded: ${manifest.displayName}, total pages: ${pageLinks.length}`);
            return manifest;
            
        } catch (error: any) {
            throw new Error(`Failed to load Florus manuscript: ${error.message}`);
        }
    }

    private async extractFlorusImageUrls(html: string, cote: string, currentVue: number): Promise<string[]> {
        console.log('Extracting Florus URLs for manuscript:', cote);
        
        // Extract the image path from current page to understand the pattern
        const imagePathMatch = html.match(/FIF=([^&\s'"]+)/) ||
                              html.match(/image\s*:\s*'([^']+)'/) ||
                              html.match(/image\s*:\s*"([^"]+)"/);
        
        if (!imagePathMatch) {
            throw new Error('Could not find image path pattern in Florus page');
        }
        
        const currentImagePath = imagePathMatch[1];
        console.log('Current image path:', currentImagePath);
        
        // Extract the base path and manuscript ID
        // Example: /var/www/florus/web/ms/B693836101_MS0425/B693836101_MS0425_129_62V.JPG.tif
        const pathParts = currentImagePath.match(/(.+\/)([^/]+)\.JPG\.tif$/);
        if (!pathParts) {
            throw new Error('Could not parse Florus image path structure');
        }
        
        const basePath = pathParts[1];
        const filenameParts = pathParts[2].match(/^(.+?)_(\d+)_(.+)$/);
        if (!filenameParts) {
            throw new Error('Could not parse Florus filename structure');
        }
        
        // Find the total number of pages from navigation
        let maxPage = currentVue + 20; // Conservative fallback
        
        // Look for naviguer() function calls in the HTML
        const navNumbers = [...html.matchAll(/naviguer\((\d+)\)/g)]
            .map(match => parseInt(match[1]))
            .filter(num => !isNaN(num) && num > 0);
        
        console.log(`Found ${navNumbers.length} navigation numbers:`, navNumbers);
        
        if (navNumbers.length > 0) {
            maxPage = Math.max(...navNumbers);
            console.log(`Maximum page from navigation: ${maxPage}`);
        } else {
            console.log(`No navigation numbers found, using fallback: ${maxPage}`);
            // Try alternative patterns
            const altPatterns = [
                /href=["']javascript:naviguer\((\d+)\)/g,
                /onclick=["']naviguer\((\d+)\)/g,
                /naviguerSelect.*?value=["'](\d+)/g
            ];
            
            for (const pattern of altPatterns) {
                const altNumbers = [...html.matchAll(pattern)]
                    .map(match => parseInt(match[1]))
                    .filter(num => !isNaN(num) && num > 0);
                    
                if (altNumbers.length > 0) {
                    maxPage = Math.max(...altNumbers);
                    console.log(`Found ${altNumbers.length} pages using alternative pattern, max: ${maxPage}`);
                    break;
                }
            }
        }
        
        console.log(`Final detected page count: ${maxPage} pages for Florus manuscript`);
        
        const imageUrls: string[] = [];
        const serverUrl = 'https://florus.bm-lyon.fr/fcgi-bin/iipsrv.fcgi';
        
        // Batch fetch all pages to build complete URL list
        const batchSize = 10; // Process 10 pages concurrently
        const pageToFilename = new Map<number, string>();
        
        // For very large manuscripts, limit initial manifest loading to avoid timeouts
        const maxPagesToFetch = maxPage > 100 ? 50 : maxPage;
        console.log(`Fetching ${maxPagesToFetch} of ${maxPage} pages for initial manifest...`);
        
        // Process pages in batches for better performance
        for (let batchStart = 1; batchStart <= maxPagesToFetch; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize - 1, maxPagesToFetch);
            const batchPromises: Promise<void>[] = [];
            
            console.log(`Processing batch: pages ${batchStart} to ${batchEnd}`);
            
            for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
                const promise = (async () => {
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            const pageUrl = `https://florus.bm-lyon.fr/visualisation.php?cote=${cote}&vue=${pageNum}`;
                            const pageResponse = await this.fetchDirect(pageUrl);
                            
                            if (pageResponse.ok) {
                                const pageHtml = await pageResponse.text();
                                const pageImageMatch = pageHtml.match(/FIF=([^&\s'"]+)/) ||
                                                      pageHtml.match(/image\s*:\s*'([^']+)'/) ||
                                                      pageHtml.match(/image\s*:\s*"([^"]+)"/);
                                
                                if (pageImageMatch) {
                                    const imagePath = pageImageMatch[1];
                                    const filename = imagePath.substring(imagePath.lastIndexOf('/') + 1);
                                    pageToFilename.set(pageNum, filename);
                                    if (pageNum <= 5 || pageNum === maxPage) {
                                        console.log(`Page ${pageNum} image path: ${imagePath}`);
                                    }
                                    break; // Success, exit retry loop
                                } else {
                                    console.warn(`No image match found for page ${pageNum}, HTML length: ${pageHtml.length}`);
                                    if (pageNum === 1) {
                                        console.log('Sample HTML for debugging:', pageHtml.substring(0, 500));
                                    }
                                    break; // No point retrying if pattern doesn't match
                                }
                            } else {
                                console.warn(`HTTP ${pageResponse.status} for page ${pageNum}`);
                                retries--;
                                if (retries > 0) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                            }
                        } catch (error: any) {
                            console.warn(`Failed to fetch page ${pageNum} (${retries} retries left):`, error.message);
                            retries--;
                            if (retries > 0) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                    }
                })();
                
                batchPromises.push(promise);
            }
            
            // Wait for current batch to complete before starting next
            try {
                await Promise.all(batchPromises);
                console.log(`Batch complete. Total pages fetched so far: ${pageToFilename.size}`);
            } catch (batchError) {
                console.error(`Error in batch ${batchStart}-${batchEnd}:`, batchError);
                // Continue with next batch even if current batch has errors
            }
            
            // Add a longer delay between batches to avoid overwhelming the server
            if (batchEnd < maxPagesToFetch) {
                console.log(`Waiting 500ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay for Lyon library
            }
        }
        
        console.log(`Successfully fetched ${pageToFilename.size} pages out of ${maxPagesToFetch} attempted (${maxPage} total)`);
        
        // Log some sample filenames to debug
        if (pageToFilename.size > 0) {
            const sampleEntries = Array.from(pageToFilename.entries()).slice(0, 5);
            console.log('Sample page mappings:', sampleEntries);
        }
        
        // Build the complete list of image URLs in order
        for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
            const filename = pageToFilename.get(pageNum);
            if (filename) {
                const imagePath = `${basePath}${filename}`;
                const imageUrl = `${serverUrl}?FIF=${imagePath}&WID=2000&CVT=JPEG`;
                imageUrls.push(imageUrl);
            } else if (pageNum <= maxPagesToFetch) {
                // Page was attempted but not found
                console.warn(`Missing page ${pageNum}, adding placeholder`);
                imageUrls.push('');
            } else {
                // Page wasn't fetched yet - will be fetched during download
                // Store metadata needed to fetch the page later
                const lazyUrl = `FLORUS_LAZY:${cote}:${pageNum}:${basePath}`;
                imageUrls.push(lazyUrl);
            }
        }
        
        // Filter out empty URLs but keep track of actual count
        const validUrls = imageUrls.filter(url => url !== '');
        
        if (validUrls.length === 0) {
            throw new Error('Could not extract any valid image URLs from Florus manuscript');
        }
        
        console.log(`Returning ${validUrls.length} valid URLs out of ${maxPage} total pages`);
        console.log(`First few URLs:`, imageUrls.slice(0, 3).filter(url => url !== ''));
        return imageUrls; // Return all URLs including placeholders to maintain correct indexing
    }

    async loadUnicattManifest(unicattUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract the book ID from the URL
            // Pattern: https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6
            const urlMatch = unicattUrl.match(/\/veneranda\/([^/?]+)/);
            if (!urlMatch) {
                throw new Error('Invalid Unicatt URL format - could not extract book ID');
            }
            
            const bookIdFull = urlMatch[1];
            const displayType = 'public'; // Based on JavaScript in the page
            
            // Build the folder structure as done in the JavaScript:
            // for (let i = 0; i < 15; i += 2) { bookId = bookId + bookIdFull.substring(i, i+2) + "/" }
            let bookIdPath = '';
            for (let i = 0; i < Math.min(15, bookIdFull.length); i += 2) {
                const segment = bookIdFull.substring(i, i + 2);
                if (segment.length > 0) {
                    bookIdPath += segment + '/';
                }
            }
            bookIdPath += bookIdFull;
            
            // Construct the manifest URL based on the pattern found in the HTML
            const manifestUrl = `https://digitallibrary.unicatt.it/veneranda/data/${displayType}/manifests/${bookIdPath}.json`;
            
            try {
                // Try to load the IIIF manifest with proxy fallback
                const response = await this.fetchWithProxyFallback(manifestUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to load Unicatt manifest: HTTP ${response.status}`);
                }
                
                const responseText = await response.text();
                let manifest;
                try {
                    manifest = JSON.parse(responseText);
                } catch {
                    throw new Error(`Invalid JSON response from Unicatt manifest URL: ${manifestUrl}. Response starts with: ${responseText.substring(0, 100)}`);
                }
                
                // Process the IIIF manifest
                const pageLinks: string[] = [];
                
                // Handle IIIF v2/v3 format
                let canvases: any[] = [];
                
                if (manifest.sequences && Array.isArray(manifest.sequences)) {
                    // IIIF v2: canvases are in sequences
                    for (const sequence of manifest.sequences) {
                        const sequenceCanvases = sequence.canvases || [];
                        canvases.push(...sequenceCanvases);
                    }
                } else if (manifest.items && Array.isArray(manifest.items)) {
                    // IIIF v3: canvases are directly in manifest.items
                    canvases = manifest.items;
                } else {
                    // Fallback: try to find canvases in the manifest itself
                    canvases = manifest.canvases || [];
                }
                
                // Process each canvas to extract image URLs
                for (const canvas of canvases) {
                    let foundImages = false;
                    
                    // Check IIIF v2 format (canvas.images)
                    if (canvas.images && Array.isArray(canvas.images)) {
                        for (const image of canvas.images) {
                            let imageUrl;
                            
                            if (image.resource) {
                                imageUrl = image.resource['@id'] || image.resource.id;
                            } else if (image['@id']) {
                                imageUrl = image['@id'];
                            }
                            
                            if (imageUrl) {
                                // Convert to full resolution
                                if (imageUrl.includes('/full/')) {
                                    imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                }
                                pageLinks.push(imageUrl);
                                foundImages = true;
                            }
                        }
                    }
                    
                    // Check IIIF v3 format (canvas.items with AnnotationPages)
                    if (!foundImages && canvas.items && Array.isArray(canvas.items)) {
                        for (const item of canvas.items) {
                            if (item.type === 'AnnotationPage' && item.items && Array.isArray(item.items)) {
                                for (const annotation of item.items) {
                                    if (annotation.body && annotation.body.id) {
                                        let imageUrl = annotation.body.id;
                                        
                                        // Convert to full resolution
                                        if (imageUrl.includes('/full/')) {
                                            imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                                        }
                                        pageLinks.push(imageUrl);
                                        foundImages = true;
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No page links found in Unicatt IIIF manifest');
                }
                
                // Extract display name from manifest
                let displayName = `Unicatt_${bookIdFull}`;
                
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (manifest.label.en && Array.isArray(manifest.label.en)) {
                        displayName = manifest.label.en[0];
                    } else if (manifest.label.it && Array.isArray(manifest.label.it)) {
                        displayName = manifest.label.it[0];
                    } else if (manifest.label.none && Array.isArray(manifest.label.none)) {
                        displayName = manifest.label.none[0];
                    } else if (typeof manifest.label === 'object') {
                        // Try to extract any language variant
                        const languages = Object.keys(manifest.label);
                        if (languages.length > 0 && Array.isArray(manifest.label[languages[0]])) {
                            displayName = manifest.label[languages[0]][0];
                        }
                    }
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    displayName: displayName,
                    library: 'unicatt',
                    originalUrl: unicattUrl
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Unicatt manifest: ${error.message}`);
            }
            
        } catch (error: any) {
            throw new Error(`Failed to load Unicatt manuscript: ${error.message}`);
        }
    }

    async loadCudlManifest(cudlUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = cudlUrl.match(/\/view\/([^/]+)/);
            if (!idMatch) {
                throw new Error('Invalid Cambridge CUDL URL format');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://cudl.lib.cam.ac.uk/iiif/${manuscriptId}`;
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch CUDL manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                return resource['@id'] || resource.id;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'cudl',
                displayName: `Cambridge_${manuscriptId}`,
                originalUrl: cudlUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Cambridge CUDL manuscript: ${error.message}`);
        }
    }

    async loadTrinityCamManifest(trinityUrl: string): Promise<ManuscriptManifest> {
        try {
            const manuscriptIdMatch = trinityUrl.match(/\/Manuscript\/([^/]+)/);
            if (!manuscriptIdMatch) {
                throw new Error('Invalid Trinity College Cambridge URL format');
            }
            
            const manuscriptId = manuscriptIdMatch[1];
            const manifestUrl = `https://mss-cat.trin.cam.ac.uk/Manuscript/${manuscriptId}/manifest.json`;
            
            // Use extended timeout for Trinity Cambridge as their server can be slow
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
            
            try {
                const manifestResponse = await fetch(manifestUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json,application/ld+json,*/*',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!manifestResponse.ok) {
                    if (manifestResponse.status === 404) {
                        throw new Error(`Manuscript not found: ${manuscriptId}. Please check the URL is correct.`);
                    } else if (manifestResponse.status >= 500) {
                        throw new Error(`Trinity Cambridge server error (HTTP ${manifestResponse.status}). The server may be temporarily unavailable.`);
                    } else {
                        throw new Error(`Failed to fetch Trinity Cambridge manifest: HTTP ${manifestResponse.status}`);
                    }
                }
                
                const responseText = await manifestResponse.text();
                let iiifManifest;
                
                try {
                    iiifManifest = JSON.parse(responseText);
                } catch {
                    throw new Error(`Invalid JSON response from Trinity Cambridge. Response starts with: ${responseText.substring(0, 100)}`);
                }
                
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure from Trinity Cambridge');
                }
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    let imageUrl = resource['@id'] || resource.id;
                    
                    // For Trinity Cambridge, convert to smaller size for faster downloads
                    // Convert from /full/full/ to /full/1000,/ (1000px wide, loads in ~1.4s vs 45s)
                    if (imageUrl && imageUrl.includes('/full/full/')) {
                        imageUrl = imageUrl.replace('/full/full/', '/full/1000,/');
                    }
                    
                    return imageUrl;
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in Trinity Cambridge manifest');
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'trinity_cam',
                    displayName: `TrinityC_${manuscriptId}`,
                    originalUrl: trinityUrl,
                };
                
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('Trinity Cambridge server request timed out after 60 seconds. The server may be temporarily unavailable.');
                }
                throw fetchError;
            }
            
        } catch (error: any) {
            throw new Error(`Failed to load Trinity College Cambridge manuscript: ${error.message}`);
        }
    }

    async loadIsosManifest(isosUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = isosUrl.match(/\/([^/]+)\.html$/);
            if (!idMatch) {
                throw new Error('Invalid ISOS URL format');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://www.isos.dias.ie/static/manifests/${manuscriptId}.json`;
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch ISOS manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                
                // For ISOS, prefer the service URL format which works better with headers
                if (resource.service && (resource.service['@id'] || resource.service.id)) {
                    const serviceUrl = resource.service['@id'] || resource.service.id;
                    return serviceUrl + '/full/max/0/default.jpg';
                }
                
                // Fallback to resource ID
                return resource['@id'] || resource.id;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'isos',
                displayName: `ISOS_${manuscriptId}`,
                originalUrl: isosUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load ISOS manuscript: ${error.message}`);
        }
    }

    async loadMiraManifest(miraUrl: string): Promise<ManuscriptManifest> {
        try {
            const response = await this.fetchDirect(miraUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch MIRA page: HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Look for the manifest in the windows section which shows the default manifest for this MIRA item
            const windowsMatch = html.match(/windows:\s*\[\s*\{\s*manifestId:\s*"([^"]+)"/);
            if (!windowsMatch) {
                throw new Error('No IIIF manifest found in MIRA page windows configuration');
            }
            
            const manifestUrl = windowsMatch[1];
            console.log(`[MIRA] Found manifest URL: ${manifestUrl}`);
            
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch MIRA manifest: HTTP ${manifestResponse.status}`);
            }
            
            const manifestText = await manifestResponse.text();
            
            // Check if Trinity Dublin returned HTML instead of JSON (blocked/captcha)
            if (manifestUrl.includes('digitalcollections.tcd.ie') && manifestText.trim().startsWith('<')) {
                throw new Error('Trinity College Dublin manifests are currently blocked due to access restrictions. This MIRA item points to a Trinity Dublin manuscript that cannot be accessed programmatically.');
            }
            
            let iiifManifest;
            try {
                iiifManifest = JSON.parse(manifestText);
            } catch (parseError: any) {
                throw new Error(`Invalid JSON manifest from ${manifestUrl}: ${parseError.message}`);
            }
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                return resource['@id'] || resource.id || resource.service?.['@id'] + '/full/max/0/default.jpg';
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            const urlMatch = miraUrl.match(/\/(\d+)$/);
            const manuscriptId = urlMatch ? urlMatch[1] : 'unknown';
            
            // Extract manuscript name from the page title if available
            const titleMatch = html.match(/<h1[^>]*>MIrA \d+:\s*([^<]+)<\/h1>/);
            const manuscriptName = titleMatch ? titleMatch[1].trim() : `MIRA_${manuscriptId}`;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'mira',
                displayName: manuscriptName,
                originalUrl: miraUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load MIRA manuscript: ${error.message}`);
        }
    }

    async loadOrleansManifest(orleansUrl: string): Promise<ManuscriptManifest> {
        console.log(`Starting Orleans manifest loading for: ${orleansUrl}`);
        try {
            // Handle different types of URLs:
            // 1. Media notice pages: https://mediatheques.orleans.fr/recherche/viewnotice/clef/.../id/745380
            // 2. Direct Aurelia URLs: https://aurelia.orleans.fr/s/aurelia/item/257012
            
            let itemId: string;
            const baseApiUrl = 'https://aurelia.orleans.fr/api';
            
            if (orleansUrl.includes('mediatheques.orleans.fr')) {
                // For media notice pages, search by title since ID mapping is complex
                let searchQuery = '';
                
                if (orleansUrl.includes('FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE')) {
                    // Direct search for the Augustine manuscript
                    searchQuery = 'Fragments de différents livres de l\'Écriture sainte';
                } else {
                    // Try to extract and search for other manuscripts
                    const titleMatch = orleansUrl.match(/clef\/([^/]+)/);
                    if (titleMatch) {
                        const encodedTitle = titleMatch[1];
                        searchQuery = decodeURIComponent(encodedTitle.replace(/--/g, ' '));
                    } else {
                        throw new Error('Could not extract manuscript title from URL for search');
                    }
                }
                
                console.log(`Searching Orleans API for: "${searchQuery}"`);
                const searchUrl = `${baseApiUrl}/items?search=${encodeURIComponent(searchQuery)}`;
                
                // Add retry logic for search as well
                const searchResponse = await Promise.race([
                    this.fetchWithProxyFallback(searchUrl),
                    new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Search timeout')), 15000)
                    )
                ]);
                
                if (!searchResponse.ok) {
                    throw new Error(`Orleans search failed: HTTP ${searchResponse.status}`);
                }
                
                const searchResults = await searchResponse.json();
                console.log(`Orleans search returned ${Array.isArray(searchResults) ? searchResults.length : 0} results`);
                
                if (!Array.isArray(searchResults) || searchResults.length === 0) {
                    throw new Error(`Manuscript "${searchQuery}" not found in Orleans search results`);
                }
                
                itemId = searchResults[0]['o:id']?.toString() || searchResults[0].o_id?.toString();
                if (!itemId) {
                    throw new Error('Could not extract item ID from Orleans search results');
                }
                
                console.log(`Found Orleans manuscript with ID: ${itemId}`);
            } else if (orleansUrl.includes('aurelia.orleans.fr')) {
                // Direct Aurelia URL - extract item ID
                const itemMatch = orleansUrl.match(/\/item\/(\d+)/);
                if (!itemMatch) {
                    throw new Error('Invalid Aurelia URL format - could not extract item ID');
                }
                itemId = itemMatch[1];
            } else {
                throw new Error('Unsupported Orléans URL format');
            }
            
            // Fetch the item metadata with retry logic
            console.log(`Fetching Orleans item metadata for ID: ${itemId}`);
            const itemUrl = `${baseApiUrl}/items/${itemId}`;
            
            let itemData;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    const itemResponse = await Promise.race([
                        this.fetchWithProxyFallback(itemUrl),
                        new Promise<never>((_, reject) => 
                            setTimeout(() => reject(new Error('Item fetch timeout')), 15000)
                        )
                    ]);
                    
                    if (!itemResponse.ok) {
                        throw new Error(`Failed to fetch Orléans item: HTTP ${itemResponse.status}`);
                    }
                    
                    itemData = await itemResponse.json();
                    break;
                } catch (error: any) {
                    retryCount++;
                    console.warn(`Orleans item fetch attempt ${retryCount}/${maxRetries} failed:`, error.message);
                    
                    if (retryCount >= maxRetries) {
                        throw new Error(`Failed to fetch Orleans item after ${maxRetries} attempts: ${error.message}`);
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                }
            }
            console.log(`Successfully fetched Orleans item data`);
            
            // Extract media items from the Omeka item
            const mediaItems = itemData['o:media'] || itemData.o_media || [];
            
            if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
                throw new Error('No media items found in Orléans manuscript');
            }
            
            // Process media items to get IIIF URLs
            const pageLinks: string[] = [];
            console.log(`Processing ${mediaItems.length} media items for Orleans manuscript`);
            
            // Process media items sequentially to avoid overwhelming the server
            let processedCount = 0;
            
            for (let idx = 0; idx < mediaItems.length; idx++) {
                const mediaRef = mediaItems[idx];
                const mediaId = mediaRef['o:id'] || mediaRef.o_id || 
                               (typeof mediaRef === 'object' && mediaRef['@id'] ? 
                                mediaRef['@id'].split('/').pop() : mediaRef);
                
                if (!mediaId) {
                    console.warn(`No media ID found for media item ${idx}`);
                    continue;
                }
                
                try {
                    const mediaUrl = `${baseApiUrl}/media/${mediaId}`;
                    
                    // Use fetchWithProxyFallback with its built-in timeout
                    try {
                        const mediaResponse = await this.fetchWithProxyFallback(mediaUrl);
                        
                        if (mediaResponse.ok) {
                            const mediaData = await mediaResponse.json();
                            
                            // Extract IIIF image URL from the media data
                            const iiifSource = mediaData['o:source'] || mediaData.o_source;
                            
                            if (iiifSource && typeof iiifSource === 'string') {
                                // Convert IIIF service URL to full resolution image URL
                                let imageUrl = iiifSource;
                                
                                // If it's an IIIF image service URL, convert to full resolution
                                if (imageUrl.includes('/iiif/3/') || imageUrl.includes('/iiif/2/')) {
                                    // IIIF Image API URL - convert to full size JPEG
                                    imageUrl = `${imageUrl}/full/max/0/default.jpg`;
                                }
                                
                                pageLinks[idx] = imageUrl;
                                processedCount++;
                                
                                // Progress logging every 10 items
                                if (processedCount % 10 === 0) {
                                    console.log(`Orleans: processed ${processedCount}/${mediaItems.length} media items`);
                                }
                            } else {
                                // Fallback: check for thumbnail URLs if IIIF source not available
                                const thumbnails = mediaData.thumbnail_display_urls || mediaData['thumbnail_display_urls'];
                                if (thumbnails && thumbnails.large) {
                                    pageLinks[idx] = thumbnails.large;
                                    processedCount++;
                                }
                            }
                        } else {
                            console.warn(`Orleans media ${mediaId} returned HTTP ${mediaResponse.status}`);
                        }
                    } catch (fetchError: any) {
                        if (fetchError.name === 'AbortError') {
                            console.warn(`Orleans media ${mediaId} request timed out`);
                        } else {
                            throw fetchError;
                        }
                    }
                } catch (mediaError: any) {
                    console.warn(`Error processing Orleans media item ${mediaId}:`, mediaError.message);
                }
                
                // Add small delay between requests to be respectful to the server
                if (idx < mediaItems.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Filter out undefined values and maintain order
            const validPageLinks = pageLinks.filter(Boolean);
            console.log(`Successfully processed ${validPageLinks.length} page links for Orleans manuscript`);
            
            if (validPageLinks.length === 0) {
                throw new Error('No valid image URLs found in Orléans manuscript');
            }
            
            // Ensure we have a reasonable number of pages
            if (validPageLinks.length < Math.min(5, mediaItems.length * 0.1)) {
                console.warn(`Only ${validPageLinks.length}/${mediaItems.length} Orleans media items processed successfully`);
            }
            
            // Extract display name from item metadata
            let displayName = 'Orleans_Manuscript';
            
            if (itemData['dcterms:title'] || itemData['dcterms_title']) {
                const titleProperty = itemData['dcterms:title'] || itemData['dcterms_title'];
                if (Array.isArray(titleProperty) && titleProperty.length > 0) {
                    displayName = titleProperty[0]['@value'] || titleProperty[0].value || titleProperty[0];
                } else if (typeof titleProperty === 'string') {
                    displayName = titleProperty;
                }
            } else if (itemData['o:title'] || itemData.o_title) {
                displayName = itemData['o:title'] || itemData.o_title;
            }
            
            // Sanitize display name for filesystem
            displayName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 100);
            
            return {
                pageLinks: validPageLinks,
                totalPages: validPageLinks.length,
                displayName: displayName,
                library: 'orleans',
                originalUrl: orleansUrl,
            };
            
        } catch (error: any) {
            console.error(`Orleans manifest loading failed:`, error);
            throw new Error(`Failed to load Orléans manuscript: ${error.message}`);
        }
    }


}