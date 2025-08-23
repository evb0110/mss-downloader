import { promises as fs } from 'fs';
import path from 'path';
import { getAppPath } from './ElectronCompat';
import { PDFDocument, rgb } from 'pdf-lib';
import { ManifestCache } from './ManifestCache';
import { configService } from './ConfigService';
import { LibraryOptimizationService } from './LibraryOptimizationService';
import { ZifImageProcessor } from './ZifImageProcessor';
import { DziImageProcessor } from './DziImageProcessor';
import { TileEngineService } from './tile-engine/TileEngineService';
import { DirectTileProcessor } from './DirectTileProcessor';
import { SharedManifestAdapter } from './SharedManifestAdapter';
import { DownloadLogger } from './DownloadLogger';
import { comprehensiveLogger } from './ComprehensiveLogger';
import { enhancedLogger, ManuscriptContext, PerformanceMetrics } from './EnhancedLogger';
import { UltraReliableBDLService } from './UltraReliableBDLService';
import { networkResilienceService } from './NetworkResilienceService';
import { createProgressMonitor } from './IntelligentProgressMonitor';
import {
    GallicaLoader,
    MorganLoader,
    NyplLoader,
    GrenobleLoader,
    KarlsruheLoader,
    ManchesterLoader,
    MunichLoader,
    VaticanLoader,
    DurhamLoader,
    UgentLoader,
    BritishLibraryLoader,
    UnifrLoader,
    CeciliaLoader,
    IrhtLoader,
    LocLoader,
    DijonLoader,
    LaonLoader,
    SharedCanvasLoader,
    SaintOmerLoader,
    TorontoLoader,
    FlorusLoader,
    UnicattLoader,
    CudlLoader,
    TrinityCamLoader,
    IsosLoader,
    MiraLoader,
    RbmeLoader,
    ParkerLoader,
    ManuscriptaLoader,
    InternetCulturaleLoader,
    GrazLoader,
    CologneLoader,
    ViennaManuscriptaLoader,
    RomeLoader,
    BerlinLoader,
    CzechLoader,
    ModenaLoader,
    BdlLoader,
    EuropeanaLoader,
    EManuscriptaLoader,
    MonteCassinoLoader,
    VallicellianLoader,
    OmnesVallicellianLoader,
    VeronaLoader,
    DiammLoader,
    BneLoader,
    MdcCataloniaLoader,
    BvpbLoader,
    FlorenceLoader,
    OnbLoader,
    RouenLoader,
    FreiburgLoader,
    FuldaLoader,
    WolfenbuettelLoader,
    HhuLoader,
    GamsLoader,
    LinzLoader,
    DigitalWaltersLoader,
    GenericIiifLoader,
    CodicesLoader,
    type LoaderDependencies,
    type LibraryLoader
} from './library-loaders';
import type { ManuscriptManifest, LibraryInfo, DownloadProgress } from '../../shared/types';
import type { QueuedManuscript } from '../../shared/queueTypes';

interface DownloadOptions {
    onProgress?: (progress: DownloadProgress) => void;
    onManifestLoaded?: () => void;
    onStatusChange?: (status: string) => void;
    onError?: (error: string) => void;
    maxConcurrent?: number | string;
    skipExisting?: boolean;
    startPage?: number;
    endPage?: number;
    pageLinks?: string[];
    displayName?: string;
    library?: string;
    totalPages?: number;
    queueItem?: QueuedManuscript;
}

interface TileConfig {
    startPage: number;
    [key: string]: unknown;
}

interface ManifestWithTileConfig extends ManuscriptManifest {
    requiresTileProcessor?: boolean;
    tileConfig?: TileConfig;
}

import type { TLibrary } from '../../shared/queueTypes';

const MIN_VALID_IMAGE_SIZE_BYTES = 1024; // 1KB heuristic

interface FileTypeInfo {
    extension: string;
    mimeType: string;
    isImage: boolean;
}

interface DownloadResult {
    buffer: ArrayBuffer;
    fileType: FileTypeInfo;
}

/**
 * Detects file type from content-type header and/or buffer content
 * Returns appropriate file extension and metadata
 */
function detectFileType(contentType: string | null, buffer: ArrayBuffer): FileTypeInfo {
    // First, try to detect from content-type header
    if (contentType) {
        const normalizedType = contentType.toLowerCase().trim();
        
        // PDF files
        if (normalizedType.includes('application/pdf') || normalizedType.includes('pdf')) {
            return { extension: 'pdf', mimeType: 'application/pdf', isImage: false };
        }
        
        // Image files from content-type
        if (normalizedType.includes('image/jpeg') || normalizedType.includes('jpeg')) {
            return { extension: 'jpg', mimeType: 'image/jpeg', isImage: true };
        }
        if (normalizedType.includes('image/png') || normalizedType.includes('png')) {
            return { extension: 'png', mimeType: 'image/png', isImage: true };
        }
        if (normalizedType.includes('image/tiff') || normalizedType.includes('tiff')) {
            return { extension: 'tiff', mimeType: 'image/tiff', isImage: true };
        }
        if (normalizedType.includes('image/gif') || normalizedType.includes('gif')) {
            return { extension: 'gif', mimeType: 'image/gif', isImage: true };
        }
        if (normalizedType.includes('image/webp') || normalizedType.includes('webp')) {
            return { extension: 'webp', mimeType: 'image/webp', isImage: true };
        }
        if (normalizedType.includes('image/')) {
            // Generic image type - default to jpg
            return { extension: 'jpg', mimeType: 'image/jpeg', isImage: true };
        }
    }
    
    // Fallback: detect from buffer content (magic numbers)
    const uint8Array = new Uint8Array(buffer);
    if (uint8Array.length >= 4) {
        // PDF magic number: %PDF
        if (uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && 
            uint8Array[2] === 0x44 && uint8Array[3] === 0x46) {
            return { extension: 'pdf', mimeType: 'application/pdf', isImage: false };
        }
        
        // JPEG magic number: FF D8 FF
        if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
            return { extension: 'jpg', mimeType: 'image/jpeg', isImage: true };
        }
        
        // PNG magic number: 89 50 4E 47
        if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && 
            uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
            return { extension: 'png', mimeType: 'image/png', isImage: true };
        }
        
        // TIFF magic numbers: II 2A 00 (little endian) or MM 00 2A (big endian)
        if ((uint8Array[0] === 0x49 && uint8Array[1] === 0x49 && 
             uint8Array[2] === 0x2A && uint8Array[3] === 0x00) ||
            (uint8Array[0] === 0x4D && uint8Array[1] === 0x4D && 
             uint8Array[2] === 0x00 && uint8Array[3] === 0x2A)) {
            return { extension: 'tiff', mimeType: 'image/tiff', isImage: true };
        }
        
        // GIF magic number: GIF87a or GIF89a
        if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
            return { extension: 'gif', mimeType: 'image/gif', isImage: true };
        }
    }
    
    // Check for WebP magic number (need at least 12 bytes): RIFF....WEBP
    if (uint8Array.length >= 12) {
        if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && 
            uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
            uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && 
            uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
            return { extension: 'webp', mimeType: 'image/webp', isImage: true };
        }
    }
    
    // Default fallback: assume JPEG image
    return { extension: 'jpg', mimeType: 'image/jpeg', isImage: true };
}

export class EnhancedManuscriptDownloaderService {
    private manifestCache: ManifestCache;
    private zifProcessor: ZifImageProcessor;
    private dziProcessor: DziImageProcessor;
    private tileEngineService: TileEngineService;
    private directTileProcessor: DirectTileProcessor;
    private sharedManifestAdapter: SharedManifestAdapter;
    private logger: DownloadLogger;
    private ultraBDLService: UltraReliableBDLService;
    private libraryLoaders: Map<string, LibraryLoader>;

    constructor(manifestCache?: ManifestCache) {
        this.manifestCache = manifestCache || new ManifestCache();
        this.zifProcessor = new ZifImageProcessor();
        this.dziProcessor = new DziImageProcessor();
        this.tileEngineService = new TileEngineService();
        this.directTileProcessor = new DirectTileProcessor();
        // Use fetchDirect for SharedManifestAdapter - it handles both HTTP and HTTPS correctly
        this.sharedManifestAdapter = new SharedManifestAdapter(this.fetchDirect.bind(this));
        this.logger = DownloadLogger.getInstance();
        this.ultraBDLService = UltraReliableBDLService.getInstance();

        // Initialize library loaders with dependencies
        const loaderDeps: LoaderDependencies = {
            fetchDirect: this.fetchDirect.bind(this),
            fetchWithProxyFallback: this.fetchWithProxyFallback.bind(this),
            fetchWithHTTPS: this.fetchWithHTTPS.bind(this),
            sanitizeUrl: this.sanitizeUrl.bind(this),
            sleep: this.sleep.bind(this),
            manifestCache: this.manifestCache,
            logger: this.logger,
            zifProcessor: this.zifProcessor,
            dziProcessor: this.dziProcessor,
            directTileProcessor: this.directTileProcessor,
            tileEngineService: this.tileEngineService,
            sharedManifestAdapter: this.sharedManifestAdapter,
            ultraBDLService: this.ultraBDLService,
            createProgressMonitor: createProgressMonitor,
            validateInternetCulturaleImage: this.validateInternetCulturaleImage?.bind(this),
            // Provide loader methods for inter-loader dependencies
            loadIIIFManifest: (url: string) => this.loadLibraryManifest('generic_iiif', url),
            loadGenericIIIFManifest: this.loadGenericIIIFManifest?.bind(this),
            loadVallicellianManifest: (url: string) => this.loadLibraryManifest('vallicelliana', url),
            loadDiammSpecificManifest: (url: string) => this.loadLibraryManifest('diamm', url)
        };

        // Initialize the loader map
        this.libraryLoaders = new Map();
        this.libraryLoaders.set('gallica', new GallicaLoader(loaderDeps));
        this.libraryLoaders.set('morgan', new MorganLoader(loaderDeps));
        this.libraryLoaders.set('nypl', new NyplLoader(loaderDeps));
        this.libraryLoaders.set('grenoble', new GrenobleLoader(loaderDeps));
        this.libraryLoaders.set('karlsruhe', new KarlsruheLoader(loaderDeps));
        this.libraryLoaders.set('manchester', new ManchesterLoader(loaderDeps));
        this.libraryLoaders.set('munich', new MunichLoader(loaderDeps));
        this.libraryLoaders.set('vatican', new VaticanLoader(loaderDeps));
        this.libraryLoaders.set('durham', new DurhamLoader(loaderDeps));
        this.libraryLoaders.set('ugent', new UgentLoader(loaderDeps));
        this.libraryLoaders.set('bl', new BritishLibraryLoader(loaderDeps));
        this.libraryLoaders.set('unifr', new UnifrLoader(loaderDeps));
        this.libraryLoaders.set('cecilia', new CeciliaLoader(loaderDeps));
        this.libraryLoaders.set('irht', new IrhtLoader(loaderDeps));
        this.libraryLoaders.set('loc', new LocLoader(loaderDeps));
        this.libraryLoaders.set('dijon', new DijonLoader(loaderDeps));
        this.libraryLoaders.set('laon', new LaonLoader(loaderDeps));
        this.libraryLoaders.set('sharedcanvas', new SharedCanvasLoader(loaderDeps));
        this.libraryLoaders.set('saintomer', new SaintOmerLoader(loaderDeps));
        this.libraryLoaders.set('toronto', new TorontoLoader(loaderDeps));
        this.libraryLoaders.set('florus', new FlorusLoader(loaderDeps));
        this.libraryLoaders.set('unicatt', new UnicattLoader(loaderDeps));
        this.libraryLoaders.set('cudl', new CudlLoader(loaderDeps));
        this.libraryLoaders.set('trinity_cam', new TrinityCamLoader(loaderDeps));
        this.libraryLoaders.set('isos', new IsosLoader(loaderDeps));
        this.libraryLoaders.set('mira', new MiraLoader(loaderDeps));
        this.libraryLoaders.set('rbme', new RbmeLoader(loaderDeps));
        this.libraryLoaders.set('parker', new ParkerLoader(loaderDeps));
        this.libraryLoaders.set('manuscripta', new ManuscriptaLoader(loaderDeps));
        this.libraryLoaders.set('internet_culturale', new InternetCulturaleLoader(loaderDeps));
        this.libraryLoaders.set('graz', new GrazLoader(loaderDeps));
        this.libraryLoaders.set('cologne', new CologneLoader(loaderDeps));
        this.libraryLoaders.set('vienna', new ViennaManuscriptaLoader(loaderDeps));
        this.libraryLoaders.set('rome', new RomeLoader(loaderDeps));
        this.libraryLoaders.set('berlin', new BerlinLoader(loaderDeps));
        this.libraryLoaders.set('czech', new CzechLoader(loaderDeps));
        this.libraryLoaders.set('modena', new ModenaLoader(loaderDeps));
        this.libraryLoaders.set('bdl', new BdlLoader(loaderDeps));
        this.libraryLoaders.set('europeana', new EuropeanaLoader(loaderDeps));
        this.libraryLoaders.set('emanuscripta', new EManuscriptaLoader(loaderDeps));
        this.libraryLoaders.set('montecassino', new MonteCassinoLoader(loaderDeps));
        this.libraryLoaders.set('vallicelliana', new VallicellianLoader(loaderDeps));
        this.libraryLoaders.set('omnesvallicelliana', new OmnesVallicellianLoader(loaderDeps));
        this.libraryLoaders.set('verona', new VeronaLoader(loaderDeps));
        this.libraryLoaders.set('diamm', new DiammLoader(loaderDeps));
        this.libraryLoaders.set('bne', new BneLoader(loaderDeps));
        this.libraryLoaders.set('mdc', new MdcCataloniaLoader(loaderDeps));
        this.libraryLoaders.set('bvpb', new BvpbLoader(loaderDeps));
        this.libraryLoaders.set('florence', new FlorenceLoader(loaderDeps));
        this.libraryLoaders.set('onb', new OnbLoader(loaderDeps));
        this.libraryLoaders.set('rouen', new RouenLoader(loaderDeps));
        this.libraryLoaders.set('freiburg', new FreiburgLoader(loaderDeps));
        this.libraryLoaders.set('fulda', new FuldaLoader(loaderDeps));
        this.libraryLoaders.set('wolfenbuettel', new WolfenbuettelLoader(loaderDeps));
        this.libraryLoaders.set('hhu', new HhuLoader(loaderDeps));
        this.libraryLoaders.set('gams', new GamsLoader(loaderDeps));
        this.libraryLoaders.set('linz', new LinzLoader(loaderDeps));
        this.libraryLoaders.set('digital_walters', new DigitalWaltersLoader(loaderDeps));
        this.libraryLoaders.set('generic_iiif', new GenericIiifLoader(loaderDeps));
        this.libraryLoaders.set('codices', new CodicesLoader(loaderDeps));

        // Clear potentially problematic cached manifests on startup
        this.manifestCache.clearProblematicUrls().catch(error => {
            console.warn('Failed to clear problematic cache entries:', (error as Error).message);
        });

        // Force clear Florence cache to ensure users get v1.4.47+ ultra-simple implementation
        this.clearFlorenceCacheOnStartup();

        // Clear Graz cache to resolve persistent issues reported by users
        this.clearGrazCacheOnStartup();

        // Clear Rome cache to fix incorrect 150-page cached values
        this.clearRomeCacheOnStartup();
        
        // Clear BDL cache to fix PDF URL vs IIIF URL issue
        this.clearBdlCacheOnStartup();
    }

    /**
     * Clear Florence ContentDM cache on startup to ensure users get the new ultra-simple implementation
     * This resolves the issue where cached manifests prevent access to the v1.4.47+ improvements
     */
    private async clearFlorenceCacheOnStartup(): Promise<void> {
        try {
            await this.manifestCache.clearDomain('cdm21059.contentdm.oclc.org');
            console.log('✅ Florence cache cleared on startup - users will access new ultra-simple implementation');
            comprehensiveLogger.log({
                level: 'info',
                category: 'system',
                library: 'Florence',
                details: {
                    message: 'Florence cache cleared on startup',
                    reason: 'Ensure users get ultra-simple implementation'
                }
            });
        } catch (error) {
            console.warn('⚠️ Failed to clear Florence cache on startup:', (error as Error).message);
            comprehensiveLogger.log({
                level: 'error',
                category: 'system',
                library: 'Florence',
                errorMessage: (error as Error).message,
                errorStack: (error as Error).stack,
                details: {
                    message: 'Failed to clear Florence cache on startup'
                }
            });
        }
    }

    /**
     * Clear Rome cache on startup to fix page count detection issues
     * Old cache may contain incorrect 150-page fallback values
     */
    private async clearRomeCacheOnStartup(): Promise<void> {
        try {
            await this.manifestCache.clearDomain('digitale.bnc.roma.sbn.it');
            console.log('✅ Rome cache cleared on startup - fixing page count detection');
            comprehensiveLogger.log({
                level: 'info',
                category: 'system',
                library: 'Rome',
                details: {
                    message: 'Rome cache cleared on startup',
                    reason: 'Fix incorrect 150-page cached values'
                }
            });
        } catch (error) {
            console.warn('⚠️ Failed to clear Rome cache on startup:', (error as Error).message);
        }
    }

    /**
     * Clear Graz cache on startup to resolve persistent user-reported issues
     * This ensures users get the latest implementation without cached problems
     */
    private async clearGrazCacheOnStartup(): Promise<void> {
        try {
            await this.manifestCache.clearDomain('unipub.uni-graz.at');
            await this.manifestCache.clearDomain('gams.uni-graz.at');
            console.log('✅ Graz cache cleared on startup - resolving persistent user issues');
            comprehensiveLogger.log({
                level: 'info',
                category: 'system',
                library: 'Graz',
                details: {
                    message: 'Graz cache cleared on startup',
                    domains: ['unipub.uni-graz.at', 'gams.uni-graz.at'],
                    reason: 'Resolve persistent user-reported issues'
                }
            });
        } catch (error) {
            console.warn('⚠️ Failed to clear Graz cache on startup:', (error as Error).message);
            comprehensiveLogger.log({
                level: 'error',
                category: 'system',
                library: 'Graz',
                errorMessage: (error as Error).message,
                errorStack: (error as Error).stack,
                details: {
                    message: 'Failed to clear Graz cache on startup'
                }
            });
        }
    }

    /**
     * Clear BDL cache on startup to fix PDF URL vs IIIF URL issue
     * Old cached manifests contain PDF URLs that cause infinite download loops
     */
    private async clearBdlCacheOnStartup(): Promise<void> {
        try {
            await this.manifestCache.clearDomain('bdl.servizirl.it');
            console.log('✅ BDL cache cleared on startup - fixing PDF URL vs IIIF URL issue');
            comprehensiveLogger.log({
                level: 'info',
                category: 'system',
                library: 'BDL',
                details: {
                    message: 'BDL cache cleared on startup',
                    reason: 'Fix PDF URL vs IIIF URL infinite download loops'
                }
            });
        } catch (error) {
            console.warn('⚠️ Failed to clear BDL cache on startup:', (error as Error).message);
            comprehensiveLogger.log({
                level: 'error',
                category: 'system',
                library: 'BDL',
                errorMessage: (error as Error).message,
                errorStack: (error as Error).stack,
                details: {
                    message: 'Failed to clear BDL cache on startup'
                }
            });
        }
    }

