import https from 'https';
import http from 'http';
import { URL } from 'url';
import { app } from 'electron';
import { join } from 'path';
import type { ElectronPdfMerger } from './ElectronPdfMerger';
import type { ManuscriptManifest, LibraryInfo, DownloadProgress, DownloadCallbacks } from '../../shared/types';

const MAX_IMAGE_FETCH_RETRIES = 2;
const IMAGE_FETCH_RETRY_DELAY_MS = 1000;
const MIN_VALID_IMAGE_SIZE_BYTES = 1024;

export class ManuscriptDownloaderService {
    private abortController: AbortController | null = null;

    constructor(
        private pdfMerger: ElectronPdfMerger
    ) {}

    // Extract a stable manuscript identifier from common URL patterns
    private extractManuscriptIdFromUrl(url: string): string | null {
        try {
            const ark = url.match(/ark:\/[^/]+\/([^/?#]+)/);
            if (ark && ark[1]) return ark[1];

            const viewSeg = url.match(/\/view\/(?:[A-Z_]+\.)?([^/?#]+)/i);
            if (viewSeg && viewSeg[1]) return viewSeg[1];

            const idParam = url.match(/[?&](?:id|PPN|manifest|path|item|record|obj|uuid)=([^&]+)/i);
            if (idParam && idParam[1]) return decodeURIComponent(idParam[1]).replace(/[^A-Za-z0-9._-]+/g, '_');

            const tail = url.match(/\/([A-Za-z0-9._-]{3,})\/?(?:[#?].*)?$/);
            if (tail && tail[1]) return tail[1];
        } catch {
            // ignore
        }
        return null;
    }

    // Append the manuscript ID to the base name if not already present
    private buildDescriptiveName(baseName: string, url: string): string {
        const safeBase = (baseName || 'manuscript').replace(/[\s]+/g, '_');
        const id = this.extractManuscriptIdFromUrl(url);
        if (!id) return safeBase;
        return safeBase.includes(id) ? safeBase : `${safeBase}__${id}`;
    }

    static readonly SUPPORTED_LIBRARIES: LibraryInfo[] = [
        {
            name: 'Gallica (BnF)',
            example: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.planchecontact',
            description: 'French National Library digital manuscripts (supports any f{page}.* format)',
        },
        {
            name: 'e-codices (Unifr)',
            example: 'https://www.e-codices.ch/en/sbe/0611/1r',
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
            name: 'Florus (BM Lyon)',
            example: 'https://florus.bm-lyon.fr/visualisation.php?cote=MS0425&vue=128',
            description: 'Bibliothèque municipale de Lyon digital manuscripts',
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
    ];

    getSupportedLibraries(): LibraryInfo[] {
        // Normalize library data to ensure all have explicit geoBlocked property
        return ManuscriptDownloaderService.SUPPORTED_LIBRARIES.map(lib => ({
            ...lib,
            geoBlocked: lib.geoBlocked ?? false,  // Ensure boolean value, default to false
            status: lib.status ?? 'operational'   // Ensure status is set
        }));
    }

    async parseManuscriptUrl(url: string): Promise<ManuscriptManifest> {
        const library = this.detectLibrary(url);
        
        switch (library) {
            case 'gallica':
                return this.loadGallicaManifest(url);
            case 'unifr':
                return this.loadUnifrManifest(url);
            case 'vatlib':
                return this.loadVatLibManifest(url);
            case 'florus':
                return this.loadFlorusManifest(url);
            case 'cudl':
                return this.loadCudlManifest(url);
            case 'trinity_cam':
                return this.loadTrinityCamManifest(url);
            case 'isos':
                return this.loadIsosManifest(url);
            case 'mira':
                return this.loadMiraManifest(url);
            default:
                throw new Error('Unsupported URL. Please check the supported libraries.');
        }
    }

    async downloadManuscript(url: string, callbacks?: DownloadCallbacks): Promise<void> {
        try {
            callbacks?.onStatusChange?.({ phase: 'parsing', message: 'Parsing manuscript URL...' });
            
            const manifest = await this.parseManuscriptUrl(url);
            
            callbacks?.onStatusChange?.({ phase: 'downloading', message: 'Starting download...' });
            
            const images = await this.downloadImagesWithProgress(manifest.pageLinks, manifest.library, callbacks);
            
            callbacks?.onStatusChange?.({ phase: 'processing', message: 'Creating PDF...' });
            
const pdfPath = await this.pdfMerger.createPDFFromImages({
                images,
                displayName: this.buildDescriptiveName(manifest.displayName, url),
                startPage: 1,
                endPage: manifest?.totalPages,
                totalPages: manifest?.totalPages,
                onProgress: (progress) => {
                    const overallProgress: DownloadProgress = {
                        totalPages: manifest?.totalPages,
                        downloadedPages: manifest?.totalPages,
                        currentPage: progress.pageNumber,
                        totalImages: manifest?.totalPages,
                        downloadedImages: manifest?.totalPages,
                        currentImageIndex: progress.pageNumber - 1,
                        pagesProcessed: progress.pageNumber,
                        percentage: 80 + Math.round(progress.percentage * 0.2), // 80-100% for PDF creation
                        elapsedTime: Date.now() - Date.now(), // TODO: track properly
                        estimatedTimeRemaining: 0,
                        bytesDownloaded: 0,
                        bytesTotal: 0,
                        downloadSpeed: 0,
                    };
                    callbacks?.onProgress?.(overallProgress);
                },
                onError: (error) => callbacks?.onError?.(error)
            });
            
            callbacks?.onStatusChange?.({ 
                phase: 'completed', 
                message: `PDF saved to: ${pdfPath}` 
            });
            
        } catch (error: any) {
            callbacks?.onError?.(error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    private detectLibrary(url: string): 'gallica' | 'unifr' | 'vatlib' | 'florus' | 'cudl' | 'trinity_cam' | 'isos' | 'mira' | null {
        // Check for unsupported libraries first
        if (url.includes('digitalcollections.tcd.ie')) {
            throw new Error('Trinity College Dublin is not currently supported due to aggressive captcha protection. Please download manuscripts manually through their website.');
        }
        
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('e-codices.unifr.ch')) return 'unifr';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('florus.bm-lyon.fr')) return 'florus';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('isos.dias.ie')) return 'isos';
        if (url.includes('mira.ie')) return 'mira';
        return null;
    }

    private async downloadImagesWithProgress(
        urls: string[], 
        _library: string,
        callbacks?: DownloadCallbacks
    ): Promise<Buffer[]> {
        const startTime = Date.now();
        const images: Buffer[] = [];
        let bytesDownloaded = 0;

        this.abortController = new AbortController();

        for (let i = 0; i < urls?.length; i++) {
            // Check abort signal more frequently
            if (this.abortController?.signal.aborted) {
                throw new Error('Download cancelled');
            }

            let imageData: Buffer | null = null;

            // Download directly without cache operations
            for (let retry = 0; retry <= MAX_IMAGE_FETCH_RETRIES; retry++) {
                try {
                    imageData = await this.downloadImageBuffer(urls[i] || '');
                    
                    if (imageData && imageData?.length >= MIN_VALID_IMAGE_SIZE_BYTES) {
                        break;
                    } else {
                        throw new Error('Invalid image size');
                    }
                } catch (error: any) {
                    console.error(`Download attempt ${retry + 1} failed for ${urls[i]}:`, error);
                    
                    if (retry === MAX_IMAGE_FETCH_RETRIES) {
                        throw new Error(`Failed to download page ${i + 1} after ${retry + 1} attempts`);
                    }
                    
                    if (retry < MAX_IMAGE_FETCH_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, IMAGE_FETCH_RETRY_DELAY_MS));
                    }
                }
            }

            if (imageData) {
                images.push(imageData);
                bytesDownloaded += imageData?.length;

                const progress: DownloadProgress = {
                    totalPages: urls?.length,
                    downloadedPages: i + 1,
                    currentPage: i + 1,
                    totalImages: urls?.length,
                    downloadedImages: i + 1,
                    currentImageIndex: i,
                    pagesProcessed: i + 1,
                    percentage: Math.round(((i + 1) / urls?.length) * 100),
                    elapsedTime: Date.now() - startTime,
                    estimatedTimeRemaining: 0,
                    bytesDownloaded,
                    bytesTotal: 0, // Unknown for now
                    downloadSpeed: bytesDownloaded / ((Date.now() - startTime) / 1000),
                };

                if (i > 0) {
                    const elapsed = Date.now() - startTime;
                    const rate = (i + 1) / elapsed;
                    const remaining = urls?.length - (i + 1);
                    progress.estimatedTimeRemaining = remaining / rate;
                }

                callbacks?.onProgress?.(progress);
            }
        }

        return images;
    }

    private async loadCudlManifest(cudlUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = cudlUrl.match(/\/view\/([^/]+)/);
            if (!idMatch) {
                throw new Error('Invalid Cambridge CUDL URL format');
            }
            
            const manuscriptId = idMatch[1];
            const manifestUrl = `https://cudl.lib.cam.ac.uk/iiif/${manuscriptId}`;
            
            const manifestData = await this.downloadTextContent(manifestUrl);
            const iiifManifest = JSON.parse(manifestData);
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: Record<string, unknown>) => {
                const images = canvas['images'] as Record<string, unknown>[];
                const resource = images[0]?.['resource'] as Record<string, unknown>;
                const rawUrl = resource['@id'] || resource['id'];
                // Convert bare IIIF identifier to proper IIIF image URL for Cambridge CUDL
                if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes('images.lib.cam.ac.uk/iiif/')) {
                    return rawUrl + '/full/1000,/0/default.jpg';
                }
                return rawUrl as string;
            }).filter((link: string) => link);
            
            if (pageLinks?.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                library: 'cudl',
                displayName: `Cambridge_${manuscriptId}`,
                originalUrl: cudlUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Cambridge CUDL manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async loadTrinityCamManifest(trinityUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = trinityUrl.match(/\/Manuscript\/([^/]+)/);
            if (!idMatch) {
                throw new Error('Invalid Trinity Cambridge URL format');
            }
            
            throw new Error('Trinity College Cambridge manuscripts require manual inspection - please provide direct image URLs or use a supported IIIF endpoint');
            
        } catch (error: any) {
            throw new Error(`Failed to load Trinity Cambridge manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async loadIsosManifest(isosUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = isosUrl.match(/\/([^/]+)\/([^/]+)\.html/);
            if (!idMatch) {
                throw new Error('Invalid ISOS URL format');
            }
            
            const collection = idMatch[1];
            const manuscriptId = idMatch[2];
            const manifestUrl = `https://www.isos.dias.ie/static/manifests/${manuscriptId}.json`;
            
            const manifestData = await this.downloadTextContent(manifestUrl);
            const iiifManifest = JSON.parse(manifestData);
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: Record<string, unknown>) => {
                const images = canvas['images'] as Record<string, unknown>[];
                const resource = images[0]?.['resource'] as Record<string, unknown>;
                const service = resource['service'] as Record<string, unknown>;
                if (service && service['@id']) {
                    return `${service['@id']}/full/full/0/default.jpg`;
                }
                return (resource['@id'] || resource['id']) as string;
            }).filter((link: string) => link);
            
            if (pageLinks?.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                library: 'isos',
                displayName: `ISOS_${collection}_${manuscriptId}`,
                originalUrl: isosUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load ISOS manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async loadMiraManifest(miraUrl: string): Promise<ManuscriptManifest> {
        try {
            const idMatch = miraUrl.match(/\/(\d+)$/);
            if (!idMatch) {
                throw new Error('Invalid MIRA URL format');
            }
            
            const miraId = idMatch[1];
            
            const html = await this.downloadTextContent(miraUrl);
            
            const manifestMatch = html.match(/manifest[^"]*([^"]+\.json)/);
            if (manifestMatch) {
                const manifestUrl = manifestMatch[1];
                const manifestData = await this.downloadTextContent(manifestUrl || '');
                const iiifManifest = JSON.parse(manifestData);
                
                if (iiifManifest.sequences && iiifManifest.sequences[0] && iiifManifest.sequences[0].canvases) {
                    const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: Record<string, unknown>) => {
                        const images = canvas['images'] as Record<string, unknown>[];
                        const resource = images[0]?.['resource'] as Record<string, unknown>;
                        const service = resource['service'] as Record<string, unknown>;
                        if (service && service['@id']) {
                            return `${service['@id']}/full/full/0/default.jpg`;
                        }
                        return (resource['@id'] || resource['id']) as string;
                    }).filter((link: string) => link);
                    
                    if (pageLinks?.length > 0) {
                        return {
                            pageLinks,
                            totalPages: pageLinks?.length,
                            library: 'mira',
                            displayName: `MIRA_${miraId}`,
                            originalUrl: miraUrl,
                        };
                    }
                }
            }
            
            throw new Error('Could not find valid IIIF manifest in MIRA page');
            
        } catch (error: any) {
            throw new Error(`Failed to load MIRA manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    private downloadImageBuffer(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(url, { 
                
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            // Handle abort
            if (this.abortController) {
                this.abortController.signal.addEventListener('abort', () => {
                    req.destroy();
                    reject(new Error('Download cancelled'));
                });
            }

            req.end();
        });
    }

    private async loadGallicaManifest(gallicaUrl: string): Promise<ManuscriptManifest> {
        // For Electron, we can download directly without proxies
        let processUrl = gallicaUrl;
        
        // Convert various Gallica URL formats to planchecontact format
        // Handle patterns like /f1.item, /f1.image, /f1.zoom, etc.
        if (!/\.(planchecontact|thumbs)($|\?|#)/.test(gallicaUrl)) {
            processUrl = gallicaUrl.replace(/\/f\d+\.(item|image|zoom|highres)($|\?|#)/, '/f1.planchecontact$2');
        }

        const html = await this.downloadTextContent(processUrl);
        
        if (html.includes('TOUT GALLICA LIVRES MANUSCRITS') && !html.includes('contenu')) {
            throw new Error('Invalid Gallica URL or manuscript not found. Please use a planchecontact URL.');
        }
        
        const pageLinks = this.extractGallicaImageUrls(html);
        
        if (pageLinks?.length === 0) {
            throw new Error('No images found in document. Please verify the URL is a valid Gallica manuscript page.');
        }
        
        const uniquePageLinks = [...new Set(pageLinks)];
        
        const arkMatch = gallicaUrl.match(/ark:\/12148\/([^/]+)/);
        const manuscriptCode = arkMatch ? `BnF._Département_des_Manuscrits._${arkMatch[1]}` : 'BnF_document';
        
        return {
            pageLinks: uniquePageLinks,
            totalPages: uniquePageLinks?.length,
            library: 'gallica',
            displayName: manuscriptCode,
            originalUrl: gallicaUrl,
        };
    }

    private async loadUnifrManifest(unifrUrl: string): Promise<ManuscriptManifest> {
        try {
            const html = await this.downloadTextContent(unifrUrl);
            const pageLinks = this.extractUnifrImageUrls(html);
            
            if (pageLinks?.length === 0) {
                throw new Error('No images found in manuscript');
            }

            // Extract manuscript code from URL - handle multiple URL patterns
            let pathMatch = unifrUrl.match(/\/(?:en|de|fr|it)\/([^/]+)\/([^/]+)(?:\/|$)/);
            if (!pathMatch) {
                pathMatch = unifrUrl.match(/\/(?:thumbs|list\/one)\/([^/]+)\/([^/]+)/);
            }
            
            const collection = pathMatch ? pathMatch[1] : '';
            const manuscript = pathMatch ? pathMatch[2] : '';
            const manuscriptCode = collection && manuscript ? `${collection}_${manuscript}` : 'manuscript';
            
            
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                library: 'unifr',
                displayName: manuscriptCode,
                originalUrl: unifrUrl,
            };
        } catch (error: any) {
            console.error('Failed to load e-codices manifest:', error);
            throw new Error(`Failed to load e-codices manuscript: ${error instanceof Error ? error.message : 'Unknown error during manifest loading'}`);
        }
    }

    private async loadVatLibManifest(vatLibUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript name from URL
            const nameMatch = vatLibUrl.match(/\/view\/([^/?]+)/);
            if (!nameMatch || !nameMatch[1]) {
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
            
            const html = await this.downloadTextContent(manifestUrl);
            const iiifManifest = JSON.parse(html);
            
            // Check if manifest has the expected structure
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid manifest structure: missing sequences or canvases');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: Record<string, unknown>) => {
                const images = canvas['images'] as Record<string, unknown>[];
                const resource = images[0]?.['resource'] as Record<string, unknown>;
                const service = resource['service'] as Record<string, unknown>;
                
                // Vatican Library uses a service object with @id pointing to the image service
                if (service && service['@id']) {
                    // Extract the base service URL and construct full resolution image URL
                    const serviceId = service['@id'];
                    return `${serviceId}/full/full/0/native.jpg`;
                }
                
                // Fallback to direct resource @id if no service (other IIIF implementations)
                if (resource['@id']) {
                    return resource['@id'];
                }
                
                return null;
            }).filter((link: string) => link);
            
            if (pageLinks?.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            
            return {
                pageLinks,
                totalPages: pageLinks?.length,
                library: 'vatlib',
                displayName: displayName,
                originalUrl: vatLibUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Vatican Library manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async loadFlorusManifest(florusUrl: string): Promise<ManuscriptManifest> {
        try {
            const html = await this.downloadTextContent(florusUrl);
            
            // Extract manuscript code and current page from URL
            const urlParams = new URLSearchParams(florusUrl.split('?')[1]);
            const cote = urlParams.get('cote') || '';
            const currentVue = parseInt(urlParams.get('vue') || '1');
            
            if (!cote) {
                throw new Error('Invalid Florus URL: missing cote parameter');
            }
            
            // Parse the HTML to find the navigation structure and determine total pages
            const pageLinks = await this.extractFlorusImageUrls(html, cote, currentVue);
            
            if (pageLinks?.length === 0) {
                throw new Error('No pages found in Florus manuscript');
            }
            
            // Find actual total pages from navigation
            let actualTotalPages = pageLinks?.length;
            const navNumbers = [...html.matchAll(/naviguer\((\d+)\)/g)]
                .map(match => parseInt(match?.[1] || '0'))
                .filter(num => !isNaN(num) && num > 0);
            
            if (navNumbers?.length > 0) {
                actualTotalPages = Math.max(...navNumbers);
            }
            
            return {
                pageLinks,
                totalPages: actualTotalPages, // Use actual total, not sample size
                library: 'florus',
                displayName: `BM_Lyon_${cote}`,
                originalUrl: florusUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load Florus manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private downloadTextContent(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(url, {
                
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    private extractGallicaImageUrls(html: string): string[] {
        // Copy the regex patterns from the original web implementation
        const imageLinks: string[] = [];
        
        // Pattern 1: High-resolution images from planchecontact
        const highResPattern = /href="(https:\/\/gallica\.bnf\.fr\/ark:\/12148\/[^"]+\.highres)"/g;
        let match;
        while ((match = highResPattern.exec(html)) !== null) {
            imageLinks.push(match?.[1] || '');
        }
        
        // Pattern 2: Alternative image patterns if needed
        const arkPattern = /ark:\/12148\/[^/]+\/f(\d+)\.item/g;
        const arkMatches = [];
        while ((match = arkPattern.exec(html)) !== null) {
            arkMatches.push(match[0]);
        }
        
        return imageLinks;
    }

    private extractUnifrImageUrls(html: string): string[] {
        // Try to find the manuscript-viewer component with :menu-bar-data attribute
        const menuBarDataMatch = html.match(/<manuscript-viewer\s+:menu-bar-data='([^']+)'/);
        if (menuBarDataMatch) {
            try {
                const menuBarDataJson = menuBarDataMatch[1];
                const menuBarData = JSON.parse(menuBarDataJson || '{}');
                if (menuBarData.canvases && Array.isArray(menuBarData.canvases)) {
                    return menuBarData.canvases.map((canvas: Record<string, unknown>) => {
                        if (!canvas['src']) throw new Error('Canvas missing src field');
                        // Convert thumbnails to full-resolution images
                        const imageUrl = (canvas['src'] as string).replace('https://www.e-codices.unifr.ch', 'https://www.e-codices.ch')
                            .replace(/\/full\/,\d+\//g, '/full/full/')
                            .replace(/\/default\/jpg$/, '/default.jpg');
                        return imageUrl;
                    });
                }
            } catch (error) {
                console.warn('Failed to parse menu-bar-data JSON:', error);
            }
        }

        // Try to find the manuscript-viewer component with :viewer-data attribute
        const viewerDataStart = html.indexOf(':viewer-data=\'');
        if (viewerDataStart !== -1) {
            try {
                const jsonStart = viewerDataStart + ':viewer-data=\''?.length;
                let jsonEnd = jsonStart;
                let quoteCount = 1; // We already passed one opening quote
                
                // Find the matching closing quote by tracking escape sequences
                // Add safety limit to prevent infinite loops on malformed HTML
                const maxSearchLength = Math.min(html?.length, jsonStart + 1000000); // Max 1MB of characters to search
                for (let i = jsonStart; i < maxSearchLength && quoteCount > 0; i++) {
                    const char = html[i];
                    const prevChar = i > 0 ? html[i - 1] : '';
                    
                    if (char === '\'' && prevChar !== '\\') {
                        quoteCount--;
                        if (quoteCount === 0) {
                            jsonEnd = i;
                            break;
                        }
                    }
                }
                
                // If we hit the search limit without finding the closing quote, skip this parsing attempt
                if (quoteCount > 0) {
                    console.warn('extractUnifrImageUrls: Failed to find closing quote within search limit, skipping viewer-data parsing');
                }
                
                if (quoteCount === 0) {
                    const viewerDataJson = html.substring(jsonStart, jsonEnd);
                    const viewerData = JSON.parse(viewerDataJson);
                    if (viewerData.canvases && Array.isArray(viewerData.canvases)) {
                        return viewerData.canvases.map((canvas: Record<string, unknown>) => {
                            if (!canvas['src']) throw new Error('Canvas missing src field');
                            const imageUrl = (canvas['src'] as string).replace('https://www.e-codices.unifr.ch', 'https://www.e-codices.ch')
                                .replace(/\/full\/,\d+\//g, '/full/full/')
                                .replace(/\/default\/jpg$/, '/default.jpg');
                            return imageUrl;
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to parse viewer-data JSON:', error);
            }
        }

        // Legacy approach: Try simple viewer-data pattern
        const legacyViewerDataMatch = html.match(/:viewer-data=["']([^"']+)["']/);
        if (legacyViewerDataMatch) {
            try {
                const viewerDataJson = legacyViewerDataMatch[1]?.replace(/\\"/g, '"').replace(/\\\//g, '/');
                if (!viewerDataJson) {
                    throw new Error('Viewer data JSON is empty');
                }
                const viewerData = JSON.parse(viewerDataJson);
                if (viewerData.canvases && Array.isArray(viewerData.canvases)) {
                    return viewerData.canvases.map((canvas: Record<string, unknown>) => {
                        if (!canvas['src']) throw new Error('Canvas missing src field');
                        const imageUrl = (canvas['src'] as string).replace('https://www.e-codices.unifr.ch', 'https://www.e-codices.ch')
                            .replace(/\/full\/,\d+\//g, '/full/full/')
                            .replace(/\/default\/jpg$/, '/default.jpg');
                        return imageUrl;
                    });
                }
            } catch (error) {
                console.warn('Failed to parse legacy viewer-data JSON:', error);
            }
        }

        // Try alternative menu-bar-data attribute format (without colon)
        const altMenuBarDataMatch = html.match(/menu-bar-data=["']([^"']+)["']/);
        if (altMenuBarDataMatch) {
            try {
                const menuBarDataJson = altMenuBarDataMatch[1];
                const menuBarData = JSON.parse(menuBarDataJson || '{}');
                if (menuBarData.canvases && Array.isArray(menuBarData.canvases)) {
                    return menuBarData.canvases.map((canvas: Record<string, unknown>) => {
                        if (!canvas['src']) throw new Error('Canvas missing src field');
                        const imageUrl = (canvas['src'] as string).replace('https://www.e-codices.unifr.ch', 'https://www.e-codices.ch')
                            .replace(/\/full\/,\d+\//g, '/full/full/')
                            .replace(/\/default\/jpg$/, '/default.jpg');
                        return imageUrl;
                    });
                }
            } catch (error) {
                console.warn('Failed to parse alternative menu-bar-data JSON:', error);
            }
        }

        // Fallback: extract all IIIF image URLs from src attributes
        const iiifImageMatches = html.matchAll(/src="([^"]*\.jp2[^"]*)"/g);
        const iiifUrls = Array.from(iiifImageMatches, (match) => match?.[1]);
        
        if (iiifUrls?.length > 0) {
            return iiifUrls.filter((url): url is string => !!url).map((url) => {
                const imageUrl = url.replace('https://www.e-codices.unifr.ch', 'https://www.e-codices.ch')
                    .replace(/\/full\/,\d+\//g, '/full/full/')
                    .replace(/\/default\/jpg$/, '/default.jpg');
                return imageUrl;
            });
        }

        throw new Error('Could not find viewer data, menu-bar-data, or IIIF image URLs in HTML');
    }

    private async extractFlorusImageUrls(html: string, cote: string, currentVue: number): Promise<string[]> {
        // Extract the image path from current page to understand the pattern
        const imagePathMatch = html.match(/FIF=([^&\s'"]+)/) ||
                              html.match(/image\s*:\s*'([^']+)'/) ||
                              html.match(/image\s*:\s*"([^"]+)"/);
        
        if (!imagePathMatch || !imagePathMatch[1]) {
            throw new Error('Could not find image path pattern in Florus page');
        }
        
        const currentImagePath = imagePathMatch[1];
        
        // Extract the base path and manuscript ID
        const pathParts = currentImagePath.match(/(.+\/)([^/]+)\.JPG\.tif$/);
        if (!pathParts) {
            throw new Error('Could not parse Florus image path structure');
        }
        
        // const basePath = pathParts[1]; // Used for constructing URLs below
        
        // Find the total number of pages from navigation
        let maxPage = currentVue + 20; // Conservative fallback
        
        const navNumbers = [...html.matchAll(/naviguer\((\d+)\)/g)]
            .map(match => parseInt(match?.[1] || '0'))
            .filter(num => !isNaN(num) && num > 0);
        
        if (navNumbers?.length > 0) {
            maxPage = Math.max(...navNumbers);
        }
        
        // For Florus, fetch sample pages around the current page
        const imageUrls: string[] = [];
        const serverUrl = 'https://florus.bm-lyon.fr/fcgi-bin/iipsrv.fcgi';
        
        const sampleStart = Math.max(1, currentVue - 5);
        const sampleEnd = Math.min(maxPage, currentVue + 5);
        
        for (let pageNum = sampleStart; pageNum <= sampleEnd; pageNum++) {
            try {
                const pageUrl = `https://florus.bm-lyon.fr/visualisation.php?cote=${cote}&vue=${pageNum}`;
                const pageHtml = await this.downloadTextContent(pageUrl);
                
                const pageImageMatch = pageHtml.match(/FIF=([^&\s'"]+)/) ||
                                      pageHtml.match(/image\s*:\s*'([^']+)'/) ||
                                      pageHtml.match(/image\s*:\s*"([^"]+)"/);
                
                if (pageImageMatch) {
                    const imagePath = pageImageMatch[1];
                    const imageUrl = `${serverUrl}?FIF=${imagePath}&WID=2000&CVT=JPEG`;
                    imageUrls.push(imageUrl);
                }
            } catch (error) {
                console.warn(`Failed to fetch Florus page ${pageNum}: ${error}`);
            }
        }
        
        if (imageUrls?.length === 0) {
            throw new Error('Could not extract any valid image URLs from Florus manuscript');
        }
        
        return imageUrls;
    }

    async downloadManuscriptPages(
        pageLinks: string[], 
        callbacks?: {
            onProgress?: (progress: { downloadedPages: number; totalPages: number; estimatedTimeRemaining?: number }) => void;
            onStatusChange?: (status: { phase: string; message: string }) => void;
            onError?: (error: string) => void;
        }
    ): Promise<void> {
        await this.downloadManuscriptPagesWithOptions(pageLinks, {
            displayName: 'manuscript',
            startPage: 1,
            endPage: pageLinks?.length,
            totalPages: pageLinks?.length,
            ...callbacks
        });
    }

    async downloadManuscriptPagesWithOptions(
        pageLinks: string[], 
        options: {
            displayName: string;
            startPage: number;
            endPage: number;
            totalPages: number;
            autoSplit?: boolean;
            maxPagesPerPart?: number;
            onProgress?: (progress: { downloadedPages: number; totalPages: number; estimatedTimeRemaining?: number }) => void;
            onStatusChange?: (status: { phase: string; message: string }) => void;
            onError?: (error: string) => void;
        }
    ): Promise<void> {
        try {
            options.onStatusChange?.({ phase: 'downloading', message: 'Starting download...' });
            
            const images = await this.downloadImagesWithProgress(pageLinks, 'mixed', {
                onProgress: (progress) => {
                    options.onProgress?.({
                        downloadedPages: progress.downloadedPages,
                        totalPages: progress?.totalPages,
                        estimatedTimeRemaining: progress.estimatedTimeRemaining,
                    });
                },
                onStatusChange: options.onStatusChange,
                onError: options.onError,
            });
            
            options.onStatusChange?.({ phase: 'processing', message: 'Creating PDF...' });
            
            // Construct automatic filename for queue downloads
            // Use filesystem-safe sanitization while preserving more characters
            const cleanName = options.displayName
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Remove filesystem-unsafe and control characters
                .replace(/\s+/g, '_')                     // Replace spaces with underscores
                .substring(0, 100) || 'manuscript';       // Limit to 100 characters with fallback
            
            // Avoid duplicating existing part/page suffixes coming from queue item names
            const baseForFilename = cleanName
                .replace(/_Part_\d+.*$/i, '')
                .replace(/_pages_\d+-\d+.*$/i, '');
            // Always include page numbers for clarity
            const filename = `${baseForFilename}_pages_${options.startPage}-${options.endPage}.pdf`;
            
            // Group all parts for the same manuscript into a single folder under Downloads
            const folderBase = cleanName
                .replace(/_Part_\d+.*$/i, '')
                .replace(/_pages_\d+-\d+.*$/i, '');
            const targetDir = join(app.getPath('downloads'), folderBase || cleanName);
            const outputPath = join(targetDir, filename);
            
            const pdfPath = await this.pdfMerger.createPDFFromImages({
                images,
                outputPath, // Provide automatic path to avoid dialog
                displayName: options.displayName,
                startPage: options.startPage,
                endPage: options.endPage,
                totalPages: options?.totalPages,
                autoSplit: options.autoSplit,
                maxPagesPerPart: options.maxPagesPerPart,
                onProgress: (_UNUSED_progress) => {
                    // PDF creation progress is already handled in the original progress callback
                },
                onError: (error) => options.onError?.(error)
            });
            
            options.onStatusChange?.({ 
                phase: 'completed', 
                message: `PDF saved to: ${pdfPath}` 
            });
            
        } catch (error: any) {
            options.onError?.(error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    abort(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}