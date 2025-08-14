import type { ManuscriptManifest } from '../../../shared/types';
import type { ManifestCache } from '../ManifestCache';
import type { DownloadLogger } from '../DownloadLogger';
import type { ZifImageProcessor } from '../ZifImageProcessor';
import type { DziImageProcessor } from '../DziImageProcessor';
import type { DirectTileProcessor } from '../DirectTileProcessor';
import type { TileEngineService } from '../tile-engine/TileEngineService';
import type { SharedManifestAdapter } from '../SharedManifestAdapter';
import type { UltraReliableBDLService } from '../UltraReliableBDLService';

/**
 * Dependencies required by library loaders
 */
export interface LoaderDependencies {
    fetchDirect: (url: string, options?: RequestInit) => Promise<Response>;
    fetchWithProxyFallback: (url: string, options?: RequestInit) => Promise<Response>;
    fetchWithHTTPS: (url: string, options?: RequestInit) => Promise<Response>;
    sanitizeUrl: (url: string) => string;
    sleep: (ms: number) => Promise<void>;
    manifestCache: ManifestCache;
    logger: DownloadLogger;
    // Special processors used by specific libraries
    zifProcessor?: ZifImageProcessor;
    dziProcessor?: DziImageProcessor;
    directTileProcessor?: DirectTileProcessor;
    tileEngineService?: TileEngineService;
    sharedManifestAdapter?: SharedManifestAdapter;
    ultraBDLService?: UltraReliableBDLService;
    // Progress monitoring
    createProgressMonitor: (operationName: string, library?: string, customConfig?: any, callbacks?: any) => any;
    // Helper for validation
    validateInternetCulturaleImage?: (buffer: ArrayBuffer, url: string) => Promise<void>;
    // Other loaders for dependencies
    loadIIIFManifest?: (url: string) => Promise<ManuscriptManifest>;
    loadGenericIIIFManifest?: (url: string) => Promise<ManuscriptManifest>;
    loadVallicellianManifest?: (url: string) => Promise<ManuscriptManifest>;
    loadDiammSpecificManifest?: (url: string) => Promise<ManuscriptManifest>;
}

/**
 * Base interface for all library loaders
 */
export interface LibraryLoader {
    /**
     * Load a manuscript manifest from the library
     */
    loadManifest(url: string): Promise<ManuscriptManifest>;
    
    /**
     * Get the library name
     */
    getLibraryName(): string;
}

/**
 * Base class for library loaders with common functionality
 */
export abstract class BaseLibraryLoader implements LibraryLoader {
    constructor(protected deps: LoaderDependencies) {}
    
    abstract loadManifest(url: string): Promise<ManuscriptManifest>;
    abstract getLibraryName(): string;
    
    /**
     * Helper to create a basic manifest structure
     */
    protected createManifest(title: string, pages: Array<{ url: string, label?: string }>): ManuscriptManifest {
        return {
            title,
            totalPages: pages?.length,
            pageLinks: pages.map(page => page.url),
            library: 'generic' as any, // Placeholder, will be overridden by specific loaders
            displayName: title,
            originalUrl: ''
        };
    }
}