    /**
     * ULTRA-PRIORITY FIX: Comprehensive URL sanitization to prevent hostname concatenation
     * This addresses Issue #13 where URLs like 'pagella.bm-grenoble.frhttps://...' cause DNS errors
     */
    private sanitizeUrl(url: string): string {
        if (!url || typeof url !== 'string') return url;

        // ENHANCED Pattern: Detect morgan-specific malformation first
        const morganMalformedPattern = /thumbs?(https?:\/\/.+)/i;
        const morganMatch = url.match(morganMalformedPattern);
        if (morganMatch) {
            const extractedUrl = morganMatch[1] || url;
            console.error(`[URL SANITIZER] Morgan malformed URL detected: ${url}`);
            console.error(`[URL SANITIZER] Extracted clean URL: ${extractedUrl}`);
            comprehensiveLogger.log({
                level: 'error',
                category: 'url-sanitizer',
                library: 'morgan',
                url: extractedUrl,
                details: {
                    message: 'Fixed Morgan malformed URL',
                    malformedUrl: url,
                    fixedUrl: extractedUrl
                }
            });
            return extractedUrl;
        }

        // Pattern 1: hostname directly concatenated with protocol (most common)
        // Example: pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/...
        const concatenatedPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
        const match = url.match(concatenatedPattern);
        if (match) {
            const [, hostname, actualUrl] = match;
            if (!actualUrl) {
                return url;
            }
            console.error(`[URL SANITIZER] Detected concatenated URL: ${url}`);
            console.error(`[URL SANITIZER] Extracted hostname: ${hostname}`);
            console.error(`[URL SANITIZER] Extracted URL: ${actualUrl}`);
            comprehensiveLogger.log({
                level: 'error',
                category: 'url-sanitizer',
                library: 'grenoble',
                url: actualUrl,
                details: {
                    message: 'Fixed malformed URL',
                    malformedUrl: url,
                    extractedHostname: hostname,
                    fixedUrl: actualUrl
                }
            });

            // Verify the extracted URL is valid
            try {
                new URL(actualUrl);
                console.log(`[URL SANITIZER] Fixed URL: ${actualUrl}`);
                return actualUrl;
            } catch (e) {
                console.error('[URL SANITIZER] Extracted URL is still invalid:', (e as Error).message);
            }
        }

        // Pattern 2: Check for any domain+protocol patterns
        const domainPatterns = [
            /\.(fr|com|org|edu|net|it|es|at|uk|de|ch)(https?:\/\/)/i,
            /^[^:/\s]+\.[^:/\s]+(https?:\/\/)/i
        ];

        for (const pattern of domainPatterns) {
            if (pattern.test(url)) {
                const protocolMatch = url.match(/(https?:\/\/.+)$/);
                if (protocolMatch) {
                    console.error(`[URL SANITIZER] Fixed malformed URL pattern: ${url} -> ${protocolMatch[1]}`);
                    comprehensiveLogger.log({
                        level: 'warn',
                        category: 'url-sanitizer',
                        url: protocolMatch[1],
                        details: {
                            message: 'Fixed URL with domain pattern',
                            malformedUrl: url,
                            fixedUrl: protocolMatch[1]
                        }
                    });
                    return protocolMatch[1] || url;
                }
            }
        }

        return url;
    }

    static readonly SUPPORTED_LIBRARIES: LibraryInfo[] = [
        {
            name: 'BDL (Biblioteca Digitale Lombarda)',
            example: 'https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903',
            description: 'Biblioteca Digitale Lombarda digital manuscripts via IIIF (Note: May require Italian IP for some collections)',
            geoBlocked: true,
        },
        {
            name: 'Berlin State Library',
            example: 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001',
            description: 'Staatsbibliothek zu Berlin digital manuscript collections via IIIF',
        },
        {
            name: 'BNE (Biblioteca Nacional de España)',
            example: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
            description: 'Spanish National Library digital manuscript and historical document collection (Note: Some content may require Spanish IP)',
            geoBlocked: true,
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
            name: 'e-manuscripta.ch',
            example: 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497',
            description: 'Swiss digital manuscript platform (Zurich libraries)',
        },
        {
            name: 'Florus (BM Lyon)',
            example: 'https://florus.bm-lyon.fr/visualisation.php?cote=MS0425&vue=128',
            description: 'Bibliothèque municipale de Lyon digital manuscripts',
        },
        {
            name: 'Florence (ContentDM Plutei)',
            example: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            description: 'Florence digital manuscripts collection via ContentDM with maximum resolution IIIF support (Note: May require Italian IP)',
            geoBlocked: true,
        },
        {
            name: 'Gallica (BnF)',
            example: 'https://gallica.bnf.fr/ark:/12148/btv1b8449691v/f1.highres',
            description: 'French National Library digital manuscripts (supports any f{page}.* format)',
        },
        {
            name: 'Grenoble Municipal Library',
            example: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
            description: 'Bibliothèque municipale de Grenoble digital manuscripts via Gallica infrastructure',
            geoBlocked: true,
        },
        {
            name: 'Internet Culturale',
            example: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
            description: 'Italian national digital heritage platform serving manuscripts from BNCF, Laurenziana, and other institutions (Note: Some collections may require Italian IP)',
            geoBlocked: true,
        },
        {
            name: 'Karlsruhe BLB (Badische Landesbibliothek)',
            example: 'https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F3464606%2Fmanifest',
            description: 'Badische Landesbibliothek Karlsruhe digital manuscripts via IIIF v2.0',
        },
        {
            name: 'IRHT (CNRS)',
            example: 'https://arca.irht.cnrs.fr/ark:/63955/md14nk323d72',
            description: 'Institut de recherche et d\'histoire des textes digital manuscripts',
        },
        {
            name: 'Library of Congress',
            example: 'https://www.loc.gov/item/2010414164/',
            description: 'Library of Congress digital manuscripts and rare books via IIIF v2.0',
        },
        {
            name: 'Laon Bibliothèque',
            example: 'https://bibliotheque-numerique.ville-laon.fr/viewer/1459/?offset=#page=1&viewer=picture&o=download&n=0&q=',
            description: 'Bibliothèque municipale de Laon digital manuscripts',
        },
        {
            name: 'Manchester Digital Collections (John Rylands)',
            example: 'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00074/1',
            description: 'University of Manchester John Rylands Library medieval manuscripts via IIIF v2.0',
        },
        {
            name: 'Munich Digital Collections (Digitale Sammlungen)',
            example: 'https://www.digitale-sammlungen.de/en/view/bsb00050763?page=1',
            description: 'Bavarian State Library digital manuscripts via IIIF v2.0 with high-resolution support',
        },
        {
            name: 'Norwegian National Library (nb.no)',
            example: 'https://www.nb.no/items/1ef274e1cff5ab191d974e96d09c4cc1?page=0',
            description: 'National Library of Norway digital manuscripts (Note: May require Norwegian IP for image access due to geo-restrictions)',
            geoBlocked: true,
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
            name: 'ARCA (IRHT Digital Archives)',
            example: 'https://arca.irht.cnrs.fr/ark:/63955/fykkvnm8wkpd',
            description: 'IRHT (CNRS) digital manuscript archives with IIIF v3.0 support',
        },
        {
            name: 'Real Biblioteca del Monasterio de El Escorial (RBME)',
            example: 'https://rbme.patrimonionacional.es/s/rbme/item/14374',
            description: 'Real Biblioteca del Monasterio de El Escorial digital manuscripts via IIIF',
        },
        {
            name: 'Rome National Library (BNCR)',
            example: 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
            description: 'Biblioteca Nazionale Centrale di Roma digital manuscript collections (manoscrittoantico and libroantico)',
        },
        {
            name: 'Roman Archive (Archivio di Stato di Roma)',
            example: 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882',
            description: 'Archivio di Stato di Roma digital manuscripts (Note: Direct IIIF manifest URLs work best)',
        },
        {
            name: 'SharedCanvas',
            example: 'https://sharedcanvas.be/IIIF/viewer/mirador/B_OB_MS310',
            description: 'SharedCanvas-based digital manuscript viewers and collections',
        },
        {
            name: 'Saint-Omer Municipal Library',
            example: 'https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/22581/?offset=3#page=1&viewer=picture&o=&n=0&q=',
            description: 'Bibliothèque municipale de Saint-Omer medieval manuscripts via IIIF v2.0',
        },
        {
            name: 'Stanford Parker Library',
            example: 'https://parker.stanford.edu/parker/catalog/zs345bj2650',
            description: 'Stanford Parker Library on the Web - digitized manuscripts from Corpus Christi College, Cambridge via IIIF',
        },
        {
            name: 'Trinity College Cambridge',
            example: 'https://mss-cat.trin.cam.ac.uk/Manuscript/B.10.5/UV',
            description: 'Trinity College Cambridge digital manuscripts (Note: May have geographic restrictions)',
            geoBlocked: true,
        },
        {
            name: 'University of Toronto (Fisher)',
            example: 'https://collections.library.utoronto.ca/view/fisher2:F6521',
            description: 'University of Toronto Thomas Fisher Rare Book Library manuscripts via IIIF v2.0/v3.0 - Available from Russia',
            geoBlocked: true,
        },
        {
            name: 'Fulda University of Applied Sciences',
            example: 'https://fuldig.hs-fulda.de/viewer/image/PPN314755322/2/',
            description: 'Fulda University digital collections with medieval manuscripts via IIIF v2.0',
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
            geoBlocked: true,
        },
        {
            name: 'Vatican Digital Library',
            example: 'https://digi.vatlib.it/view/MSS_Vat.lat.1',
            description: 'Vatican Apostolic Library manuscripts with high-resolution IIIF support (up to 4000px width)',
        },
        {
            name: 'Vienna Manuscripta.at',
            example: 'https://manuscripta.at/diglit/AT5000-1013/0001',
            description: 'Austrian National Library digital manuscript collection',
        },
        {
            name: 'BVPB (Biblioteca Virtual del Patrimonio Bibliográfico)',
            example: 'https://bvpb.mcu.es/es/consulta/registro.do?id=451885',
            description: 'Spanish Virtual Library of Bibliographic Heritage with digitized manuscripts',
        },
        {
            name: 'Europeana Collections',
            example: 'https://www.europeana.eu/en/item/446/CNMD_00000171777',
            description: 'European cultural heritage manuscripts via IIIF manifest API',
        },
        {
            name: 'Monte-Cassino (OMNES)',
            example: 'https://manus.iccu.sbn.it/cnmd/0000313047',
            description: 'Monte-Cassino Abbey manuscripts via OMNES IIIF platform',
        },
        {
            name: 'Vallicelliana Library',
            example: 'https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest',
            description: 'Biblioteca Vallicelliana manuscripts via DAM and JMMS platforms',
        },
        {
            name: 'Omnes Vallicelliana',
            example: 'https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_D5/manifest',
            description: 'Biblioteca Vallicelliana manuscripts via Omnes digital platform',
        },
        {
            name: 'Verona Library (NBM)',
            example: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
            description: 'Nuova Biblioteca Manoscritta (Verona) manuscripts via IIIF (Note: May require Italian IP for full access)',
            geoBlocked: true,
        },
        {
            name: 'DIAMM (Digital Image Archive of Medieval Music)',
            example: 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json',
            description: 'Digital Image Archive of Medieval Music manuscripts (800-1650 AD) via IIIF',
        },
        {
            name: 'Digital Scriptorium',
            example: 'https://search.digital-scriptorium.org/catalog/DS1649',
            description: 'Digital Scriptorium manuscript database with IIIF v3 support - catalog URLs automatically converted to manifest access',
        },
        {
            name: 'MDC Catalonia (Memòria Digital de Catalunya)',
            example: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
            description: 'Catalan digital manuscript collection with historical incunables via IIIF (Note: May require Spanish/Catalan IP)',
            geoBlocked: true,
        },
        {
            name: 'BVPB (Biblioteca Virtual del Patrimonio Bibliográfico)',
            example: 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651',
            description: 'Spanish virtual library of bibliographic heritage manuscripts and historical documents',
        },
        {
            name: 'ONB (Austrian National Library)',
            example: 'https://viewer.onb.ac.at/1000B160',
            description: 'Austrian National Library digital collections with IIIF v3 support for high-resolution manuscript access',
        },
        {
            name: 'Rouen Municipal Library',
            example: 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom',
            description: 'Bibliothèque municipale de Rouen digital manuscript collections with high-resolution access',
        },
        {
            name: 'University of Freiburg',
            example: 'https://dl.ub.uni-freiburg.de/diglit/brant1494',
            description: 'University of Freiburg digital manuscript collection with METS/MODS metadata and maximum resolution IIIF support',
        },
        {
            name: 'Wolfenbüttel Digital Library (HAB)',
            example: 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst or https://diglib.hab.de/varia/selecta/ed000011/start.htm',
            description: 'Herzog August Bibliothek Wolfenbüttel digital manuscript collections with high-resolution access',
        },
        {
            name: 'HHU Düsseldorf (Heinrich-Heine-University)',
            example: 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest',
            description: 'Heinrich-Heine-University Düsseldorf digital manuscripts via IIIF v2.0 with maximum resolution support (up to 4879x6273px)',
        },
        {
            name: 'Bordeaux Bibliothèques',
            example: 'https://manuscrits.bordeaux.fr/ark:/26678/btv1b52509616g/f13.item.zoom',
            description: 'Bordeaux Libraries digital manuscripts using Deep Zoom Image (DZI) tile technology for ultra-high resolution',
        },
        {
            name: 'Heidelberg University Library',
            example: 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2',
            description: 'Heidelberg University Library digital manuscripts via IIIF v2 and v3 with maximum resolution support',
        },
        {
            name: 'Oberösterreichische Landesbibliothek (Linz)',
            example: 'https://digi.landesbibliothek.at/viewer/image/116/',
            description: 'Upper Austrian State Library (Linz) digital manuscripts via IIIF v2, featuring 500+ historical manuscripts from medieval to modern periods',
        },
        {
            name: 'Yale Beinecke Rare Book Library',
            example: 'https://collections.library.yale.edu/catalog/33242982',
            description: 'Yale Beinecke Rare Book & Manuscript Library digital collections via IIIF v3, featuring medieval manuscripts, archives, and rare books',
        },
        {
            name: 'Digital Walters Art Museum',
            example: 'https://www.thedigitalwalters.org/Data/WaltersManuscripts/html/W33/',
            description: 'The Walters Art Museum digital manuscript collection (HTML index). Downloads JPEG sap images, not TIFF masters.',
        },
        {
            name: 'Admont Codices Library',
            example: 'https://admont.codices.at/codices/169/90299',
            description: 'Admont Abbey Codices (admont.codices.at) via IIIF v3; supports direct IIIF UUID and image info.json URLs',
        },
    ];

    getSupportedLibraries(): LibraryInfo[] {
        // Normalize library data to ensure all have explicit geoBlocked property
        return EnhancedManuscriptDownloaderService.SUPPORTED_LIBRARIES.map(lib => ({
            ...lib,
            geoBlocked: lib.geoBlocked ?? false,  // Ensure boolean value, default to false
            status: lib.status ?? 'operational'   // Ensure status is set
        }));
    }

