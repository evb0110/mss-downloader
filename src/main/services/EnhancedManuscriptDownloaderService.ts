import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { PDFDocument, rgb } from 'pdf-lib';
import { ManifestCache } from './ManifestCache.js';
import { configService } from './ConfigService.js';
import { LibraryOptimizationService } from './LibraryOptimizationService.js';
import type { ManuscriptManifest, LibraryInfo } from '../../shared/types';
import type { TLibrary } from '../../shared/queueTypes';

const MIN_VALID_IMAGE_SIZE_BYTES = 1024; // 1KB heuristic

export class EnhancedManuscriptDownloaderService {
    private manifestCache: ManifestCache;

    constructor(manifestCache?: ManifestCache) {
        this.manifestCache = manifestCache || new ManifestCache();
        // Clear potentially problematic cached manifests on startup
        this.manifestCache.clearProblematicUrls().catch(error => {
            console.warn('Failed to clear problematic cache entries:', error.message);
        });
    }

    static readonly SUPPORTED_LIBRARIES: LibraryInfo[] = [
        {
            name: 'BDL (Biblioteca Digitale Lombarda)',
            example: 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903',
            description: 'Biblioteca Digitale Lombarda digital manuscripts via IIIF',
        },
        {
            name: 'Berlin State Library',
            example: 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001',
            description: 'Staatsbibliothek zu Berlin digital manuscript collections via IIIF',
        },
        {
            name: 'British Library',
            example: 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001',
            description: 'British Library digital manuscript collections via IIIF',
        },
        {
            name: 'Cambridge University Digital Library',
            example: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1',
            description: 'Cambridge University Library digital manuscripts via IIIF',
        },
        {
            name: 'Cecilia (Grand Albigeois)',
            example: 'https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=',
            description: 'Grand Albigeois mediatheques digital collections',
        },
        {
            name: 'Cologne Dom Library',
            example: 'https://digital.dombibliothek-koeln.de/hs/content/zoom/156145',
            description: 'Cologne Cathedral Library digital manuscript collection',
        },
        {
            name: 'Czech Digital Library (VKOL)',
            example: 'https://dig.vkol.cz/dig/mii87/0001rx.htm',
            description: 'Czech digital manuscript library (Experimental)',
        },
        {
            name: 'Dijon Patrimoine',
            example: 'http://patrimoine.bm-dijon.fr/pleade/img-viewer/MS00114/?ns=FR212316101_CITEAUX_MS00114_000_01_PS.jpg',
            description: 'Bibliothèque municipale de Dijon digital manuscripts',
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
            name: 'Durham University',
            example: 'https://iiif.durham.ac.uk/index.html?manifest=t1mp2676v52p',
            description: 'Durham University Library digital manuscripts via IIIF',
        },
        {
            name: 'e-codices (Unifr)',
            example: 'https://www.e-codices.ch/en/sbe/0610/1',
            description: 'Swiss virtual manuscript library',
        },
        {
            name: 'Florus (BM Lyon)',
            example: 'https://florus.bm-lyon.fr/visualisation.php?cote=MS0425&vue=128',
            description: 'Bibliothèque municipale de Lyon digital manuscripts',
        },
        {
            name: 'Gallica (BnF)',
            example: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres',
            description: 'French National Library digital manuscripts (supports any f{page}.* format)',
        },
        {
            name: 'Internet Culturale',
            example: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
            description: 'Italian national digital heritage platform serving manuscripts from BNCF, Laurenziana, and other institutions',
        },
        {
            name: 'IRHT (CNRS)',
            example: 'https://arca.irht.cnrs.fr/ark:/63955/md14nk323d72',
            description: 'Institut de recherche et d\'histoire des textes digital manuscripts',
        },
        {
            name: 'Laon Bibliothèque',
            example: 'https://bibliotheque-numerique.ville-laon.fr/viewer/1459/?offset=#page=1&viewer=picture&o=download&n=0&q=',
            description: 'Bibliothèque municipale de Laon digital manuscripts',
        },
        {
            name: 'Manuscripta.se',
            example: 'https://manuscripta.se/ms/101124',
            description: 'Swedish digital catalogue of medieval and early modern manuscripts via IIIF',
        },
        {
            name: 'Modena Diocesan Archive',
            example: 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/',
            description: 'Modena Diocesan Archive digital manuscripts (Flash interface bypassed)',
        },
        {
            name: 'Morgan Library & Museum',
            example: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
            description: 'Morgan Library & Museum digital manuscript collections',
        },
        {
            name: 'NYPL Digital Collections',
            example: 'https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002',
            description: 'New York Public Library digital manuscript collections',
        },
        {
            name: 'Orléans Médiathèques (Aurelia)',
            example: 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380',
            description: 'Médiathèques d\'Orléans digital heritage library via IIIF/Omeka',
        },
        {
            name: 'Real Biblioteca del Monasterio de El Escorial (RBME)',
            example: 'https://rbme.patrimonionacional.es/s/rbme/item/14374',
            description: 'Real Biblioteca del Monasterio de El Escorial digital manuscripts via IIIF',
        },
        {
            name: 'Rome National Library (BNCR)',
            example: 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
            description: 'Biblioteca Nazionale Centrale di Roma digital manuscript collections',
        },
        {
            name: 'SharedCanvas',
            example: 'https://sharedcanvas.be/IIIF/viewer/mirador/B_OB_MS310',
            description: 'SharedCanvas-based digital manuscript viewers and collections',
        },
        {
            name: 'Stanford Parker Library',
            example: 'https://parker.stanford.edu/parker/catalog/zs345bj2650',
            description: 'Stanford Parker Library on the Web - digitized manuscripts from Corpus Christi College, Cambridge via IIIF',
        },
        {
            name: 'Trinity College Cambridge',
            example: 'https://mss-cat.trin.cam.ac.uk/Manuscript/B.10.5/UV',
            description: 'Trinity College Cambridge digital manuscripts',
        },
        {
            name: 'UGent Library',
            example: 'https://lib.ugent.be/viewer/archive.ugent.be%3A644DCADE-4FE7-11E9-9AC5-81E62282636C',
            description: 'Ghent University Library digital manuscript collections via IIIF',
        },
        {
            name: 'Unicatt (Ambrosiana)',
            example: 'https://digitallibrary.unicatt.it/veneranda/0b02da82800c3ea6',
            description: 'Biblioteca Ambrosiana digital manuscripts',
        },
        {
            name: 'University of Graz',
            example: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            description: 'University of Graz digital manuscript collection with IIIF support',
        },
        {
            name: 'Vatican Library',
            example: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
            description: 'Vatican Apostolic Library digital collections',
        },
        {
            name: 'Vienna Manuscripta.at',
            example: 'https://manuscripta.at/diglit/AT5000-1013/0001',
            description: 'Austrian National Library digital manuscript collection',
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
        
        if (url.includes('digitalcollections.nypl.org')) return 'nypl';
        if (url.includes('themorgan.org')) return 'morgan';
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
        if (url.includes('internetculturale.it')) return 'internet_culturale';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('isos.dias.ie')) return 'isos';
        if (url.includes('mira.ie')) return 'mira';
        if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) return 'orleans';
        if (url.includes('rbme.patrimonionacional.es')) return 'rbme';
        if (url.includes('parker.stanford.edu')) return 'parker';
        if (url.includes('manuscripta.se')) return 'manuscripta';
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('digital.dombibliothek-koeln.de')) return 'cologne';
        if (url.includes('manuscripta.at')) return 'vienna_manuscripta';
        if (url.includes('digitale.bnc.roma.sbn.it')) return 'rome';
        if (url.includes('digital.staatsbibliothek-berlin.de')) return 'berlin';
        if (url.includes('dig.vkol.cz')) return 'czech';
        if (url.includes('archiviodiocesano.mo.it')) return 'modena';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        
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
    async fetchDirect(url: string, options: any = {}, attempt: number = 1): Promise<Response> {
        const controller = new AbortController();
        
        // Detect library and apply optimized timeout
        const library = this.detectLibrary(url) as TLibrary;
        const baseTimeout = configService.get('requestTimeout');
        const timeout = library ? 
            LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, library, attempt) :
            baseTimeout;
            
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
        
        // Special headers for Orleans IIIF to avoid timeout/hanging issues
        if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) {
            headers = {
                ...headers,
                'Referer': 'https://aurelia.orleans.fr/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            };
        }
        
        // Special headers for Stanford Parker Library IIIF to avoid HTTP 406 errors
        if (url.includes('stacks.stanford.edu') || url.includes('dms-data.stanford.edu')) {
            headers = {
                'User-Agent': 'curl/7.68.0',
                'Accept': '*/*'
            };
        }
        
        // Special headers for Internet Culturale to improve performance
        if (url.includes('internetculturale.it')) {
            headers = {
                ...headers,
                'Referer': 'https://www.internetculturale.it/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
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
    async loadManifest(originalUrl: string, progressCallback?: (current: number, total: number, message?: string) => void): Promise<ManuscriptManifest> {
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
                case 'nypl':
                    manifest = await this.loadNyplManifest(originalUrl);
                    break;
                case 'morgan':
                    manifest = await this.loadMorganManifest(originalUrl);
                    break;
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
                    manifest = await this.loadOrleansManifest(originalUrl, progressCallback);
                    break;
                case 'rbme':
                    manifest = await this.loadRbmeManifest(originalUrl);
                    break;
                case 'parker':
                    manifest = await this.loadParkerManifest(originalUrl);
                    break;
                case 'manuscripta':
                    manifest = await this.loadManuscriptaManifest(originalUrl);
                    break;
                case 'internet_culturale':
                    manifest = await this.loadInternetCulturaleManifest(originalUrl);
                    break;
                case 'graz':
                    manifest = await this.loadGrazManifest(originalUrl);
                    break;
                case 'cologne':
                    manifest = await this.loadCologneManifest(originalUrl);
                    break;
                case 'vienna_manuscripta':
                    manifest = await this.loadViennaManuscriptaManifest(originalUrl);
                    break;
                case 'rome':
                    manifest = await this.loadRomeManifest(originalUrl);
                    break;
                case 'berlin':
                    manifest = await this.loadBerlinManifest(originalUrl);
                    break;
                case 'czech':
                    manifest = await this.loadCzechManifest(originalUrl);
                    break;
                case 'modena':
                    manifest = await this.loadModenaManifest(originalUrl);
                    break;
                case 'bdl':
                    manifest = await this.loadBDLManifest(originalUrl);
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
     * Load Morgan Library & Museum manifest
     */
    async loadMorganManifest(morganUrl: string): Promise<ManuscriptManifest> {
        try {
            // Handle different Morgan URL patterns
            let baseUrl: string;
            let displayName: string = 'Morgan Library Manuscript';
            
            if (morganUrl.includes('ica.themorgan.org')) {
                // ICA format: https://ica.themorgan.org/manuscript/thumbs/159109
                const icaMatch = morganUrl.match(/\/manuscript\/thumbs\/(\d+)/);
                if (!icaMatch) {
                    throw new Error('Invalid Morgan ICA URL format');
                }
                baseUrl = 'https://ica.themorgan.org';
                displayName = `Morgan ICA Manuscript ${icaMatch[1]}`;
            } else {
                // Main format: https://www.themorgan.org/collection/lindau-gospels/thumbs
                // or https://www.themorgan.org/collection/gospel-book/159129
                const mainMatch = morganUrl.match(/\/collection\/([^/]+)(?:\/(\d+))?(?:\/thumbs)?/);
                if (!mainMatch) {
                    throw new Error('Invalid Morgan URL format');
                }
                baseUrl = 'https://www.themorgan.org';
                
                // Extract display name from URL
                displayName = mainMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            
            // Ensure we're fetching the thumbs page
            let thumbsUrl = morganUrl;
            if (!thumbsUrl.includes('/thumbs') && !thumbsUrl.includes('ica.themorgan.org')) {
                thumbsUrl = thumbsUrl.replace(/\/?$/, '/thumbs');
            }
            
            // Fetch the thumbs page to extract image data
            const pageResponse = await this.fetchDirect(thumbsUrl);
            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch Morgan page: ${pageResponse.status}`);
            }
            
            const pageContent = await pageResponse.text();
            
            // Extract image URLs from the page
            const pageLinks: string[] = [];
            
            if (morganUrl.includes('ica.themorgan.org')) {
                // ICA format - look for image references
                const icaImageRegex = /icaimages\/\d+\/[^"']+\.jpg/g;
                const icaMatches = pageContent.match(icaImageRegex) || [];
                
                for (const match of icaMatches) {
                    const fullUrl = `https://ica.themorgan.org/${match}`;
                    if (!pageLinks.includes(fullUrl)) {
                        pageLinks.push(fullUrl);
                    }
                }
            } else {
                // Main Morgan format - look for styled images and convert to original high-res
                const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
                const styledMatches = pageContent.match(styledImageRegex) || [];
                
                for (const match of styledMatches) {
                    // Convert styled image to original high-resolution version
                    // From: /sites/default/files/styles/large__650_x_650_/public/images/collection/filename.jpg
                    // To: /sites/default/files/images/collection/filename.jpg
                    const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
                    const fullUrl = `${baseUrl}${originalPath}`;
                    if (!pageLinks.includes(fullUrl)) {
                        pageLinks.push(fullUrl);
                    }
                }
                
                // Look for direct full-size image references (primary source for high-resolution images)
                const fullSizeImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
                const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
                
                for (const match of fullSizeMatches) {
                    const fullUrl = `${baseUrl}${match}`;
                    if (!pageLinks.includes(fullUrl)) {
                        pageLinks.push(fullUrl);
                    }
                }
                
                // Fallback: look for facsimile images (legacy format)
                const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
                const facsimileMatches = pageContent.match(facsimileRegex) || [];
                
                for (const match of facsimileMatches) {
                    const fullUrl = `${baseUrl}${match}`;
                    if (!pageLinks.includes(fullUrl)) {
                        pageLinks.push(fullUrl);
                    }
                }
                
                // Also look for any direct image references
                const directImageRegex = /https?:\/\/[^"']*themorgan\.org[^"']*\.jpg/g;
                const directMatches = pageContent.match(directImageRegex) || [];
                
                for (const match of directMatches) {
                    if (!pageLinks.includes(match) && (match.includes('facsimile') || match.includes('images/collection'))) {
                        pageLinks.push(match);
                    }
                }
            }
            
            // Try to extract title from page content
            const titleMatch = pageContent.match(/<title[^>]*>([^<]+)</i);
            if (titleMatch) {
                const pageTitle = titleMatch[1].replace(/\s*\|\s*The Morgan Library.*$/i, '').trim();
                if (pageTitle && pageTitle !== 'The Morgan Library & Museum') {
                    displayName = pageTitle;
                }
            }
            
            // Look for manuscript identifier in content
            const msMatch = pageContent.match(/MS\s+M\.?\s*(\d+)/i);
            if (msMatch) {
                displayName = `${displayName} (MS M.${msMatch[1]})`;
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No images found on Morgan Library page');
            }
            
            // Remove duplicates and sort
            const uniquePageLinks = [...new Set(pageLinks)].sort();
            
            const morganManifest = {
                pageLinks: uniquePageLinks,
                totalPages: uniquePageLinks.length,
                library: 'morgan' as const,
                displayName,
                originalUrl: morganUrl,
            };
            
            return morganManifest;
            
        } catch (error: any) {
            console.error(`Failed to load Morgan manifest: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load NYPL Digital Collections manifest
     */
    async loadNyplManifest(nyplUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract UUID from URL like https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002
            const uuidMatch = nyplUrl.match(/\/items\/([a-f0-9-]+)/);
            if (!uuidMatch) {
                throw new Error('Invalid NYPL URL format');
            }
            
            const uuid = uuidMatch[1];
            
            // Fetch the main page to extract carousel data
            const pageResponse = await this.fetchDirect(nyplUrl);
            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch NYPL page: ${pageResponse.status}`);
            }
            
            const pageContent = await pageResponse.text();
            
            // Extract carousel data which contains image IDs
            const carouselMatch = pageContent.match(/data-items="([^"]+)"/);
            if (!carouselMatch) {
                throw new Error('Could not find carousel data in NYPL page');
            }
            
            // Decode HTML entities and parse JSON
            const carouselDataHtml = carouselMatch[1];
            const carouselDataJson = carouselDataHtml
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&');
            
            let carouselItems;
            try {
                carouselItems = JSON.parse(carouselDataJson);
            } catch (error: any) {
                throw new Error(`Failed to parse carousel JSON: ${error.message}`);
            }
            
            if (!Array.isArray(carouselItems) || carouselItems.length === 0) {
                throw new Error('No carousel items found');
            }
            
            // Extract image IDs and construct high-resolution image URLs
            const pageLinks = carouselItems.map((item: any) => {
                if (!item.image_id) {
                    throw new Error(`Missing image_id for item ${item.id || 'unknown'}`);
                }
                // Use images.nypl.org format for full resolution images (&t=g parameter)
                return `https://images.nypl.org/index.php?id=${item.image_id}&t=g`;
            });
            
            // Extract display name from the first item or fallback to title from item_data
            let displayName = `NYPL Document ${uuid}`;
            if (carouselItems[0]?.title_full) {
                displayName = carouselItems[0].title_full;
            } else if (carouselItems[0]?.title) {
                displayName = carouselItems[0].title;
            } else {
                // Fallback: try to extract from item_data as well
                const itemDataMatch = pageContent.match(/var\s+item_data\s*=\s*({.*?});/s);
                if (itemDataMatch) {
                    try {
                        const itemData = JSON.parse(itemDataMatch[1]);
                        if (itemData.title) {
                            displayName = Array.isArray(itemData.title) ? itemData.title[0] : itemData.title;
                        }
                    } catch {
                        // Ignore parsing errors for fallback title
                    }
                }
            }
            
            const nyplManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'nypl' as const,
                displayName,
                originalUrl: nyplUrl,
            };
            
            return nyplManifest;
            
        } catch (error: any) {
            console.error(`Failed to load NYPL manifest: ${error.message}`);
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
            
            // Try IIIF manifest first to get page count and metadata (modern approach)
            const manifestUrl = `https://gallica.bnf.fr/iiif/${ark}/manifest.json`;
            
            try {
                const manifestResponse = await this.fetchDirect(manifestUrl);
                if (manifestResponse.ok) {
                    const manifest = await manifestResponse.json();
                    
                    // Extract page count and metadata from IIIF manifest
                    let displayName = `Gallica Document ${ark}`;
                    let totalPages = 0;
                    
                    if (manifest.label) {
                        displayName = typeof manifest.label === 'string' ? manifest.label : 
                                     manifest.label.en?.[0] || manifest.label.fr?.[0] || displayName;
                    }
                    
                    // IIIF Presentation API v2 or v3
                    const sequences = manifest.sequences || [manifest];
                    
                    for (const sequence of sequences) {
                        const canvases = sequence.canvases || sequence.items || [];
                        totalPages += canvases.length;
                    }
                    
                    if (totalPages > 0) {
                        // Use the working .highres format instead of broken IIIF URLs
                        const pageLinks: string[] = [];
                        for (let i = 1; i <= totalPages; i++) {
                            const imageUrl = `https://gallica.bnf.fr/${ark}/f${i}.highres`;
                            pageLinks.push(imageUrl);
                        }
                        
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
            
            // Fallback: Direct .highres testing approach (using working URL format)
            
            // Test if we can access .highres images directly and find the page count
            let totalPages = 0;
            
            // Binary search to find total pages efficiently
            let low = 1;
            let high = 1000; // reasonable upper bound
            let lastValidPage = 0;
            
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const testUrl = `https://gallica.bnf.fr/${ark}/f${mid}.highres`;
                
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
                    const testUrl = `https://gallica.bnf.fr/${ark}/f${count}.highres`;
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
            
            // Generate .highres image URLs
            const pageLinks = [];
            for (let i = 1; i <= totalPages; i++) {
                const imageUrl = `https://gallica.bnf.fr/${ark}/f${i}.highres`;
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
            // Use proxy fallback for Unicatt, Orleans, Internet Culturale, and Graz images or when direct access fails
            const response = url.includes('digitallibrary.unicatt.it') || url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr') || url.includes('internetculturale.it') || url.includes('unipub.uni-graz.at')
                ? await this.fetchWithProxyFallback(url)
                : await this.fetchDirect(url, {}, attempt + 1); // Pass attempt number for timeout calculation
            
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
                // Check if library supports progressive backoff
                const library = this.detectLibrary(url) as TLibrary;
                const useProgressiveBackoff = library && 
                    LibraryOptimizationService.getOptimizationsForLibrary(library).enableProgressiveBackoff;
                    
                const delay = useProgressiveBackoff 
                    ? LibraryOptimizationService.calculateProgressiveBackoff(attempt + 1)
                    : this.calculateRetryDelay(attempt);
                
                console.log(`Retrying ${url} (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms delay` + 
                           (useProgressiveBackoff ? ' (progressive backoff)' : ''));
                
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
            const failedPages: number[] = [];
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
            
            // Apply library-specific optimization settings for concurrent downloads
            const globalMaxConcurrent = maxConcurrent || configService.get('maxConcurrentDownloads');
            const library = manifest.library as TLibrary;
            const autoSplitThresholdMB = Math.round(configService.get('autoSplitThreshold') / (1024 * 1024)); // Convert bytes to MB
            const optimizations = LibraryOptimizationService.applyOptimizations(
                autoSplitThresholdMB,
                globalMaxConcurrent,
                library
            );
            const actualMaxConcurrent = optimizations.maxConcurrentDownloads;
            
            // Log optimization info for debugging
            if (optimizations.optimizationDescription) {
                console.log(`Applying ${library} optimizations: ${optimizations.optimizationDescription}`);
                console.log(`Using ${actualMaxConcurrent} concurrent downloads (global: ${globalMaxConcurrent})`);
            }
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
                    completedPages++; // Count cached files as completed
                } catch {
                    // Not present: fetch and write
                    try {
                        const imageData = await this.downloadImageWithRetries(imageUrl);
                        const writePromise = fs.writeFile(imgPath, Buffer.from(imageData));
                        writePromises.push(writePromise);
                        // Only mark path if download succeeded
                        imagePaths[pageIndex] = imgPath;
                        completedPages++; // Only increment on successful download
                    } catch (error: any) {
                        console.error(`\n❌ Failed to download page ${pageIndex + 1}: ${error.message}`);
                        // Track failed page
                        failedPages.push(pageIndex + 1);
                        // Don't mark path for failed downloads
                        // Don't increment completedPages for failures
                    }
                }
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
            
            // Create complete array with placeholders for failed pages - only for the requested page range
            const completeImagePaths: (string | null)[] = [];
            for (let i = 0; i < totalPagesToDownload; i++) {
                const actualPageIndex = actualStartPage - 1 + i; // Convert to 0-based index
                completeImagePaths[i] = imagePaths[actualPageIndex] || null;
            }
            
            const validImagePaths = imagePaths.filter(Boolean);
            
            if (validImagePaths.length === 0) {
                throw new Error('No images were successfully downloaded');
            }
            
            // Enhanced validation for manuscripta.se to prevent infinite loops
            if (manifest.library === 'manuscripta') {
                const successRate = validImagePaths.length / totalPagesToDownload;
                const minSuccessRate = 0.8; // At least 80% success rate required
                
                if (successRate < minSuccessRate) {
                    throw new Error(`Manuscripta.se download had low success rate: ${Math.round(successRate * 100)}% (${validImagePaths.length}/${totalPagesToDownload} pages). Minimum ${Math.round(minSuccessRate * 100)}% required to prevent infinite loops.`);
                }
                
                console.log(`✅ Manuscripta.se validation passed: ${Math.round(successRate * 100)}% success rate (${validImagePaths.length}/${totalPagesToDownload} pages)`);
            }
            
            validImagePaths.sort((a, b) => {
                const aNum = parseInt(a.match(/_page_(\d+)\.jpg$/)![1], 10);
                const bNum = parseInt(b.match(/_page_(\d+)\.jpg$/)![1], 10);
                return aNum - bNum;
            });
            
            
            if (shouldSplit) {
                // Split into multiple PDFs like barsky.club
                const totalParts = Math.ceil(completeImagePaths.length / maxPagesPerPart);
                const createdFiles: string[] = [];
                
                for (let partIndex = 0; partIndex < totalParts; partIndex++) {
                    const startIdx = partIndex * maxPagesPerPart;
                    const endIdx = Math.min(startIdx + maxPagesPerPart, completeImagePaths.length);
                    const partImages = completeImagePaths.slice(startIdx, endIdx);
                    
                    const partNumber = String(partIndex + 1).padStart(2, '0');
                    const partFilename = `${sanitizedName}_part_${partNumber}.pdf`;
                    const partFilepath = path.join(targetDir, partFilename);
                    
                    const partStartPage = actualStartPage + startIdx;
                    await this.convertImagesToPDFWithBlanks(partImages, partFilepath, partStartPage);
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
                await this.convertImagesToPDFWithBlanks(completeImagePaths, filepath, actualStartPage);
                
                // Clean up temporary images
                for (const p of validImagePaths) {
                    try { 
                        await fs.unlink(p); 
                    } catch {
                        // Ignore file deletion errors
                    }
                }
                
                const failedPagesCount = failedPages.length;
                const statusMessage = failedPagesCount > 0 
                    ? `${failedPagesCount} of ${manifest.totalPages} pages couldn't be downloaded`
                    : undefined;
                
                return { 
                    success: true, 
                    filepath, 
                    totalPages: manifest.totalPages, // Total pages including blanks
                    failedPages: failedPagesCount,
                    statusMessage 
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
            await this.writeFileWithVerification(outputPath, allPdfBytes[0]);
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
            await this.writeFileWithVerification(outputPath, finalPdfBytes);
        }
        
    }

    async convertImagesToPDFWithBlanks(imagePaths: (string | null)[], outputPath: string, startPageNumber: number = 1): Promise<void> {
        const totalImages = imagePaths.length;
        const maxMemoryMB = 1024;
        const batchSize = Math.min(50, Math.max(10, Math.floor(maxMemoryMB / 20)));
        
        const allPdfBytes: Uint8Array[] = [];
        let processedCount = 0;
        
        for (let i = 0; i < totalImages; i += batchSize) {
            const batch = imagePaths.slice(i, Math.min(i + batchSize, totalImages));
            
            try {
                const batchPdfDoc = await PDFDocument.create();
                let pagesInBatch = 0;
                
                for (let j = 0; j < batch.length; j++) {
                    const imagePath = batch[j];
                    const pageNumber = startPageNumber + i + j;
                    
                    if (imagePath === null) {
                        // Create informative page for missing image
                        const page = batchPdfDoc.addPage([595, 842]); // A4 size
                        const { height } = page.getSize();
                        
                        page.drawText(`Page ${pageNumber} - Download Failed`, {
                            x: 50,
                            y: height - 100,
                            size: 18,
                            color: rgb(0.6, 0.2, 0.2),
                        });
                        
                        page.drawText('This page could not be downloaded after multiple attempts.', {
                            x: 50,
                            y: height - 140,
                            size: 12,
                            color: rgb(0.4, 0.4, 0.4),
                        });
                        
                        page.drawText('Possible causes:', {
                            x: 50,
                            y: height - 170,
                            size: 11,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('• Server temporarily unavailable', {
                            x: 70,
                            y: height - 190,
                            size: 10,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('• Network connectivity issues', {
                            x: 70,
                            y: height - 205,
                            size: 10,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('• Image file corrupted or missing from source', {
                            x: 70,
                            y: height - 220,
                            size: 10,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        page.drawText('You may try downloading this manuscript again later.', {
                            x: 50,
                            y: height - 250,
                            size: 10,
                            color: rgb(0.5, 0.5, 0.5),
                        });
                        
                        pagesInBatch++;
                        processedCount++;
                        continue;
                    }
                    
                    // Process valid image (same logic as original function)
                    try {
                        await fs.access(imagePath);
                        const stats = await fs.stat(imagePath);
                        
                        if (stats.size < MIN_VALID_IMAGE_SIZE_BYTES) {
                            // Create informative page for corrupted/small image
                            const page = batchPdfDoc.addPage([595, 842]);
                            const { height } = page.getSize();
                            
                            page.drawText(`Page ${pageNumber} - File Corrupted`, {
                                x: 50,
                                y: height - 100,
                                size: 18,
                                color: rgb(0.6, 0.2, 0.2),
                            });
                            
                            page.drawText(`Image file was too small (${stats.size} bytes) or corrupted.`, {
                                x: 50,
                                y: height - 140,
                                size: 12,
                                color: rgb(0.4, 0.4, 0.4),
                            });
                            
                            page.drawText('The server provided an invalid or incomplete image file.', {
                                x: 50,
                                y: height - 170,
                                size: 11,
                                color: rgb(0.3, 0.3, 0.3),
                            });
                            
                            page.drawText('You may try downloading this manuscript again later.', {
                                x: 50,
                                y: height - 200,
                                size: 10,
                                color: rgb(0.5, 0.5, 0.5),
                            });
                            
                            pagesInBatch++;
                            processedCount++;
                            continue;
                        }
                        
                        const imageBuffer = await fs.readFile(imagePath);
                        
                        let image;
                        try {
                            image = await batchPdfDoc.embedJpg(imageBuffer);
                        } catch {
                            try {
                                image = await batchPdfDoc.embedPng(imageBuffer);
                            } catch (embedError: any) {
                                // Create informative page for embed failure
                                const page = batchPdfDoc.addPage([595, 842]);
                                const { height } = page.getSize();
                                
                                page.drawText(`Page ${pageNumber} - Format Error`, {
                                    x: 50,
                                    y: height - 100,
                                    size: 18,
                                    color: rgb(0.6, 0.2, 0.2),
                                });
                                
                                page.drawText('Image format not supported by PDF generator.', {
                                    x: 50,
                                    y: height - 140,
                                    size: 12,
                                    color: rgb(0.4, 0.4, 0.4),
                                });
                                
                                page.drawText('The image file exists but uses an unsupported format.', {
                                    x: 50,
                                    y: height - 170,
                                    size: 11,
                                    color: rgb(0.3, 0.3, 0.3),
                                });
                                
                                page.drawText('Please report this issue if it affects many pages.', {
                                    x: 50,
                                    y: height - 200,
                                    size: 10,
                                    color: rgb(0.5, 0.5, 0.5),
                                });
                                
                                pagesInBatch++;
                                processedCount++;
                                continue;
                            }
                        }
                        
                        const { width, height } = image;
                        const page = batchPdfDoc.addPage([width, height]);
                        page.drawImage(image, {
                            x: 0,
                            y: 0,
                            width,
                            height,
                        });
                        
                        pagesInBatch++;
                        processedCount++;
                        
                    } catch (error: any) {
                        // Create informative page for any other errors
                        const page = batchPdfDoc.addPage([595, 842]);
                        const { height } = page.getSize();
                        
                        page.drawText(`Page ${pageNumber} - Processing Error`, {
                            x: 50,
                            y: height - 100,
                            size: 18,
                            color: rgb(0.6, 0.2, 0.2),
                        });
                        
                        page.drawText('An unexpected error occurred while processing this page.', {
                            x: 50,
                            y: height - 140,
                            size: 12,
                            color: rgb(0.4, 0.4, 0.4),
                        });
                        
                        page.drawText('Error details:', {
                            x: 50,
                            y: height - 170,
                            size: 11,
                            color: rgb(0.3, 0.3, 0.3),
                        });
                        
                        const errorMsg = error.message || 'Unknown error occurred';
                        const truncatedError = errorMsg.length > 60 ? errorMsg.substring(0, 60) + '...' : errorMsg;
                        page.drawText(truncatedError, {
                            x: 50,
                            y: height - 190,
                            size: 9,
                            color: rgb(0.2, 0.2, 0.2),
                        });
                        
                        page.drawText('Please report this error if it affects many pages.', {
                            x: 50,
                            y: height - 220,
                            size: 10,
                            color: rgb(0.5, 0.5, 0.5),
                        });
                        
                        pagesInBatch++;
                        processedCount++;
                    }
                }
                
                if (pagesInBatch > 0) {
                    const batchPdfBytes = await batchPdfDoc.save();
                    allPdfBytes.push(batchPdfBytes);
                }
                
            } catch (batchError: any) {
                console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
            }
        }
        
        if (allPdfBytes.length === 0) {
            throw new Error('No pages were processed into PDF');
        }
        
        if (allPdfBytes.length === 1) {
            await fs.writeFile(outputPath, allPdfBytes[0]);
        } else {
            const finalPdfDoc = await PDFDocument.create();
            
            for (const pdfBytes of allPdfBytes) {
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pageIndices = pdfDoc.getPageIndices();
                const pages = await finalPdfDoc.copyPages(pdfDoc, pageIndices);
                pages.forEach((page) => finalPdfDoc.addPage(page));
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
                const rawUrl = resource['@id'] || resource.id;
                // Convert bare IIIF identifier to proper IIIF image URL for Cambridge CUDL
                if (rawUrl && rawUrl.includes('images.lib.cam.ac.uk/iiif/')) {
                    return rawUrl + '/full/1000,/0/default.jpg';
                }
                return rawUrl;
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
            
            // Check for other institutions that might return HTML error pages
            if (manifestText.trim().startsWith('<')) {
                // Extract institution name from manifest URL for better error messages
                let institution = 'Unknown institution';
                if (manifestUrl.includes('digitalcollections.tcd.ie')) {
                    institution = 'Trinity College Dublin';
                } else if (manifestUrl.includes('isos.dias.ie')) {
                    institution = 'Irish Script on Screen (ISOS)';
                } else if (manifestUrl.includes('riaconservation.ie')) {
                    institution = 'Royal Irish Academy';
                }
                
                throw new Error(`Failed to access IIIF manifest from ${institution}. The manifest URL returned an HTML page instead of JSON data, indicating access restrictions or server issues. Manifest URL: ${manifestUrl}`);
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

    async loadOrleansManifest(orleansUrl: string, progressCallback?: (current: number, total: number, message?: string) => void): Promise<ManuscriptManifest> {
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
                } else if (orleansUrl.includes('OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE')) {
                    // Direct search for the Pseudo Isidore manuscript
                    searchQuery = 'Ouvrages de Pseudo Isidore';
                } else {
                    // Try to extract and search for other manuscripts
                    const titleMatch = orleansUrl.match(/clef\/([^/]+)/);
                    if (titleMatch) {
                        const encodedTitle = titleMatch[1];
                        // Handle common Orleans URL patterns
                        let decodedTitle = decodeURIComponent(encodedTitle.replace(/--/g, ' '));
                        
                        // Apply transformations for common patterns
                        decodedTitle = decodedTitle
                            .replace(/([A-Z]+)DE([A-Z]+)/g, '$1 de $2') // Add "de" between uppercase words
                            .replace(/([A-Z])([A-Z]+)/g, (_match, first, rest) => first + rest.toLowerCase()) // Convert to proper case
                            .replace(/\s+/g, ' ') // Normalize spaces
                            .trim();
                        
                        searchQuery = decodedTitle;
                    } else {
                        throw new Error('Could not extract manuscript title from URL for search');
                    }
                }
                
                // Try multiple search strategies for better results
                let searchResults: any[] = [];
                const searchStrategies = [
                    searchQuery, // Original full query
                    searchQuery.split(' ').slice(0, 2).join(' '), // First two words
                    searchQuery.split(' ')[0], // First word only
                    searchQuery.toLowerCase(), // Lowercase version
                    searchQuery.toLowerCase().split(' ').slice(0, 2).join(' '), // Lowercase first two words
                    searchQuery.toLowerCase().split(' ')[0], // Lowercase first word
                    // Extract partial terms for complex titles
                    ...searchQuery.toLowerCase().split(' ').filter(word => word.length > 4) // Words longer than 4 chars
                ];
                
                for (let i = 0; i < searchStrategies.length && searchResults.length === 0; i++) {
                    const currentQuery = searchStrategies[i];
                    console.log(`Searching Orleans API (attempt ${i + 1}/${searchStrategies.length}) for: "${currentQuery}"`);
                    const searchUrl = `${baseApiUrl}/items?search=${encodeURIComponent(currentQuery)}`;
                    
                    try {
                        // Use fetchDirect with extended Orleans timeout
                        const searchResponse = await this.fetchDirect(searchUrl);
                        
                        if (!searchResponse.ok) {
                            console.warn(`Orleans search attempt ${i + 1} failed: HTTP ${searchResponse.status}`);
                            continue;
                        }
                        
                        const results = await searchResponse.json();
                        if (Array.isArray(results) && results.length > 0) {
                            searchResults = results;
                            console.log(`Orleans search attempt ${i + 1} returned ${results.length} results`);
                            break;
                        }
                    } catch (error: any) {
                        console.warn(`Orleans search attempt ${i + 1} failed:`, error.message);
                        if (i === searchStrategies.length - 1) {
                            throw error; // Re-throw on final attempt
                        }
                    }
                }
                
                if (!Array.isArray(searchResults) || searchResults.length === 0) {
                    throw new Error(`Manuscript not found in Orleans search results using any search strategy. Tried: ${searchStrategies.join(', ')}`);
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
                    // Use fetchDirect with extended Orleans timeout instead of manual timeout
                    const itemResponse = await this.fetchDirect(itemUrl);
                    
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
            
            // Report initial progress
            progressCallback?.(0, mediaItems.length, `Loading manifest: 0/${mediaItems.length} pages`);
            
            // Process media items with batch processing and circuit breaker to prevent hanging
            let processedCount = 0;
            const batchSize = 4; // Smaller batches for Orleans to reduce API load
            const maxFailedBatches = 5; // Allow more failed batches before giving up
            const maxTotalFailures = Math.floor(mediaItems.length * 0.3); // Allow 30% failures max
            
            let failedBatchCount = 0;
            let totalFailures = 0;
            let lastProgressUpdate = Date.now();
            
            // For very large manuscripts (>200 pages), limit to first 200 pages to prevent hanging
            const maxPagesToProcess = Math.min(mediaItems.length, 200);
            if (mediaItems.length > 200) {
                console.log(`Orleans manuscript has ${mediaItems.length} pages, limiting to first ${maxPagesToProcess} pages for stability`);
                progressCallback?.(0, maxPagesToProcess, `Loading manifest (limited): 0/${maxPagesToProcess} pages`);
            }
            
            const itemsToProcess = mediaItems.slice(0, maxPagesToProcess);
            
            // Process items in batches with circuit breaker
            for (let batchStart = 0; batchStart < itemsToProcess.length; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize, itemsToProcess.length);
                const batch = itemsToProcess.slice(batchStart, batchEnd);
                
                console.log(`Orleans: processing batch ${Math.floor(batchStart / batchSize) + 1} (items ${batchStart + 1}-${batchEnd})`);
                
                // Process batch with Promise.allSettled for parallel processing
                const batchPromises = batch.map(async (mediaRef, batchIdx) => {
                    const idx = batchStart + batchIdx;
                    const mediaId = mediaRef['o:id'] || mediaRef.o_id || 
                                   (typeof mediaRef === 'object' && mediaRef['@id'] ? 
                                    mediaRef['@id'].split('/').pop() : mediaRef);
                    
                    if (!mediaId) {
                        throw new Error(`No media ID found for media item ${idx}`);
                    }
                    
                    const mediaUrl = `${baseApiUrl}/media/${mediaId}`;
                    
                    try {
                        const mediaResponse = await this.fetchDirect(mediaUrl);
                        
                        if (!mediaResponse.ok) {
                            throw new Error(`HTTP ${mediaResponse.status}`);
                        }
                        
                        const mediaData = await mediaResponse.json();
                        
                        // Orleans uses files/large/{hash}.jpg pattern - extract from thumbnail_display_urls or construct from filename
                        const thumbnails = mediaData.thumbnail_display_urls || mediaData['thumbnail_display_urls'];
                        
                        if (thumbnails && thumbnails.large) {
                            // Use the direct large thumbnail URL (preferred method)
                            return { idx, imageUrl: thumbnails.large, mediaId };
                        } else {
                            // Fallback: construct URL from o:filename hash
                            const filename = mediaData['o:filename'] || mediaData.o_filename;
                            if (filename && typeof filename === 'string') {
                                const imageUrl = `https://aurelia.orleans.fr/files/large/${filename}.jpg`;
                                return { idx, imageUrl, mediaId };
                            }
                        }
                        
                        throw new Error('No valid image URL found');
                        
                    } catch (fetchError: any) {
                        if (fetchError.name === 'AbortError') {
                            throw new Error(`Request timed out for media ${mediaId}`);
                        }
                        throw fetchError;
                    }
                });
                
                // Execute batch with timeout
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Process results and count failures
                let batchFailures = 0;
                
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        const { idx, imageUrl } = result.value;
                        pageLinks[idx] = imageUrl;
                        processedCount++;
                    } else {
                        batchFailures++;
                        totalFailures++;
                        console.warn(`Orleans batch processing error:`, result.reason?.message || result.reason);
                    }
                }
                
                // Circuit breaker logic
                if (batchFailures === batch.length) {
                    failedBatchCount++;
                    console.warn(`Orleans: entire batch failed (${failedBatchCount}/${maxFailedBatches} consecutive failures)`);
                    
                    if (failedBatchCount >= maxFailedBatches) {
                        throw new Error(`Orleans API appears to be blocked - ${maxFailedBatches} consecutive batch failures. Processed ${processedCount}/${itemsToProcess.length} pages.`);
                    }
                } else {
                    failedBatchCount = 0; // Reset consecutive failure count on any success
                }
                
                // Check total failure threshold
                if (totalFailures > maxTotalFailures) {
                    throw new Error(`Too many Orleans API failures (${totalFailures}/${itemsToProcess.length}). Server may be rate limiting. Processed ${processedCount} pages.`);
                }
                
                // Progress reporting and stall detection
                const now = Date.now();
                const shouldReport = processedCount % 10 === 0 || batchEnd >= itemsToProcess.length;
                
                if (shouldReport) {
                    const progressMessage = itemsToProcess.length < mediaItems.length 
                        ? `Loading manifest (limited): ${processedCount}/${itemsToProcess.length} pages`
                        : `Loading manifest: ${processedCount}/${itemsToProcess.length} pages`;
                    
                    console.log(`Orleans: processed ${processedCount}/${itemsToProcess.length} media items (${totalFailures} failures)`);
                    progressCallback?.(processedCount, itemsToProcess.length, progressMessage);
                    lastProgressUpdate = now;
                }
                
                // Check for stalled progress (no progress for >5 minutes)
                if (now - lastProgressUpdate > 300000) {
                    throw new Error(`Orleans manifest loading stalled - no progress for 5 minutes. Processed ${processedCount}/${itemsToProcess.length} pages.`);
                }
                
                // Add longer delay between batches to be respectful to the server
                if (batchEnd < itemsToProcess.length) {
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between batches
                }
            }
            
            // Report final progress
            const finalMessage = itemsToProcess.length < mediaItems.length 
                ? `Manifest loaded (limited): ${processedCount} pages` 
                : `Manifest loaded: ${processedCount} pages`;
            progressCallback?.(processedCount, itemsToProcess.length, finalMessage);
            
            // Preserve page order by keeping original positions, only filter out sparse array gaps
            const validPageLinks: string[] = [];
            let validPageCount = 0;
            
            // Process pageLinks array in order, maintaining sequence
            for (let i = 0; i < pageLinks.length; i++) {
                const pageUrl = pageLinks[i];
                if (pageUrl && typeof pageUrl === 'string') {
                    validPageLinks.push(pageUrl);
                    validPageCount++;
                } else if (pageLinks[i] === undefined && i < itemsToProcess.length) {
                    // For failed pages within the expected range, log warning but don't break sequence
                    console.warn(`Orleans: Page ${i + 1} failed to load, skipping in sequence`);
                }
            }
            
            console.log(`Successfully processed ${validPageCount} page links for Orleans manuscript (maintained original order)`);
            
            if (validPageLinks.length === 0) {
                throw new Error('No valid image URLs found in Orléans manuscript');
            }
            
            // Ensure we have a reasonable number of pages (more lenient threshold)
            const minExpectedPages = Math.min(3, itemsToProcess.length * 0.05); // Only require 5% minimum
            if (validPageLinks.length < minExpectedPages) {
                console.warn(`Only ${validPageLinks.length}/${itemsToProcess.length} Orleans media items processed successfully`);
                
                // If we have very few pages, it might be worth throwing an error
                if (validPageLinks.length < 2) {
                    throw new Error(`Insufficient Orleans pages loaded: only ${validPageLinks.length} pages out of ${itemsToProcess.length} total`);
                }
            }
            
            // Log summary of processing
            if (itemsToProcess.length < mediaItems.length) {
                console.log(`Orleans: Successfully processed ${validPageLinks.length} pages (limited from ${mediaItems.length} total pages for stability)`);
            } else {
                console.log(`Orleans: Successfully processed ${validPageLinks.length}/${mediaItems.length} pages`);
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

    async loadRbmeManifest(rbmeUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading RBME manuscript: ${rbmeUrl}`);
            
            // Extract the item ID from the URL
            // Pattern: https://rbme.patrimonionacional.es/s/rbme/item/14374
            const idMatch = rbmeUrl.match(/\/item\/(\d+)/);
            if (!idMatch) {
                throw new Error('Invalid RBME URL format - could not extract item ID');
            }
            
            const itemId = idMatch[1];
            console.log(`Extracted RBME item ID: ${itemId}`);
            
            // Fetch the RBME page to extract the manifest URL with timeout
            console.log('Fetching RBME page content...');
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(() => {
                pageController.abort();
                console.error(`RBME page request timed out after 30 seconds for item: ${itemId}`);
            }, 30000); // 30 second timeout
            
            let pageContent: string;
            try {
                const pageResponse = await this.fetchDirect(rbmeUrl, {
                    signal: pageController.signal,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Cache-Control': 'no-cache'
                    }
                });
                clearTimeout(pageTimeoutId);
                
                if (!pageResponse.ok) {
                    throw new Error(`Failed to fetch RBME page: HTTP ${pageResponse.status} ${pageResponse.statusText}`);
                }
                
                pageContent = await pageResponse.text();
                console.log(`RBME page content loaded, length: ${pageContent.length}`);
                
            } catch (pageError: any) {
                clearTimeout(pageTimeoutId);
                if (pageError.name === 'AbortError') {
                    throw new Error('RBME page request timed out. The server may be experiencing high load.');
                }
                throw pageError;
            }
            
            // Extract manifest URL from the page content
            // Look for manifest URL in Universal Viewer configuration or meta tags
            const manifestMatch = pageContent.match(/(?:manifest["']?\s*:\s*["']|"manifest"\s*:\s*["'])(https:\/\/rbdigital\.realbiblioteca\.es\/files\/manifests\/[^"']+)/);
            if (!manifestMatch) {
                console.error('Failed to find manifest URL in page content');
                console.log('Page content preview:', pageContent.substring(0, 500));
                throw new Error('Could not find IIIF manifest URL in RBME page');
            }
            
            const manifestUrl = manifestMatch[1];
            console.log(`Found RBME manifest URL: ${manifestUrl}`);
            
            // Fetch the IIIF manifest with timeout
            const manifestController = new AbortController();
            const manifestTimeoutId = setTimeout(() => {
                manifestController.abort();
                console.error(`RBME manifest request timed out after 30 seconds: ${manifestUrl}`);
            }, 30000); // 30 second timeout
            
            let iiifManifest: any;
            try {
                const manifestResponse = await this.fetchDirect(manifestUrl, {
                    signal: manifestController.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                clearTimeout(manifestTimeoutId);
                
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch RBME manifest: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
                }
                
                iiifManifest = await manifestResponse.json();
                console.log(`RBME manifest loaded successfully for item: ${itemId}`);
                
            } catch (manifestError: any) {
                clearTimeout(manifestTimeoutId);
                if (manifestError.name === 'AbortError') {
                    throw new Error('RBME manifest request timed out. The server may be experiencing high load.');
                }
                throw manifestError;
            }
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                const serviceUrl = resource.service?.['@id'] || resource.service?.id;
                
                if (serviceUrl) {
                    // Use IIIF Image API to get full resolution images
                    return `${serviceUrl}/full/max/0/default.jpg`;
                } else {
                    // Fallback to direct image URL
                    return resource['@id'] || resource.id;
                }
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No images found in RBME manifest');
            }
            
            // Extract title and metadata
            const label = iiifManifest.label || 'RBME Manuscript';
            const displayName = typeof label === 'string' ? label : (label?.['@value'] || label?.value || 'RBME Manuscript');
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 100);
            
            return {
                displayName: sanitizedName,
                totalPages: pageLinks.length,
                pageLinks,
                library: 'rbme' as any,
                originalUrl: rbmeUrl
            };
            
        } catch (error: any) {
            console.error(`RBME manifest loading failed:`, error);
            throw new Error(`Failed to load RBME manuscript: ${error.message}`);
        }
    }

    async loadParkerManifest(parkerUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract the manuscript ID from the URL
            // Pattern: https://parker.stanford.edu/parker/catalog/zs345bj2650
            const idMatch = parkerUrl.match(/\/catalog\/([^/]+)(?:\/|$)/);
            if (!idMatch) {
                throw new Error('Invalid Stanford Parker URL format - could not extract manuscript ID');
            }
            
            const manuscriptId = idMatch[1];
            // Stanford Parker IIIF manifest URL pattern
            const manifestUrl = `https://dms-data.stanford.edu/data/manifests/Parker/${manuscriptId}/manifest.json`;
            
            // Fetch the IIIF manifest
            const manifestResponse = await this.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch Stanford Parker manifest: HTTP ${manifestResponse.status}`);
            }
            
            const iiifManifest = await manifestResponse.json();
            
            // Handle both IIIF v2 and v3 formats
            let canvases;
            if (iiifManifest.sequences && iiifManifest.sequences[0]) {
                // IIIF v2 format
                canvases = iiifManifest.sequences[0].canvases;
            } else if (iiifManifest.items) {
                // IIIF v3 format
                canvases = iiifManifest.items;
            } else {
                throw new Error('Invalid IIIF manifest structure - no sequences or items found');
            }
            
            if (!canvases || canvases.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            const pageLinks = canvases.map((canvas: any) => {
                let imageUrl;
                
                if (canvas.images && canvas.images[0]) {
                    // IIIF v2 format - Stanford Parker provides direct image URLs
                    const resource = canvas.images[0].resource;
                    // Use the direct image URL provided by Stanford Parker
                    imageUrl = resource['@id'] || resource.id;
                } else if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                    // IIIF v3 format
                    const annotation = canvas.items[0].items[0];
                    const body = annotation.body;
                    imageUrl = body.id;
                }
                
                return imageUrl;
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No images found in Stanford Parker manifest');
            }
            
            // Extract title and metadata
            const label = iiifManifest.label || iiifManifest.title || 'Stanford Parker Manuscript';
            let displayName;
            
            if (typeof label === 'string') {
                displayName = label;
            } else if (label?.['@value']) {
                displayName = label['@value'];
            } else if (label?.value) {
                displayName = label.value;
            } else if (label?.en && Array.isArray(label.en)) {
                displayName = label.en[0];
            } else if (label?.en) {
                displayName = label.en;
            } else {
                displayName = `Stanford_Parker_${manuscriptId}`;
            }
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 150);
            
            return {
                displayName: sanitizedName,
                totalPages: pageLinks.length,
                pageLinks,
                library: 'parker' as any,
                originalUrl: parkerUrl
            };
            
        } catch (error: any) {
            console.error(`Stanford Parker manifest loading failed:`, error);
            throw new Error(`Failed to load Stanford Parker manuscript: ${error.message}`);
        }
    }

    /**
     * Load Manuscripta.se manifest (using IIIF manifest API)
     */
    async loadManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Manuscripta.se manuscript: ${manuscriptaUrl}`);
            
            // Extract manuscript ID from URL: https://manuscripta.se/ms/101124 -> 101124
            const idMatch = manuscriptaUrl.match(/\/ms\/(\d+)/);
            if (!idMatch) {
                throw new Error('Invalid Manuscripta.se URL format. Expected format: https://manuscripta.se/ms/{id}');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://manuscripta.se/iiif/${manuscriptId}/manifest.json`;
            
            console.log(`Loading Manuscripta.se manifest from: ${manifestUrl}`);
            
            // Add timeout and enhanced error handling for Manuscripta.se
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.error(`Manuscripta.se manifest request timed out after 30 seconds for ID: ${manuscriptId}`);
            }, 30000); // 30 second timeout
            
            let iiifManifest: any;
            try {
                const manifestResponse = await this.fetchWithProxyFallback(manifestUrl, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Cache-Control': 'no-cache'
                    }
                });
                clearTimeout(timeoutId);
                
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch Manuscripta.se manifest: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
                }
                
                iiifManifest = await manifestResponse.json();
                
                // Validate manifest structure
                if (!iiifManifest) {
                    throw new Error('Empty manifest received from Manuscripta.se');
                }
                
                console.log(`Manuscripta.se manifest loaded successfully for ID: ${manuscriptId}`);
                
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('Manuscripta.se manifest request timed out. The server may be experiencing high load.');
                }
                throw fetchError;
            }
            
            // Extract title from manifest
            let displayName = 'Manuscripta_' + manuscriptId;
            if (iiifManifest.label) {
                if (typeof iiifManifest.label === 'string') {
                    displayName = iiifManifest.label;
                } else if (Array.isArray(iiifManifest.label)) {
                    displayName = iiifManifest.label[0];
                } else if (typeof iiifManifest.label === 'object') {
                    // IIIF 3.0 format with language maps
                    const labelValues = Object.values(iiifManifest.label);
                    if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
                        displayName = (labelValues[0] as string[])[0];
                    }
                }
            }
            
            // Parse IIIF manifest structure - support both IIIF 2.x and 3.x
            let canvases: any[] = [];
            
            if (iiifManifest.sequences && iiifManifest.sequences[0] && iiifManifest.sequences[0].canvases) {
                // IIIF 2.x structure
                canvases = iiifManifest.sequences[0].canvases;
            } else if (iiifManifest.items) {
                // IIIF 3.x structure
                canvases = iiifManifest.items;
            } else {
                throw new Error('Invalid IIIF manifest structure - no canvases found');
            }
            
            const pageLinks = canvases.map((canvas: any) => {
                let imageUrl: string | null = null;
                
                // IIIF 2.x format
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    imageUrl = resource['@id'] || resource.id;
                }
                // IIIF 3.x format
                else if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                    const annotation = canvas.items[0].items[0];
                    if (annotation.body && annotation.body.id) {
                        imageUrl = annotation.body.id;
                    }
                }
                
                if (!imageUrl) {
                    return null;
                }
                
                // Convert to full resolution IIIF image URL if needed
                if (imageUrl.includes('/iiif/') && !imageUrl.includes('/full/')) {
                    // Ensure proper IIIF Image API format: {scheme}://{server}{/prefix}/{identifier}/full/max/0/default.jpg
                    const iiifBase = imageUrl.split('/info.json')[0];
                    return `${iiifBase}/full/max/0/default.jpg`;
                }
                
                return imageUrl;
            }).filter((link: string | null): link is string => link !== null);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            console.log(`Successfully loaded Manuscripta.se manifest: ${pageLinks.length} pages found`);
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                .replace(/\.+$/, '')
                .substring(0, 150) || `Manuscripta_${manuscriptId}`;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'manuscripta' as any,
                displayName: sanitizedName,
                originalUrl: manuscriptaUrl,
            };
            
        } catch (error: any) {
            console.error(`Manuscripta.se manifest loading failed:`, error);
            throw new Error(`Failed to load Manuscripta.se manuscript: ${error.message}`);
        }
    }

    async loadInternetCulturaleManifest(internetCulturaleUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract OAI identifier from URL
            const oaiMatch = internetCulturaleUrl.match(/id=([^&]+)/);
            if (!oaiMatch) {
                throw new Error('Invalid Internet Culturale URL: missing OAI identifier');
            }
            
            const oaiId = decodeURIComponent(oaiMatch[1]);
            console.log(`Loading Internet Culturale manuscript with OAI ID: ${oaiId}`);
            
            // Extract teca parameter for institution info
            const tecaMatch = internetCulturaleUrl.match(/teca=([^&]+)/);
            const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
            
            // Construct API URL for manifest data with all required parameters
            const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
            
            // Set headers similar to browser request
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/xml, application/xml, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Referer': internetCulturaleUrl,
                'X-Requested-With': 'XMLHttpRequest',
            };
            
            console.log(`Fetching Internet Culturale API: ${apiUrl}`);
            
            // Fetch manifest data from API
            const response = await this.fetchDirect(apiUrl, { headers });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const xmlText = await response.text();
            
            if (!xmlText || xmlText.trim().length === 0) {
                throw new Error('Empty response from API');
            }
            
            // Parse XML response
            console.log('Parsing Internet Culturale XML manifest...');
            
            // Extract title from bibinfo section
            let displayName = 'Internet Culturale Manuscript';
            const titleMatch = xmlText.match(/<info key="Titolo">\s*<value>(.*?)<\/value>/);
            if (titleMatch) {
                displayName = titleMatch[1].trim();
            } else {
                // Fallback: extract from OAI ID
                const parts = oaiId.split(':');
                if (parts.length > 0) {
                    displayName = parts[parts.length - 1].replace(/%/g, ' ').trim();
                }
            }
            
            // Extract page URLs from XML
            const pageLinks: string[] = [];
            const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
            let match;
            
            while ((match = pageRegex.exec(xmlText)) !== null) {
                let relativePath = match[1];
                
                // Fix Florence URL issue: use 'web' instead of 'normal' for working images
                if (relativePath.includes('cacheman/normal/')) {
                    relativePath = relativePath.replace('cacheman/normal/', 'cacheman/web/');
                }
                
                // Convert relative path to absolute URL
                const imageUrl = `https://www.internetculturale.it/jmms/${relativePath}`;
                pageLinks.push(imageUrl);
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No image URLs found in XML manifest');
            }
            
            // Add institution info to display name
            if (teca && teca !== 'Unknown') {
                displayName = `${displayName} (${teca})`;
            }
            
            // Sanitize display name for Windows file system
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\.$/, ''); // Remove trailing period
            
            console.log(`Internet Culturale manifest loaded: ${pageLinks.length} pages`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'internet_culturale' as any,
                displayName: sanitizedName,
                originalUrl: internetCulturaleUrl,
            };
            
        } catch (error: any) {
            console.error(`Internet Culturale manifest loading failed:`, error);
            throw new Error(`Failed to load Internet Culturale manuscript: ${error.message}`);
        }
    }

    async loadGrazManifest(grazUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading University of Graz manifest: ${grazUrl}`);
            
            // Extract manuscript ID from URL
            // URL patterns: 
            // - https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
            // - https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540
            const manuscriptIdMatch = grazUrl.match(/\/(\d+)$/);
            if (!manuscriptIdMatch) {
                throw new Error('Could not extract manuscript ID from Graz URL');
            }
            
            let manuscriptId = manuscriptIdMatch[1];
            
            // If this is a pageview URL, convert to titleinfo ID using known pattern
            // Pattern: pageview ID - 2 = titleinfo ID (e.g., 8224540 -> 8224538)
            if (grazUrl.includes('/pageview/')) {
                const pageviewId = parseInt(manuscriptId);
                const titleinfoId = (pageviewId - 2).toString();
                console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
                manuscriptId = titleinfoId;
            }
            
            // Construct IIIF manifest URL
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
            console.log(`Fetching IIIF manifest from: ${manifestUrl}`);
            
            // Fetch the IIIF manifest
            const headers = {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };
            
            const response = await this.fetchWithProxyFallback(manifestUrl, { headers });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch IIIF manifest: ${response.status} ${response.statusText}`);
            }
            
            const manifest = await response.json();
            console.log(`IIIF manifest loaded, processing canvases...`);
            
            const pageLinks: string[] = [];
            let displayName = 'University of Graz Manuscript';
            
            // Extract title from manifest metadata
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (manifest.label['@value']) {
                    displayName = manifest.label['@value'];
                } else if (manifest.label.en) {
                    displayName = Array.isArray(manifest.label.en) ? manifest.label.en[0] : manifest.label.en;
                } else if (manifest.label.de) {
                    displayName = Array.isArray(manifest.label.de) ? manifest.label.de[0] : manifest.label.de;
                }
            }
            
            // Process IIIF sequences and canvases
            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases) {
                    for (const canvas of sequence.canvases) {
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            let imageUrl = '';
                            
                            // Use webcache URLs for highest resolution
                            if (image.resource && image.resource['@id']) {
                                const resourceId = image.resource['@id'];
                                
                                // Convert webcache URLs to highest available resolution
                                // Pattern: https://unipub.uni-graz.at/download/webcache/SIZE/PAGE_ID
                                if (resourceId.includes('/download/webcache/')) {
                                    // Extract page ID from the URL
                                    const pageIdMatch = resourceId.match(/\/webcache\/\d+\/(\d+)$/);
                                    if (pageIdMatch) {
                                        const pageId = pageIdMatch[1];
                                        // Use highest available resolution (2000px)
                                        imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
                                    } else {
                                        console.warn(`University of Graz: Unexpected webcache URL format: ${resourceId}`);
                                        // Fallback to original URL if pattern doesn't match
                                        imageUrl = resourceId;
                                    }
                                } else {
                                    // Not a webcache URL, use as-is
                                    imageUrl = resourceId;
                                }
                            } else if (image.resource && image.resource.service && image.resource.service['@id']) {
                                // Legacy fallback to IIIF service URL (shouldn't be needed for Graz)
                                const serviceId = image.resource.service['@id'];
                                imageUrl = `${serviceId}/full/full/0/default.jpg`;
                                console.warn(`University of Graz: Using legacy IIIF service URL: ${imageUrl}`);
                            }
                            
                            if (imageUrl) {
                                pageLinks.push(imageUrl);
                            }
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No page images found in IIIF manifest');
            }
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\.$/, ''); // Remove trailing period
            
            console.log(`University of Graz manifest loaded: ${pageLinks.length} pages`);
            if (pageLinks.length > 0) {
                console.log(`First page URL: ${pageLinks[0]}`);
                console.log(`Last page URL: ${pageLinks[pageLinks.length - 1]}`);
            }
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'graz' as any,
                displayName: sanitizedName,
                originalUrl: grazUrl,
            };
            
        } catch (error: any) {
            console.error(`University of Graz manifest loading failed:`, error);
            throw new Error(`Failed to load University of Graz manuscript: ${error.message}`);
        }
    }

    async loadCologneManifest(cologneUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Cologne Dom Library manifest: ${cologneUrl}`);
            
            // Determine collection and ID from URL
            // URL patterns:
            // - https://digital.dombibliothek-koeln.de/hs/content/zoom/156145
            // - https://digital.dombibliothek-koeln.de/schnuetgen/Handschriften/content/pageview/652610
            // - https://digital.dombibliothek-koeln.de/ddbkhd/Handschriften/content/pageview/94078
            
            let collection = 'hs'; // default collection
            let pageId = '';
            let displayName = 'Cologne Dom Library Manuscript';
            
            // Extract collection and page ID
            const hsMatch = cologneUrl.match(/\/hs\/content\/zoom\/(\d+)/);
            const schnuetgenMatch = cologneUrl.match(/\/schnuetgen\/[^/]+\/content\/pageview\/(\d+)/);
            const ddbkhdMatch = cologneUrl.match(/\/ddbkhd\/[^/]+\/content\/pageview\/(\d+)/);
            
            if (hsMatch) {
                collection = 'hs';
                pageId = hsMatch[1];
                displayName = 'Cologne Dom Library Manuscript';
            } else if (schnuetgenMatch) {
                collection = 'schnuetgen';
                pageId = schnuetgenMatch[1];
                displayName = 'Cologne Schnütgen Museum Manuscript';
            } else if (ddbkhdMatch) {
                collection = 'ddbkhd';
                pageId = ddbkhdMatch[1];
                displayName = 'Cologne DDBKHD Manuscript';
            } else {
                throw new Error('Could not extract collection and page ID from Cologne URL');
            }
            
            console.log(`Detected collection: ${collection}, page ID: ${pageId}`);
            
            // Fetch the viewer page to extract all page IDs
            const headers = {
                'Cookie': 'js_enabled=1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            };
            
            const response = await this.fetchDirect(cologneUrl, { headers });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Cologne page: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            console.log(`Cologne page fetched, extracting page list...`);
            
            // Extract page IDs - try different methods based on page structure
            const pageIds: string[] = [];
            
            // Method 1: Try pageList div (for HS collection with zoom viewer)
            const pageListMatch = html.match(/<div id="pageList"[^>]*>.*?<\/div>/s);
            if (pageListMatch) {
                const pageListHtml = pageListMatch[0];
                const pageIdRegex = /data-id="(\d+)"/g;
                let match;
                while ((match = pageIdRegex.exec(pageListHtml)) !== null) {
                    pageIds.push(match[1]);
                }
                console.log(`Found ${pageIds.length} pages using pageList method`);
            }
            
            // Method 2: Try select dropdown options (for Schnütgen and DDBKHD collections)
            if (pageIds.length === 0) {
                const selectMatch = html.match(/<select[^>]*id="goToPage"[^>]*>.*?<\/select>/s);
                if (selectMatch) {
                    const selectHtml = selectMatch[0];
                    const optionRegex = /option value="(\d+)"/g;
                    let match;
                    while ((match = optionRegex.exec(selectHtml)) !== null) {
                        pageIds.push(match[1]);
                    }
                    console.log(`Found ${pageIds.length} pages using select dropdown method`);
                }
            }
            
            if (pageIds.length === 0) {
                throw new Error('No page IDs found in Cologne page using any method');
            }
            
            console.log(`Found ${pageIds.length} pages`);
            
            // Extract manuscript title from page metadata if available
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
            if (titleMatch) {
                const title = titleMatch[1]
                    .replace(/Handschriften der Diözesan- und Dombibliothek \/ /, '')
                    .replace(/ \[.*$/, '') // Remove trailing bracket content
                    .trim();
                
                if (title && title !== 'Handschriften der Diözesan- und Dombibliothek') {
                    displayName = title;
                }
            }
            
            // Build image URLs for highest resolution (2000px)
            const pageLinks: string[] = [];
            const baseUrl = 'https://digital.dombibliothek-koeln.de';
            
            for (const id of pageIds) {
                const imageUrl = `${baseUrl}/${collection}/download/webcache/2000/${id}`;
                pageLinks.push(imageUrl);
            }
            
            // Sanitize display name for filesystem
            const sanitizedName = displayName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\.$/, ''); // Remove trailing period
            
            console.log(`Cologne Dom Library manifest loaded: ${pageLinks.length} pages`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'cologne' as any,
                displayName: sanitizedName,
                originalUrl: cologneUrl,
            };
            
        } catch (error: any) {
            console.error(`Cologne Dom Library manifest loading failed:`, error);
            throw new Error(`Failed to load Cologne Dom Library manuscript: ${error.message}`);
        }
    }

    async loadViennaManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Vienna Manuscripta manifest for:', manuscriptaUrl);
        
        try {
            // Extract manuscript ID from URL
            // Expected format: https://manuscripta.at/diglit/AT5000-XXXX/0001
            const urlMatch = manuscriptaUrl.match(/\/diglit\/(AT\d+-\d+)/);
            if (!urlMatch) {
                throw new Error('Invalid Vienna Manuscripta URL format');
            }
            
            const manuscriptId = urlMatch[1];
            console.log('Manuscript ID:', manuscriptId);
            
            // Extract base URL
            const baseUrl = `https://manuscripta.at/diglit/${manuscriptId}`;
            
            const pageLinks: string[] = [];
            let pageNum = 1;
            
            // Iterate through pages to find all images
            while (true) {
                const pageUrl = `${baseUrl}/${pageNum.toString().padStart(4, '0')}`;
                console.log(`Checking page ${pageNum}: ${pageUrl}`);
                
                try {
                    const response = await this.fetchDirect(pageUrl);
                    if (!response.ok) {
                        console.log(`Page ${pageNum} returned HTTP ${response.status}, assuming end of manuscript`);
                        break;
                    }
                    
                    const html = await response.text();
                    
                    // Extract img_max_url directly from the HTML (simpler and more reliable)
                    const imgMaxMatch = html.match(/"img_max_url":"([^"]+)"/);
                    if (!imgMaxMatch) {
                        console.log(`Page ${pageNum}: No img_max_url found, assuming end of manuscript`);
                        break;
                    }
                    
                    // Check if pageInfo is empty (indicates end of manuscript)
                    const pageInfoEmptyMatch = html.match(/const pageInfo = {};/);
                    if (pageInfoEmptyMatch) {
                        console.log(`Page ${pageNum}: Empty pageInfo, end of manuscript reached`);
                        break;
                    }
                    
                    const imageUrl = imgMaxMatch[1];
                    pageLinks.push(imageUrl);
                    console.log(`Page ${pageNum}: Found image ${imageUrl}`);
                    
                    pageNum++;
                    
                    // Safety check to prevent infinite loops
                    if (pageNum > 1000) {
                        console.warn('Reached maximum page limit (1000), stopping');
                        break;
                    }
                    
                } catch (error: any) {
                    console.log(`Error fetching page ${pageNum}: ${error.message}`);
                    break;
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in Vienna Manuscripta manuscript');
            }
            
            // Extract manuscript name from first page for display name
            const displayName = `Vienna_${manuscriptId}`;
            
            const manifest: ManuscriptManifest = {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'vienna_manuscripta' as const,
                displayName,
                originalUrl: manuscriptaUrl,
            };
            
            console.log(`Vienna Manuscripta manifest loaded: ${displayName}, total pages: ${pageLinks.length}`);
            return manifest;
            
        } catch (error: any) {
            console.error('Vienna Manuscripta manifest loading failed:', error);
            throw new Error(`Failed to load Vienna Manuscripta manuscript: ${error.message}`);
        }
    }

    async loadRomeManifest(romeUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Rome National Library manifest for:', romeUrl);
        
        try {
            // Extract manuscript ID from URL
            // Expected format: http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1
            const urlMatch = romeUrl.match(/\/manoscrittoantico\/([^/]+)\/([^/]+)\/(\d+)/);
            if (!urlMatch) {
                throw new Error('Invalid Rome National Library URL format');
            }
            
            const [, manuscriptId1, manuscriptId2] = urlMatch;
            
            // Verify that both parts of the manuscript ID are the same
            if (manuscriptId1 !== manuscriptId2) {
                throw new Error('Inconsistent manuscript ID in Rome URL');
            }
            
            const manuscriptId = manuscriptId1;
            
            // Fetch the first page to get metadata and examine image URLs
            const pageResponse = await this.fetchDirect(romeUrl);
            if (!pageResponse.ok) {
                throw new Error(`Failed to load Rome page: HTTP ${pageResponse.status}`);
            }
            
            const html = await pageResponse.text();
            
            // Extract title from the breadcrumbs or page content
            let title = manuscriptId; // fallback
            const titleMatch = html.match(/<title>([^<]+)<\/title>/) || 
                              html.match(/Dettaglio manoscritto[^>]*>[^:]*:\s*([^<]+)</) ||
                              html.match(/data-caption="([^"]+)"/);
            if (titleMatch) {
                title = titleMatch[1].trim().replace(/\s*-\s*Biblioteca.*/, '');
            }
            
            // Extract total page count from "Totale immagini: 175"
            const pageCountMatch = html.match(/Totale immagini:\s*(\d+)/);
            if (!pageCountMatch) {
                throw new Error('Could not extract page count from Rome manuscript page');
            }
            
            const totalPages = parseInt(pageCountMatch[1], 10);
            
            // Look for actual image URLs in the page HTML to understand the correct format
            // BNCR may use different resolution endpoints - check for existing img tags
            const imageMatch = html.match(/src="([^"]*\/img\/manoscrittoantico\/[^"]*)"/) ||
                              html.match(/href="([^"]*\/img\/manoscrittoantico\/[^"]*)"/) ||
                              html.match(/"([^"]*\/img\/manoscrittoantico\/[^"]*\/(?:full|max|high|large)[^"]*)"/);
            
            let imageUrlTemplate = '';
            if (imageMatch) {
                const sampleImageUrl = imageMatch[1];
                console.log(`Found sample image URL in page: ${sampleImageUrl}`);
                
                // Extract the pattern and determine if we need different resolution parameters
                if (sampleImageUrl.includes('/full/')) {
                    imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/${manuscriptId}/${manuscriptId}/PAGENUM/full`;
                } else if (sampleImageUrl.includes('/max/')) {
                    imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/${manuscriptId}/${manuscriptId}/PAGENUM/max`;
                } else if (sampleImageUrl.includes('/high/')) {
                    imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/${manuscriptId}/${manuscriptId}/PAGENUM/high`;
                } else {
                    // If no resolution parameter found, try to extract the pattern and add full resolution
                    const basePattern = sampleImageUrl.replace(/\/\d+\/[^/]*$/, '');
                    imageUrlTemplate = `${basePattern}/PAGENUM/full`;
                }
            } else {
                // Fallback to original format, but also try 'max' which is commonly used for full resolution
                imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/${manuscriptId}/${manuscriptId}/PAGENUM/max`;
                console.log('No sample image URL found in page HTML, using max resolution template');
            }
            
            // Generate page links using the determined template
            const pageLinks: string[] = [];
            for (let i = 1; i <= totalPages; i++) {
                pageLinks.push(imageUrlTemplate.replace('PAGENUM', i.toString()));
            }
            
            console.log(`Rome National Library: Found ${totalPages} pages for "${title}"`);
            console.log(`Using image URL template: ${imageUrlTemplate.replace('PAGENUM', '1')} (first page example)`);
            
            return {
                pageLinks,
                totalPages: totalPages,
                library: 'rome',
                displayName: title,
                originalUrl: romeUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Rome National Library manifest:', error);
            throw new Error(`Failed to load Rome National Library manuscript: ${error.message}`);
        }
    }

    /**
     * Load Berlin State Library manifest
     */
    async loadBerlinManifest(berlinUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Berlin State Library manifest for:', berlinUrl);
        
        try {
            // Extract PPN from URL
            // Expected formats:
            // https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001
            // https://digital.staatsbibliothek-berlin.de/werkansicht/?PPN=PPN782404677
            const ppnMatch = berlinUrl.match(/[?&]PPN=(PPN\d+)/);
            if (!ppnMatch) {
                throw new Error('Could not extract PPN from Berlin State Library URL');
            }
            
            const fullPpn = ppnMatch[1]; // e.g., "PPN782404456"
            const ppnNumber = fullPpn.replace('PPN', ''); // e.g., "782404456"
            
            // Fetch IIIF manifest
            const manifestUrl = `https://content.staatsbibliothek-berlin.de/dc/${fullPpn}/manifest`;
            console.log('Fetching Berlin manifest from:', manifestUrl);
            
            const manifestResponse = await this.fetchDirect(manifestUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!manifestResponse.ok) {
                throw new Error(`Failed to load Berlin IIIF manifest: HTTP ${manifestResponse.status}`);
            }
            
            const manifestData = await manifestResponse.json();
            
            // Extract metadata
            const title = manifestData.label || `Berlin Manuscript ${ppnNumber}`;
            
            // Get sequences and canvases
            if (!manifestData.sequences || manifestData.sequences.length === 0) {
                throw new Error('No sequences found in Berlin IIIF manifest');
            }
            
            const sequence = manifestData.sequences[0];
            const canvases = sequence.canvases || [];
            
            if (canvases.length === 0) {
                throw new Error('No canvases found in Berlin IIIF manifest');
            }
            
            // Generate page links from canvases
            const pageLinks: string[] = [];
            for (const canvas of canvases) {
                if (canvas.images && canvas.images.length > 0) {
                    const image = canvas.images[0];
                    if (image.resource && image.resource['@id']) {
                        // Use the direct image URL from the manifest
                        pageLinks.push(image.resource['@id']);
                    } else {
                        // Fallback: construct URL from canvas ID
                        // Canvas ID format: https://content.staatsbibliothek-berlin.de/dc/782404456-0001/canvas
                        const canvasMatch = canvas['@id'].match(/\/dc\/(\d+-\d+)\/canvas$/);
                        if (canvasMatch) {
                            const imageId = canvasMatch[1];
                            pageLinks.push(`https://content.staatsbibliothek-berlin.de/dc/${imageId}/full/full/0/default.jpg`);
                        }
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No valid image URLs found in Berlin IIIF manifest');
            }
            
            console.log(`Berlin State Library: Found ${pageLinks.length} pages for "${title}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'berlin',
                displayName: title,
                originalUrl: berlinUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Berlin State Library manifest:', error);
            throw new Error(`Failed to load Berlin State Library manuscript: ${error.message}`);
        }
    }

    /**
     * Load Czech Digital Library (VKOL) manifest
     */
    async loadCzechManifest(czechUrl: string): Promise<ManuscriptManifest> {
        console.log('Loading Czech Digital Library manifest for:', czechUrl);
        
        try {
            // Parse the URL to extract manuscript ID and base path
            // URL format: https://dig.vkol.cz/dig/mii87/0001rx.htm
            const urlMatch = czechUrl.match(/dig\.vkol\.cz\/dig\/([^/]+)\/(\d{4})[rv]x\.htm/);
            if (!urlMatch) {
                throw new Error('Could not parse Czech Digital Library URL format');
            }

            const [, manuscriptId] = urlMatch;
            
            console.log(`Czech library: manuscript ID ${manuscriptId}`);

            // Fetch the main page to get manuscript metadata
            const response = await this.fetchWithProxyFallback(czechUrl);
            if (!response.ok) {
                throw new Error(`Failed to load Czech library page: HTTP ${response.status}`);
            }

            const htmlContent = await response.text();
            
            // Extract title/name from HTML - look for the manuscript title
            let title = `Czech Manuscript ${manuscriptId}`;
            const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                title = titleMatch[1].trim().replace(/\s+/g, ' ');
            }

            // Try to extract total page count from HTML content
            // Look for patterns like "185 ff." (folios) or similar folio count indicators
            let maxFolio = 185; // Default based on the example analysis
            
            const folioMatch = htmlContent.match(/(\d+)\s*ff?\.|Obsah.*?(\d+)\s*ff?\./i);
            if (folioMatch) {
                const detectedFolios = parseInt(folioMatch[1] || folioMatch[2]);
                if (detectedFolios > 0 && detectedFolios < 1000) { // Sanity check
                    maxFolio = detectedFolios;
                    console.log(`Czech library: detected ${maxFolio} folios from HTML content`);
                }
            }

            const pageLinks: string[] = [];

            // Generate page URLs for recto and verso pages
            // Pattern: 0001r, 0001v, 0002r, 0002v, etc.
            for (let folioNum = 1; folioNum <= maxFolio; folioNum++) {
                const paddedNum = folioNum.toString().padStart(4, '0');
                
                // Add recto page (r)
                const rectoImageUrl = `https://dig.vkol.cz/dig/${manuscriptId}/inet/${paddedNum}r.jpg`;
                pageLinks.push(rectoImageUrl);
                
                // Add verso page (v)
                const versoImageUrl = `https://dig.vkol.cz/dig/${manuscriptId}/inet/${paddedNum}v.jpg`;
                pageLinks.push(versoImageUrl);
            }

            console.log(`Czech Digital Library: Generated ${pageLinks.length} page URLs for "${title}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'czech',
                displayName: title,
                originalUrl: czechUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Czech Digital Library manifest:', error);
            throw new Error(`Failed to load Czech Digital Library manuscript: ${error.message}`);
        }
    }

    /**
     * Load Modena Diocesan Archive manifest by bypassing Flash interface and accessing mobile images directly
     */
    async loadModenaManifest(modenaUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Modena Diocesan Archive manuscript: ${modenaUrl}`);
            
            // Extract manuscript ID from URL
            // Expected format: https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/
            const manuscriptIdMatch = modenaUrl.match(/\/flip\/([^/]+)\/?$/);
            if (!manuscriptIdMatch) {
                throw new Error('Invalid Modena URL format. Expected: https://archiviodiocesano.mo.it/archivio/flip/MANUSCRIPT_ID/');
            }
            
            const manuscriptId = manuscriptIdMatch[1];
            console.log(`Extracted manuscript ID: ${manuscriptId}`);
            
            // Access mobile interface to determine page count
            const mobileUrl = `${modenaUrl.replace(/\/$/, '')}/mobile/index.html`;
            console.log(`Fetching mobile interface: ${mobileUrl}`);
            
            const mobileResponse = await this.fetchDirect(mobileUrl);
            const mobileHtml = await mobileResponse.text();
            
            // Extract total pages from JavaScript configuration
            // Look for total page count in mobile interface
            let totalPages = 0;
            
            // Try to extract from mobile page display (e.g., "Page: 1/11")
            const pageDisplayMatch = mobileHtml.match(/Page:\s*\d+\/(\d+)/);
            if (pageDisplayMatch) {
                const displayedTotal = parseInt(pageDisplayMatch[1]);
                console.log(`Found page display total: ${displayedTotal}`);
                if (!totalPages || displayedTotal > totalPages) {
                    totalPages = displayedTotal;
                }
            }
            
            // Try to extract from JavaScript config (more reliable for actual total)
            const totalPagesMatch = mobileHtml.match(/totalPages['":\s]*(\d+)/i);
            if (totalPagesMatch) {
                const jsTotal = parseInt(totalPagesMatch[1]);
                console.log(`Found JavaScript total pages: ${jsTotal}`);
                if (!totalPages || jsTotal > totalPages) {
                    totalPages = jsTotal;
                }
            }
            
            // Try to extract from data-pages attribute or similar
            const dataPagesMatch = mobileHtml.match(/data-pages[='"\s]*(\d+)/i);
            if (dataPagesMatch) {
                const dataTotal = parseInt(dataPagesMatch[1]);
                console.log(`Found data-pages total: ${dataTotal}`);
                if (!totalPages || dataTotal > totalPages) {
                    totalPages = dataTotal;
                }
            }
            
            // Try to extract from pages array or configuration
            const pagesArrayMatch = mobileHtml.match(/pages\s*[:=]\s*\[(.*?)\]/s);
            if (pagesArrayMatch) {
                const pagesContent = pagesArrayMatch[1];
                const pageCount = (pagesContent.match(/,/g) || []).length + 1;
                console.log(`Found pages array with ${pageCount} items`);
                if (!totalPages || pageCount > totalPages) {
                    totalPages = pageCount;
                }
            }
            
            // Fallback: try to determine by checking sequential image availability
            if (!totalPages) {
                console.log('No explicit page count found, attempting to determine by checking image availability');
                const baseImageUrl = `${modenaUrl.replace(/\/$/, '')}/files/mobile/`;
                
                // Binary search to find the last available page
                let low = 1;
                let high = 500; // Reasonable upper bound
                let lastFound = 0;
                
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    const testUrl = `${baseImageUrl}${mid}.jpg`;
                    
                    try {
                        const testResponse = await this.fetchDirect(testUrl, { timeout: 5000 });
                        if (testResponse.ok) {
                            lastFound = mid;
                            low = mid + 1;
                        } else {
                            high = mid - 1;
                        }
                    } catch {
                        high = mid - 1;
                    }
                }
                
                if (lastFound > 0) {
                    totalPages = lastFound;
                    console.log(`Determined page count by availability check: ${totalPages}`);
                }
            }
            
            // Ultimate fallback only as last resort
            if (!totalPages) {
                console.warn('Could not determine page count, using fallback of 231 pages');
                totalPages = 231;
            }
            
            console.log(`Final determined page count: ${totalPages}`);
            
            // Verify that images are accessible by testing first page
            const baseImageUrl = `${modenaUrl.replace(/\/$/, '')}/files/mobile/`;
            const firstPageUrl = `${baseImageUrl}1.jpg`;
            
            console.log(`Testing image access: ${firstPageUrl}`);
            const testResponse = await this.fetchDirect(firstPageUrl);
            if (!testResponse.ok) {
                throw new Error(`Cannot access manuscript images. Status: ${testResponse.status}`);
            }
            
            console.log(`Image access confirmed. Generating URLs for ${totalPages} pages`);
            
            // Generate page URLs using the discovered pattern
            const pageLinks: string[] = [];
            for (let page = 1; page <= totalPages; page++) {
                pageLinks.push(`${baseImageUrl}${page}.jpg`);
            }
            
            const displayName = `Modena_${manuscriptId}`;
            console.log(`Generated ${pageLinks.length} page URLs for "${displayName}"`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'modena',
                displayName,
                originalUrl: modenaUrl
            };
            
        } catch (error: any) {
            console.error('Error loading Modena Diocesan Archive manifest:', error);
            throw new Error(`Failed to load Modena manuscript: ${error.message}`);
        }
    }

    /**
     * Load BDL (Biblioteca Digitale Lombarda) manuscript manifest
     */
    async loadBDLManifest(bdlUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading BDL manuscript: ${bdlUrl}`);
            
            // Extract manuscript ID from URL
            // Expected format: https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903
            const urlParams = new URLSearchParams(bdlUrl.split('?')[1]);
            const manuscriptId = urlParams.get('cdOggetto');
            const pathType = urlParams.get('path');
            
            if (!manuscriptId) {
                throw new Error('Invalid BDL URL format. Missing cdOggetto parameter.');
            }
            
            if (!pathType) {
                throw new Error('Invalid BDL URL format. Missing path parameter.');
            }
            
            console.log(`Extracted manuscript ID: ${manuscriptId}, path: ${pathType}`);
            
            // Determine service path (public for fe, private for be)
            const servicePath = pathType === 'fe' ? 'public' : 'private';
            
            // Fetch pages JSON from BDL API with enhanced timeout
            const pagesApiUrl = `https://www.bdl.servizirl.it/bdl/${servicePath}/rest/json/item/${manuscriptId}/bookreader/pages`;
            console.log(`Fetching pages from: ${pagesApiUrl}`);
            
            // Add timeout and retry logic for BDL API call
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.error('BDL API request timed out after 30 seconds');
            }, 30000); // 30 second timeout for manifest loading
            
            try {
                const response = await this.fetchWithProxyFallback(pagesApiUrl, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch BDL pages: HTTP ${response.status} ${response.statusText}`);
                }
                
                const pagesData = await response.json();
                
                if (!Array.isArray(pagesData) || pagesData.length === 0) {
                    throw new Error('Invalid or empty pages data from BDL API');
                }
                
                console.log(`Found ${pagesData.length} pages in BDL manuscript`);
                
                // Extract image URLs from pages data with validation
                const pageLinks: string[] = [];
                
                for (const page of pagesData) {
                    if (page.idMediaServer) {
                        // Construct IIIF URL for full resolution image
                        const imageUrl = `https://www.bdl.servizirl.it/cantaloupe/iiif/2/${page.idMediaServer}/full/full/0/default.jpg`;
                        pageLinks.push(imageUrl);
                    } else {
                        console.warn(`Page ${page.id || 'unknown'} missing idMediaServer, skipping`);
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid image URLs found in BDL pages data');
                }
                
                // Validate first image URL to ensure it's accessible
                console.log('Validating first image URL...');
                const firstImageController = new AbortController();
                const firstImageTimeoutId = setTimeout(() => {
                    firstImageController.abort();
                }, 10000); // 10 second timeout for validation
                
                try {
                    const firstImageResponse = await fetch(pageLinks[0], {
                        method: 'HEAD',
                        signal: firstImageController.signal
                    });
                    clearTimeout(firstImageTimeoutId);
                    
                    if (!firstImageResponse.ok) {
                        console.warn(`First image validation failed: HTTP ${firstImageResponse.status}`);
                    } else {
                        console.log('First image URL validated successfully');
                    }
                } catch (validationError) {
                    clearTimeout(firstImageTimeoutId);
                    console.warn('First image validation failed:', validationError);
                    // Don't fail the entire process, just log the warning
                }
                
                const displayName = `BDL_${manuscriptId}`;
                console.log(`Generated ${pageLinks.length} page URLs for "${displayName}"`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'bdl',
                    displayName,
                    originalUrl: bdlUrl
                };
                
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('BDL API request timed out. The server may be experiencing high load.');
                }
                throw fetchError;
            }
            
        } catch (error: any) {
            console.error('Error loading BDL manuscript manifest:', error);
            throw new Error(`Failed to load BDL manuscript: ${error.message}`);
        }
    }

    /*
     * Write file with atomic operation and verification
     */
    private async writeFileWithVerification(outputPath: string, data: Buffer): Promise<void> {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Use atomic write pattern: write to temp file, then rename
        const tempPath = `${outputPath}.tmp`;
        
        try {
            // Write to temporary file first
            await fs.writeFile(tempPath, data);
            
            // Verify the temp file was written correctly
            const stats = await fs.stat(tempPath);
            if (stats.size !== data.length) {
                throw new Error(`File size mismatch: wrote ${data.length} bytes, got ${stats.size} bytes`);
            }
            
            // Atomically move temp file to final location
            await fs.rename(tempPath, outputPath);
            
            console.log(`✅ File written and verified: ${path.basename(outputPath)} (${(stats.size / (1024 * 1024)).toFixed(1)}MB)`);
            
        } catch (error: any) {
            // Clean up temp file if it exists
            try {
                await fs.unlink(tempPath);
            } catch {
                // Ignore cleanup errors
            }
            throw new Error(`File write verification failed: ${error.message}`);
        }
    }

}