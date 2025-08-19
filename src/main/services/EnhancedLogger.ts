import { DownloadLogger } from './DownloadLogger';
import { comprehensiveLogger } from './ComprehensiveLogger';

/**
 * Enhanced Logging System for MSS Downloader
 * Provides meaningful, diagnostic logging with full context
 */

export interface ManuscriptContext {
    id: string;
    title?: string;
    library: string;
    url: string;
    totalPages?: number;
    estimatedSizeMB?: number;
    actualSizeMB?: number;
    chunkNumber?: number;
    totalChunks?: number;
}

export interface PerformanceMetrics {
    duration?: number;
    speedMbps?: number;
    eta?: number;
    bytesTransferred?: number;
    retryCount?: number;
    attemptNumber?: number;
}

export interface LibrarySpecificData {
    authentication?: string;
    qualityLevel?: string;
    serverResponseTime?: number;
    pageDetectionMethod?: string;
    binarySearchIterations?: number;
    chunkSplitReason?: string;
    zipFileStitching?: boolean;
}

export class EnhancedLogger {
    private static instance: EnhancedLogger;
    private downloadLogger: DownloadLogger;
    
    private constructor() {
        this.downloadLogger = DownloadLogger.getInstance();
    }
    
    static getInstance(): EnhancedLogger {
        if (!this.instance) {
            this.instance = new EnhancedLogger();
        }
        return this.instance;
    }

    // MANIFEST LOADING PHASE
    
