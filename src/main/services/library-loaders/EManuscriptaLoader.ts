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
                const { comprehensiveLogger } = await import('./ComprehensiveLogger');
                comprehensiveLogger.logEManuscriptaDiscovery('load_manifest_start', {
                    originalUrl: manuscriptaUrl,
                    processedUrl: manuscriptaUrl
                });
                
                // Use SharedManifestLoaders for ULTRA-OPTIMIZED discovery
                const { SharedManifestLoaders } = await import('../../shared/SharedManifestLoaders');
                const loader = new SharedManifestLoaders();
                
                // Make comprehensiveLogger available globally for SharedManifestLoaders
                (global as any).comprehensiveLogger = comprehensiveLogger;
                
                console.log('[e-manuscripta] Using SharedManifestLoaders with ULTRA-OPTIMIZED discovery');
                const sharedResult = await loader.getEManuscriptaManifest(manuscriptaUrl);
                
                if (sharedResult.error) {
                    throw new Error(sharedResult.error);
                }
                
                // Convert SharedManifestLoaders result to ManuscriptManifest format
                const pageLinks = sharedResult.images.map((img: any) => img.url);
                
                const eManuscriptaManifest: ManuscriptManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'e_manuscripta',
                    displayName: sharedResult.displayName || `e-manuscripta manuscript`,
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