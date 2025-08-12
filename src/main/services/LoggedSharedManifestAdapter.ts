import { SharedManifestLoaders } from '../../shared/SharedManifestLoaders';
import { comprehensiveLogger } from './ComprehensiveLogger';

/**
 * Wrapper around SharedManifestLoaders that adds comprehensive logging
 * for all network operations and errors
 */
export class LoggedSharedManifestAdapter {
    private loaders: SharedManifestLoaders;
    
    constructor() {
        this.loaders = new SharedManifestLoaders();
    }
    
    async fetchWithRetry(url: string, options: any = {}) {
        const startTime = Date.now();
        const library = this.detectLibraryFromUrl(url);
        
        comprehensiveLogger.logNetworkRequest(url, {
            method: options.method || 'GET',
            headers: options.headers,
            library,
            timeout: options.timeout
        });
        
        try {
            const result = await this.loaders.fetchWithRetry(url, options);
            
            comprehensiveLogger.logNetworkResponse(url, {
                statusCode: 200, // Successful since no error thrown
                duration: Date.now() - startTime,
                bytesReceived: result.length,
                library
            });
            
            return result;
        } catch (error: any) {
            comprehensiveLogger.logNetworkError(url, error, {
                library,
                duration: Date.now() - startTime
            });
            
            // Re-throw with enhanced context
            const enhancedError = new Error(error.message);
            enhancedError.stack = error.stack;
            (enhancedError as any).originalError = error;
            (enhancedError as any).url = url;
            (enhancedError as any).library = library;
            throw enhancedError;
        }
    }
    
