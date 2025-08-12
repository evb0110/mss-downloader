import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class EuropeanaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'europeana';
    }
        async loadManifest(europeanaUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract collection ID and record ID from URL
                // Expected format: https://www.europeana.eu/en/item/{collectionId}/{recordId}
                const urlMatch = europeanaUrl.match(/\/item\/(\d+)\/([^/?]+)/);
                if (!urlMatch) {
                    throw new Error('Invalid Europeana URL format');
                }
                
                const collectionId = urlMatch[1];
                const recordId = urlMatch[2];
                
                console.log(`Europeana: Loading record data for ${collectionId}/${recordId}`);
                
                // First, try to get external IIIF manifest URL via Europeana Record API
                const recordApiUrl = `https://api.europeana.eu/record/${collectionId}/${recordId}.json?wskey=api2demo`;
                
                try {
                    const recordResponse = await this.deps.fetchDirect(recordApiUrl);
                    if (recordResponse.ok) {
                        const recordData = await recordResponse.json();
                        
                        // Look for external IIIF manifest in webResources
                        if (recordData.object?.aggregations?.[0]?.webResources) {
                            for (const resource of recordData.object.aggregations[0].webResources) {
                                if (resource.dctermsIsReferencedBy && Array.isArray(resource.dctermsIsReferencedBy)) {
                                    for (const manifestUrl of resource.dctermsIsReferencedBy) {
                                        if (manifestUrl.includes('manifest.json') || manifestUrl.includes('/manifest')) {
                                            console.log(`Europeana: Found external IIIF manifest: ${manifestUrl}`);
                                            
                                            // Load the external IIIF manifest
                                            if (!this.deps.loadGenericIIIFManifest) {
                                                throw new Error('Generic IIIF manifest loader not available');
                                            }
                                            const externalManifest = await this.deps.loadGenericIIIFManifest(manifestUrl);
                                            console.log(`Europeana: Successfully loaded external manifest with ${externalManifest.totalPages} pages`);
                                            return externalManifest;
                                        }
                                    }
                                }
                            }
                        }
                        
                        console.log(`Europeana: No external IIIF manifest found in Record API, falling back to Europeana's own IIIF`);
                    }
                } catch (error: any) {
                    console.log(`Europeana: Record API failed (${(error as Error).message}), falling back to Europeana's own IIIF`);
                }
                
                // Fallback: Use Europeana's own IIIF manifest (limited)
                const manifestUrl = `https://iiif.europeana.eu/presentation/${collectionId}/${recordId}/manifest`;
                console.log(`Europeana: Loading Europeana's own IIIF manifest from ${manifestUrl}`);
                
                const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to fetch Europeana IIIF manifest: HTTP ${manifestResponse.status}`);
                }
                
                const iiifManifest = await manifestResponse.json();
                
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure from Europeana');
                }
                
                const canvases = iiifManifest.sequences[0].canvases;
                console.log(`Europeana: Processing ${canvases.length} pages from Europeana's own IIIF manifest`);
                
                // Extract image URLs from IIIF manifest
                const pageLinks = canvases.map((canvas: any) => {
                    if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                        const resource = canvas.images[0].resource;
                        
                        // Check for IIIF Image API service
                        if (resource.service && resource.service['@id']) {
                            // Use full resolution IIIF Image API endpoint
                            return `${resource.service['@id']}/full/full/0/default.jpg`;
                        }
                        
                        // Fallback to direct resource URL
                        return resource['@id'] || resource.id;
                    }
                    return null;
                }).filter((url: string | null): url is string => url !== null);
                
                if (pageLinks.length === 0) {
                    throw new Error('No image URLs found in Europeana IIIF manifest');
                }
                
                // Extract display name from manifest
                let displayName = `Europeana_${recordId}`;
                if (iiifManifest.label) {
                    if (typeof iiifManifest.label === 'string') {
                        displayName = iiifManifest.label;
                    } else if (Array.isArray(iiifManifest.label)) {
                        // Handle IIIF label array format with objects containing @value
                        const firstLabel = iiifManifest.label[0];
                        if (typeof firstLabel === 'string') {
                            displayName = firstLabel;
                        } else if (firstLabel && typeof firstLabel === 'object' && '@value' in firstLabel) {
                            displayName = firstLabel['@value'] as string;
                        } else {
                            displayName = firstLabel || displayName;
                        }
                    } else if (typeof iiifManifest.label === 'object') {
                        // Handle multilingual labels (IIIF 3.0 format)
                        const labelValues = Object.values(iiifManifest.label);
                        if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
                            displayName = (labelValues[0] as string[])[0] || displayName;
                        }
                    }
                }
                
                const europeanaManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'europeana' as const,
                    displayName,
                    originalUrl: europeanaUrl,
                };
                
                console.log(`Europeana: Created manifest for "${displayName}" with ${pageLinks.length} pages`);
                return europeanaManifest;
                
            } catch (error: any) {
                console.error(`Failed to load Europeana manifest: ${(error as Error).message}`);
                throw error;
            }
        }
}