import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class EManuscriptaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'emanuscripta';
    }
    
    async loadManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
            try {
                // Ensure URL has protocol
                if (!manuscriptaUrl.startsWith('http://') && !manuscriptaUrl.startsWith('https://')) {
                    manuscriptaUrl = 'https://www.' + manuscriptaUrl;
                } else if (!manuscriptaUrl.includes('www.')) {
                    manuscriptaUrl = manuscriptaUrl.replace('https://', 'https://www.');
                }
                
                console.log(`Loading e-manuscripta.ch manifest from: ${manuscriptaUrl}`);
                
                // Log for debugging Issue #10
                const { comprehensiveLogger } = await import('../ComprehensiveLogger');
                comprehensiveLogger.logEManuscriptaDiscovery('load_manifest_start', {
                    originalUrl: manuscriptaUrl,
                    processedUrl: manuscriptaUrl
                });
                
                // Use SharedManifestLoaders for ULTRA-OPTIMIZED discovery
                const { SharedManifestLoaders } = await import('../../../shared/SharedManifestLoaders');
                const loader = new SharedManifestLoaders();
                
                // Make comprehensiveLogger available globally for SharedManifestLoaders
                (global as any).comprehensiveLogger = comprehensiveLogger;
                
                console.log('[e-manuscripta] Using SharedManifestLoaders with ULTRA-OPTIMIZED discovery');
                const sharedResult = await loader.getEManuscriptaManifest(manuscriptaUrl);
                
                // Handle different return types from SharedManifestLoaders
                let pageLinks: string[];
                let displayName: string;
                
                if (Array.isArray(sharedResult)) {
                    // Handle direct array result
                    pageLinks = sharedResult.map((img: any) => img.url);
                    displayName = `e-manuscripta manuscript`;
                } else if (sharedResult && typeof sharedResult === 'object') {
                    // Handle object result
                    if ('error' in sharedResult) {
                        throw new Error((sharedResult as any).error);
                    }
                    if ('images' in sharedResult) {
                        pageLinks = (sharedResult as any).images.map((img: any) => img.url);
                        displayName = (sharedResult as any).displayName || `e-manuscripta manuscript`;
                    } else {
                        throw new Error('Invalid result format from SharedManifestLoaders');
                    }
                } else {
                    throw new Error('Unexpected result format from SharedManifestLoaders');
                }
                
                const eManuscriptaManifest: ManuscriptManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'e_manuscripta',
                    displayName,
                    originalUrl: manuscriptaUrl,
                };
                
                console.log(`[e-manuscripta] Manifest created with ${pageLinks.length} pages using ULTRA-OPTIMIZED discovery`);
                comprehensiveLogger.logEManuscriptaDiscovery('load_manifest_complete', {
                    pagesFound: pageLinks.length,
                    displayName: eManuscriptaManifest.displayName
                });
                
                return eManuscriptaManifest;
                
            } catch (error: any) {
                console.error(`Failed to load e-manuscripta.ch manifest: ${error.message}`);
                throw error;
            }
        }
}