    async fetchCataloniaManifest(url: string) {
        const library = 'Catalonia MDC';
        const startTime = Date.now();
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library,
            url,
            details: {
                message: 'Loading Catalonia MDC manifest',
                method: 'getMDCCataloniaManifest'
            }
        });
        
        try {
            const manifest = await this.loaders.getMDCCataloniaManifest(url);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                details: {
                    message: 'Catalonia MDC manifest loaded successfully',
                    pageCount: manifest.pages?.length || 0
                }
            });
            
            return manifest;
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                errorMessage: error.message,
                errorStack: error.stack,
                details: {
                    message: 'Failed to load Catalonia MDC manifest',
                    method: 'getMDCCataloniaManifest'
                }
            });
            throw error;
        }
    }
    
    async fetchEuropeanaManifest(url: string) {
        const library = 'Europeana';
        const startTime = Date.now();
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library,
            url,
            details: {
                message: 'Loading Europeana manifest (generic method)',
                method: 'getManifestForLibrary'
            }
        });
        
        try {
            const manifest = await this.loaders.getManifestForLibrary('europeana', url);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                details: {
                    message: 'Europeana manifest loaded successfully',
                    pageCount: manifest.pages?.length || 0
                }
            });
            
            return manifest;
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                errorMessage: error.message,
                errorStack: error.stack,
                details: {
                    message: 'Failed to load Europeana manifest',
                    method: 'getManifestForLibrary'
                }
            });
            throw error;
        }
    }
    
    async fetchFlorenceManifest(url: string) {
        const library = 'Florence';
        const startTime = Date.now();
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library,
            url,
            details: {
                message: 'Loading Florence manifest',
                method: 'getFlorenceManifest'
            }
        });
        
        try {
            const manifest = await this.loaders.getFlorenceManifest(url);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                details: {
                    message: 'Florence manifest loaded successfully',
                    pageCount: manifest.pages?.length || 0
                }
            });
            
            return manifest;
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                errorMessage: error.message,
                errorStack: error.stack,
                details: {
                    message: 'Failed to load Florence manifest',
                    method: 'getFlorenceManifest',
                    isAuthError: error.message?.includes('403') || error.message?.includes('Authentication')
                }
            });
            throw error;
        }
    }
    
    async fetchVeronaManifest(url: string) {
        const library = 'Verona';
        const startTime = Date.now();
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library,
            url,
            details: {
                message: 'Loading Verona manifest',
                method: 'getVeronaManifest'
            }
        });
        
        try {
            const manifest = await this.loaders.getVeronaManifest(url);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                details: {
                    message: 'Verona manifest loaded successfully',
                    pageCount: manifest.pages?.length || 0
                }
            });
            
            return manifest;
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                errorMessage: error.message,
                errorStack: error.stack,
                details: {
                    message: 'Failed to load Verona manifest',
                    method: 'getVeronaManifest',
                    isTimeoutError: error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')
                }
            });
            throw error;
        }
    }
    
    async parseGrazManifest(url: string) {
        const library = 'Graz';
        const startTime = Date.now();
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library,
            url,
            details: {
                message: 'Parsing Graz manifest',
                method: 'getGrazManifest'
            }
        });
        
        try {
            const manifest = await this.loaders.getGrazManifest(url);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                details: {
                    message: 'Graz manifest parsed successfully',
                    pageCount: manifest.pages?.length || 0
                }
            });
            
            return manifest;
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                errorMessage: error.message,
                errorStack: error.stack,
                details: {
                    message: 'Failed to parse Graz manifest',
                    method: 'getGrazManifest'
                }
            });
            throw error;
        }
    }
    
    async fetchIIIFManifest(url: string, customUserAgent?: string) {
        const library = this.detectLibraryFromUrl(url);
        const startTime = Date.now();
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library,
            url,
            details: {
                message: 'Loading IIIF manifest (generic fetch with retry)',
                method: 'fetchWithRetry',
                customUserAgent
            }
        });
        
        try {
            const manifest = await this.loaders.fetchWithRetry(url, { 
                headers: customUserAgent ? { 'User-Agent': customUserAgent } : undefined 
            });
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                details: {
                    message: 'IIIF manifest loaded successfully',
                    manifestType: manifest['@context'] ? 'Presentation API' : 'Unknown',
                    canvases: Array.isArray(manifest.sequences?.[0]?.canvases) 
                        ? manifest.sequences[0].canvases.length 
                        : manifest.items?.length || 0
                }
            });
            
            return manifest;
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'manifest',
                library,
                url,
                duration: Date.now() - startTime,
                errorMessage: error.message,
                errorStack: error.stack,
                details: {
                    message: 'Failed to load IIIF manifest',
                    method: 'fetchWithRetry'
                }
            });
            throw error;
        }
    }
    
    private detectLibraryFromUrl(url: string): string {
        // Map of domain patterns to library names
        const libraryPatterns = [
            { pattern: /bdl\.servizirl\.it/, name: 'BDL' },
            { pattern: /staatsbibliothek-berlin\.de/, name: 'Berlin State Library' },
            { pattern: /bdh-rd\.bne\.es/, name: 'BNE' },
            { pattern: /bl\.digirati\.io/, name: 'British Library' },
            { pattern: /cambridge\.org/, name: 'Cambridge' },
            { pattern: /mdc\.csuc\.cat/, name: 'Catalonia MDC' },
            { pattern: /digi\.vatlib\.it/, name: 'DigiVatLib' },
            { pattern: /digital\.bodleian\.ox\.ac\.uk/, name: 'Digital Bodleian' },
            { pattern: /europeana\.eu/, name: 'Europeana' },
            { pattern: /cdm21059\.contentdm\.oclc\.org/, name: 'Florence' },
            { pattern: /gallica\.bnf\.fr/, name: 'Gallica' },
            { pattern: /uni-graz\.at|gams\.uni-graz\.at/, name: 'Graz' },
            { pattern: /internetculturale\.it/, name: 'Internet Culturale' },
            { pattern: /blb-karlsruhe\.de/, name: 'Karlsruhe' },
            { pattern: /themorgan\.org/, name: 'Morgan Library' },
            { pattern: /bsb-muenchen\.de/, name: 'Munich BSB' },
            { pattern: /glossa\.uni-graz\.at/, name: 'Graz Glossa' },
            { pattern: /nb\.no/, name: 'National Library of Norway' },
            { pattern: /dhb\.thulb\.uni-jena\.de/, name: 'Jena' },
            { pattern: /e-codices\.unifr\.ch/, name: 'e-codices' },
            { pattern: /digi\.ub\.uni-heidelberg\.de/, name: 'Heidelberg' },
            { pattern: /nbn-resolving\.de/, name: 'Wolfenbuttel' },
            { pattern: /socrates\.leidenuniv\.nl/, name: 'Leiden' },
            { pattern: /cdm\.csbsju\.edu/, name: 'St John\'s' },
            { pattern: /bavarikon\.de/, name: 'Bavarikon' },
            { pattern: /manuscripts\.ru/, name: 'Russian State Library' },
            { pattern: /nbm\.regione\.veneto\.it|nuovabibliotecamanoscritta\.it/, name: 'Verona' }
        ];
        
        for (const { pattern, name } of libraryPatterns) {
            if (pattern.test(url)) {
                return name;
            }
        }
        
        return 'Unknown';
    }
}