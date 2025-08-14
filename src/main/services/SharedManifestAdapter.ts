/**
 * Adapter for SharedManifestLoaders to work in Electron environment
 * This bridges the shared Node.js loaders with Electron's fetch implementation
 */

import type { ManuscriptManifest } from '../../shared/types';
import { DownloadLogger } from './DownloadLogger';

// Type definitions for manuscript manifest extensions
interface TileConfig {
    type: string;
    baseId?: string;
    publicId?: string;
    startPage?: number;
    pageCount?: number;
    tileBaseUrl?: string;
    [key: string]: unknown;
}

interface ExtendedManuscriptManifest extends ManuscriptManifest {
    type?: string;
    requiresTileAssembly?: boolean;
    processorType?: string;
    images?: Array<{ url: string; [key: string]: unknown }>;
    requiresTileProcessor?: boolean;
    tileConfig?: TileConfig;
}

interface ManifestLoadError extends Error {
    library: string;
    originalUrl: string;
    isManifestError: boolean;
}

// Dynamic import for TypeScript module
const loadSharedManifestLoaders = async () => {
    // Try .ts first for development, fall back to .js for production
    try {
        const module = await import('../../shared/SharedManifestLoaders.ts');
        return module.SharedManifestLoaders;
    } catch {
        const module = await import('../../shared/SharedManifestLoaders.js');
        return module.SharedManifestLoaders;
    }
};

import type { SharedManifestLoaders } from '../../shared/SharedManifestLoaders';

export class SharedManifestAdapter {
    private sharedLoaders: SharedManifestLoaders | null;
    private electronFetch: (url: string, options?: RequestInit) => Promise<Response>;

    constructor(electronFetch: (url: string, options?: RequestInit) => Promise<Response>) {
        this.electronFetch = electronFetch;
        this.sharedLoaders = null;
    }

    private async initializeSharedLoaders() {
        if (!this.sharedLoaders) {
            const SharedManifestLoaders = await loadSharedManifestLoaders();
            this.sharedLoaders = new SharedManifestLoaders(this.electronFetch);
        }
    }

    /**
     * Get manifest using shared loaders - guarantees sync with validation
     */
    async getManifestForLibrary(libraryId: string, url: string): Promise<ManuscriptManifest> {
        try {
            await this.initializeSharedLoaders();
            const result = await this.sharedLoaders?.getManifestForLibrary(libraryId, url);
            
            // Convert shared loader format to Electron format
            // Handle Bordeaux and other tile-based formats that don't have images array
            const manifest: ExtendedManuscriptManifest = {
                pageLinks: (result as any).images ? (result as any).images.map((image: { url: string }) => image.url) : [],
                totalPages: (result as any).images ? (result as any).images?.length : ((result as any).pageCount || 0),
                library: libraryId as ManuscriptManifest['library'],
                displayName: (result as any).displayName || `${libraryId} Manuscript`,
                originalUrl: url
            };

            // Add special properties for tile-based libraries
            if ((result as any).type === 'tiles' || (result as any).type === 'dzi' || (result as any).type === 'bordeaux_tiles') {
                manifest.type = (result as any).type;
                manifest.requiresTileAssembly = (result as any).requiresTileAssembly;
                manifest.processorType = (result as any).processorType;
                if ((result as any).images) {
                    manifest.images = (result as any).images; // Preserve full image info for tile processing
                }
            }
            
            // Handle new Bordeaux format with tile processor integration
            if ((result as any).requiresTileProcessor) {
                manifest.requiresTileProcessor = true;
                manifest.tileConfig = {
                    type: (result as any).type,
                    baseId: (result as any).baseId,
                    publicId: (result as any).publicId,
                    startPage: (result as any).startPage,
                    pageCount: (result as any).pageCount,
                    tileBaseUrl: (result as any).tileBaseUrl
                };
                // Generate placeholder page links for UI
                manifest.pageLinks = [];
                for (let i = 0; i < (result as any).pageCount; i++) {
                    const pageNum = (result as any).startPage + i;
                    manifest.pageLinks.push(`${(result as any).tileBaseUrl}/${(result as any).baseId}_${String(pageNum).padStart(4, '0')}`);
                }
                if (manifest) manifest.totalPages = (result as any).pageCount;
            }

            return manifest as ManuscriptManifest;
        } catch (error: any) {
            console.error(`SharedManifestAdapter error for ${libraryId}:`, error);
            
            // Create a safe, serializable error that won't crash IPC
            const errorObj = error as Error;
            const safeError = new Error(
                `Failed to load ${libraryId} manifest: ${errorObj?.message || 'Unknown error'}`
            ) as ManifestLoadError;
            safeError.name = 'ManifestLoadError';
            
            // Add safe metadata without circular references
            safeError.library = libraryId;
            safeError.originalUrl = url;
            safeError.isManifestError = true;
            
            // Log the full error for debugging
            const logger = DownloadLogger.getInstance();
            logger.log({
                level: 'error',
                library: libraryId,
                url,
                message: `Manifest loading failed in SharedManifestAdapter`,
                errorStack: (error as any)?.stack,
                details: {
                    errorMessage: (error as any)?.message,
                    errorCode: (error as any)?.code,
                    errorName: (error as any)?.name
                }
            });
            
            // Return safe error, not the original which might have circular refs
            throw safeError;
        }
    }

    /**
     * Check if library is supported by shared loaders
     */
    isLibrarySupported(libraryId: string): boolean {
        const supportedLibraries = ['bdl', 'bodleian', 'verona', 'vienna_manuscripta', 'bne', 'mdc_catalonia', 'florence', 'grenoble', 'manchester', 'munich', 'toronto', 'vatican', 'karlsruhe', 'loc', 'graz', 'gams', 'bvpb', 'morgan', 'hhu', 'duesseldorf', 'bordeaux', 'e_manuscripta', 'norwegian', 'nb', 'heidelberg', 'linz'];
        return supportedLibraries.includes(libraryId);
    }
}