    logManifestStart(context: ManuscriptContext, details?: LibrarySpecificData) {
        const message = `Loading ${context.library} manuscript: ${context.title || context.id}`;
        
        console.log(`[MANIFEST] ${message}`);
        console.log(`[MANIFEST] URL: ${context.url}`);
        
        if (details?.authentication) {
            console.log(`[MANIFEST] ${context.library} auth: ${details.authentication}`);
        }
        
        this.downloadLogger.log({
            level: 'info',
            library: context.library,
            url: context.url,
            message: `Manifest loading started`,
            details: {
                manuscriptId: context.id,
                title: context.title,
                ...details
            }
        });
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library: context.library,
            url: context.url,
            details: {
                message,
                manuscriptId: context.id,
                title: context.title,
                ...details
            }
        });
    }
    
    logManifestProgress(context: ManuscriptContext, progress: string, data?: LibrarySpecificData) {
        const message = `${context.library}: ${progress}`;
        
        console.log(`[MANIFEST] ${message}`);
        
        if (data?.binarySearchIterations) {
            console.log(`[MANIFEST] ${context.library} binary search: ${data.binarySearchIterations} iterations`);
        }
        
        if (data?.pageDetectionMethod) {
            console.log(`[MANIFEST] ${context.library} page detection: ${data.pageDetectionMethod}`);
        }
        
        this.downloadLogger.log({
            level: 'debug',
            library: context.library,
            url: context.url,
            message: progress,
            details: data
        });
    }
    
    logManifestComplete(context: ManuscriptContext, metrics: PerformanceMetrics, data?: LibrarySpecificData) {
        const sizeMB = context.estimatedSizeMB || 0;
        const avgPageSize = context.totalPages ? (sizeMB / context.totalPages * 1024).toFixed(0) : 'unknown';
        const duration = metrics.duration ? `${(metrics.duration / 1000).toFixed(1)}s` : 'unknown';
        
        const message = `Parsed ${context.totalPages} pages, ${sizeMB.toFixed(1)}MB estimated (${avgPageSize}KB avg/page)`;
        
        console.log(`[MANIFEST] ${context.library} ${context.title || context.id}: ${message} in ${duration}`);
        
        if (context.totalChunks && context.totalChunks > 1) {
            console.log(`[MANIFEST] ${context.library}: Will split into ${context.totalChunks} chunks (${data?.chunkSplitReason || 'size optimization'})`);
        }
        
        this.downloadLogger.logManifestLoad(context.library, context.url, metrics.duration);
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            library: context.library,
            url: context.url,
            duration: metrics.duration,
            details: {
                message: `Manifest parsing complete`,
                totalPages: context.totalPages,
                estimatedSizeMB: context.estimatedSizeMB,
                avgPageSizeKB: avgPageSize,
                totalChunks: context.totalChunks,
                ...data
            }
        });
    }
    
    // DOWNLOAD PHASE
    
    logDownloadStart(context: ManuscriptContext, data?: LibrarySpecificData) {
        const chunkInfo = context.totalChunks && context.totalChunks > 1 
            ? ` - Part ${context.chunkNumber}/${context.totalChunks}` 
            : '';
        const sizeInfo = context.estimatedSizeMB ? ` (~${context.estimatedSizeMB.toFixed(1)}MB)` : '';
        const pageRange = context.chunkNumber && context.totalChunks && context.totalChunks > 1
            ? ` (pages ${this.calculatePageRange(context)})`
            : ` (${context.totalPages} pages)`;
        
        const message = `Starting ${context.library} ${context.title || context.id}${chunkInfo}${pageRange}${sizeInfo}`;
        
        console.log(`[DOWNLOAD] ${message}`);
        
        if (data?.qualityLevel) {
            console.log(`[DOWNLOAD] ${context.library} quality: ${data.qualityLevel}`);
        }
        
        if (data?.authentication) {
            console.log(`[DOWNLOAD] ${context.library} auth status: ${data.authentication}`);
        }
        
        this.downloadLogger.logDownloadStart(context.library, context.url, {
            manuscriptId: context.id,
            title: context.title,
            chunkNumber: context.chunkNumber,
            totalChunks: context.totalChunks,
            estimatedSizeMB: context.estimatedSizeMB,
            ...data
        });
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'download',
            library: context.library,
            url: context.url,
            details: {
                message: `Download started`,
                manuscriptId: context.id,
                title: context.title,
                chunkInfo,
                pageRange,
                sizeInfo,
                ...data
            }
        });
    }
    
    logDownloadProgress(context: ManuscriptContext, current: number, total: number, metrics: PerformanceMetrics, data?: LibrarySpecificData) {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        const speedMbps = metrics.speedMbps || 0;
        const eta = metrics.eta ? `${Math.round(metrics.eta)}s` : 'calculating';
        const transferred = metrics.bytesTransferred ? `${(metrics.bytesTransferred / 1024 / 1024).toFixed(1)}MB` : '';
        
        const chunkInfo = context.totalChunks && context.totalChunks > 1 
            ? ` - Part ${context.chunkNumber}/${context.totalChunks}` 
            : '';
        
        const message = `${context.library} ${context.title || context.id}${chunkInfo}: ${percentage}% (${current}/${total} pages, ${transferred}, ${speedMbps.toFixed(1)}MB/s, ETA ${eta})`;
        
        console.log(`[PROGRESS] ${message}`);
        
        this.downloadLogger.logDownloadProgress(context.library, context.url, metrics.bytesTransferred || 0, context.estimatedSizeMB ? context.estimatedSizeMB * 1024 * 1024 : undefined);
        
        comprehensiveLogger.log({
            level: 'debug',
            category: 'download',
            library: context.library,
            url: context.url,
            details: {
                message: `Download progress`,
                percentage,
                current,
                total,
                speedMbps,
                eta: metrics.eta,
                bytesTransferred: metrics.bytesTransferred,
                chunkInfo,
                ...data
            }
        });
    }
    
    logDownloadError(context: ManuscriptContext, error: Error, metrics: PerformanceMetrics, retryInfo?: { willRetry: boolean; nextAttempt?: number; maxRetries?: number }) {
        const chunkInfo = context.totalChunks && context.totalChunks > 1 
            ? ` - Part ${context.chunkNumber}/${context.totalChunks}` 
            : '';
        
        const errorMsg = `${context.library} ${context.title || context.id}${chunkInfo}: ${error.message}`;
        
        if (retryInfo?.willRetry) {
            const retryMsg = ` after ${(metrics.duration || 0) / 1000}s, retrying (attempt ${retryInfo.nextAttempt}/${retryInfo.maxRetries})`;
            console.log(`[ERROR] ${errorMsg}${retryMsg}`);
        } else {
            console.log(`[ERROR] ${errorMsg} - FAILED PERMANENTLY`);
        }
        
        this.downloadLogger.logDownloadError(context.library, context.url, error, metrics.attemptNumber);
        
        comprehensiveLogger.logNetworkError(context.url, error, {
            library: context.library,
            attemptNumber: metrics.attemptNumber,
            duration: metrics.duration
        });
    }
    
    logDownloadSuccess(context: ManuscriptContext, metrics: PerformanceMetrics, outputPath: string) {
        const chunkInfo = context.totalChunks && context.totalChunks > 1 
            ? ` - Part ${context.chunkNumber}/${context.totalChunks}` 
            : '';
        const duration = metrics.duration ? `${(metrics.duration / 1000).toFixed(1)}s` : 'unknown';
        const speed = metrics.speedMbps ? `${metrics.speedMbps.toFixed(2)}MB/s` : 'unknown';
        const sizeMB = context.actualSizeMB || context.estimatedSizeMB || 0;
        const retryInfo = metrics.retryCount ? `, ${metrics.retryCount} retries` : '';
        
        const message = `${context.library} ${context.title || context.id}${chunkInfo} complete: ${sizeMB.toFixed(1)}MB in ${duration} (${speed}${retryInfo})`;
        
        console.log(`[SUCCESS] ${message}`);
        
        this.downloadLogger.logDownloadComplete(context.library, context.url, metrics.duration || 0, (sizeMB * 1024 * 1024));
        this.downloadLogger.logFileSaved(context.library, outputPath, sizeMB * 1024 * 1024);
        
        comprehensiveLogger.log({
            level: 'info',
            category: 'download',
            library: context.library,
            url: context.url,
            duration: metrics.duration,
            details: {
                message: `Download completed successfully`,
                manuscriptId: context.id,
                title: context.title,
                chunkInfo,
                actualSizeMB: context.actualSizeMB,
                speedMbps: metrics.speedMbps,
                retryCount: metrics.retryCount,
                outputPath
            }
        });
    }
    
    // LIBRARY-SPECIFIC LOGGING
    
    logRomeBinarySearch(context: ManuscriptContext, iteration: number, range: { min: number; max: number; testing: number }, result: 'exists' | 'missing' | 'error') {
        console.log(`[ROME] ${context.title || context.id} binary search iteration ${iteration}: testing page ${range.testing} (range ${range.min}-${range.max}) = ${result}`);
        
        this.downloadLogger.log({
            level: 'debug',
            library: 'Rome',
            message: `Binary search iteration ${iteration}`,
            details: {
                manuscriptId: context.id,
                iteration,
                range,
                result
            }
        });
    }
    
    logRomanArchiveFolioProbing(context: ManuscriptContext, probingInfo: { testPoints: number[]; validFolios: number[]; discoveredRange?: { min: number; max: number } }) {
        const validCount = probingInfo.validFolios.length;
        const rangeInfo = probingInfo.discoveredRange 
            ? ` (range ${probingInfo.discoveredRange.min}-${probingInfo.discoveredRange.max})`
            : '';
            
        console.log(`[ROMAN-ARCHIVE] ${context.title || context.id}: Folio probing found ${validCount} valid folios${rangeInfo} - prevents 404 errors`);
        
        if (validCount > 0) {
            console.log(`[ROMAN-ARCHIVE] ${context.title || context.id}: Valid folios: [${probingInfo.validFolios.join(', ')}]`);
        }
        
        this.downloadLogger.log({
            level: 'info',
            library: 'Roman Archive',
            message: `Intelligent folio probing completed`,
            details: {
                manuscriptId: context.id,
                testPointsChecked: probingInfo.testPoints.length,
                validFoliosFound: validCount,
                validFolios: probingInfo.validFolios,
                discoveredRange: probingInfo.discoveredRange
            }
        });
    }
    
    logRomanArchiveChunking(context: ManuscriptContext, chunkStrategy: { chunksCount: number; reason: string; chunkSizeMB: number }) {
        console.log(`[ROMAN-ARCHIVE] ${context.title || context.id}: Splitting into ${chunkStrategy.chunksCount} chunks (${chunkStrategy.chunkSizeMB.toFixed(1)}MB each) - ${chunkStrategy.reason}`);
        
        this.downloadLogger.log({
            level: 'info',
            library: 'Roman Archive',
            message: `Chunk strategy determined`,
            details: {
                manuscriptId: context.id,
                ...chunkStrategy
            }
        });
    }
    
    logMorganZipStitching(context: ManuscriptContext, progress: { current: number; total: number; currentFile: string }) {
        console.log(`[MORGAN] ${context.title || context.id}: Stitching .zif files ${progress.current}/${progress.total} (${progress.currentFile})`);
        
        this.downloadLogger.log({
            level: 'debug',
            library: 'Morgan',
            message: `ZIP file stitching progress`,
            details: {
                manuscriptId: context.id,
                ...progress
            }
        });
    }
    
    logVaticanAuth(context: ManuscriptContext, authStatus: { status: 'valid' | 'invalid' | 'refreshed'; tokenAge?: number }) {
        console.log(`[VATICAN] ${context.title || context.id}: Auth token ${authStatus.status}${authStatus.tokenAge ? ` (${Math.round(authStatus.tokenAge / 60000)}m old)` : ''}`);
        
        this.downloadLogger.log({
            level: 'info',
            library: 'Vatican',
            message: `Authentication status: ${authStatus.status}`,
            details: {
                manuscriptId: context.id,
                ...authStatus
            }
        });
    }
    
    logBDLQualityFallback(context: ManuscriptContext, qualityAttempt: { from: string; to: string; reason: string }) {
        console.log(`[BDL] ${context.title || context.id}: Quality fallback ${qualityAttempt.from} → ${qualityAttempt.to} (${qualityAttempt.reason})`);
        
        this.downloadLogger.log({
            level: 'warn',
            library: 'BDL',
            message: `Quality fallback applied`,
            details: {
                manuscriptId: context.id,
                ...qualityAttempt
            }
        });
    }
    
    logOrleansDecryption(context: ManuscriptContext, decryptionInfo: { encrypted: boolean; method?: string; success?: boolean }) {
        if (decryptionInfo.encrypted) {
            console.log(`[ORLEANS] ${context.title || context.id}: Encrypted manifest ${decryptionInfo.method ? `(${decryptionInfo.method})` : ''} - ${decryptionInfo.success ? 'decryption successful' : 'decryption failed'}`);
        }
        
        this.downloadLogger.log({
            level: decryptionInfo.success === false ? 'error' : 'info',
            library: 'Orleans',
            message: `Manifest decryption`,
            details: {
                manuscriptId: context.id,
                ...decryptionInfo
            }
        });
    }
    
    // HELPER METHODS
    
    private calculatePageRange(context: ManuscriptContext): string {
        if (!context.chunkNumber || !context.totalChunks || !context.totalPages) {
            return 'unknown';
        }
        
        const pagesPerChunk = Math.ceil(context.totalPages / context.totalChunks);
        const startPage = (context.chunkNumber - 1) * pagesPerChunk + 1;
        const endPage = Math.min(context.chunkNumber * pagesPerChunk, context.totalPages);
        
        return `${startPage}-${endPage}`;
    }
}

// Export singleton instance
export const enhancedLogger = EnhancedLogger.getInstance();