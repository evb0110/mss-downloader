import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class BvpbLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'bvpb';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                const pathMatch = originalUrl.match(/path=([^&]+)/);
                if (!pathMatch) {
                    throw new Error('Could not extract path from BVPB URL');
                }
                
                const pathId = pathMatch[1];
                console.log(`Extracting BVPB manuscript path: ${pathId}`);
                
                const allImageIds: string[] = [];
                let currentPosition = 1;
                let hasMorePages = true;
                let totalPages = 0;
                let pageTitle = 'BVPB Manuscript';
                
                while (hasMorePages) {
                    const catalogUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${pathId}&posicion=${currentPosition}`;
                    console.log(`Discovering BVPB manuscript pages starting at position ${currentPosition}...`);
                    
                    const response = await this.deps.fetchDirect(catalogUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to load BVPB catalog page: ${response.status}`);
                    }
                    
                    const html = await response.text();
                    
                    // Extract title from first page
                    if (currentPosition === 1) {
                        try {
                            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
                            if (titleMatch) {
                                pageTitle = titleMatch[1]
                                    .replace(/Biblioteca Virtual del Patrimonio Bibliográfico[^>]*>\s*/gi, '')
                                    .replace(/^\s*Búsqueda[^>]*>\s*/gi, '')
                                    .replace(/\s*\(Objetos digitales\)\s*/gi, '')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&rsaquo;/g, '›')
                                    .replace(/&[^;]+;/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim() || pageTitle;
                            }
                        } catch (titleError) {
                            console.warn('Could not extract BVPB title:', (titleError as Error).message);
                        }
                        
                        // Extract total pages count
                        const totalMatch = html.match(/(\d+)\s*de\s*(\d+)/);
                        if (totalMatch) {
                            totalPages = parseInt(totalMatch[2]);
                            console.log(`Found total pages: ${totalPages}`);
                        }
                    }
                    
                    // Extract image IDs from current page
                    const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
                    const pageImageIds: string[] = [];
                    let match;
                    while ((match = imageIdPattern.exec(html)) !== null) {
                        const imageId = match[1];
                        if (!pageImageIds.includes(imageId)) {
                            pageImageIds.push(imageId);
                        }
                    }
                    
                    console.log(`Found ${pageImageIds.length} images on page starting at position ${currentPosition}`);
                    allImageIds.push(...pageImageIds);
                    
                    // Check if there are more pages
                    if (totalPages > 0 && allImageIds.length >= totalPages) {
                        hasMorePages = false;
                        console.log(`Reached total pages limit: ${totalPages}`);
                    } else if (pageImageIds.length === 0) {
                        hasMorePages = false;
                        console.log('No more images found, stopping pagination');
                    } else {
                        // Move to next page (BVPB shows 12 images per page)
                        currentPosition += 12;
                        
                        // Safety check - don't go beyond reasonable limits
                        if (currentPosition > 10000) {
                            console.warn('Reached safety limit, stopping pagination');
                            hasMorePages = false;
                        }
                    }
                }
                
                if (allImageIds.length === 0) {
                    throw new Error('No images found for this BVPB manuscript');
                }
                
                console.log(`BVPB manuscript discovery completed: ${allImageIds.length} pages found`);
                
                // Remove duplicates and sort by numeric ID to ensure proper order
                const uniqueImageIds = [...new Set(allImageIds)].sort((a, b) => parseInt(a) - parseInt(b));
                console.log(`Unique image IDs: ${uniqueImageIds.length}`);
                
                const pageLinks = uniqueImageIds.map(imageId => 
                    `https://bvpb.mcu.es/es/media/object.do?id=${imageId}`
                );
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'bvpb',
                    displayName: pageTitle,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load BVPB manuscript: ${(error as Error).message}`);
            }
        }
}