import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class KarlsruheLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'karlsruhe';
    }
    
    async loadManifest(karlsruheUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                
                if (karlsruheUrl.includes('i3f.vls.io')) {
                    // Extract manifest URL from i3f viewer URL
                    // URL format: https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F[ID]%2Fmanifest
                    const urlParams = new URLSearchParams(new URL(karlsruheUrl).search);
                    const encodedManifestUrl = urlParams.get('id');
                    
                    if (!encodedManifestUrl) {
                        throw new Error('Could not extract manifest URL from Karlsruhe viewer URL');
                    }
                    
                    manifestUrl = decodeURIComponent(encodedManifestUrl);
                } else if (karlsruheUrl.includes('digital.blb-karlsruhe.de/blbhs/content/titleinfo/')) {
                    // Direct BLB URL format: https://digital.blb-karlsruhe.de/blbhs/content/titleinfo/3464606
                    const idMatch = karlsruheUrl.match(/titleinfo\/(\d+)/);
                    if (!idMatch) {
                        throw new Error('Could not extract ID from Karlsruhe direct URL');
                    }
                    const id = idMatch[1];
                    manifestUrl = `https://digital.blb-karlsruhe.de/i3f/v20/${id}/manifest`;
                } else {
                    throw new Error('Unsupported Karlsruhe URL format');
                }
                
                let displayName = 'Karlsruhe BLB Manuscript';
                
                // Load IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load manifest: HTTP ${response.status}`);
                }
                
                const manifest = await response.json();
                
                // Extract metadata from IIIF v2.0 manifest
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (Array.isArray(manifest.label)) {
                        displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                    } else if (manifest.label['@value']) {
                        displayName = manifest.label['@value'];
                    }
                }
                
                // Get page count from sequences/canvases (IIIF v2.0)
                let totalPages = 0;
                const pageLinks: string[] = [];
                
                if (manifest.sequences && manifest.sequences.length > 0) {
                    const sequence = manifest.sequences[0];
                    if (sequence.canvases && Array.isArray(sequence.canvases)) {
                        totalPages = sequence.canvases.length;
                        
                        // Extract image URLs with maximum resolution
                        for (const canvas of sequence.canvases) {
                            if (canvas.images && canvas.images.length > 0) {
                                const image = canvas.images[0];
                                if (image.resource && image.resource['@id']) {
                                    // Extract base image ID and construct maximum resolution URL
                                    const imageId = image.resource['@id'];
                                    
                                    // For Karlsruhe, use direct webcache/2000/ access for maximum resolution
                                    // Testing showed: webcache/2000/=821KB vs IIIF=269KB (4x quality improvement)
                                    // Extract webcache ID from URL like: https://digital.blb-karlsruhe.de/download/webcache/1000/221191
                                    const webcacheMatch = imageId.match(/webcache\/\d+\/(\d+)/);
                                    
                                    let maxResUrl: string;
                                    if (webcacheMatch) {
                                        // Use maximum available webcache resolution (2000px is highest available)
                                        maxResUrl = `https://digital.blb-karlsruhe.de/download/webcache/2000/${webcacheMatch[1]}`;
                                    } else {
                                        // Try to extract ID from other patterns and construct webcache URL
                                        // First try IIIF pattern: .../iiif/ID/full/...
                                        let idMatch = imageId.match(/\/iiif\/(\d+)\/full/);
                                        if (!idMatch) {
                                            // Try general numeric pattern at end: .../ID or .../ID.jpg
                                            idMatch = imageId.match(/(\d+)(?:\.jpg)?$/);
                                        }
                                        
                                        if (idMatch) {
                                            maxResUrl = `https://digital.blb-karlsruhe.de/download/webcache/2000/${idMatch[1]}`;
                                        } else {
                                            // Last resort: use IIIF format (lower quality but better than nothing)
                                            maxResUrl = imageId.includes('/full/') ? 
                                                imageId.replace('/full/full/0/default.jpg', '/full/2000,/0/default.jpg') :
                                                imageId;
                                        }
                                    }
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                }
                
                if (totalPages === 0 || pageLinks.length === 0) {
                    throw new Error('No pages found in IIIF manifest');
                }
                
                const karlsruheManifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'karlsruhe' as const,
                    displayName,
                    originalUrl: karlsruheUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(karlsruheUrl, karlsruheManifest).catch(console.warn);
                
                return karlsruheManifest;
                
            } catch (error: any) {
                throw new Error(`Failed to load Karlsruhe manuscript: ${(error as Error).message}`);
            }
        }
}