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
            const manifest: ManuscriptManifest = {
                pageLinks: result.images.map((image: any) => image.url),
                totalPages: result.images.length,
                library: libraryId as any,
                displayName: result.displayName || `${libraryId} Manuscript`,
                originalUrl: url
            };

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
        const supportedLibraries = ['bdl', 'verona', 'vienna_manuscripta', 'bne', 'mdc_catalonia', 'florence', 'grenoble', 'manchester', 'toronto', 'vatican', 'karlsruhe', 'loc', 'graz', 'bvpb', 'morgan', 'hhu', 'duesseldorf'];
        return supportedLibraries.includes(libraryId);
    }
}