import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class BneLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'bne';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL using regex
                const idMatch = originalUrl.match(/[?&]id=(\d+)/);
                if (!idMatch) {
                    throw new Error('Could not extract manuscript ID from BNE URL');
                }
                
                const manuscriptId = idMatch[1];
                console.log(`Extracting BNE manuscript ID: ${manuscriptId}`);
                
                // Use robust page discovery (skip problematic PDF info endpoint)
                console.log('BNE: Using robust page discovery (hanging issue fixed)...');
                return this.robustBneDiscovery(manuscriptId, originalUrl);
                
            } catch (error: any) {
                throw new Error(`Failed to load BNE manuscript: ${(error as Error).message}`);
            }
        }
}