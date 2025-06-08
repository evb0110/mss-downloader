import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ElectronPdfMerger } from './ElectronPdfMerger';
import type { UnifiedManifest, LibraryInfo, DownloadProgress, DownloadCallbacks } from '../../shared/types';

const MAX_IMAGE_FETCH_RETRIES = 2;
const IMAGE_FETCH_RETRY_DELAY_MS = 1000;
const MIN_VALID_IMAGE_SIZE_BYTES = 1024;

export class UnifiedManuscriptDownloader {
    private abortController: AbortController | null = null;

    constructor(
        private pdfMerger: ElectronPdfMerger
    ) {}

    static readonly SUPPORTED_LIBRARIES: LibraryInfo[] = [
        {
            name: 'Gallica (BnF)',
            example: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.planchecontact',
            description: 'French National Library digital manuscripts',
        },
        {
            name: 'e-codices (Unifr)',
            example: 'https://www.e-codices.unifr.ch/en/zbz/C0043/1r',
            description: 'Swiss virtual manuscript library',
        },
        {
            name: 'Vatican Library',
            example: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
            description: 'Vatican Apostolic Library digital collections',
        },
    ];

    getSupportedLibraries(): LibraryInfo[] {
        console.log('getSupportedLibraries called, returning:', UnifiedManuscriptDownloader.SUPPORTED_LIBRARIES);
        return UnifiedManuscriptDownloader.SUPPORTED_LIBRARIES;
    }

    async parseManuscriptUrl(url: string): Promise<UnifiedManifest> {
        const library = this.detectLibrary(url);
        
        switch (library) {
            case 'gallica':
                return this.loadGallicaManifest(url);
            case 'unifr':
                return this.loadUnifrManifest(url);
            case 'vatlib':
                return this.loadVatLibManifest(url);
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
                onProgress: (progress) => {
                    const overallProgress: DownloadProgress = {
                        totalPages: manifest.totalPages,
                        downloadedPages: manifest.totalPages,
                        currentPage: progress.pageNumber,
                        totalImages: manifest.totalPages,
                        downloadedImages: manifest.totalPages,
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
            callbacks?.onError?.(error.message);
            throw error;
        }
    }

    private detectLibrary(url: string): 'gallica' | 'unifr' | 'vatlib' | null {
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('e-codices.unifr.ch')) return 'unifr';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
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

        for (let i = 0; i < urls.length; i++) {
            if (this.abortController.signal.aborted) {
                throw new Error('Download cancelled');
            }

            let imageData: Buffer | null = null;

            // Download directly without cache operations
            for (let retry = 0; retry <= MAX_IMAGE_FETCH_RETRIES; retry++) {
                try {
                    imageData = await this.downloadImageBuffer(urls[i]);
                    
                    if (imageData && imageData.length >= MIN_VALID_IMAGE_SIZE_BYTES) {
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
                bytesDownloaded += imageData.length;

                const progress: DownloadProgress = {
                    totalPages: urls.length,
                    downloadedPages: i + 1,
                    currentPage: i + 1,
                    totalImages: urls.length,
                    downloadedImages: i + 1,
                    currentImageIndex: i,
                    pagesProcessed: i + 1,
                    percentage: Math.round(((i + 1) / urls.length) * 100),
                    elapsedTime: Date.now() - startTime,
                    estimatedTimeRemaining: 0,
                    bytesDownloaded,
                    bytesTotal: 0, // Unknown for now
                    downloadSpeed: bytesDownloaded / ((Date.now() - startTime) / 1000),
                };

                if (i > 0) {
                    const elapsed = Date.now() - startTime;
                    const rate = (i + 1) / elapsed;
                    const remaining = urls.length - (i + 1);
                    progress.estimatedTimeRemaining = remaining / rate;
                }

                callbacks?.onProgress?.(progress);
            }
        }

        return images;
    }

    private downloadImageBuffer(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(url, { 
                timeout: 30000,
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

    private async loadGallicaManifest(gallicaUrl: string): Promise<UnifiedManifest> {
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
        
        if (pageLinks.length === 0) {
            throw new Error('No images found in document. Please verify the URL is a valid Gallica manuscript page.');
        }
        
        const uniquePageLinks = [...new Set(pageLinks)];
        
        const arkMatch = gallicaUrl.match(/ark:\/12148\/([^/]+)/);
        const manuscriptCode = arkMatch ? `BNF_${arkMatch[1]}` : 'BNF_document';
        
        return {
            pageLinks: uniquePageLinks,
            totalPages: uniquePageLinks.length,
            library: 'gallica',
            displayName: manuscriptCode,
            originalUrl: gallicaUrl,
        };
    }

    private async loadUnifrManifest(unifrUrl: string): Promise<UnifiedManifest> {
        const html = await this.downloadTextContent(unifrUrl);
        const pageLinks = this.extractUnifrImageUrls(html);
        
        if (pageLinks.length === 0) {
            throw new Error('No images found in manuscript');
        }

        let pathMatch = unifrUrl.match(/\/(?:en|de|fr|it)\/([^/]+)\/([^/]+)(?:\/|$)/);
        if (!pathMatch) {
            pathMatch = unifrUrl.match(/\/(?:thumbs|list\/one)\/([^/]+)\/([^/]+)/);
        }
        
        const collection = pathMatch ? pathMatch[1] : '';
        const manuscript = pathMatch ? pathMatch[2] : '';
        const manuscriptCode = collection && manuscript ? `${collection}-${manuscript.toLowerCase()}` : 'manuscript';
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            library: 'unifr',
            displayName: manuscriptCode,
            originalUrl: unifrUrl,
        };
    }

    private async loadVatLibManifest(_vatLibUrl: string): Promise<UnifiedManifest> {
        // Implement Vatican Library manifest loading
        throw new Error('Vatican Library support not yet implemented in Electron version');
    }

    private downloadTextContent(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(url, {
                timeout: 30000,
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
            imageLinks.push(match[1]);
        }
        
        // Pattern 2: Alternative image patterns if needed
        const arkPattern = /ark:\/12148\/[^\/]+\/f(\d+)\.item/g;
        const arkMatches = [];
        while ((match = arkPattern.exec(html)) !== null) {
            arkMatches.push(match[0]);
        }
        
        return imageLinks;
    }

    private extractUnifrImageUrls(html: string): string[] {
        const imageLinks: string[] = [];
        
        // Extract e-codices image URLs
        const patterns = [
            /data-src="([^"]*\/thumbs\/[^"]*\.jpg)"/g,
            /src="([^"]*\/thumbs\/[^"]*\.jpg)"/g,
            /"(https:\/\/www\.e-codices\.unifr\.ch[^"]*\/thumbs\/[^"]*\.jpg)"/g
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                let url = match[1];
                if (!url.startsWith('http')) {
                    url = `https://www.e-codices.unifr.ch${url}`;
                }
                imageLinks.push(url.replace('/thumbs/', '/max/'));
            }
        }
        
        return [...new Set(imageLinks)];
    }

    abort(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}