    /**
     * Calculate exponential backoff delay with jitter - enhanced with network resilience
     */
    calculateRetryDelay(attempt: number, error?: Error, libraryName?: string): number {
        // Use enhanced retry calculation from NetworkResilienceService
        return networkResilienceService.calculateRetryDelay(attempt, error, libraryName);
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
     * Helper to use extracted library loader or fallback to original method
     */
    private async useLoaderOrFallback(
        libraryKey: string,
        url: string,
        fallbackMethod: (url: string) => Promise<ManuscriptManifest>
    ): Promise<ManuscriptManifest> {
        const loader = this.libraryLoaders.get(libraryKey);
        if (loader) {
            return await loader.loadManifest(url);
        } else {
            // Fallback to original method if loader not found
            return await fallbackMethod.call(this, url);
        }
    }

    /**
     * Validate Internet Culturale images to detect authentication error pages
     */
    private async validateInternetCulturaleImage(buffer: ArrayBuffer, url: string): Promise<void> {
        // Check for the specific "Preview non disponibile" error page by content, not just size
        // Error pages contain specific text, while legitimate small images are just compressed manuscripts

        try {
            // Convert buffer to text to check for error messages
            const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

            // Check for actual error text content (case-insensitive)
            const errorTexts = [
                'preview non disponibile',
                'Preview non disponibile',
                'PREVIEW NON DISPONIBILE',
                'anteprima non disponibile',
                'Anteprima non disponibile',
                'accesso negato',
                'access denied',
                'errore',
                'error'
            ];

            const hasErrorText = errorTexts.some(errorText =>
                textContent.toLowerCase().includes(errorText.toLowerCase())
            );

            if (hasErrorText) {
                throw new Error(
                    `Internet Culturale authentication error: received error page with text "${errorTexts.find(t => textContent.toLowerCase().includes(t.toLowerCase()))}" instead of manuscript image. ` +
                    `This indicates a session/authentication issue. Image size: ${buffer.byteLength} bytes. ` +
                    `URL: ${url}`
                );
            }

            // Validate JPEG structure
            const bytes = new Uint8Array(buffer);
            const isValidJpeg = bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;

            if (!isValidJpeg) {
                throw new Error(`Invalid JPEG format received from Internet Culturale: ${url}`);
            }

            // Log small but valid images for monitoring (some manuscripts have legitimately small images)
            if (buffer.byteLength < 40000) {
                console.log(`Internet Culturale: Small but valid image (${buffer.byteLength} bytes): ${url}`);
            }

        } catch {
            // If text decoding fails, it's likely a binary image (which is good)
            // Just verify it's a valid JPEG
            const bytes = new Uint8Array(buffer);
            const isValidJpeg = bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;

            if (!isValidJpeg) {
                throw new Error(`Invalid JPEG format received from Internet Culturale: ${url}`);
            }
        }
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
        if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
        if ((url.includes('i3f.vls.io') && url.includes('blb-karlsruhe.de')) || url.includes('digital.blb-karlsruhe.de')) return 'karlsruhe';
        if (url.includes('digitalcollections.manchester.ac.uk')) return 'manchester';
        if (url.includes('digitale-sammlungen.de')) return 'munich';
        if (url.includes('nb.no')) return 'norwegian';
        if (url.includes('e-codices.unifr.ch') || url.includes('e-codices.ch')) return 'unifr';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('e-rara.ch')) return 'e_rara';
        if (url.includes('collections.library.yale.edu')) return 'yale';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('cecilia.mediatheques.grand-albigeois.fr')) return 'cecilia';
        if (url.includes('www.loc.gov') || url.includes('tile.loc.gov')) return 'loc';
        if (url.includes('patrimoine.bm-dijon.fr')) return 'dijon';
        if (url.includes('bibliotheque-numerique.ville-laon.fr')) return 'laon';
        if (url.includes('iiif.durham.ac.uk')) return 'durham';
        if (url.includes('sharedcanvas.be')) return 'sharedcanvas';
        if (url.includes('bibliotheque-agglo-stomer.fr')) return 'saintomer';
        if (url.includes('lib.ugent.be')) return 'ugent';
        if (url.includes('iiif.bl.uk') || url.includes('bl.digirati.io')) return 'bl';
        if (url.includes('florus.bm-lyon.fr')) return 'florus';
        if (url.includes('digitallibrary.unicatt.it')) return 'unicatt';
        if (url.includes('internetculturale.it')) return 'internet_culturale';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('iiif.library.utoronto.ca') || url.includes('collections.library.utoronto.ca')) return 'toronto';
        if (url.includes('isos.dias.ie')) return 'isos';
        if (url.includes('mira.ie')) return 'mira';
        if (url.includes('arca.irht.cnrs.fr')) return 'arca';
        if (url.includes('rbme.patrimonionacional.es')) return 'rbme';
        if (url.includes('parker.stanford.edu')) return 'parker';
        if (url.includes('manuscripta.se')) return 'manuscripta';
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('gams.uni-graz.at')) return 'gams';
        if (url.includes('digital.dombibliothek-koeln.de')) return 'cologne';
        if (url.includes('manuscripta.at')) return 'vienna_manuscripta';
        if (url.includes('digitale.bnc.roma.sbn.it')) return 'rome';
        if (url.includes('digital.staatsbibliothek-berlin.de')) return 'berlin';
        if (url.includes('dig.vkol.cz')) return 'czech';
        if (url.includes('archiviodiocesano.mo.it')) return 'modena';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('europeana.eu')) return 'europeana';
        if (url.includes('omnes.dbseret.com/montecassino')) return 'montecassino';
        if (url.includes('dam.iccu.sbn.it') || url.includes('jmms.iccu.sbn.it')) return 'vallicelliana';
        if (url.includes('omnes.dbseret.com/vallicelliana')) return 'omnes_vallicelliana';
        if (url.includes('manus.iccu.sbn.it')) return 'montecassino';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('bvpb.mcu.es')) return 'bvpb';
        if (url.includes('diamm.ac.uk') || url.includes('iiif.diamm.net') || url.includes('musmed.eu/visualiseur-iiif')) return 'diamm';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('mdc.csuc.cat/digital/collection')) return 'mdc_catalonia';
        if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
        if (url.includes('cdm21059.contentdm.oclc.org/iiif/2/plutei:')) return 'florence'; // IIIF image URLs
        if (url.includes('viewer.onb.ac.at')) return 'onb';
        if (url.includes('rotomagus.fr')) return 'rouen';
        if (url.includes('dl.ub.uni-freiburg.de')) return 'freiburg';
        if (url.includes('fuldig.hs-fulda.de')) return 'fulda';
        if (url.includes('diglib.hab.de')) return 'wolfenbuettel';
        if (url.includes('digital.ulb.hhu.de')) return 'hhu';
        if (url.includes('manuscrits.bordeaux.fr') || url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('digital.bodleian.ox.ac.uk') || url.includes('digital2.bodleian.ox.ac.uk')) return 'bodleian';
        if (url.includes('digi.ub.uni-heidelberg.de') || url.includes('doi.org/10.11588/diglit')) return 'heidelberg';
        if (url.includes('digi.landesbibliothek.at')) return 'linz';
        // Digital Walters Art Museum support - only HTML index URLs per Issue #38
        if (url.includes('thedigitalwalters.org') && url.includes('/Data/WaltersManuscripts/html/')) return 'digital_walters';
        // Issue #54: Ambrosiana library support
        if (url.includes('ambrosiana.comperio.it')) return 'ambrosiana';
        // Issue #30: Roman Archive support
        if (url.includes('imagoarchiviodistatoroma.cultura.gov.it') || url.includes('archiviostorico.senato.it')) return 'roman_archive';
        // Issue #33: Digital Scriptorium support  
        if (url.includes('digital-scriptorium.org') || url.includes('colenda.library.upenn.edu')) return 'digital_scriptorium';
        // Codices library support - both manuscript pages and direct IIIF manifests
        if (url.includes('codices.at')) return 'codices';

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
     * Norwegian proxy for geo-restricted content (requires Norwegian IP)
     * Using proxy services that might have Norwegian exit nodes
     */
    private readonly NORWEGIAN_PROXIES = [
        // These are general proxies that might work
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        // Additional proxies that might have European/Nordic nodes
        'https://thingproxy.freeboard.io/fetch/',
        'https://api.codetabs.com/v1/proxy?quest='
    ];

    /**
     * Extract manuscript ID from URL for logging purposes
     */
    private extractManuscriptId(url: string): string {
        try {
            // Extract meaningful ID from URL
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
            
            // Try to find manuscript-like identifiers
            for (const part of pathParts) {
                // Look for common manuscript ID patterns
                if (/^(ms|MS|Cod|cod|Vat|vat|lat|gr|arab|heb|syr|arm|eth|copt|pal|mss|MSS)[-._]?\d+/i.test(part)) {
                    return part;
                }
                // Look for simple numeric or alphanumeric IDs
                if (/^[a-zA-Z0-9-_]{3,}$/.test(part) && part !== 'manifest' && part !== 'viewer' && part !== 'digital') {
                    return part;
                }
            }
            
            // Fallback: use last meaningful path segment
            return pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'unknown';
        } catch {
            return 'unknown';
        }
    }

    /**
     * Calculate estimated size for a manuscript
     */
    private calculateEstimatedSize(manifest: ManuscriptManifest): number {
        if (!manifest.totalPages) return 0;
        
        // Estimate based on library and page count
        // Average page sizes observed from real downloads
        const avgPageSizeKB: Record<string, number> = {
            'vatlib': 800,     // High resolution Vatican manuscripts
            'vatican': 800,
            'bdl': 700,        // BDL high quality images
            'roman_archive': 1200, // Very high resolution
            'gallica': 600,    // Good quality
            'morgan': 500,     // Medium quality
            'nypl': 400,       // Compressed images
            'munich': 300,     // Compressed images
            'e_manuscripta': 250, // Smaller images
            'florence': 200,   // Smaller images
            'default': 400     // Default assumption
        };
        
        const library = manifest.library || 'default';
        const pageSize = avgPageSizeKB[library] || avgPageSizeKB['default'];
        
        return (manifest?.totalPages * pageSize) / 1024; // Convert to MB
    }

    /**
     * Fetch with automatic proxy fallback
     */
    async fetchWithProxyFallback(url: string, options: RequestInit = {}): Promise<Response> {
        // ULTRA-PRIORITY FIX for Issue #9: Sanitize URL before any fetch operation
        url = this.sanitizeUrl(url);

        // For Norwegian content, try Norwegian-friendly proxies first
        const isNorwegianContent = url.includes('nb.no') || url.includes('api.nb.no');
        const proxiesToTry = isNorwegianContent ? this.NORWEGIAN_PROXIES : this.PROXY_SERVERS;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), configService.get('requestTimeout') || 30000);

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
        } catch (directError: unknown) {
            clearTimeout(timeoutId);

            // If direct access fails, try proxy servers
            for (const proxy of proxiesToTry) {
                try {
                    const proxyController = new AbortController();
                    const proxyTimeoutId = setTimeout(() => proxyController.abort(), configService.get('requestTimeout') || 30000);

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
                } catch (proxyError: unknown) {
                    console.warn(`Proxy ${proxy} failed for ${url}: ${proxyError instanceof Error ? proxyError.message : String(proxyError)}`);
                    continue;
                }
            }

            // All proxies failed, throw original error
            throw directError;
        }
    }

    /**
     * Enhanced direct fetch with network resilience
     */
    async fetchDirect(url: string, options: RequestInit = {}, attempt: number = 1): Promise<Response> {
        const startTime = Date.now();
        const library = this.detectLibrary(url) as TLibrary || 'unknown';
        const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';

        // Check circuit breaker before attempting request
        const circuitCheck = networkResilienceService.canExecuteRequest(library);
        if (!circuitCheck.allowed) {
            const error = new Error(circuitCheck.reason || 'Circuit breaker prevented request');
            (error as any).code = 'CIRCUIT_BREAKER_OPEN';
            throw error;
        }

        // Always create our own controller for library-specific timeouts
        const controller = new AbortController();

        // Get optimized HTTP agent with connection pooling
        const urlObj = new URL(url);
        const httpAgent = networkResilienceService.getHttpAgent(urlObj.hostname);

        // CRITICAL FIX: Ensure baseTimeout is never undefined to prevent NaN timeout
        const baseTimeout = configService.get('requestTimeout') || 30000; // Default to 30 seconds if undefined
        const timeout = library ?
            LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, library, attempt) :
            baseTimeout;

        this.logger.logDownloadStart(library || 'unknown', url, { attempt, method: 'fetchDirect' });
        this.logger.log({
            level: 'debug',
            library: library || 'unknown',
            url,
            message: `Library detected: ${library || 'unknown'}, timeout: ${timeout}ms (base: ${baseTimeout}ms), using connection pool`,
            details: { library, timeout, baseTimeout, attempt, useConnectionPool: true }
        });

        // CRITICAL FIX: Always apply library-specific timeout, even with external signals
        // This ensures Graz and other libraries get their proper extended timeouts
        const timeoutId = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            this.logger.logTimeout(library || 'unknown', url, elapsed, attempt);
            console.error(`[fetchDirect] TIMEOUT: Request timed out after ${elapsed}ms (configured timeout: ${timeout}ms) for ${library || 'unknown'} library: ${url}`);
            controller.abort();
        }, timeout);

        // Chain external signal if provided
        const externalSignal = options.signal;
        if (externalSignal) {
            const abortListener = () => {
                console.log(`[fetchDirect] External signal aborted for ${url}`);
                controller.abort();
            };
            externalSignal.addEventListener('abort', abortListener);

            // Clean up listener when our controller aborts
            controller.signal.addEventListener('abort', () => {
                externalSignal.removeEventListener('abort', abortListener);
            });
        }

        // Special headers for ISOS to avoid 403 Forbidden errors
        let headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...(options.headers as Record<string, string> || {})
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
            } as any;
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
            } as any;
        }
        
        // Special headers for Florence ContentDM to avoid 403 Forbidden errors
        if (url.includes('cdm21059.contentdm.oclc.org')) {
            headers = {
                ...headers,
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'DNT': '1'
            } as any;
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
            } as any;
        }

        // Special headers for University of Graz to improve IIIF compatibility
        if (url.includes('unipub.uni-graz.at')) {
            headers = {
                ...headers,
                'Referer': 'https://unipub.uni-graz.at/',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            } as any;
        }

        // Special headers for BNE to ensure PDF downloads work properly
        if (url.includes('bdh-rd.bne.es')) {
            headers = {
                ...headers,
                'Referer': 'https://bdh-rd.bne.es/',
                'Accept': 'application/pdf,*/*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            } as any;
        }

        // Special headers for Rouen Municipal Library to ensure session management
        if (url.includes('rotomagus.fr')) {
            // Extract manuscript ID and page number for proper referer
            const arkMatch = url.match(/ark:\/12148\/([^/?\s]+)/);
            const pageMatch = url.match(/f(\d+)\./);

            if (arkMatch && pageMatch) {
                const manuscriptId = arkMatch[1];
                const pageNumber = pageMatch[1];
                const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNumber}.item.zoom`;

                headers = {
                    ...headers,
                    'Referer': refererUrl,
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                } as any;
            } else {
                // Fallback for non-image URLs (manifest, etc.)
                headers = {
                    ...headers,
                    'Referer': 'https://www.rotomagus.fr/',
                    'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
                } as any;
            }
        }

        try {
            // SSL-tolerant fetching for Verona domains with certificate hostname mismatch
            const fetchOptions: RequestInit & { rejectUnauthorized?: boolean } = {
                ...options,
                signal: controller.signal,
                headers
            };

            // Verona, Grenoble, Graz, MDC Catalonia, Florence, and BNE domains benefit from full HTTPS module bypass for better reliability  
            // NOTE: Rome REMOVED from fetchWithHTTPS due to server hanging issues - now uses simpler fetchDirect
            if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') ||
                url.includes('pagella.bm-grenoble.fr') || url.includes('unipub.uni-graz.at') ||
                url.includes('mdc.csuc.cat') || url.includes('cdm21059.contentdm.oclc.org') ||
                url.includes('bdh-rd.bne.es')) {
                try {
                    const response = await this.fetchWithHTTPS(url, fetchOptions);
                    if (timeoutId) clearTimeout(timeoutId);
                    return response;
                } catch (httpsError: unknown) {
                    // For Verona, if main site fails, try IIIF server directly
                    const errorCode = (httpsError as { code?: string })?.code;
                    if ((url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) &&
                        (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED')) {
                        console.warn(`[Verona] Primary connection failed with ${errorCode}, attempting IIIF server fallback`);

                        // If it's the main site, try the IIIF server
                        if (url.includes('nuovabibliotecamanoscritta.it')) {
                            const altUrl = url.replace('www.nuovabibliotecamanoscritta.it', 'nbm.regione.veneto.it');
                            const response = await this.fetchWithHTTPS(altUrl, fetchOptions);
                            if (timeoutId) clearTimeout(timeoutId);
                            return response;
                        }
                    }
                    throw httpsError;
                }
            }

            const response = await fetch(url, fetchOptions);
            if (timeoutId) clearTimeout(timeoutId);

            const elapsed = Date.now() - startTime;

            // Log response headers for debugging
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            if (DEBUG_LOGS) {
                this.logger.log({
                    level: 'debug',
                    library: library || 'unknown',
                    url,
                    message: `Response received - Status: ${response.status}, Time: ${elapsed}ms`,
                    duration: elapsed,
                    details: {
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders,
                        attempt
                    }
                });
            }

            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                const size = contentLength ? parseInt(contentLength, 10) : 0;
                
                // Record successful request metrics
                networkResilienceService.recordRequestMetrics(urlObj.hostname, elapsed, true);
                networkResilienceService.recordSuccess(library);
                
                this.logger.logDownloadComplete(library || 'unknown', url, elapsed, size);
            }

            return response;
        } catch (error: unknown) {
            if (timeoutId) clearTimeout(timeoutId);

            const elapsed = Date.now() - startTime;
            const errorAsError = error as Error;
            
            // Record metrics and handle circuit breaker
            networkResilienceService.recordRequestMetrics(urlObj.hostname, elapsed, false);
            networkResilienceService.recordFailure(library, errorAsError);
            
            // Classify the error for better user experience
            const errorClassification = networkResilienceService.classifyNetworkError(errorAsError);
            
            // Enhanced error logging with classification
            this.logger.logDownloadError(library || 'unknown', url, errorAsError, attempt);
            this.logger.log({
                level: 'error',
                library: library || 'unknown',
                url,
                message: `Network error classified as ${errorClassification.category}: ${errorClassification.userMessage}`,
                duration: elapsed,
                details: {
                    errorCode: (errorAsError as any)?.code,
                    errorMessage: errorAsError.message,
                    classification: errorClassification,
                    attempt,
                    circuitBreakerState: networkResilienceService.getCircuitBreakerStatus(library)
                }
            });
            
            console.error(`[fetchDirect] ERROR after ${elapsed}ms for ${url}:`, error);
            console.log(`[fetchDirect] Error classification: ${errorClassification.category} - ${errorClassification.suggestedAction}`);

            throw error;
        }
    }

    /**
     * Specialized fetch for Verona domains using native HTTPS module
     * This fixes SSL certificate validation issues with Node.js fetch API
     */
    private async fetchWithHTTPS(url: string, options: RequestInit & { rejectUnauthorized?: boolean } = {}): Promise<Response> {
        // ULTRA-PRIORITY FIX: Sanitize URL before any processing
        url = this.sanitizeUrl(url);

        const https = await import('https');
        const { URL } = await import('url');
        const dns = await import('dns').then(m => m.promises);

        // ULTRA-CRITICAL FIX for Issue #13: Additional defensive URL parsing
        // Catch cases where hostname might be concatenated with URL
        let urlObj;
        try {
            urlObj = new URL(url);

            // Double-check hostname doesn't contain URL parts
            if (urlObj.hostname.includes('://') || urlObj.hostname.includes('https') || urlObj.hostname.includes('http')) {
                console.error(`[CRITICAL] Malformed URL detected after URL parsing: hostname=${urlObj.hostname}, url=${url}`);
                // Try to extract the real URL from the malformed string
                const realUrlMatch = url.match(/(https?:\/\/[^\s]+)/);
                if (realUrlMatch) {
                    url = realUrlMatch[1] || url;
                    urlObj = new URL(url);
                    console.log(`[CRITICAL] Recovered correct URL: ${url}`);
                } else {
                    throw new Error(`Cannot parse malformed URL: ${url}`);
                }
            }
        } catch (urlError: unknown) {
            console.error(`[CRITICAL] URL parsing failed for: ${url}`);
            console.error(`[CRITICAL] Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`);

            // Last resort: try to extract valid URL from error-prone string
            const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                url = urlMatch[1] || url;
                urlObj = new URL(url);
                console.log(`[CRITICAL] Recovered URL from parsing error: ${url}`);
            } else {
                throw urlError;
            }
        }
        const library = this.detectLibraryFromUrl(url);

        comprehensiveLogger.logNetworkRequest(url, {
            method: options.method || 'GET',
            headers: options.headers as Record<string, string> | undefined,
            library,
            timeout: (options as any).timeout
        });

        // Special handling for Graz to resolve ETIMEDOUT issues
        if (url.includes('unipub.uni-graz.at')) {
            const dnsStartTime = Date.now();
            try {
                // Pre-resolve DNS to avoid resolution timeouts
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                    comprehensiveLogger.log({
                        level: 'debug',
                        category: 'network',
                        library: 'Graz',
                        url,
                        dnsLookupTime: Date.now() - dnsStartTime,
                        details: {
                            message: 'DNS pre-resolution successful',
                            hostname: urlObj.hostname,
                            addresses
                        }
                    });
                }
            } catch (dnsError: unknown) {
                console.warn(`[Graz] DNS resolution failed, proceeding anyway:`, dnsError);
                comprehensiveLogger.log({
                    level: 'warn',
                    category: 'network',
                    library: 'Graz',
                    url,
                    dnsLookupTime: Date.now() - dnsStartTime,
                    errorCode: (dnsError as any)?.code,
                    errorMessage: dnsError instanceof Error ? dnsError.message : String(dnsError),
                    details: {
                        message: 'DNS pre-resolution failed, proceeding anyway',
                        hostname: urlObj.hostname
                    }
                });
            }
        }

        // Special handling for Grenoble to resolve DNS issues
        if (url.includes('pagella.bm-grenoble.fr')) {
            try {
                // ULTRA-DEFENSIVE: Validate hostname before DNS lookup
                let hostname = urlObj.hostname;

                // CRITICAL FIX for Issue #13: Additional hostname validation
                if (hostname.includes('://') || hostname.includes('https') || hostname.includes('http')) {
                    console.error(`[Grenoble] CRITICAL: Malformed hostname detected: ${hostname}`);
                    console.error(`[Grenoble] Full URL was: ${url}`);

                    // Try to extract clean hostname
                    const cleanMatch = hostname.match(/^([a-z0-9.-]+?)(?:https?|\/\/|$)/i);
                    if (cleanMatch && cleanMatch[1]) {
                        hostname = cleanMatch[1];
                    } else {
                        // Skip DNS resolution if hostname is invalid
                        console.error(`[Grenoble] Cannot extract valid hostname, skipping DNS resolution`);
                        throw new Error(`[Grenoble] Cannot extract valid hostname from URL: ${url}`);
                    }
                }

                // Additional validation: hostname should not be too long or contain invalid chars
                if (hostname.length > 253 || !/^[a-z0-9.-]+$/i.test(hostname)) {
                    console.error(`[Grenoble] Invalid hostname format: ${hostname}`);
                    throw new Error(`[Grenoble] Invalid hostname format: ${hostname}`);
                }

                // Pre-resolve DNS to avoid EAI_AGAIN errors
                const addresses = await dns.resolve4(hostname);
                if (addresses.length > 0) {
                }
            } catch (dnsError: unknown) {
                console.warn(`[Grenoble] DNS resolution failed, proceeding anyway:`, dnsError instanceof Error ? dnsError instanceof Error ? dnsError.message : String(dnsError) : String(dnsError));

                // Log detailed error for debugging Issue #13
                const errorWithCode = dnsError as { code?: string };
                if (errorWithCode?.code === 'EAI_AGAIN' || errorWithCode?.code === 'ENOTFOUND') {
                    console.error(`[Grenoble] DNS Error Details:`);
                    console.error(`  - Error Code: ${errorWithCode.code}`);
                    console.error(`  - Hostname attempted: ${urlObj.hostname}`);
                    console.error(`  - Original URL: ${url}`);
                    console.error(`  - Sanitized URL: ${this.sanitizeUrl(url)}`);
                }
            }
        }

        // Special handling for Florence to resolve ETIMEDOUT issues
        if (url.includes('cdm21059.contentdm.oclc.org')) {
            try {
                // Pre-resolve DNS to avoid resolution timeouts
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                }
            } catch (dnsError) {
                console.warn(`[Florence] DNS resolution failed, proceeding anyway:`, dnsError);
            }
        }

        // Special handling for Verona to resolve ETIMEDOUT issues
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
            try {
                // Pre-resolve DNS to avoid resolution timeouts
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                }
            } catch (dnsError) {
                console.warn(`[Verona] DNS resolution failed, proceeding anyway:`, dnsError);
            }
        }

        // Special handling for Rome National Library to resolve socket timeout issues
        if (url.includes('digitale.bnc.roma.sbn.it')) {
            const dnsStartTime = Date.now();
            try {
                // Pre-resolve DNS to avoid resolution timeouts
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                    comprehensiveLogger.log({
                        level: 'debug',
                        category: 'network',
                        library: 'Rome',
                        url,
                        dnsLookupTime: Date.now() - dnsStartTime,
                        details: {
                            message: 'DNS pre-resolution successful',
                            hostname: urlObj.hostname,
                            addresses
                        }
                    });
                }
            } catch (dnsError: unknown) {
                console.warn(`[Rome] DNS resolution failed, proceeding anyway:`, dnsError);
                comprehensiveLogger.log({
                    level: 'warn',
                    category: 'network',
                    library: 'Rome',
                    url,
                    dnsLookupTime: Date.now() - dnsStartTime,
                    errorCode: (dnsError as any)?.code,
                    errorMessage: dnsError instanceof Error ? dnsError.message : String(dnsError),
                    details: {
                        message: 'DNS pre-resolution failed, proceeding anyway',
                        hostname: urlObj.hostname
                    }
                });
            }
        }

        // Special handling for MDC Catalonia to resolve timeout issues
        if (url.includes('mdc.csuc.cat')) {
            const dnsStartTime = Date.now();
            try {
                // Pre-resolve DNS to avoid resolution timeouts
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                    comprehensiveLogger.log({
                        level: 'debug',
                        category: 'network',
                        library: 'MDC Catalonia',
                        url,
                        dnsLookupTime: Date.now() - dnsStartTime,
                        details: {
                            message: 'DNS pre-resolution successful',
                            hostname: urlObj.hostname,
                            addresses
                        }
                    });
                }
            } catch (dnsError: unknown) {
                console.warn(`[MDC Catalonia] DNS resolution failed, proceeding anyway:`, dnsError);
                comprehensiveLogger.log({
                    level: 'warn',
                    category: 'network',
                    library: 'MDC Catalonia',
                    url,
                    dnsLookupTime: Date.now() - dnsStartTime,
                    errorCode: (dnsError as any)?.code,
                    errorMessage: dnsError instanceof Error ? dnsError.message : String(dnsError),
                    details: {
                        message: 'DNS pre-resolution failed, proceeding anyway',
                        hostname: urlObj.hostname
                    }
                });
            }
        }

        // Create agent with connection pooling for Graz, Florence, Verona, and Rome
        const agent = (url.includes('unipub.uni-graz.at') || url.includes('cdm21059.contentdm.oclc.org') ||
                      url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') ||
                      url.includes('digitale.bnc.roma.sbn.it')) ?
            new https.Agent({
                keepAlive: true,
                keepAliveMsecs: url.includes('cdm21059.contentdm.oclc.org') ? 60000 : 1000, // Florence: longer keep-alive for stability
                maxSockets: url.includes('cdm21059.contentdm.oclc.org') ? 3 : 10, // Florence: reduce concurrent connections to avoid overwhelming server
                maxFreeSockets: url.includes('cdm21059.contentdm.oclc.org') ? 1 : 5, // Florence: minimal free sockets to reduce server load
                timeout: url.includes('digitale.bnc.roma.sbn.it') ? 15000 : 
                        url.includes('cdm21059.contentdm.oclc.org') ? 60000 : 120000, // Florence: 60s timeout for faster recovery
                rejectUnauthorized: false,
                scheduling: url.includes('cdm21059.contentdm.oclc.org') ? 'fifo' : undefined // Florence: predictable connection scheduling
            }) : undefined;

        // ULTRA-DEFENSIVE: Final hostname validation
        const hostname = urlObj.hostname;
        if (hostname.includes('://') || hostname.includes('https')) {
            const error = new Error(`Invalid hostname detected: ${hostname}. URL: ${url}`);
            comprehensiveLogger.log({
                level: 'error',
                category: 'network',
                library,
                url,
                errorCode: 'INVALID_HOSTNAME',
                errorMessage: (error as Error).message,
                details: {
                    hostname,
                    url
                }
            });
            throw error;
        }

        const methodUpper = (options.method || 'GET').toUpperCase();
        const requestTimeout = ((options as any).timeout && typeof (options as any).timeout === 'number')
                    ? (options as any).timeout
                    : (url.includes('unipub.uni-graz.at') ? 120000 :
                       (url.includes('digitale.bnc.roma.sbn.it') ? 15000 : // Rome responds instantly - 15s is plenty
                       (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) ? 60000 : 30000));
        
        // For lightweight HEAD requests (probes), keep a strict cap to avoid 30s stalls
        const effectiveTimeout = methodUpper === 'HEAD' ? Math.min(requestTimeout, 5000) : requestTimeout;
        
        // ContentDM Florence specific headers to prevent 403 errors
        const baseHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        };

        // Add ContentDM-specific headers for Florence manuscripts to prevent 403 errors
        if (url.includes('cdm21059.contentdm.oclc.org')) {
            Object.assign(baseHeaders, {
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'DNT': '1',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
            });
        }

        const requestOptions = {
            hostname: hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                ...baseHeaders,
                ...(options.headers as Record<string, string> || {})
            },
            rejectUnauthorized: false,
            // Use connection pooling agent for Graz
            agent: agent
        };

        // Implement retry logic for connection timeouts
        const maxRetries = url.includes('unipub.uni-graz.at') ? 5 :
                         (url.includes('digitale.bnc.roma.sbn.it') ? 3 : // Rome needs retries for socket issues
                         (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) ? 3 : 1);
        let retryCount = 0;
        const overallStartTime = Date.now(); // Track total time from first attempt

        const attemptRequest = (): Promise<Response> => {
            return new Promise((resolve, reject) => {
                const attemptStartTime = Date.now();
                const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';
                if (DEBUG_LOGS) console.log(`[fetchWithHTTPS] Attempt ${retryCount + 1}/${maxRetries} for ${urlObj.hostname}`);

                const req = https.request(requestOptions, (res) => {
                const chunks: Buffer[] = [];
                let lastDataTime = Date.now();
                let totalBytes = 0;
                let progressTimer: NodeJS.Timeout;

                // Smart timeout: Monitor if data is still flowing
                const PROGRESS_CHECK_INTERVAL = 10000; // Check every 10 seconds
                const STALL_TIMEOUT = 30000; // Timeout if no data for 30 seconds
                const initialTimeout = effectiveTimeout;

                // Clear any existing timeout
                const clearProgressTimer = () => {
                    if (progressTimer) {
                        clearTimeout(progressTimer);
                    }
                };

                // Setup progress monitoring
                const setupProgressMonitor = () => {
                    if (methodUpper === 'HEAD') return; // No progress monitoring for HEAD
                    clearProgressTimer();
                    progressTimer = setTimeout(() => {
                        const timeSinceLastData = Date.now() - lastDataTime;
                        if (timeSinceLastData > STALL_TIMEOUT) {
                            req.destroy();
                            const stallError = new Error(`Download stalled - no data received for ${STALL_TIMEOUT / 1000} seconds (downloaded ${totalBytes} bytes)`);
                            comprehensiveLogger.log({
                                level: 'error',
                                category: 'network',
                                library,
                                url,
                                errorMessage: stallError.message,
                                bytesTransferred: totalBytes,
                                duration: Date.now() - attemptStartTime,
                                details: {
                                    message: 'Download stalled',
                                    stallDuration: timeSinceLastData,
                                    bytesReceived: totalBytes
                                }
                            });
                            reject(stallError);
                        } else {
                            // Still receiving data, continue monitoring
                            if (DEBUG_LOGS) console.log(`[fetchWithHTTPS] Download in progress: ${totalBytes} bytes received, last data ${Math.round(timeSinceLastData / 1000)}s ago`);
                            setupProgressMonitor();
                        }
                    }, PROGRESS_CHECK_INTERVAL);
                };

                // Initial timeout for connection establishment
                const connectionTimer = setTimeout(() => {
                    if (totalBytes === 0) {
                        req.destroy();
                        const timeoutError = new Error(`Connection timeout - no response after ${initialTimeout / 1000} seconds`);
                        comprehensiveLogger.logTimeout(url, initialTimeout, {
                            library,
                            attemptNumber: retryCount + 1,
                            bytesReceived: 0
                        });
                        reject(timeoutError);
                    }
                }, initialTimeout);

                res.on('data', (chunk) => {
                    chunks.push(chunk);
                    totalBytes += chunk.length;
                    lastDataTime = Date.now();

                    // Clear connection timer once we start receiving data
                    if (totalBytes === chunk.length) {
                        clearTimeout(connectionTimer);
                        setupProgressMonitor();
                    }
                });

                res.on('end', async () => {
                    clearTimeout(connectionTimer);
                    clearProgressTimer();

                    let body = Buffer.concat(chunks);
                    const responseHeaders = new Headers();

                    const attemptDuration = Date.now() - attemptStartTime;
                    if (DEBUG_LOGS) console.log(`[fetchWithHTTPS] Download complete: ${totalBytes} bytes in ${Math.round(attemptDuration / 1000)}s`);

                    Object.entries(res.headers).forEach(([key, value]) => {
                        responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value || '');
                    });

                    // Handle content decompression
                    const contentEncoding = res.headers['content-encoding'];
                    if (contentEncoding) {
                        const zlib = await import('zlib');
                        try {
                            if (contentEncoding === 'gzip') {
                                body = zlib.gunzipSync(body);
                            } else if (contentEncoding === 'deflate') {
                                body = zlib.inflateSync(body);
                            } else if (contentEncoding === 'br') {
                                body = zlib.brotliDecompressSync(body);
                            }
                            // Remove content-encoding header after decompression
                            responseHeaders.delete('content-encoding');
                        } catch (decompressError) {
                            console.error(`Failed to decompress ${contentEncoding} content:`, decompressError);
                            // Continue with compressed body if decompression fails
                        }
                    }

                    const response = new Response(body, {
                        status: res.statusCode || 200,
                        statusText: res.statusMessage || 'OK',
                        headers: responseHeaders
                    });

                    comprehensiveLogger.logNetworkResponse(url, {
                        statusCode: res.statusCode || 200,
                        headers: Object.fromEntries(responseHeaders.entries()),
                        duration: Date.now() - attemptStartTime,
                        bytesReceived: totalBytes,
                        library
                    });

                    resolve(response);
                });

                res.on('error', (error) => {
                    clearTimeout(connectionTimer);
                    clearProgressTimer();
                    reject(error);
                });
            });

            req.on('error', (error: unknown) => {
                const attemptDuration = Date.now() - attemptStartTime;
                if (DEBUG_LOGS) console.log(`[fetchWithHTTPS] Request error after ${attemptDuration}ms:`, (error as any)?.code, (error as Error).message);

                comprehensiveLogger.logNetworkError(url, error, {
                    library,
                    attemptNumber: retryCount + 1,
                    duration: attemptDuration
                });

                // Handle connection timeouts with retry for Graz, Florence, Verona, and MDC Catalonia
                if ((url.includes('unipub.uni-graz.at') || url.includes('cdm21059.contentdm.oclc.org') ||
                     url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') ||
                     url.includes('mdc.csuc.cat')) &&
                    ((error as any)?.code === 'ETIMEDOUT' || (error as any)?.code === 'ECONNRESET' ||
                     (error as any)?.code === 'ENOTFOUND' || (error as any)?.code === 'ECONNREFUSED' ||
                     (error as any)?.code === 'ENETUNREACH' || (error as any)?.code === 'EHOSTUNREACH' ||
                     (error as any)?.code === 'EPIPE' || (error as any)?.code === 'ECONNABORTED') &&
                    retryCount < maxRetries - 1) {

                    retryCount++;
                    // More aggressive exponential backoff: 2s, 4s, 8s, 16s, 32s (max 30s)
                    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    const libraryName = url.includes('unipub.uni-graz.at') ? 'Graz' :
                                      url.includes('cdm21059.contentdm.oclc.org') ? 'Florence' :
                                      url.includes('mdc.csuc.cat') ? 'MDC Catalonia' :
                                      (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) ? 'Verona' : 'Unknown';
                    console.log(`[${libraryName}] Connection failed with ${(error as any)?.code}, retry ${retryCount}/${maxRetries - 1} in ${backoffDelay}ms...`);

                    setTimeout(() => {
                        attemptRequest().then(resolve).catch(reject);
                    }, backoffDelay);
                } else {
                    // Final error or non-retryable error
                    if ((error as any)?.code === 'ETIMEDOUT' && url.includes('unipub.uni-graz.at')) {
                        const totalTime = Math.round((Date.now() - overallStartTime) / 1000);
                        const actualTimeout = Math.round(requestTimeout / 1000);
                        reject(new Error(`University of Graz connection timeout after ${actualTimeout} seconds (${maxRetries} attempts over ${totalTime} seconds total). The server at ${urlObj.hostname} is not responding. This may be due to high server load or network issues. Please try again later or check if the manuscript is accessible at https://unipub.uni-graz.at/`));
                    } else if ((error as any)?.code === 'ETIMEDOUT' && url.includes('cdm21059.contentdm.oclc.org')) {
                        const totalTime = Math.round((Date.now() - overallStartTime) / 1000);
                        const actualTimeout = Math.round(requestTimeout / 1000);
                        reject(new Error(`Florence library (ContentDM) connection timeout after ${actualTimeout} seconds (${maxRetries} attempts over ${totalTime} seconds total). The server at ${urlObj.hostname} is not responding. This may be due to high server load or network issues. Please try again later or check if the manuscript is accessible at https://cdm21059.contentdm.oclc.org/`));
                    } else if ((error as any)?.code === 'ETIMEDOUT' && (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it'))) {
                        const totalTime = Math.round((Date.now() - overallStartTime) / 1000);
                        const actualTimeout = Math.round(requestTimeout / 1000);
                        reject(new Error(`Verona NBM connection timeout after ${actualTimeout} seconds (${maxRetries} attempts over ${totalTime} seconds total). The server at ${urlObj.hostname} is not responding. This may be due to high server load or network issues. Please try again later or check if the manuscript is accessible at https://www.nuovabibliotecamanoscritta.it/`));
                    } else if ((error as any)?.code === 'ETIMEDOUT' && url.includes('mdc.csuc.cat')) {
                        const totalTime = Math.round((Date.now() - overallStartTime) / 1000);
                        const actualTimeout = Math.round(requestTimeout / 1000);
                        reject(new Error(`MDC Catalonia connection timeout after ${actualTimeout} seconds (${maxRetries} attempts over ${totalTime} seconds total). The server at ${urlObj.hostname} is not responding. This may be due to high server load, network restrictions, or regional blocking. Please try again later or check if the manuscript is accessible at https://mdc.csuc.cat/`));
                    } else {
                        reject(error);
                    }
                }
            });

            // Add connection timeout handling
            req.on('timeout', () => {
                console.log(`[fetchWithHTTPS] Socket timeout for ${urlObj.hostname}`);
                req.destroy();
                const timeoutError = new Error('Socket timeout') as Error & { code: string };
                timeoutError.code = 'ETIMEDOUT';
                req.emit('error', timeoutError);
            });

            req.end();
        });
    };

    return attemptRequest();
    }

    /**
     * Load manifest for different library types
     */
    async loadManifest(originalUrl: string, _UNUSED_progressCallback?: (current: number, total: number, message?: string) => void): Promise<ManuscriptManifest> {
        const manifestStartTime = Date.now();
        
        // ULTRA-PRIORITY FIX for Issue #9: Sanitize URL at the earliest entry point
        originalUrl = this.sanitizeUrl(originalUrl);

        // Check cache first
        const cachedManifest = await this.manifestCache.get(originalUrl);
        if (cachedManifest) {
            return cachedManifest as unknown as ManuscriptManifest;
        }

        const library = this.detectLibrary(originalUrl);
        if (!library) {
            throw new Error(`Unsupported library for URL: ${originalUrl}`);
        }

        // Create manuscript context for logging
        const context: ManuscriptContext = {
            id: this.extractManuscriptId(originalUrl),
            library: library,
            url: originalUrl
        };

        // Log manifest loading start
        enhancedLogger.logManifestStart(context);

        let manifest: ManuscriptManifest;

        try {
            switch (library) {
                case 'nypl':
                    manifest = await this.loadLibraryManifest('nypl', originalUrl);
                    break;
                case 'morgan':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('morgan', originalUrl);
                    break;
                case 'gallica':
                    manifest = await this.loadLibraryManifest('gallica', originalUrl);
                    break;
                case 'grenoble':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('grenoble', originalUrl);
                    break;
                case 'karlsruhe':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('karlsruhe', originalUrl);
                    break;
                case 'manchester':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('manchester', originalUrl);
                    break;
                case 'munich':
                    // ROUTING: munich → MunichLoader (registered as 'munich')
                    // WHY: MunichLoader has 9x better performance + /full/max/ resolution vs SharedManifest basic implementation
                    // TESTED: 2024-08-21 with manuscripts: bsb00050763 (726 pages, 82ms vs 727ms SharedManifest)
                    manifest = await this.loadLibraryManifest('munich', originalUrl);
                    break;
                case 'norwegian':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('norwegian', originalUrl);
                    break;
                case 'unifr':
                    manifest = await this.loadLibraryManifest('unifr', originalUrl);
                    break;
                case 'vatlib':
                    // ROUTING FIX: Use dedicated VaticanLoader instead of basic SharedManifest
                    manifest = await this.loadLibraryManifest('vatican', originalUrl);
                    break;
                case 'cecilia':
                    manifest = await this.loadLibraryManifest('cecilia', originalUrl);
                    break;
                case 'irht':
                    manifest = await this.loadLibraryManifest('irht', originalUrl);
                    break;
                case 'loc':
                    manifest = await this.loadLibraryManifest('loc', originalUrl);
                    break;
                case 'dijon':
                    manifest = await this.loadLibraryManifest('dijon', originalUrl);
                    break;
                case 'laon':
                    manifest = await this.loadLibraryManifest('laon', originalUrl);
                    break;
                case 'durham':
                    manifest = await this.loadLibraryManifest('durham', originalUrl);
                    break;
                case 'sharedcanvas':
                    manifest = await this.loadLibraryManifest('sharedcanvas', originalUrl);
                    break;
                case 'saintomer':
                    manifest = await this.loadLibraryManifest('saintomer', originalUrl);
                    break;
                case 'ugent':
                    manifest = await this.loadLibraryManifest('ugent', originalUrl);
                    break;
                case 'bl':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('bl', originalUrl);
                    break;
                case 'florus':
                    manifest = await this.loadLibraryManifest('florus', originalUrl);
                    break;
                case 'unicatt':
                    manifest = await this.loadLibraryManifest('unicatt', originalUrl);
                    break;
                case 'cudl':
                    manifest = await this.loadLibraryManifest('cudl', originalUrl);
                    break;
                case 'trinity_cam':
                    manifest = await this.loadLibraryManifest('trinity_cam', originalUrl);
                    break;
                case 'toronto':
                    manifest = await this.loadLibraryManifest('toronto', originalUrl);
                    break;
                case 'isos':
                    manifest = await this.loadLibraryManifest('isos', originalUrl);
                    break;
                case 'mira':
                    manifest = await this.loadLibraryManifest('mira', originalUrl);
                    break;
                case 'arca':
                    try {
                        // Try IIIF manifest first (IIIF-ONLY manuscripts like fykkvnm8wkpd)
                        manifest = await this.sharedManifestAdapter.getManifestForLibrary('arca', originalUrl);
                    } catch (error: any) {
                        // If IIIF manifest returns 404, fall back to web parsing (WEB-ONLY manuscripts like md14nk323d72)
                        if (error.message && error.message.includes('404')) {
                            console.log(`[ARCA] IIIF manifest not found for ${originalUrl}, falling back to web parsing via IrhtLoader`);
                            manifest = await this.loadLibraryManifest('irht', originalUrl);
                        } else {
                            // Propagate other errors (network, auth, etc.)
                            throw error;
                        }
                    }
                    break;
                case 'rbme':
                    manifest = await this.loadLibraryManifest('rbme', originalUrl);
                    break;
                case 'parker':
                    manifest = await this.loadLibraryManifest('parker', originalUrl);
                    break;
                case 'manuscripta':
                    manifest = await this.loadLibraryManifest('manuscripta', originalUrl);
                    break;
                case 'internet_culturale':
                    manifest = await this.loadLibraryManifest('internet_culturale', originalUrl);
                    break;
                case 'graz':
                    // ROUTING FIX: Use dedicated GrazLoader instead of basic SharedManifest
                    manifest = await this.loadLibraryManifest('graz', originalUrl);
                    break;
                case 'hhu':
                    // ROUTING FIX: Use dedicated HhuLoader instead of basic SharedManifest
                    manifest = await this.loadLibraryManifest('hhu', originalUrl);
                    break;
                case 'bordeaux':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('bordeaux', originalUrl);
                    break;
                case 'bodleian':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('bodleian', originalUrl);
                    break;
                case 'heidelberg':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('heidelberg', originalUrl);
                    break;
                case 'bdl':
                    // ROUTING: bdl → BdlLoader (more comprehensive than SharedManifest implementation)
                    // WHY: BdlLoader properly handles IIIF URLs vs PDF URLs distinction
                    // TESTED: 2024-08-20 with manuscript 3903 - fixes infinite PDF download loops
                    manifest = await this.loadLibraryManifest('bdl', originalUrl);
                    break;
                case 'berlin':
                    // ROUTING: berlin → BerlinLoader (registered as 'berlin')
                    // WHY: BerlinLoader has 37x better performance + 3-attempt retry logic vs SharedManifest basic implementation
                    // TESTED: 2024-08-21 with manuscripts: PPN782404456 (302 pages, 97ms vs 3565ms SharedManifest)
                    manifest = await this.loadLibraryManifest('berlin', originalUrl);
                    break;
                case 'bne':
                    manifest = await this.loadLibraryManifest('bne', originalUrl);
                    break;
                case 'vatican':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('vatican', originalUrl);
                    break;
                case 'cambridge':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('cambridge', originalUrl);
                    break;
                case 'cologne':
                    manifest = await this.loadLibraryManifest('cologne', originalUrl);
                    break;
                case 'czech':
                    manifest = await this.loadLibraryManifest('czech', originalUrl);
                    break;
                case 'emanuscripta':
                    manifest = await this.loadLibraryManifest('emanuscripta', originalUrl);
                    break;
                case 'e_manuscripta':
                    manifest = await this.loadLibraryManifest('emanuscripta', originalUrl);
                    break;
                case 'florence':
                    manifest = await this.loadLibraryManifest('florence', originalUrl);
                    break;
                case 'modena':
                    manifest = await this.loadLibraryManifest('modena', originalUrl);
                    break;
                case 'rome':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('rome', originalUrl);
                    break;
                case 'fulda':
                    manifest = await this.loadLibraryManifest('fulda', originalUrl);
                    break;
                case 'vienna':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('vienna', originalUrl);
                    break;
                case 'bvpb':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('bvpb', originalUrl);
                    break;
                case 'europeana':
                    manifest = await this.loadLibraryManifest('europeana', originalUrl);
                    break;
                case 'montecassino':
                    manifest = await this.loadLibraryManifest('montecassino', originalUrl);
                    break;
                case 'vallicelliana':
                    manifest = await this.loadLibraryManifest('vallicelliana', originalUrl);
                    break;
                case 'omnesvallicelliana':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('omnesvallicelliana', originalUrl);
                    break;
                case 'verona':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('verona', originalUrl);
                    break;
                case 'diamm':
                    manifest = await this.loadLibraryManifest('diamm', originalUrl);
                    break;
                case 'mdc':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('mdc', originalUrl);
                    break;
                case 'mdc_catalonia':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('mdc_catalonia', originalUrl);
                    break;
                case 'onb':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('onb', originalUrl);
                    break;
                case 'rouen':
                    manifest = await this.loadLibraryManifest('rouen', originalUrl);
                    break;
                case 'freiburg':
                    manifest = await this.loadLibraryManifest('freiburg', originalUrl);
                    break;
                case 'wolfenbuettel':
                    manifest = await this.loadLibraryManifest('wolfenbuettel', originalUrl);
                    break;
                case 'gams':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('gams', originalUrl);
                    break;
                case 'generic_iiif':
                    manifest = await this.useLoaderOrFallback('generic_iiif', originalUrl, (url: string) => this.loadLibraryManifest('generic_iiif', url));
                    break;
                case 'linz':
                    // ROUTING FIX: Use dedicated LinzLoader instead of basic SharedManifest
                    manifest = await this.loadLibraryManifest('linz', originalUrl);
                    break;
                case 'digital_walters':
                    // ROUTING: digital_walters → DigitalWaltersLoader (registered as 'digital_walters')
                    // WHY: Digital Walters requires page count discovery and custom URL structure for sequential images
                    // TESTED: 2025-01-XX with manuscript W33 (584 pages via sequential image discovery)
                    manifest = await this.loadLibraryManifest('digital_walters', originalUrl);
                    break;
                case 'yale':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('yale', originalUrl);
                    break;
                case 'e_rara':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('e_rara', originalUrl);
                    break;
                case 'roman_archive':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('roman_archive', originalUrl);
                    break;
                case 'digital_scriptorium':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('digital_scriptorium', originalUrl);
                    break;
                case 'ambrosiana':
                    // ROUTING: ambrosiana → SharedManifestAdapter for Issue #54 support
                    // WHY: New library added by user request - using SharedManifest for initial implementation
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('ambrosiana', originalUrl);
                    break;
                case 'codices':
                    // ROUTING: codices → CodicesLoader (registered as 'codices')
                    // WHY: Codices (codices.at) uses standard IIIF v3 implementation with full resolution support
                    // TESTED: Standard IIIF implementation with manifest discovery and full/full/0/default.jpg resolution
                    manifest = await this.loadLibraryManifest('codices', originalUrl);
                    break;
                case 'vienna_manuscripta':
                    // ROUTING: vienna_manuscripta → ViennaManuscriptaLoader (registered as 'vienna')
                    // WHY: ViennaManuscriptaLoader has comprehensive IIIF + page discovery vs SharedManifest's 10-page limit
                    // TESTED: 2024-08-21 with https://manuscripta.at/diglit/AT5000-1013/0001 (343 pages via IIIF)
                    manifest = await this.loadLibraryManifest('vienna', originalUrl);
                    break;
                case 'monte_cassino':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('monte_cassino', originalUrl);
                    break;
                case 'omnes_vallicelliana':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('omnes_vallicelliana', originalUrl);
                    break;
                case 'iccu_api':
                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('iccu_api', originalUrl);
                    break;

                default:
                    throw new Error(`Unsupported library: ${library}`);
            }

            manifest.library = library as ManuscriptManifest['library'];
            manifest.originalUrl = originalUrl;

            // Update context with loaded manifest data
            context.title = manifest.displayName;
            context.totalPages = manifest.totalPages;
            context.estimatedSizeMB = this.calculateEstimatedSize(manifest);

            // Log successful manifest completion
            const manifestDuration = Date.now() - manifestStartTime;
            enhancedLogger.logManifestComplete(context, { duration: manifestDuration });

            // Cache the manifest
            await this.manifestCache.set(originalUrl, manifest as unknown as Record<string, unknown>);

            return manifest;

        } catch (error: unknown) {
            console.error(`Failed to load manifest: ${(error as Error).message}`);

            // Enhanced error handling for specific network issues
            if ((error as any)?.code === 'ETIMEDOUT' && originalUrl.includes('unipub.uni-graz.at')) {
                throw new Error(`University of Graz connection timeout. The server is not responding - this may be due to high load or network issues. Please try again later or check if the manuscript is accessible through the Graz website.`);
            }

            if ((error as any)?.code === 'ECONNRESET' && originalUrl.includes('unipub.uni-graz.at')) {
                throw new Error(`University of Graz connection was reset. The server closed the connection unexpectedly. Please try again in a few moments.`);
            }

            // Florence (ContentDM) specific ECONNRESET error handling
            if ((error as any)?.code === 'ECONNRESET' && originalUrl.includes('cdm21059.contentdm.oclc.org')) {
                throw new Error(`Florence library connection reset. The ContentDM server at cdm21059.contentdm.oclc.org closed the connection unexpectedly, likely due to high server load or maintenance. This is common with OCLC ContentDM systems during peak usage. Please try again in a few minutes when server load decreases.\n\nURL: ${originalUrl}\nError: ECONNRESET (Connection reset by peer)\n\n💡 Florence manuscripts are hosted on OCLC's ContentDM platform, which can experience high load. If this error persists, try:\n1. Wait 2-5 minutes for server load to decrease\n2. Check manuscript accessibility at https://cdm21059.contentdm.oclc.org/\n3. Try during off-peak hours (early morning or late evening European time)`);
            }

            // Florence (ContentDM) specific timeout error handling
            if (((error as any)?.code === 'ETIMEDOUT' || (error as Error).message?.includes('timeout')) && originalUrl.includes('cdm21059.contentdm.oclc.org')) {
                throw new Error(`Florence library connection timeout. The ContentDM server at cdm21059.contentdm.oclc.org is not responding within the timeout period, indicating high server load or network congestion. This is typical for OCLC ContentDM during peak hours.\n\nURL: ${originalUrl}\nError: ETIMEDOUT (Connection timeout)\n\n💡 Florence manuscripts are hosted on OCLC's ContentDM platform, which can experience high load. If this error persists, try:\n1. Wait 2-5 minutes for server load to decrease\n2. Check manuscript accessibility at https://cdm21059.contentdm.oclc.org/\n3. Try during off-peak hours (early morning or late evening European time)`);
            }

            if ((error as Error).message?.includes('timeout') && originalUrl.includes('unipub.uni-graz.at')) {
                throw new Error(`University of Graz request timed out. Large manuscripts may take longer to load - please try again with patience, as the system allows extended timeouts for Graz manuscripts.`);
            }

            throw error;
        }
    }

    /**
     * Download image with retries and proxy fallback
     */
    async downloadImageWithRetries(url: string, attempt = 0): Promise<DownloadResult> {
        const startTime = Date.now();
        const library = this.detectLibrary(url) as TLibrary;
        const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';

        // Debug logging for BDL detection
        if (url.includes('bdl.servizirl.it')) {
            console.log(`🔍 [BDL Detection] URL contains 'bdl.servizirl.it': ${url}`);
            console.log(`🔍 [BDL Detection] detectLibrary returned: '${library}'`);
            if (library !== 'bdl') {
                console.error(`❌ [BDL Detection] CRITICAL: Library detection FAILED! Expected 'bdl', got '${library}'`);
            }
        }

        // CRITICAL FIX v2: Intercept ALL BDL downloads, regardless of attempt number
        // Also check URL directly in case detectLibrary fails
        if (library === 'bdl' || url.includes('bdl.servizirl.it')) {
            console.log(`🔄 [BDL Ultra] Intercepting BDL download (attempt ${attempt}): ${url}`);

            // Force ultra-reliable mode for BDL - ignore config
            // const ultraMode = true; // Force enabled
            // const maxRetries = -1; // Force unlimited

            console.log(`🔥 [BDL Ultra] FORCED ULTRA MODE - Will retry forever until success`);
            comprehensiveLogger.log({
                level: 'info',
                category: 'bdl-ultra',
                library: 'bdl',
                url,
                message: `Using Ultra-Reliable BDL Service (attempt ${attempt}, forced unlimited retries)`,
                details: {
                    attempt,
                    forcedMode: true,
                    maxRetries: -1
                }
            });

            // Keep trying until we get a valid image
            let validBuffer: Buffer | null = null;
            let ultraAttempt = 0;

            while (!validBuffer) {
                ultraAttempt++;
                console.log(`🔁 [BDL Ultra] Ultra-attempt ${ultraAttempt} for ${url.substring(0, 100)}...`);

                const buffer = await this.ultraBDLService.ultraReliableDownload(
                    url,
                    attempt, // Use actual attempt number as page index hint
                    {
                        ultraReliableMode: true, // Force enabled
                        maxRetries: -1, // Force unlimited
                        maxQualityFallbacks: true,
                        proxyHealthCheck: ultraAttempt % 5 === 0, // Check every 5 attempts
                        persistentQueue: true,
                        pageVerificationSize: 10240, // 10KB minimum
                        minDelayMs: 2000,
                        maxDelayMs: 60000, // 1 minute max between attempts
                        globalTimeoutMs: 8 * 60 * 1000, // 8 minute timeout per page to prevent blocking
                        yieldToQueue: true // Allow other downloads to proceed if stuck
                    }
                );

                // Validate the buffer
                if (buffer && buffer.length >= 10240) { // At least 10KB
                    // Check for JPEG signature
                    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                        validBuffer = buffer;
                        console.log(`✅ [BDL Ultra] SUCCESS after ${ultraAttempt} ultra-attempts: ${buffer.length} bytes (valid JPEG)`);
                    } else {
                        console.warn(`⚠️ [BDL Ultra] Got ${buffer.length} bytes but not valid JPEG, retrying...`);
                    }
                } else {
                    const size = buffer ? buffer.length : 0;
                    console.warn(`⚠️ [BDL Ultra] Got only ${size} bytes (need 10KB+), retrying...`);
                }

                // If we didn't get a valid buffer, wait before retrying
                if (!validBuffer) {
                    const delay = Math.min(5000 * ultraAttempt, 60000); // Progressive delay up to 1 minute
                    console.log(`⏳ [BDL Ultra] Waiting ${delay}ms before ultra-attempt ${ultraAttempt + 1}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            console.log(`✅ [BDL Ultra] FINAL SUCCESS: Downloaded ${validBuffer.length} bytes after ${ultraAttempt} attempts`);
            // Detect file type for BDL ultra service results
            const fileType = detectFileType(null, validBuffer); // BDL typically returns images, but detect anyway
            return { buffer: validBuffer, fileType };
        }

        // Only log on first attempt to avoid duplicates with fetchDirect
        if (attempt === 0) {
            this.logger.log({
                level: 'info',
                library: library || 'unknown',
                url,
                message: `Starting image download`,
                attemptNumber: attempt + 1
            });
        }

        try {
            if (url.endsWith('.zif')) {
                const buffer = await this.downloadAndProcessZifFile(url, attempt);
                return { buffer, fileType: { extension: 'jpg', mimeType: 'image/jpeg', isImage: true } };
            }

            if (url.endsWith('.dzi')) {
                const buffer = await this.downloadAndProcessDziFile(url, attempt);
                return { buffer, fileType: { extension: 'jpg', mimeType: 'image/jpeg', isImage: true } };
            }

            // Use proxy fallback for libraries with connection issues or when direct access fails
            // Note: Internet Culturale removed from proxy list to fix authentication issues
            // BDL added due to IIIF server instability (60% connection failures)
            // University of Graz removed from proxy list to use library-specific timeout multiplier (2.0x)
            // Special handling for Norwegian content that may be geo-blocked
            const isNorwegianContent = url.includes('nb.no') || url.includes('api.nb.no');

            // For Norwegian content, always try proxy fallback due to geo-blocking
            if (isNorwegianContent && attempt === 0) {
                console.log('[Norwegian] Detected nb.no content - will use proxy fallback for geo-blocked images');
            }

            const needsProxyFallback = url.includes('digitallibrary.unicatt.it') ||
                                     isNorwegianContent ||  // Always use proxy for Norwegian content
                                     url.includes('bdl.servizirl.it');

            this.logger.log({
                level: 'debug',
                library: library || 'unknown',
                url,
                message: `Proxy fallback needed: ${needsProxyFallback}`,
                details: { needsProxyFallback, attempt: attempt + 1 }
            });

            let response: Response;
            try {
                response = needsProxyFallback
                    ? await this.fetchWithProxyFallback(url)
                    : await this.fetchDirect(url, {}, attempt + 1); // Pass attempt number for timeout calculation

                // MDC Catalonia: If 1000px resolution fails, try full resolution fallback
                if (url.includes('mdc.csuc.cat') && !response.ok && url.includes('/full/1000,/')) {
                    console.log(`MDC Catalonia: 1000px resolution failed (${response.status}), trying full resolution fallback`);
                    const fallbackUrl = url.replace('/full/1000,/', '/full/full/');
                    response = needsProxyFallback
                        ? await this.fetchWithProxyFallback(fallbackUrl)
                        : await this.fetchDirect(fallbackUrl, {}, attempt + 1);
                }
            } catch (fetchError: unknown) {
                // Enhanced error handling for BNC Roma infrastructure failures
                if (url.includes('digitale.bnc.roma.sbn.it')) {
                    const errorWithProps = fetchError as { name?: string; code?: string; message?: string };
                    if (errorWithProps.name === 'AbortError' || errorWithProps.code === 'ECONNRESET' ||
                        errorWithProps.code === 'ENOTFOUND' || errorWithProps.code === 'ECONNREFUSED' ||
                        errorWithProps.code === 'ETIMEDOUT' || errorWithProps.code === 'ENETUNREACH' ||
                        errorWithProps.message?.includes('timeout') || errorWithProps.message?.includes('ENETUNREACH')) {
                        throw new Error(`BNC Roma infrastructure failure: Cannot reach digitale.bnc.roma.sbn.it server. This appears to be a network infrastructure issue. Check www.bncrm.beniculturali.it for announcements or try again later.`);
                    }
                }

                // Enhanced error handling for MDC Catalonia network issues
                if (url.includes('mdc.csuc.cat')) {
                    const errorObj = fetchError as unknown as Error & { code?: string; name?: string };
                    const isNetworkError = errorObj.name === 'AbortError' ||
                                         errorObj.code === 'ECONNRESET' ||
                                         errorObj.code === 'ENOTFOUND' ||
                                         errorObj.code === 'ECONNREFUSED' ||
                                         errorObj.code === 'ETIMEDOUT' ||
                                         errorObj.code === 'ENETUNREACH' ||
                                         errorObj.message?.includes('timeout') ||
                                         errorObj.message?.includes('ECONNREFUSED') ||
                                         errorObj.message?.includes('ENETUNREACH');

                    if (isNetworkError) {
                        throw new Error(`MDC Catalonia network issue (attempt ${attempt}): Cannot reach mdc.csuc.cat servers. This appears to be a temporary connectivity issue. The server may be experiencing high load or network problems. Please try again later.`);
                    }
                }

                throw fetchError;
            }

            if (!response.ok) {
                this.logger.log({
                    level: 'error',
                    library: library || 'unknown',
                    url,
                    message: `HTTP error: ${response.status} ${response.statusText}`,
                    attemptNumber: attempt + 1,
                    details: { status: response.status, statusText: response.statusText }
                });

                // Enhanced error messages for BNC Roma HTTP errors
                if (url.includes('digitale.bnc.roma.sbn.it')) {
                    if (response.status === 500) {
                        throw new Error(`BNC Roma server error (HTTP 500): The image server is experiencing internal issues. This may be temporary - please try again.`);
                    } else if (response.status === 503) {
                        throw new Error(`BNC Roma service unavailable (HTTP 503): The image server is temporarily unavailable, possibly due to maintenance.`);
                    } else if (response.status === 404) {
                        throw new Error(`BNC Roma image not found (HTTP 404): The requested image may have been moved or the URL is incorrect.`);
                    } else if (response.status >= 500) {
                        throw new Error(`BNC Roma server error (HTTP ${response.status}): The image server is experiencing technical difficulties.`);
                    }
                }

                // Enhanced error messages for MDC Catalonia HTTP errors
                if (url.includes('mdc.csuc.cat')) {
                    if (response.status === 500) {
                        throw new Error(`MDC Catalonia server error (HTTP 500): The mdc.csuc.cat image server is experiencing internal issues. This may be temporary - please try again.`);
                    } else if (response.status === 503) {
                        throw new Error(`MDC Catalonia service unavailable (HTTP 503): The image server is temporarily unavailable, possibly due to maintenance.`);
                    } else if (response.status === 404) {
                        throw new Error(`MDC Catalonia image not found (HTTP 404): The requested image may have been moved or the URL structure has changed. Please verify the manuscript ID and page number.`);
                    } else if (response.status === 403) {
                        throw new Error(`MDC Catalonia access denied (HTTP 403): The image server is blocking this request. This may require authentication or the manuscript may have access restrictions.`);
                    } else if (response.status === 501) {
                        throw new Error(`MDC Catalonia resolution not supported (HTTP 501): The requested image resolution is not supported. Try a different resolution (full/full, full/max, full/800,).`);
                    } else if (response.status >= 500) {
                        throw new Error(`MDC Catalonia server error (HTTP ${response.status}): The mdc.csuc.cat server is experiencing technical difficulties.`);
                    }
                }

                // Enhanced error handling for Norwegian National Library geo-blocking
                if (url.includes('nb.no') && response.status === 403) {
                    const errorBody = await response.text().catch(() => '');
                    if (errorBody.includes('geo') || errorBody.includes('location') || errorBody.includes('Norway') || errorBody.includes('Norge')) {
                        throw new Error(`Norwegian National Library geo-blocking detected (HTTP 403): This content is only accessible from Norwegian IP addresses. \n\nPossible solutions:\n1. Use a VPN with Norwegian servers\n2. Access the content from within Norway\n3. Check if the manuscript has alternative access options\n4. Contact the Norwegian National Library for access permissions\n\nURL: ${url}`);
                    } else {
                        throw new Error(`Norwegian National Library access denied (HTTP 403): Access to this manuscript may be restricted. This could be due to:\n1. Geographic IP restrictions (Norwegian IP required)\n2. Authentication requirements\n3. Copyright or access restrictions\n\nPlease verify the manuscript's access policy at nb.no`);
                    }
                }
                
                // Enhanced error handling for Florence ContentDM 403 errors
                if (url.includes('cdm21059.contentdm.oclc.org') && response.status === 403) {
                    throw new Error(`Florence ContentDM access denied (HTTP 403): The ContentDM server is blocking this request. This is typically due to:\n1. Too many concurrent requests (rate limiting)\n2. Missing session/referer headers\n3. ContentDM security policies\n4. Temporary server restrictions\n\nThe download will retry automatically with enhanced headers and rate limiting. If the issue persists, try:\n1. Reducing concurrent downloads to 1-2\n2. Waiting a few minutes before retrying\n3. Checking if the manuscript requires authentication\n\nURL: ${url}`);
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            const elapsed = Date.now() - startTime;

            if (DEBUG_LOGS) {
                this.logger.log({
                    level: 'debug',
                    library: library || 'unknown',
                    url,
                    message: `Buffer downloaded - Size: ${buffer.byteLength} bytes, Time: ${elapsed}ms`,
                    duration: elapsed,
                    details: { size: buffer.byteLength, speedMbps: (buffer.byteLength / elapsed / 1024).toFixed(2) }
                });
            }

            if (buffer.byteLength < MIN_VALID_IMAGE_SIZE_BYTES) {
                this.logger.log({
                    level: 'error',
                    library: library || 'unknown',
                    url,
                    message: `Image too small: ${buffer.byteLength} bytes (min: ${MIN_VALID_IMAGE_SIZE_BYTES})`,
                    details: { size: buffer.byteLength, minSize: MIN_VALID_IMAGE_SIZE_BYTES }
                });
                throw new Error(`Image too small: ${buffer.byteLength} bytes`);
            }

            // Special validation for Internet Culturale to detect authentication error pages
            if (url.includes('internetculturale.it')) {
                await this.validateInternetCulturaleImage(buffer, url);
            }

            // Detect file type from response headers and buffer content
            const contentType = response.headers.get('content-type');
            const fileType = detectFileType(contentType, buffer);
            
            this.logger.log({
                level: 'debug',
                library: library || 'unknown',
                url,
                message: `File type detected: ${fileType.extension} (${fileType.mimeType})`,
                details: { 
                    detectedExtension: fileType.extension, 
                    isImage: fileType.isImage, 
                    contentTypeHeader: contentType 
                }
            });

            return { buffer, fileType };

        } catch (error: unknown) {
            const elapsed = Date.now() - startTime;
            this.logger.logDownloadError(library || 'unknown', url, error as Error, attempt + 1);
            console.error(`[downloadImageWithRetries] Error after ${elapsed}ms:`, (error as Error).message);

            const maxRetries = configService.get('maxRetries');
            if (attempt < maxRetries) {
                // BDL Quality Fallback: Try lower quality before retrying same quality
                if (url.includes('bdl.servizirl.it') && (url.includes('/full/max/') || url.includes('/full/full/'))) {
                    const qualityFallbacks = ['/full/2048,/', '/full/1024,/', '/full/512,/'];
                    const currentQuality = (url.includes('/full/max/') || url.includes('/full/full/')) ? 0 :
                                         url.includes('/full/2048,') ? 1 :
                                         url.includes('/full/1024,') ? 2 : 3;

                    if (currentQuality < qualityFallbacks.length) {
                        const fallbackUrl = url.replace(/\/full\/[^/]+\//, String(qualityFallbacks[currentQuality]));
                        console.log(`BDL quality fallback: ${url} -> ${fallbackUrl}`);
                        return this.downloadImageWithRetries(fallbackUrl, attempt);
                    }
                }

                // Check if library supports progressive backoff
                const retryLibrary = this.detectLibrary(url) as TLibrary;
                const useProgressiveBackoff = retryLibrary &&
                    LibraryOptimizationService.getOptimizationsForLibrary(retryLibrary).enableProgressiveBackoff;

                const delay = useProgressiveBackoff
                    ? LibraryOptimizationService.calculateProgressiveBackoff(
                        attempt + 1,
                        retryLibrary === 'roman_archive' ? 2000 : 
                        retryLibrary === 'florence' ? 1500 : 1000, // ContentDM requires longer delays
                        retryLibrary === 'roman_archive' ? 60000 : 
                        retryLibrary === 'florence' ? 45000 : 30000 // Florence needs extra recovery time
                    )
                    : this.calculateRetryDelay(attempt);

                this.logger.logRetry(retryLibrary || 'unknown', url, attempt + 2, delay);
                console.log(`[downloadImageWithRetries] Will retry - Library: ${retryLibrary}, Progressive backoff: ${useProgressiveBackoff}, Delay: ${delay}ms`);
                console.log(`Retrying ${url} (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms delay` +
                           (useProgressiveBackoff ? ' (progressive backoff)' : ''));

                await this.sleep(delay);
                return this.downloadImageWithRetries(url, attempt + 1);
            }

            const totalTime = Date.now() - startTime;
            this.logger.log({
                level: 'error',
                library: library || 'unknown',
                url,
                message: `FINAL FAILURE after ${maxRetries + 1} attempts`,
                attemptNumber: maxRetries + 1,
                duration: totalTime,
                errorStack: (error as any)?.stack
            });
            console.error(`[downloadImageWithRetries] FINAL FAILURE after ${maxRetries + 1} attempts for ${url}`);
            console.error(`[downloadImageWithRetries] Total time spent: ${totalTime}ms`);

            // Enhanced error message for Florence ContentDM 403 failures
            if (url.includes('cdm21059.contentdm.oclc.org')) {
                if ((error as Error).message.includes('403') || (error as Error).message.includes('Forbidden')) {
                    throw new Error(`Florence ContentDM access blocked: 403 Forbidden errors indicate the server detected bulk downloading patterns. This is often caused by requesting image sizes that exceed ContentDM's limits or downloading too quickly. The app now uses intelligent sizing (4000px max) and rate limiting (1.5s delays), but some manuscripts may still require manual intervention. Try reducing concurrent downloads to 1-2 and wait 5 minutes before retrying.`);
                }
            }

            // Enhanced error message for BNC Roma failures
            if (url.includes('digitale.bnc.roma.sbn.it')) {
                if ((error as Error).message.includes('BNC Roma infrastructure failure')) {
                    throw new Error(`BNC Roma complete failure: Server infrastructure is completely unreachable after ${maxRetries} attempts with progressive backoff. The digital library server appears to be offline. Check www.bncrm.beniculturali.it for service announcements or contact GARR support at cert@garr.it`);
                } else if ((error as Error).message.includes('BNC Roma server error')) {
                    throw new Error(`BNC Roma persistent server errors: Multiple server errors encountered after ${maxRetries} attempts. The digital library may be experiencing technical difficulties. Please try again later or contact BNC Roma support.`);
                }
            }

            throw new Error(`Failed after ${maxRetries} attempts: ${(error as Error).message}`);
        }
    }

    async downloadAndProcessZifFile(url: string, attempt = 0): Promise<ArrayBuffer> {
        // Calculate timeout based on attempt number (more time for retries)
        const baseTimeout = 300000; // 5 minutes base
        const timeoutMs = baseTimeout + (attempt * 120000); // +2 minutes per retry

        try {
            console.log(`Processing ZIF file: ${url} (attempt ${attempt + 1})`);

            // Use the dedicated ZIF processor with timeout protection
            const representativeImageBuffer = await this.zifProcessor.processZifFile(url);

            console.log(`ZIF processed successfully: ${(representativeImageBuffer.length / 1024 / 1024).toFixed(2)} MB high-quality image`);

            // Convert Buffer to ArrayBuffer for compatibility
            const arrayBuffer = new ArrayBuffer(representativeImageBuffer.length);
            const view = new Uint8Array(arrayBuffer);
            view.set(representativeImageBuffer);

            return arrayBuffer;

        } catch (error: unknown) {
            const maxRetries = configService.get('maxRetries');
            if (attempt < maxRetries) {
                const isTimeoutError = (error as Error).message.includes('timeout') || (error as Error).message.includes('timed out');
                const delay = isTimeoutError ? this.calculateRetryDelay(attempt) * 2 : this.calculateRetryDelay(attempt);

                console.log(`ZIF processing failed (attempt ${attempt + 1}/${maxRetries}): ${(error as Error).message}${isTimeoutError ? ' [TIMEOUT]' : ''}`);
                console.log(`Retrying ZIF processing in ${delay / 1000}s with ${timeoutMs / 1000}s timeout...`);

                await this.sleep(delay);
                return this.downloadAndProcessZifFile(url, attempt + 1);
            }

            // Provide more specific error message for timeout issues
            if ((error as Error).message.includes('timeout') || (error as Error).message.includes('timed out')) {
                throw new Error(`ZIF processing timed out after ${maxRetries + 1} attempts. This manuscript may be very large or the server may be overloaded. Please try again later.`);
            }

            throw new Error(`Failed to process ZIF file after ${maxRetries + 1} attempts: ${(error as Error).message}`);
        }
    }

    async downloadAndProcessDziFile(url: string, attempt = 0): Promise<ArrayBuffer> {
        // Calculate timeout based on attempt number (more time for retries)
        const baseTimeout = 300000; // 5 minutes base
        const timeoutMs = baseTimeout + (attempt * 120000); // +2 minutes per retry

        try {
            console.log(`Processing DZI file: ${url} (attempt ${attempt + 1})`);

            // Use the dedicated DZI processor with timeout protection
            const representativeImageBuffer = await this.dziProcessor.processDziImage(url);

            console.log(`DZI processed successfully: ${(representativeImageBuffer.length / 1024 / 1024).toFixed(2)} MB high-quality image`);

            // Convert Buffer to ArrayBuffer for compatibility
            const arrayBuffer = new ArrayBuffer(representativeImageBuffer.length);
            const view = new Uint8Array(arrayBuffer);
            view.set(representativeImageBuffer);

            return arrayBuffer;

        } catch (error: unknown) {
            const maxRetries = configService.get('maxRetries');
            if (attempt < maxRetries) {
                const isTimeoutError = (error as Error).message.includes('timeout') || (error as Error).message.includes('timed out');
                const delay = isTimeoutError ? this.calculateRetryDelay(attempt) * 2 : this.calculateRetryDelay(attempt);

                console.log(`DZI processing failed (attempt ${attempt + 1}/${maxRetries}): ${(error as Error).message}${isTimeoutError ? ' [TIMEOUT]' : ''}`);
                console.log(`Retrying DZI processing in ${delay / 1000}s with ${timeoutMs / 1000}s timeout...`);

                await this.sleep(delay);
                return this.downloadAndProcessDziFile(url, attempt + 1);
            }

            // Provide more specific error message for timeout issues
            if ((error as Error).message.includes('timeout') || (error as Error).message.includes('timed out')) {
                throw new Error(`DZI processing timed out after ${maxRetries + 1} attempts. This manuscript may be very large or the server may be overloaded. Please try again later.`);
            }

            throw new Error(`Failed to process DZI file after ${maxRetries + 1} attempts: ${(error as Error).message}`);
        }
    }

    /**
     * Download manuscript
     */
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

    async downloadManuscript(url: string, options: DownloadOptions = {}): Promise<string> {
        const {
            onProgress = () => {},
            onManifestLoaded = () => {},
            maxConcurrent = configService.get('maxConcurrentDownloads'),
            skipExisting = false,
            startPage,
            endPage,
            // NEW: Accept pre-processed data from queue
            pageLinks,
            displayName,
            library,
            totalPages,
            queueItem,
        } = options;

        const downloadStartTime = Date.now();
        let manifest: ManuscriptManifest | undefined;
        let filepath: string | undefined;
        let validImagePaths: string[] = [];
        let context: ManuscriptContext;

        try {
            // Use provided pageLinks if available, otherwise load manifest
            const manifestStartTime = Date.now();
            let manifestLoadDuration = 0;

            if (pageLinks && Array.isArray(pageLinks) && pageLinks.length > 0) {
                // Build manifest from pre-sliced data
                manifest = {
                    pageLinks: pageLinks,
                    totalPages: totalPages || pageLinks.length,
                    library: library || 'unknown',
                    displayName: displayName || 'manuscript',
                    originalUrl: url,
                    // Preserve any special metadata from queueItem
                    ...(queueItem?.partInfo ? { partInfo: queueItem.partInfo } : {}),
                    ...(queueItem?.tileConfig ? { tileConfig: queueItem.tileConfig } : {}),
                    ...(queueItem?.requiresTileProcessor ? { requiresTileProcessor: queueItem.requiresTileProcessor } : {}),
                } as ManuscriptManifest;
                const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';
                if (DEBUG_LOGS) console.log(`Using pre-sliced pageLinks for ${displayName}: ${pageLinks.length} pages`);
                manifestLoadDuration = Date.now() - manifestStartTime; // Minimal time
            } else {
                // Existing behavior: load manifest from URL
                manifest = await this.loadManifest(url);
                manifestLoadDuration = Date.now() - manifestStartTime;
            }

            // Validate special processor requirements
            if ((manifest as ManifestWithTileConfig).requiresTileProcessor && !(manifest as ManifestWithTileConfig).tileConfig) {
                throw new Error('Bordeaux manuscript requires tileConfig but none provided');
            }

            // Create manuscript context for enhanced logging
            context = {
                id: this.extractManuscriptId(url),
                title: manifest.displayName,
                library: manifest.library || 'unknown',
                url: url,
                totalPages: manifest.totalPages,
                estimatedSizeMB: this.calculateEstimatedSize(manifest)
            };

            // Log download start with enhanced information
            enhancedLogger.logDownloadStart(context);

            onManifestLoaded();

            // Get internal cache directory for temporary images
            const tempImagesDir = path.join(getAppPath('userData'), 'temp-images');

            // Ensure temporary images directory exists
            await fs.mkdir(tempImagesDir, { recursive: true });

            // Generate filename using filesystem-safe sanitization
            const nameWithId = this.buildDescriptiveName(manifest.displayName, url);
            const sanitizedName = nameWithId
                .replace(/[\u003c\u003e:"/\\|?*\x00-\x1f]/g, '_')  // Remove filesystem-unsafe and control characters
                .replace(/[\u00A0-\u9999]/g, '_')         // Replace Unicode special characters that may cause Windows issues
                .replace(/[^\w\s.-]/g, '_')               // Replace any remaining special characters except word chars, spaces, dots, hyphens
                .replace(/\s+/g, '_')                     // Replace spaces with underscores
                .replace(/_{2,}/g, '_')                   // Replace multiple underscores with single underscore
                .replace(/^_|_$/g, '')                    // Remove leading/trailing underscores
                .replace(/\.+$/g, '')                     // Remove trailing periods (Windows compatibility)
                .substring(0, 100) || 'manuscript';       // Limit to 100 characters with fallback

            // Calculate pages to download for splitting logic
            // When using pre-sliced pageLinks, pages are already selected
            const actualStartPage = pageLinks ? 1 : Math.max(1, startPage || manifest.startPageFromUrl || 1);
            const actualEndPage = pageLinks ? manifest.totalPages : Math.min(manifest.totalPages, endPage || manifest.totalPages);
            const totalPagesToDownload = actualEndPage - actualStartPage + 1;

            // Apply library-specific optimization settings early to get split threshold
            // This must happen before determining split logic to respect user settings
            const parsedMax = typeof maxConcurrent === 'string' ? parseInt(maxConcurrent, 10) : maxConcurrent;
            const globalMaxConcurrent = (Number.isFinite(parsedMax as number) && (parsedMax as number) > 0)
                ? (parsedMax as number)
                : (configService.get('maxConcurrentDownloads') || 3);
            const manifestLibrary = manifest.library as TLibrary;
            const globalAutoSplitThresholdMB = Math.round((configService.get('autoSplitThreshold') || 314572800) / (1024 * 1024)); // Convert bytes to MB, default 300MB
            const optimizations = LibraryOptimizationService.applyOptimizations(
                globalAutoSplitThresholdMB,
                globalMaxConcurrent,
                manifestLibrary
            );

            // Use library-specific or global split threshold
            // This respects user's configured split size (30MB, 100MB, etc)
            const autoSplitThresholdMB = optimizations.autoSplitThresholdMB;

            // Estimate average page size (conservative estimate: 500KB per page for high-quality images)
            // This is based on typical manuscript page sizes at high resolution
            const estimatedTotalSizeMB = (totalPagesToDownload * 0.5);

            // Determine if we need to split the PDF based on estimated size
            // Fixed: Was hardcoded to 1000 pages, now uses actual MB threshold
            const shouldSplit = estimatedTotalSizeMB > autoSplitThresholdMB;
            const maxPagesPerPart = Math.ceil((autoSplitThresholdMB * 2) / 1); // Pages per part based on threshold (assuming ~0.5MB per page)

            let filename: string;
            let filepath: string;

            // Final PDF goes to Downloads folder - always create a subfolder for each manuscript
            const downloadsDir = getAppPath('downloads');
            await fs.mkdir(downloadsDir, { recursive: true });

            // Always create a subfolder with the manuscript base name (strip part/page suffixes)
            // Check if this is an auto-split part BEFORE sanitization strips the page info
            const isAutoSplitPart = queueItem?.isAutoPart && sanitizedName.includes('_Part_') && sanitizedName.includes('_pages_');
            
            const folderBase = sanitizedName
                .replace(/_Part_\d+.*$/i, '')
                .replace(/_pages_\d+-\d+.*$/i, '');
            const targetDir = path.join(downloadsDir, folderBase || sanitizedName);
            await fs.mkdir(targetDir, { recursive: true });

            if (shouldSplit) {
                const partNumber = String(1).padStart(2, '0');
                filename = `${sanitizedName}_part_${partNumber}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                filepath = path.join(targetDir, filename);
            } else {
                if (isAutoSplitPart) {
                    // Auto-split part already has page range in name, just add .pdf
                    filename = `${sanitizedName}.pdf`;
                } else {
                    // Always include page numbers for clarity
                    filename = `${sanitizedName}_pages_${actualStartPage}-${actualEndPage}.pdf`;
                }
                filepath = path.join(targetDir, filename);
            }

            // Check if file exists
            if (skipExisting) {
                try {
                    await fs.access(filepath);
                    return filepath;
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
                const eta = rate > 0 ? Math.round((totalPagesToDownload - completedPages) / rate) : 0;
                onProgress({
                    totalPages: totalPagesToDownload,
                    downloadedPages: completedPages,
                    currentPage: completedPages,
                    totalImages: totalPagesToDownload,
                    downloadedImages: completedPages,
                    currentImageIndex: completedPages,
                    pagesProcessed: completedPages,
                    percentage: progress * 100,
                    progress: progress,
                    elapsedTime: elapsed,
                    estimatedTimeRemaining: eta,
                    eta: eta,
                    bytesDownloaded: 0,
                    bytesTotal: 0,
                    downloadSpeed: rate
                });
            };

            // ULTRA-PRIORITY FIX #9: Force parallel downloads for BDL
            // Override concurrency settings for BDL to improve performance
            let actualMaxConcurrent = optimizations.maxConcurrentDownloads
                ? Math.min(optimizations.maxConcurrentDownloads, globalMaxConcurrent || 3)
                : (globalMaxConcurrent || 3);

            // Special handling for BDL: use aggressive parallelism
            if (manifest.library === 'bdl') {
                actualMaxConcurrent = Math.min(10, manifest.pageLinks.length); // Up to 10 concurrent for BDL
                console.log(`🚀 [BDL Performance] Using ${actualMaxConcurrent} concurrent downloads for faster speed`);
            }

            // Validate actualMaxConcurrent to prevent "Invalid array length" error
            if (!Number.isInteger(actualMaxConcurrent) || actualMaxConcurrent <= 0 || !Number.isFinite(actualMaxConcurrent)) {
                console.warn(`Invalid maxConcurrentDownloads value: ${actualMaxConcurrent} (type: ${typeof actualMaxConcurrent}). Using default: 3`);
                actualMaxConcurrent = 3;
            }

            // Log optimization info for debugging
            if (optimizations.optimizationDescription) {
                const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';
                if (DEBUG_LOGS) {
                    console.log(`Applying ${library} optimizations: ${optimizations.optimizationDescription}`);
                    console.log(`Using ${actualMaxConcurrent} concurrent downloads (global: ${globalMaxConcurrent})`);
                }
            }

            const semaphore = new Array(actualMaxConcurrent).fill(null);
            let nextPageIndex = actualStartPage - 1; // Convert to 0-based index

            const downloadPage = async (pageIndex: number) => {
                // Fix for Bordeaux and other libraries: map page index to manifest array index
                // When using pre-sliced pageLinks, index directly
                const manifestIndex = pageLinks ? pageIndex : (pageIndex - (actualStartPage - 1));

                // Validate manifestIndex is within bounds
                if (manifestIndex < 0 || manifestIndex >= (manifest?.pageLinks?.length ?? 0)) {
                    console?.error(`Page index ${pageIndex + 1} (manifest index ${manifestIndex}) is out of bounds for manifest with ${manifest?.pageLinks?.length ?? 0} pages`);
                    failedPages.push(pageIndex + 1);
                    completedPages++;
                    updateProgress();
                    return;
                }

                let imageUrl = manifest?.pageLinks[manifestIndex];

                // Skip placeholder URLs (empty strings) used for missing pages
                if (!imageUrl || imageUrl === '') {
                    console.warn(`Skipping missing page ${pageIndex + 1}`);
                    completedPages++;
                    updateProgress();
                    return;
                }

                // Check if this manifest requires the DirectTileProcessor (Bordeaux)
                if ((manifest as ManifestWithTileConfig).requiresTileProcessor && (manifest as ManifestWithTileConfig).tileConfig) {
                    const imgFile = `${sanitizedName}_page_${pageIndex + 1}.jpg`;
                    const imgPath = path.join(tempImagesDir, imgFile);

                    try {
                        // Skip if already downloaded
                        await fs.access(imgPath);
                        // Store in array using relative index for proper array management
                        const relativeIndex = pageIndex - (actualStartPage - 1);
                        imagePaths[relativeIndex] = imgPath;
                        completedPages++;
                        updateProgress();
                        return;
                    } catch {
                        // Use DirectTileProcessor for Bordeaux
                        try {
                            const tileConfig = (manifest as ManifestWithTileConfig).tileConfig as TileConfig;
                            const pageNum = tileConfig.startPage + pageIndex;
                            console.log(`[Bordeaux] Processing page ${pageNum} using DirectTileProcessor`);

                            // Create a progress callback for tile downloads
                            const tileProgressCallback = (tilesDownloaded: number, totalTiles: number) => {
                                // Calculate sub-progress within this page
                                const pageProgress = tilesDownloaded / totalTiles;
                                const overallProgress = (completedPages + pageProgress) / totalPagesToDownload;

                                const elapsed = (Date.now() - startTime) / 1000;
                                const rate = (completedPages + pageProgress) / elapsed;
                                const eta = rate > 0 ? Math.round((totalPagesToDownload - completedPages - pageProgress) / rate) : 0;

                                onProgress({
                                    totalPages: totalPagesToDownload,
                                    downloadedPages: completedPages,
                                    currentPage: pageIndex + 1,
                                    totalImages: totalTiles,
                                    downloadedImages: tilesDownloaded,
                                    currentImageIndex: tilesDownloaded,
                                    pagesProcessed: completedPages,
                                    percentage: overallProgress * 100,
                                    progress: overallProgress,
                                    elapsedTime: elapsed,
                                    estimatedTimeRemaining: eta,
                                    eta: eta,
                                    bytesDownloaded: 0,
                                    bytesTotal: 0,
                                    downloadSpeed: rate
                                });
                            };

                            const result = await this.directTileProcessor.processPage(
                                tileConfig['baseId'] as string,
                                pageNum,
                                imgPath,
                                tileProgressCallback
                            );

                            if (result.success) {
                                // Store in array using relative index for proper array management
                        const relativeIndex = pageIndex - (actualStartPage - 1);
                        imagePaths[relativeIndex] = imgPath;
                                completedPages++;
                                updateProgress();
                                console.log(`[Bordeaux] Successfully processed page ${pageNum}`);
                            } else {
                                console.error(`[Bordeaux] Failed to process page ${pageNum}: ${result.error}`);
                                failedPages.push(pageIndex + 1);
                            }
                        } catch (error: unknown) {
                            console.error(`[Bordeaux] Error processing page ${pageIndex + 1}: ${(error as Error).message}`);
                            failedPages.push(pageIndex + 1);
                        }
                    }

                    return;
                }

                // Check if this is a tile-based system
                const isTileBased = await this.tileEngineService.isTileBasedUrl(imageUrl);
                if (isTileBased) {
                    const imgFile = `${sanitizedName}_page_${pageIndex + 1}.jpg`;
                    const imgPath = path.join(tempImagesDir, imgFile);

                    try {
                        // Skip if already downloaded
                        await fs.access(imgPath);
                        // Store in array using relative index for proper array management
                        const relativeIndex = pageIndex - (actualStartPage - 1);
                        imagePaths[relativeIndex] = imgPath;
                        completedPages++;
                        updateProgress();
                        return;
                    } catch {
                        // Not present: download using tile engine
                        try {
                            const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';
                            if (DEBUG_LOGS) console.log(`Downloading tile-based page ${pageIndex + 1} from ${imageUrl}`);

                            const tileCallbacks = this.tileEngineService.createProgressCallback(
                                (progress) => {
                                    // Update progress with tile download info
                                    const tileProgress = completedPages + ((progress as Record<string, unknown>)['percentage'] as number / 100);
                                    const elapsed = (Date.now() - startTime) / 1000;
                                    const rate = tileProgress / elapsed;
                                    const eta = rate > 0 ? Math.round((totalPagesToDownload - tileProgress) / rate) : 0;

                                    onProgress({
                                        progress: tileProgress / totalPagesToDownload,
                                        totalPages: totalPagesToDownload,
                                        downloadedPages: Math.floor(tileProgress),
                                        currentPage: pageIndex + 1,
                                        totalImages: totalPagesToDownload,
                                        downloadedImages: Math.floor(tileProgress),
                                        currentImageIndex: Math.floor(tileProgress),
                                        pagesProcessed: Math.floor(tileProgress),
                                        percentage: (tileProgress / totalPagesToDownload) * 100,
                                        elapsedTime: elapsed,
                                        estimatedTimeRemaining: eta,
                                        eta: eta,
                                        bytesDownloaded: 0,
                                        bytesTotal: 0,
                                        downloadSpeed: rate
                                    });
                                },
                                (status) => {
                                    console.log(`Tile download status: ${status['phase']} - ${status['message']}`);
                                }
                            );

                            const result = await this.tileEngineService.downloadTilesAndStitch(
                                imageUrl,
                                imgPath,
                                tileCallbacks
                            );

                            if (result.success) {
                                // Store in array using relative index for proper array management
                        const relativeIndex = pageIndex - (actualStartPage - 1);
                        imagePaths[relativeIndex] = imgPath;
                                completedPages++;
                                const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';
                                if (DEBUG_LOGS) console.log(`Successfully downloaded ${result.downloadedTiles} tiles for page ${pageIndex + 1}`);
                            } else {
                                console.error(`Failed to download tiles for page ${pageIndex + 1}: ${result.errors.join(', ')}`);
                                failedPages.push(pageIndex + 1);
                            }
                        } catch (error: unknown) {
                            console.error(`Tile download error for page ${pageIndex + 1}: ${(error as Error).message}`);
                            failedPages.push(pageIndex + 1);
                        }
                    }

                    updateProgress();
                    return;
                }

                // Handle lazy-loaded Florus pages
                if (imageUrl.startsWith('FLORUS_LAZY:')) {
                    const parts = imageUrl.split(':');
                    const cote = parts[1];
                    const pageNum = parseInt(parts[2] || '0');
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
                                const filename = imagePath!.substring(imagePath!.lastIndexOf('/') + 1);
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
                    } catch (error: unknown) {
                        console.error(`Failed to fetch lazy page ${pageNum}: ${(error as Error).message}`);
                        completedPages++;
                        updateProgress();
                        return;
                    }
                }

                try {
                    // Download first to determine actual file type
                    const downloadResult = await this.downloadImageWithRetries(imageUrl);
                    const { buffer, fileType } = downloadResult;
                    
                    // Create filename with correct extension based on detected file type
                    const imgFile = `${sanitizedName}_page_${pageIndex + 1}.${fileType.extension}`;
                    const imgPath = path.join(tempImagesDir, imgFile);
                    
                    // Check if file with correct extension already exists
                    let fileExists = false;
                    try {
                        await fs.access(imgPath);
                        fileExists = true;
                    } catch {
                        // File doesn't exist, we'll write it
                        fileExists = false;
                    }
                    
                    if (fileExists) {
                        // File already exists with correct extension - mark path for skipped file
                        imagePaths[pageIndex] = imgPath;
                        completedPages++; // Count cached files as completed
                        { const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1'; if (DEBUG_LOGS) console.log(`📋 Skipped existing file: ${imgFile} (${fileType.extension.toUpperCase()})`); }
                    } else {
                        // Write the file with detected extension
                        const writePromise = fs.writeFile(imgPath, Buffer.from(buffer));
                        writePromises.push(writePromise);
                        
                        // Store in array using relative index for proper array management
                        const relativeIndex = pageIndex - (actualStartPage - 1);
                        imagePaths[relativeIndex] = imgPath;
                        completedPages++; // Only increment on successful download
                        
                        { const DEBUG_LOGS = ((configService.get('logLevel') || 'info') === 'debug') || process.env.MSSDL_DEBUG === '1';
                          const PAGE_LOG_INTERVAL = configService.get('pageLogInterval') || 50;
                          if (DEBUG_LOGS || ((relativeIndex + 1) % PAGE_LOG_INTERVAL === 0) || (pageIndex + 1 === actualEndPage)) {
                              console.log(`💾 Downloaded: ${imgFile} (${fileType.extension.toUpperCase()}, ${fileType.mimeType})`);
                          }
                        }
                        
                        // RATE LIMITING: Add delay after successful Rome downloads to prevent server blocking
                        if (library === 'rome') {
                            const rateLimit = LibraryOptimizationService.getOptimizationsForLibrary('rome');
                            if (rateLimit.enableProgressiveBackoff) {
                                const delay = 500; // 500ms delay between Rome downloads
                                console.log(`[Rome] Rate limiting: waiting ${delay}ms before next download...`);
                                await this.sleep(delay);
                            }
                        }
                        
                        // Rate limiting for Roman Archive IIPImage server
                        if (library === 'roman_archive') {
                            const rateLimit = LibraryOptimizationService.getOptimizationsForLibrary('roman_archive');
                            if (rateLimit.enableProgressiveBackoff) {
                                const delay = 1000; // 1 second delay between Roman Archive downloads
                                console.log(`[Roman Archive] Rate limiting: waiting ${delay}ms before next download...`);
                                await this.sleep(delay);
                            }
                        }
                        
                        // Rate limiting for Florence ContentDM server to prevent 403 errors
                        if (library === 'florence') {
                            const florenceOpts = LibraryOptimizationService.getOptimizationsForLibrary('florence');
                            if (florenceOpts.requestDelayMs) {
                                console.log(`[Florence ContentDM] Rate limiting: waiting ${florenceOpts.requestDelayMs}ms before next download to prevent 403 errors...`);
                                await this.sleep(florenceOpts.requestDelayMs);
                            }
                        }
                    }
                } catch (error: unknown) {
                    console.error(`\n❌ Failed to download page ${pageIndex + 1}: ${(error as Error).message}`);
                    // Track failed page
                    failedPages.push(pageIndex + 1);
                    // Don't mark path for failed downloads
                    // Don't increment completedPages for failures
                }
                updateProgress();
            };

            // Download pages with proper concurrency control
            // Each element in semaphore array represents a worker that downloads pages
            await Promise.all(semaphore.map(async () => {
                // Fixed: Loop condition was comparing 0-based index with 1-based page number
                // actualEndPage is 1-based (e.g., 600 for last page)
                // nextPageIndex is 0-based (0-599 for 600 pages)
                // So we need to compare with actualEndPage - 1
                while (nextPageIndex <= actualEndPage - 1) {
                    const idx = nextPageIndex++;
                    await downloadPage(idx);
                }
            }));

            // Wait for all file writes to complete before processing
            await Promise.all(writePromises);

            // Ensure final progress update
            onProgress({
                totalPages: totalPagesToDownload,
                downloadedPages: totalPagesToDownload,
                currentPage: totalPagesToDownload,
                totalImages: 0,
                downloadedImages: 0,
                currentImageIndex: 0,
                pagesProcessed: totalPagesToDownload,
                percentage: 100,
                progress: 1.0,
                elapsedTime: 0,
                estimatedTimeRemaining: 0,
                eta: 0,
                bytesDownloaded: 0,
                bytesTotal: 0,
                downloadSpeed: 0
            });

            // Create complete array with placeholders for failed pages - only for the requested page range
            const completeImagePaths: (string | null)[] = [];
            for (let i = 0; i < totalPagesToDownload; i++) {
                // imagePaths uses relative indexing now, so just use i directly
                completeImagePaths[i] = imagePaths[i] || null;
            }

            validImagePaths = imagePaths.filter(Boolean);

            // BDL Post-download verification and recovery
            if (manifest.library === 'bdl' && configService.get('bdlPostVerification')) {
                console.log('🔍 [BDL] Starting post-download verification and recovery...');
                const pageUrls = manifest.pageLinks.slice(actualStartPage - 1, actualEndPage);

                // Verify and re-download any failed or small pages
                const verifiedPaths = await this.ultraBDLService.verifyAndRedownload(
                    completeImagePaths,
                    pageUrls,
                    {
                        ultraReliableMode: configService.get('bdlUltraReliableMode'),
                        maxRetries: configService.get('bdlMaxRetries'),
                        maxQualityFallbacks: true,
                        proxyHealthCheck: configService.get('bdlProxyHealthCheck'),
                        persistentQueue: configService.get('bdlPersistentQueue'),
                        pageVerificationSize: configService.get('bdlMinVerificationSize'),
                        minDelayMs: 2000,
                        maxDelayMs: 300000 // 5 minutes max
                    }
                );

                // Update arrays with verified paths
                for (let i = 0; i < verifiedPaths.length; i++) {
                    if (verifiedPaths[i]) {
                        completeImagePaths[i] = verifiedPaths[i] ?? null;
                        if (!imagePaths[i]) {
                            imagePaths[i] = verifiedPaths[i] ?? "";
                        }
                    }
                }

                // Recount valid paths
                validImagePaths = imagePaths.filter(Boolean);
                const recoveredCount = validImagePaths.length - failedPages.length;
                if (recoveredCount > 0) {
                    console.log(`✅ [BDL] Recovered ${recoveredCount} previously failed pages`);
                }

                // Clear the retry queue for this manuscript
                await this.ultraBDLService.clearRetryQueue((manifest as any).manuscriptId);
            }

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
                // Support multiple file extensions (jpg, jpeg, png, pdf, tiff, etc.)
                const aMatch = a.match(/_page_(\d+)\.[^.]+$/);
                const bMatch = b.match(/_page_(\d+)\.[^.]+$/);
                
                // Handle cases where the regex doesn't match (shouldn't happen, but be safe)
                if (!aMatch || !bMatch) {
                    console.warn('Warning: Could not extract page number from filename', { a, b });
                    return 0;
                }
                
                const aNum = parseInt(aMatch[1] || '0', 10);
                const bNum = parseInt(bMatch[1] || '0', 10);
                return aNum - bNum;
            });

            // Log PDF creation start
            this.logger.logPdfCreationStart(
                manifest.library || 'unknown',
                completeImagePaths.length,
                targetDir
            );

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
                    try {
                        // BNE and BDL may provide PDFs, not images - use PDF merger instead
                        // Check if any of the files are PDFs
                        const hasPDFs = partImages.some(img => img && img.toLowerCase().endsWith('.pdf'));
                        
                        if ((manifest as any)?.library === 'bne' || hasPDFs) {
                            await this.mergePDFPages(partImages, partFilepath, partStartPage, manifest);
                        } else {
                            await this.convertImagesToPDFWithBlanks(partImages, partFilepath, partStartPage, manifest);
                        }
                        createdFiles.push(partFilepath);
                    } catch (pdfError: unknown) {
                        const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
                        console.error(`Failed to create PDF part ${partNumber}: ${errorMessage}`);
                        this.logger.logPdfCreationError(manifest.library || 'unknown', pdfError as Error, {
                            partNumber,
                            imagesInPart: partImages.length,
                            outputPath: partFilepath
                        });
                        throw new Error(`PDF creation failed for part ${partNumber}: ${errorMessage}`);
                    }
                }

                // Clean up temporary images
                for (const p of validImagePaths) {
                    try {
                        await fs.unlink(p);
                    } catch {
                        // Ignore file deletion errors
                    }
                }

                // Log manuscript download complete with all files
                const downloadDuration = Date.now() - downloadStartTime;
                this.logger.logManuscriptDownloadComplete(
                    manifest.library || 'unknown',
                    url,
                    validImagePaths.length,
                    createdFiles,
                    downloadDuration
                );

                return createdFiles[0] || ''; // Return first part as primary filepath
            } else {
                // Single PDF
                try {
                    // BNE and BDL may provide PDFs, not images - use PDF merger instead
                    // Check if any of the files are PDFs
                    const hasPDFs = completeImagePaths.some(img => img && img.toLowerCase().endsWith('.pdf'));
                    
                    if ((manifest as any)?.library === 'bne' || hasPDFs) {
                        await this.mergePDFPages(completeImagePaths, filepath, actualStartPage, manifest);
                    } else {
                        await this.convertImagesToPDFWithBlanks(completeImagePaths, filepath, actualStartPage, manifest);
                    }
                } catch (pdfError: unknown) {
                    const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
                    console.error(`Failed to create PDF: ${errorMessage}`);
                    this.logger.logPdfCreationError(manifest.library || 'unknown', pdfError as Error, {
                        totalImages: completeImagePaths.length,
                        outputPath: filepath
                    });
                    throw new Error(`PDF creation failed: ${errorMessage}`);
                }

                // Clean up temporary images
                for (const p of validImagePaths) {
                    try {
                        await fs.unlink(p);
                    } catch {
                        // Ignore file deletion errors
                    }
                }

                // Log manuscript download complete with enhanced information
                const downloadDuration = Date.now() - downloadStartTime;
                const stats = await fs.stat(filepath);
                context.actualSizeMB = stats.size / (1024 * 1024);
                
                const metrics: PerformanceMetrics = {
                    duration: downloadDuration,
                    speedMbps: context.actualSizeMB ? (context.actualSizeMB / (downloadDuration / 1000)) : undefined
                };
                
                enhancedLogger.logDownloadSuccess(context, metrics, filepath);

                return filepath; // Return the created PDF filepath
            }

        } catch (error: unknown) {
            console.error(`❌ Download failed: ${(error as Error).message}`);

            // Log manuscript download failed with better stage detection
            let failedStage = 'unknown';
            if (!manifest) {
                failedStage = 'manifest_loading';
            } else if ((error as Error).message?.includes('convertImagesToPDF') ||
                      (error as Error).message?.includes('PDF') ||
                      (error as Error).message?.includes('memory') ||
                      (error as Error).message?.includes('No pages created') ||
                      validImagePaths && validImagePaths.length > 0 && !filepath) {
                failedStage = 'pdf_creation';
            } else if (validImagePaths && validImagePaths.length === 0) {
                failedStage = 'image_download';
            } else {
                failedStage = 'processing';
            }

            // Log enhanced error information
            if (context) {
                const errorMetrics: PerformanceMetrics = {
                    duration: Date.now() - downloadStartTime
                };
                enhancedLogger.logDownloadError(context, error as Error, errorMetrics);
            } else {
                // Fallback for early errors before context is created
                const fallbackContext: ManuscriptContext = {
                    id: this.extractManuscriptId(url),
                    library: this.detectLibrary(url) || 'unknown',
                    url: url
                };
                const errorMetrics: PerformanceMetrics = {
                    duration: Date.now() - downloadStartTime
                };
                enhancedLogger.logDownloadError(fallbackContext, error as Error, errorMetrics);
            }

            throw error;
        }
    }

    /**
     * Convert images to PDF with robust error handling and memory management
     */
    async convertImagesToPDF(imagePaths: string[], outputPath: string, manifest?: unknown): Promise<void> {
        const startTime = Date.now();
        const totalImages = imagePaths.length;
        const maxMemoryMB = 1024; // 1GB memory limit

        // Log PDF conversion start
        this.logger.log({
            level: 'info',
            library: (manifest as any)?.library || 'unknown',
            message: `Starting PDF conversion with ${totalImages} images`,
            details: { totalImages, outputPath }
        });

        // Special handling for large manuscripts to prevent memory allocation failures
        let batchSize;

        // ULTRA-PRIORITY FIX for Issue #23: BDL memory allocation failure
        // BDL manuscripts often have high-resolution images that consume lots of memory
        if ((manifest as any)?.library === 'bdl') {
            if (totalImages > 300) {
                batchSize = 5; // Ultra-small batches for 300+ page BDL manuscripts
                console.log(`🔧 [BDL Memory Fix] Large BDL manuscript (${totalImages} pages), using ultra-small batch size: ${batchSize} to prevent memory allocation failure`);
            } else if (totalImages > 200) {
                batchSize = 8; // Very small batches for 200+ page BDL
                console.log(`🔧 [BDL Memory Fix] Large BDL manuscript (${totalImages} pages), using very small batch size: ${batchSize}`);
            } else if (totalImages > 100) {
                batchSize = 12; // Small batches for 100+ page BDL
                console.log(`🔧 [BDL Memory Fix] Medium BDL manuscript (${totalImages} pages), using small batch size: ${batchSize}`);
            } else if (totalImages > 50) {
                batchSize = 15; // Moderate batches for 50+ page BDL
            } else {
                batchSize = 20; // Standard batches for smaller BDL manuscripts
            }
        } else if ((manifest as any)?.library === 'manuscripta' && totalImages > 300) {
            batchSize = 8; // Very small batches for 300+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using very small batch size: ${batchSize}`);
        } else if ((manifest as any)?.library === 'manuscripta' && totalImages > 200) {
            batchSize = 12; // Small batches for 200+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using small batch size: ${batchSize}`);
        } else if ((manifest as any)?.library === 'manuscripta' && totalImages > 100) {
            batchSize = 20;
        } else {
            batchSize = Math.min(50, Math.max(10, Math.floor(maxMemoryMB / 20))); // Adaptive batch size
        }

        const allPdfBytes: Uint8Array[] = [];
        // let processedCount = 0;

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
                        if (!imagePath) {
                            throw new Error('Image path is undefined');
                        }
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
                            } catch {
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
                        // processedCount++;

                    } catch (error: unknown) {
                        console.error(`\n❌ Failed to process ${path.basename(imagePath)}: ${(error as Error).message}`);
                        continue;
                    }
                }

                if (validImagesInBatch > 0) {
                    // Save batch PDF
                    const batchPdfBytes = await batchPdfDoc.save();
                    allPdfBytes.push(batchPdfBytes);

                    // Force garbage collection after each batch if available
                    if (global.gc) {
                        global.gc();

                        // ULTRA-PRIORITY FIX for Issue #23: Enhanced memory cleanup for BDL
                        if ((manifest as any)?.library === 'bdl' && totalImages > 100) {
                            // BDL needs aggressive memory cleanup due to high-resolution images
                            await new Promise(resolve => setTimeout(resolve, 300)); // 300ms pause for memory cleanup
                            console.log(`🔧 [BDL Memory] Aggressive memory cleanup after batch ${batchNum}/${Math.ceil(totalImages / batchSize)}`);

                            // Double garbage collection for large BDL manuscripts
                            if (totalImages > 300) {
                                global.gc();
                                await new Promise(resolve => setTimeout(resolve, 100)); // Additional cleanup
                            }
                        }
                        // For large manuscripta.se files, add extra memory cleanup time
                        else if ((manifest as any)?.library === 'manuscripta' && totalImages > 200) {
                            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms pause
                            console.log(`Memory cleanup completed after batch ${batchNum}/${Math.ceil(totalImages / batchSize)}`);
                        }
                    }
                }

            } catch (batchError: unknown) {
                const errorMessage = batchError instanceof Error ? batchError.message : String(batchError);
                console.error(`\n❌ Batch ${batchNum} failed: ${errorMessage}`);

                // ULTRA-PRIORITY FIX for Issue #23: Handle memory allocation failures gracefully
                if (batchError instanceof Error && batchError.message && batchError.message.includes('Array buffer allocation failed')) {
                    console.error('🚨 [BDL Memory] Memory allocation failure detected!');
                    console.error('🔧 [BDL Memory] Attempting recovery with smaller batch size...');

                    // Try to recover by processing images one at a time
                    const singleImageBatch = imagePaths.slice(i, Math.min(i + batchSize, totalImages));
                    for (const singleImagePath of singleImageBatch) {
                        try {
                            const singlePdfDoc = await PDFDocument.create();
                            const imageBuffer = await fs.readFile(singleImagePath);

                            let image;
                            try {
                                image = await singlePdfDoc.embedJpg(imageBuffer);
                            } catch {
                                try {
                                    image = await singlePdfDoc.embedPng(imageBuffer);
                                } catch {
                                    console.error(`   Skipping unprocessable image: ${path.basename(singleImagePath)}`);
                                    continue;
                                }
                            }

                            const { width, height } = image;
                            const page = singlePdfDoc.addPage([width, height]);
                            page.drawImage(image, { x: 0, y: 0, width, height });

                            const singlePdfBytes = await singlePdfDoc.save();
                            allPdfBytes.push(singlePdfBytes);
                            // processedCount++;

                            // Force memory cleanup after each single image
                            if (global.gc) {
                                global.gc();
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }

                        } catch (singleError: unknown) {
                            const singleErrorMessage = singleError instanceof Error ? singleError.message : String(singleError);
                            console.error(`   Failed to process single image: ${singleErrorMessage}`);
                        }
                    }
                    console.log('🔧 [BDL Memory] Recovery completed, continuing with next batch...');
                } else {
                    throw batchError;
                }
            }
        }

        if (allPdfBytes.length === 0) {
            throw new Error('No valid images were processed into PDF');
        }

        // Merge all batch PDFs into final PDF

        if (allPdfBytes.length === 1) {
            // Single batch, just write it
            const pdfBytes = allPdfBytes[0];
            if (!pdfBytes) {
                throw new Error('No PDF bytes available for writing');
            }
            await this.writeFileWithVerification(outputPath, pdfBytes instanceof Buffer ? pdfBytes : Buffer.from(pdfBytes));
        } else {
            // Multiple batches, merge them
            const finalPdfDoc = await PDFDocument.create();

            for (let i = 0; i < allPdfBytes.length; i++) {
                try {
                    const pdfBytesData = allPdfBytes[i];
                    if (!pdfBytesData) {
                        console.warn(`Skipping undefined PDF bytes at index ${i}`);
                        continue;
                    }
                    const batchPdf = await PDFDocument.load(pdfBytesData);
                    const pageIndices = batchPdf.getPageIndices();
                    const copiedPages = await finalPdfDoc.copyPages(batchPdf, pageIndices);

                    copiedPages.forEach((page) => finalPdfDoc.addPage(page));
                } catch (mergeError: unknown) {
                    const mergeErrorMessage = mergeError instanceof Error ? mergeError.message : String(mergeError);
                    console.error(`\n❌ Failed to merge batch ${i + 1}: ${mergeErrorMessage}`);
                    throw mergeError;
                }
            }

            const finalPdfBytes = await finalPdfDoc.save();
            await this.writeFileWithVerification(outputPath, Buffer.from(finalPdfBytes));

            // Log PDF creation complete
            const duration = Date.now() - startTime;
            const stats = await fs.stat(outputPath);
            this.logger.logPdfCreationComplete(
                (manifest as any)?.library || 'unknown',
                outputPath,
                stats.size,
                duration
            );
        }

    }

    async convertImagesToPDFWithBlanks(imagePaths: (string | null)[], outputPath: string, startPageNumber: number = 1, manifest?: unknown): Promise<void> {
        const startTime = Date.now();
        const totalImages = imagePaths.length;
        const maxMemoryMB = 1024;

        // Log PDF conversion start
        this.logger.log({
            level: 'info',
            library: (manifest as any)?.library || 'unknown',
            message: `Starting PDF conversion with ${totalImages} images (with blanks for failed pages)`,
            details: { totalImages, outputPath, startPageNumber }
        });

        // Special handling for large manuscripta.se files to prevent infinite loops
        let batchSize;
        if ((manifest as any)?.library === 'manuscripta' && totalImages > 300) {
            batchSize = 8; // Very small batches for 300+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using very small batch size: ${batchSize}`);
        } else if ((manifest as any)?.library === 'manuscripta' && totalImages > 200) {
            batchSize = 12; // Small batches for 200+ page manuscripta.se
            console.log(`Large manuscripta.se manuscript detected (${totalImages} pages), using small batch size: ${batchSize}`);
        } else if ((manifest as any)?.library === 'manuscripta' && totalImages > 100) {
            batchSize = 20;
        } else {
            batchSize = Math.min(50, Math.max(10, Math.floor(maxMemoryMB / 20)));
        }

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
                        if (!imagePath) {
                            throw new Error('Image path is undefined');
                        }
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
                            } catch {
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

                    } catch (error: unknown) {
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

                        const errorMsg = (error as Error).message || 'Unknown error occurred';
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

                    // Log batch progress
                    const batchNum = Math.floor(i / batchSize) + 1;
                    const totalBatches = Math.ceil(totalImages / batchSize);
                    this.logger.log({
                        level: 'debug',
                        library: (manifest as any)?.library || 'unknown',
                        message: `PDF batch ${batchNum}/${totalBatches} processed: ${pagesInBatch} pages`,
                        details: {
                            batchNum,
                            totalBatches,
                            pagesInBatch,
                            processedCount,
                            totalImages
                        }
                    });

                    // Force garbage collection after each batch if available
                    if (global.gc) {
                        global.gc();
                        // For large manuscripta.se files, add extra memory cleanup time
                        if ((manifest as any)?.library === 'manuscripta' && totalImages > 200) {
                            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms pause
                            const batchNum = Math.floor(i / batchSize) + 1;
                            const totalBatches = Math.ceil(totalImages / batchSize);
                            console.log(`Memory cleanup completed after batch ${batchNum}/${totalBatches}`);
                        }
                    }
                }

            } catch (batchError: unknown) {
                console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, (batchError as Error).message);
            }
        }

        if (allPdfBytes.length === 0) {
            throw new Error('No pages were processed into PDF');
        }

        if (allPdfBytes.length === 1) {
            if (!outputPath) {
                throw new Error('Output path is required for writing PDF');
            }
            const pdfData = allPdfBytes[0];
            if (!pdfData) {
                throw new Error('No PDF data available');
            }
            await fs.writeFile(outputPath, pdfData);
        } else {
            const finalPdfDoc = await PDFDocument.create();

            for (const pdfBytes of allPdfBytes) {
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pageIndices = pdfDoc.getPageIndices();
                const pages = await finalPdfDoc.copyPages(pdfDoc, pageIndices);
                pages.forEach((page) => finalPdfDoc.addPage(page));
            }

            const finalPdfBytes = await finalPdfDoc.save();
            if (!outputPath) {
                throw new Error('Output path is required for writing PDF');
            }
            await fs.writeFile(outputPath, finalPdfBytes);
        }

        // Log PDF creation complete
        const duration = Date.now() - startTime;
        const stats = await fs.stat(outputPath);
        this.logger.logPdfCreationComplete(
            (manifest as any)?.library || 'unknown',
            outputPath,
            stats.size,
            duration
        );
    }

    /**
     * Merge PDF pages for libraries that provide PDFs instead of images (like BNE)
     */
    async mergePDFPages(pdfPaths: (string | null)[], outputPath: string, startPageNumber: number = 1, manifest?: unknown): Promise<void> {
        const startTime = Date.now();
        const totalPages = pdfPaths.length;

        // Log PDF merge start
        this.logger.log({
            level: 'info',
            library: (manifest as any)?.library || 'unknown',
            message: `Starting PDF merge with ${totalPages} PDF pages`,
            details: { totalPages, outputPath, startPageNumber }
        });

        try {
            const finalPdfDoc = await PDFDocument.create();
            finalPdfDoc.setTitle((manifest as any)?.displayName || 'Merged Manuscript');
            finalPdfDoc.setAuthor('Manuscript Downloader');
            finalPdfDoc.setSubject('Downloaded manuscript');
            finalPdfDoc.setCreator('Electron Manuscript Downloader');

            let processedCount = 0;
            let skippedCount = 0;

            for (let i = 0; i < pdfPaths.length; i++) {
                const pdfPath = pdfPaths[i];
                const pageNumber = startPageNumber + i;

                if (pdfPath === null) {
                    // Create blank page for missing PDF
                    const page = finalPdfDoc.addPage([595, 842]); // A4 size
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

                    skippedCount++;
                    processedCount++;
                    continue;
                }

                try {
                    // Read PDF file and merge its pages
                    const pdfBuffer = await fs.readFile(pdfPath!);
                    
                    // Check if it's actually a PDF
                    const header = pdfBuffer.slice(0, 5).toString();
                    if (header !== '%PDF-') {
                        console.error(`File ${pdfPath} is not a valid PDF (header: ${header})`);
                        
                        // Create error page
                        const page = finalPdfDoc.addPage([595, 842]);
                        const { height } = page.getSize();

                        page.drawText(`Page ${pageNumber} - Invalid PDF`, {
                            x: 50,
                            y: height - 100,
                            size: 18,
                            color: rgb(0.6, 0.2, 0.2),
                        });

                        page.drawText('Downloaded file is not a valid PDF document.', {
                            x: 50,
                            y: height - 140,
                            size: 12,
                            color: rgb(0.4, 0.4, 0.4),
                        });

                        skippedCount++;
                        processedCount++;
                        continue;
                    }

                    const sourcePdfDoc = await PDFDocument.load(pdfBuffer);
                    const pageIndices = sourcePdfDoc.getPageIndices();
                    const copiedPages = await finalPdfDoc.copyPages(sourcePdfDoc, pageIndices);
                    
                    copiedPages.forEach((page) => finalPdfDoc.addPage(page));
                    processedCount++;

                } catch (error: unknown) {
                    console.error(`Failed to merge PDF page ${pageNumber}: ${(error as Error).message}`);
                    
                    // Create error page
                    const page = finalPdfDoc.addPage([595, 842]);
                    const { height } = page.getSize();

                    page.drawText(`Page ${pageNumber} - Merge Error`, {
                        x: 50,
                        y: height - 100,
                        size: 18,
                        color: rgb(0.6, 0.2, 0.2),
                    });

                    page.drawText(`Error: ${(error as Error).message}`, {
                        x: 50,
                        y: height - 140,
                        size: 12,
                        color: rgb(0.4, 0.4, 0.4),
                    });

                    skippedCount++;
                    processedCount++;
                }
            }

            // Save the final merged PDF
            const pdfBytes = await finalPdfDoc.save();
            if (!outputPath) {
                throw new Error('Output path is required for writing PDF');
            }
            await fs.writeFile(outputPath, pdfBytes);

            const stats = await fs.stat(outputPath);
            const duration = Date.now() - startTime;

            console.log(`✅ Successfully merged ${processedCount - skippedCount} PDF pages (${skippedCount} failed) in ${duration}ms`);
            console.log(`   Output: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

            // Log successful PDF creation
            this.logger.logPdfCreationComplete(
                (manifest as any)?.library || 'unknown',
                outputPath,
                stats.size,
                duration
            );

        } catch (error: unknown) {
            console.error(`Failed to merge PDFs: ${(error as Error).message}`);
            throw new Error(`PDF merge failed: ${(error as Error).message}`);
        }
    }

    // Removed unused method _handleEManuscriptaTitleInfo

    /**
     * Handle E-Manuscripta thumbview URLs (individual blocks)
     */

    /**
     * Extract physical description from manifest metadata
     */

    /**
     * Extract manuscript title from manifest metadata
     */

    /**
     * Extract CNMD identifier from manifest metadata
     */

    /**
     * Parse expected folio count from physical description
     */

    /**
     * Extract text from IIIF metadata value (handle various formats)
     */
    private getMetadataText(value: unknown): string {
        if (typeof value === 'string') {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(v => this.getMetadataText(v)).join(', ');
        }

        if (value && typeof value === 'object') {
            // Handle language maps
            if ((value as any).it) return this.getMetadataText((value as any).it);
            if ((value as any).en) return this.getMetadataText((value as any).en);
            if ((value as any)["@value"]) return (value as any)["@value"];

            return JSON.stringify(value);
        }

        return String(value || '');
    }

    private detectLibraryFromUrl(url: string): string {
        // Map of domain patterns to library names
        const libraryPatterns = [
            { pattern: /bdl\.servizirl\.it/, name: 'BDL' },
            { pattern: /staatsbibliothek-berlin\.de/, name: 'Berlin State Library' },
            { pattern: /bdh-rd\.bne\.es/, name: 'BNE' },
            { pattern: /bl\.digirati\.io/, name: 'British Library' },
            { pattern: /cambridge\.org/, name: 'Cambridge' },
            { pattern: /mdc\.csuc\.cat/, name: 'Catalonia MDC' },
            { pattern: /digi\.vatlib\.it/, name: 'DigiVatLib' },
            { pattern: /digital\.bodleian\.ox\.ac\.uk/, name: 'Digital Bodleian' },
            { pattern: /europeana\.eu/, name: 'Europeana' },
            { pattern: /cdm21059\.contentdm\.oclc\.org/, name: 'Florence' },
            { pattern: /gallica\.bnf\.fr/, name: 'Gallica' },
            { pattern: /uni-graz\.at|gams\.uni-graz\.at/, name: 'Graz' },
            { pattern: /internetculturale\.it/, name: 'Internet Culturale' },
            { pattern: /blb-karlsruhe\.de/, name: 'Karlsruhe' },
            { pattern: /themorgan\.org/, name: 'Morgan Library' },
            { pattern: /bsb-muenchen\.de/, name: 'Munich BSB' },
            { pattern: /glossa\.uni-graz\.at/, name: 'Graz Glossa' },
            { pattern: /nb\.no/, name: 'National Library of Norway' },
            { pattern: /dhb\.thulb\.uni-jena\.de/, name: 'Jena' },
            { pattern: /e-codices\.unifr\.ch/, name: 'e-codices' },
            { pattern: /digi\.ub\.uni-heidelberg\.de/, name: 'Heidelberg' },
            { pattern: /nbn-resolving\.de/, name: 'Wolfenbuttel' },
            { pattern: /socrates\.leidenuniv\.nl/, name: 'Leiden' },
            { pattern: /cdm\.csbsju\.edu/, name: 'St John\'s' },
            { pattern: /bavarikon\.de/, name: 'Bavarikon' },
            { pattern: /manuscripts\.ru/, name: 'Russian State Library' },
            { pattern: /nbm\.regione\.veneto\.it|nuovabibliotecamanoscritta\.it/, name: 'Verona' },
            { pattern: /pagella\.bm-grenoble\.fr/, name: 'Grenoble' },
            { pattern: /rotomagus\.fr/, name: 'Rouen' }
        ];

        for (const { pattern, name } of libraryPatterns) {
            if (pattern.test(url)) {
                return name;
            }
        }

        return 'Unknown';
    }

    // Generic method to replace all repetitive library-specific methods
    private async loadLibraryManifest(libraryKey: string, url: string): Promise<ManuscriptManifest> {
        const loader = this.libraryLoaders.get(libraryKey);
        if (loader) {
            return loader.loadManifest(url);
        }
        throw new Error(`${libraryKey} loader not available`);
    }

    // Stub methods for loader dependencies (these delegate to loaders or throw errors)

    private async loadGenericIIIFManifest(url: string): Promise<ManuscriptManifest> {
        return this.loadLibraryManifest('generic_iiif', url);
    }

    abort() {
        // Abort any ongoing downloads
        // This method can be called by other services to stop downloads
    }

    async writeFileWithVerification(filePath: string, data: any): Promise<void> {
        // Write file with verification
        const fs = await import('fs/promises');
        await fs.writeFile(filePath, data);
    }

    parseEManuscriptaDropdown(_UNUSED_html: string): any {
        // Parse e-manuscripta dropdown data
        return {};
    }

    parseEManuscriptaJSConfig(_UNUSED_html: string): any {
        // Parse e-manuscripta JS config
        return {};
    }
}