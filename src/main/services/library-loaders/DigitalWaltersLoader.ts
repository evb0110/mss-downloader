import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class DigitalWaltersLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'digital_walters';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
        try {
            // Strictly support the HTML index URLs as requested in Issue #38
            // URL format: https://www.thedigitalwalters.org/Data/WaltersManuscripts/html/WXX/
            if (!url.includes('thedigitalwalters.org') || !url.includes('/Data/WaltersManuscripts/html/')) {
                throw new Error('Unsupported Digital Walters URL. Expected https://www.thedigitalwalters.org/Data/WaltersManuscripts/html/WXX/');
            }

            const idMatch = url.match(/\/html\/([Ww]\d+)\/?(?:[#?].*)?$/);
            if (!idMatch || !idMatch[1]) {
                throw new Error('Invalid Digital Walters URL format - could not extract manuscript ID');
            }
            const manuscriptId = idMatch[1].toUpperCase(); // e.g., W33
            const wDotId = manuscriptId.replace(/^W/i, 'W.'); // e.g., W.33

            // Fetch the HTML index page
            const pageResponse = await this.deps.fetchDirect(url);
            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch Digital Walters index page: HTTP ${pageResponse.status}`);
            }
            const pageContent = await pageResponse.text();

            // Extract display title
            let title = `The Digital Walters - ${wDotId}`;
            const titleMatch = pageContent.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                title = (titleMatch[1] || '').trim().replace(/\s+/g, ' ') || title;
            }

            // Parse HTML to count sap.jpg entries for this manuscript
            // Look for occurrences like: W33_000001_sap.jpg
            const re = new RegExp(`${manuscriptId}_([0-9]{6})_sap\\.jpg`, 'gi');
            const seen = new Set<number>();
            let m: RegExpExecArray | null;
            while ((m = re.exec(pageContent)) !== null) {
                const nStr = m && m[1] ? m[1] : undefined;
                if (nStr) {
                    const n = parseInt(nStr, 10);
                    if (Number.isFinite(n)) seen.add(n);
                }
            }

            if (seen.size === 0) {
                throw new Error('No pages found in Digital Walters manuscript (no sap.jpg entries in HTML index)');
            }

            // Determine max page number and generate sequential links from 1..max
            const maxPage = Math.max(...Array.from(seen));
            const pageLinks: string[] = [];
            for (let i = 1; i <= maxPage; i++) {
                const padded = i.toString().padStart(6, '0');
                const imageUrl = `https://www.thedigitalwalters.org/Data/WaltersManuscripts/${manuscriptId}/data/${wDotId}/sap/${manuscriptId}_${padded}_sap.jpg`;
                pageLinks.push(imageUrl);
            }

            const sanitizedTitle = title
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                .replace(/\.+$/, '')
                .substring(0, 150);

            return {
                displayName: sanitizedTitle,
                totalPages: pageLinks.length,
                pageLinks,
                library: 'digital_walters' as const,
                originalUrl: url
            };
            
        } catch (error: any) {
            console.error(`Digital Walters manifest loading failed:`, error);
            throw new Error(`Failed to load Digital Walters manuscript: ${(error as Error).message}`);
        }
    }
}
