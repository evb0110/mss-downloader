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
            name: 'Laon Bibliothèque ⚠️',
            example: 'https://bibliotheque-numerique.ville-laon.fr/viewer/1459/?offset=#page=1&viewer=picture&o=download&n=0&q=',
            description: 'Bibliothèque municipale de Laon digital manuscripts (NOT WORKING YET - proxy issues)',
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
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('e-codices.unifr.ch')) return 'unifr';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('cecilia.mediatheques.grand-albigeois.fr')) return 'cecilia';
        if (url.includes('arca.irht.cnrs.fr')) return 'irht';
        if (url.includes('patrimoine.bm-dijon.fr')) return 'dijon';
        if (url.includes('bibliotheque-numerique.ville-laon.fr')) return 'laon';
        if (url.includes('iiif.durham.ac.uk')) return 'durham';
        if (url.includes('sharedcanvas.be')) return 'sharedcanvas';
        if (url.includes('lib.ugent.be')) return 'ugent';
        if (url.includes('iiif.bl.uk') || url.includes('bl.digirati.io')) return 'bl';
        
        return null;
    }

    /**
     * Direct fetch (no proxy needed in Electron main process)
     */
    async fetchDirect(url: string, options: any = {}): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), configService.get('requestTimeout'));
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    ...options.headers
                }
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
        console.log(`Loading manifest for: ${originalUrl}`);
        
        // Check cache first
        const cachedManifest = await this.manifestCache.get(originalUrl);
        if (cachedManifest) {
            console.log(`✓ Using cached manifest for ${originalUrl}`);
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
                default:
                    throw new Error(`Unsupported library: ${library}`);
            }
            
            manifest.library = library as any;
            manifest.originalUrl = originalUrl;
            
            // Cache the manifest
            await this.manifestCache.set(originalUrl, manifest);
            
            console.log(`✓ Loaded ${manifest.totalPages} pages from ${library.toUpperCase()}`);
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
            const arkMatch = gallicaUrl.match(/ark:\/[^\/]+\/[^\/?\s]+/);
            if (!arkMatch) {
                throw new Error('Invalid Gallica URL format');
            }
            
            const ark = arkMatch[0];
            
            // Try IIIF manifest first (modern approach)
            const manifestUrl = `https://gallica.bnf.fr/iiif/${ark}/manifest.json`;
            console.log(`[Gallica] Trying IIIF manifest: ${manifestUrl}`);
            
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
                        console.log(`[Gallica] IIIF manifest loaded: ${pageLinks.length} pages`);
                        
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
            } catch (e) {
                console.log(`[Gallica] IIIF manifest failed: ${e}`);
            }
            
            // Fallback: Direct IIIF image testing approach
            console.log(`[Gallica] Trying direct IIIF image approach`);
            
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
                } catch (e) {
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
                    } catch (e) {
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
            
            console.log(`[Gallica] Direct IIIF approach found ${totalPages} pages`);
            
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
        } catch (error) {
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
                        // Convert to full resolution if IIIF
                        if (imageUrl.includes('/full/')) {
                            imageUrl = imageUrl.replace(/\/full\/[^\/]+\//, '/full/max/');
                        }
                        pageLinks.push(imageUrl);
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

    async loadVatlibManifest(url: string): Promise<ManuscriptManifest> {
        const manifestUrl = url.replace('/view/', '/iiif/') + '/manifest.json';
        return this.loadIIIFManifest(manifestUrl);
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
                const arkMatch = url.match(/ark:\/[^\/]+\/[^\/?\s]+/);
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
        } catch (error) {
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
                    console.log(`[Cecilia] Trying to parse viewer page for document ${documentId}`);
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
            
            console.log(`[Cecilia] Using manifest URL: ${manifestUrl}`);
            
            // Load the IIIF-style manifest from Cecilia
            const response = await this.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load Cecilia manifest: HTTP ${response.status}`);
            }
            
            const responseText = await response.text();
            let manifestData;
            try {
                manifestData = JSON.parse(responseText);
            } catch (error) {
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
        const arkMatch = url.match(/ark:\/(\d+)\/([^\/?]+)/);
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
        const msMatch = url.match(/img-viewer\/([^\/?]+)/);
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
            const lgiiifMatch = html.match(/lgiiif\?url=([^&'\"]+)/);
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
        const match = url.match(/\/viewer\/mirador\/([^\/?&]+)/);
        if (!match) {
            throw new Error('Invalid SharedCanvas URL format');
        }
        const manifestUrl = `https://sharedcanvas.be/IIIF/manifests/${match[1]}`;
        return this.loadIIIFManifest(manifestUrl);
    }

    /**
     * Download image with retries
     */
    async downloadImageWithRetries(url: string, attempt = 0): Promise<ArrayBuffer> {
        try {
            const response = await this.fetchDirect(url);
            
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
                console.log(`  Retry ${attempt + 1}/${maxRetries} in ${delay}ms: ${error.message}`);
                
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
            console.log(`🔍 Starting download for: ${url}`);
            
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
                .replace(/\s+/g, '_')                     // Replace spaces with underscores
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
            
            // Final PDF goes to Downloads folder
            const downloadsDir = app.getPath('downloads');
            await fs.mkdir(downloadsDir, { recursive: true });
            
            if (shouldSplit) {
                // For split PDFs, we'll create the first part initially
                const partNumber = String(1).padStart(2, '0');
                filename = `${sanitizedName}_part_${partNumber}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(downloadsDir, filename);
            } else {
                // Always include page numbers for clarity
                filename = `${sanitizedName}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(downloadsDir, filename);
            }
            
            // Check if file exists
            if (skipExisting) {
                try {
                    await fs.access(filepath);
                    console.log(`📁 File already exists: ${filename}`);
                    return { success: true, filepath, skipped: true };
                } catch {
                    // File doesn't exist, continue with download
                }
            }
            
            // Page range already calculated above for filename generation
            
            console.log(`📥 Downloading and saving pages ${actualStartPage}-${actualEndPage} (${totalPagesToDownload} pages)...`);
            
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
                const imageUrl = manifest.pageLinks[pageIndex];
                const imgFile = `${sanitizedName}_page_${pageIndex + 1}.jpg`;
                const imgPath = path.join(tempImagesDir, imgFile);
                
                try {
                    // Skip if already downloaded
                    await fs.access(imgPath);
                } catch {
                    // Not present: fetch and write
                    try {
                        const imageData = await this.downloadImageWithRetries(imageUrl);
                        const writePromise = fs.writeFile(imgPath, Buffer.from(imageData));
                        writePromises.push(writePromise);
                    } catch (error: any) {
                        console.error(`\n❌ Failed to download page ${pageIndex + 1}: ${error.message}`);
                    }
                }
                
                // Mark path regardless of skip/fail
                imagePaths[pageIndex] = imgPath;
                completedPages++;
                updateProgress();
            };
            
            await Promise.all(semaphore.map(async () => {
                while (nextPageIndex < actualEndPage) {
                    const idx = nextPageIndex++;
                    await downloadPage(idx);
                }
            }));
            
            console.log('\n');
            const validImagePaths = imagePaths.filter(Boolean);
            
            if (validImagePaths.length === 0) {
                throw new Error('No images were successfully downloaded');
            }
            
            validImagePaths.sort((a, b) => {
                const aNum = parseInt(a.match(/_page_(\d+)\.jpg$/)![1], 10);
                const bNum = parseInt(b.match(/_page_(\d+)\.jpg$/)![1], 10);
                return aNum - bNum;
            });
            
            console.log(`📄 Converting ${validImagePaths.length} images to PDF...`);
            
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
                    const partFilepath = path.join(downloadsDir, partFilename);
                    
                    console.log(`  Creating part ${partIndex + 1}/${totalParts}: ${partFilename} (${partImages.length} pages)`);
                    await this.convertImagesToPDF(partImages, partFilepath);
                    createdFiles.push(partFilepath);
                }
                
                console.log(`✅ Successfully created ${totalParts} PDF parts`);
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {}
                }
                
                // Wait for all file writes to complete
                await Promise.all(writePromises);
                
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
                console.log(`✅ Successfully saved: ${filename}`);
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {}
                }
                
                // Wait for all file writes to complete
                await Promise.all(writePromises);
                
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
        
        console.log(`  Processing ${totalImages} images in batches of ${batchSize}...`);
        
        const allPdfBytes: Uint8Array[] = [];
        let processedCount = 0;
        
        // Process images in batches to manage memory
        for (let i = 0; i < totalImages; i += batchSize) {
            const batch = imagePaths.slice(i, Math.min(i + batchSize, totalImages));
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(totalImages / batchSize);
            
            console.log(`\n  Processing batch ${batchNum}/${totalBatches} (${batch.length} images)...`);
            
            try {
                const batchPdfDoc = await PDFDocument.create();
                let validImagesInBatch = 0;
                
                for (const imagePath of batch) {
                    try {
                        // Check if file exists and is accessible
                        await fs.access(imagePath);
                        const stats = await fs.stat(imagePath);
                        
                        if (stats.size < MIN_VALID_IMAGE_SIZE_BYTES) {
                            console.warn(`\n⚠  Skipping ${path.basename(imagePath)}: file too small (${stats.size} bytes)`);
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
                                console.warn(`\n⚠  Failed to embed ${path.basename(imagePath)}: ${embedError.message}`);
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
                        
                        const percentage = Math.round((processedCount / totalImages) * 100);
                        console.log(`    Progress: ${percentage}% (${processedCount}/${totalImages})`);
                        
                    } catch (error: any) {
                        console.error(`\n❌ Failed to process ${path.basename(imagePath)}: ${error.message}`);
                        continue;
                    }
                }
                
                if (validImagesInBatch > 0) {
                    // Save batch PDF
                    const batchPdfBytes = await batchPdfDoc.save();
                    allPdfBytes.push(batchPdfBytes);
                    console.log(`\n    Batch ${batchNum} completed: ${validImagesInBatch} images processed`);
                } else {
                    console.warn(`\n⚠  Batch ${batchNum} contained no valid images`);
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
        console.log(`\n  Merging ${allPdfBytes.length} PDF batches...`);
        
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
                    
                    console.log(`    Merged batch ${i + 1}/${allPdfBytes.length}`);
                } catch (mergeError: any) {
                    console.error(`\n❌ Failed to merge batch ${i + 1}: ${mergeError.message}`);
                    throw mergeError;
                }
            }
            
            const finalPdfBytes = await finalPdfDoc.save();
            await fs.writeFile(outputPath, finalPdfBytes);
        }
        
        console.log(`\n  ✅ PDF created successfully: ${processedCount} pages processed`);
    }

}