/**
 * Adapter for SharedManifestLoaders to work in Electron environment
 * This bridges the shared Node.js loaders with Electron's fetch implementation
 */

import type { ManuscriptManifest } from '../../shared/types';

// Dynamic import for Node.js module in TypeScript
const loadSharedManifestLoaders = async () => {
    const { SharedManifestLoaders } = await import('../../shared/SharedManifestLoaders.js');
    return SharedManifestLoaders;
};

export class SharedManifestAdapter {
    private sharedLoaders: any;
    private electronFetch: (url: string, options?: any) => Promise<any>;

    constructor(electronFetch: (url: string, options?: any) => Promise<any>) {
        this.electronFetch = electronFetch;
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
            const result = await this.sharedLoaders.getManifestForLibrary(libraryId, url);
            
            // Convert shared loader format to Electron format
            // Handle Bordeaux and other tile-based formats that don't have images array
            const manifest: ManuscriptManifest = {
                pageLinks: result.images ? result.images.map((image: any) => image.url) : [],
                totalPages: result.images ? result.images.length : (result.pageCount || 0),
                library: libraryId as any,
                displayName: result.displayName || `${libraryId} Manuscript`,
                originalUrl: url
            };

            // Add special properties for tile-based libraries
            if (result.type === 'tiles' || result.type === 'dzi' || result.type === 'bordeaux_tiles') {
                (manifest as any).type = result.type;
                (manifest as any).requiresTileAssembly = result.requiresTileAssembly;
                (manifest as any).processorType = result.processorType;
                if (result.images) {
                    (manifest as any).images = result.images; // Preserve full image info for tile processing
                }
            }
            
            // Handle new Bordeaux format with tile processor integration
            if (result.requiresTileProcessor) {
                (manifest as any).requiresTileProcessor = true;
                (manifest as any).tileConfig = {
                    type: result.type,
                    baseId: result.baseId,
                    publicId: result.publicId,
                    startPage: result.startPage,
                    pageCount: result.pageCount,
                    tileBaseUrl: result.tileBaseUrl
                };
                // Generate placeholder page links for UI
                manifest.pageLinks = [];
                for (let i = 0; i < result.pageCount; i++) {
                    const pageNum = result.startPage + i;
                    manifest.pageLinks.push(`${result.tileBaseUrl}/${result.baseId}_${String(pageNum).padStart(4, '0')}`);
                }
                manifest.totalPages = result.pageCount;
            }

            return manifest;
        } catch (error) {
            console.error(`SharedManifestAdapter error for ${libraryId}:`, error);
            throw error;
        }
    }

    /**
     * Check if library is supported by shared loaders
     */
    isLibrarySupported(libraryId: string): boolean {
        const supportedLibraries = ['bdl', 'verona', 'vienna_manuscripta', 'bne', 'mdc_catalonia', 'florence', 'grenoble', 'manchester', 'toronto', 'vatican', 'karlsruhe', 'loc', 'graz', 'bvpb', 'morgan', 'hhu', 'duesseldorf', 'bordeaux'];
        return supportedLibraries.includes(libraryId);
    }
}