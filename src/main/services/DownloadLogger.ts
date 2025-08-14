import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    library: string;
    url?: string;
    message: string;
    details?: Record<string, unknown>;
    duration?: number;
    attemptNumber?: number;
    errorStack?: string;
}

export class DownloadLogger {
    private static instance: DownloadLogger;
    private logs: LogEntry[] = [];
    private maxLogs = 10000; // Keep last 10k log entries
    private sessionStartTime = new Date().toISOString();
    
    private constructor() {}
    
    static getInstance(): DownloadLogger {
        if (!this.instance) {
            this.instance = new DownloadLogger();
        }
        return this.instance;
    }
    
    log(entry: Omit<LogEntry, 'timestamp'>) {
        const logEntry: LogEntry = {
            ...entry,
            timestamp: new Date().toISOString()
        };
        
        this.logs.push(logEntry);
        
        // Keep only last maxLogs entries
        if (this.logs?.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // Also log to console for development
        const consoleMsg = `[${logEntry.library}] ${logEntry.message}`;
        switch (entry.level) {
            case 'error':
                console.error(consoleMsg, entry.details || '');
                break;
            case 'warn':
                console.warn(consoleMsg, entry.details || '');
                break;
            case 'debug':
                console.debug(consoleMsg, entry.details || '');
                break;
            default:
                console.log(consoleMsg, entry.details || '');
        }
    }
    
    logDownloadStart(library: string, url: string, details?: Record<string, unknown>) {
        this.log({
            level: 'info',
            library,
            url,
            message: 'Download started',
            details
        });
    }
    
    logDownloadProgress(library: string, url: string, bytesReceived: number, totalBytes?: number) {
        this.log({
            level: 'debug',
            library,
            url,
            message: `Progress: ${bytesReceived} bytes${totalBytes ? ` / ${totalBytes}` : ''}`,
            details: { bytesReceived, totalBytes }
        });
    }
    
    logDownloadComplete(library: string, url: string, duration: number, size: number) {
        this.log({
            level: 'info',
            library,
            url,
            message: `Download complete: ${(size / 1024 / 1024).toFixed(2)}MB in ${(duration / 1000).toFixed(1)}s`,
            duration,
            details: { size, speedMbps: (size / duration / 1024).toFixed(2) }
        });
    }
    
    logDownloadError(library: string, url: string, error: Error, attemptNumber?: number) {
        this.log({
            level: 'error',
            library,
            url,
            message: `Download failed: ${error.message}`,
            attemptNumber,
            errorStack: error.stack,
            details: {
                errorName: (error as any)?.name,
                errorMessage: error.message
            }
        });
    }
    
    logRetry(library: string, url: string, attemptNumber: number, delay: number) {
        this.log({
            level: 'warn',
            library,
            url,
            message: `Retrying download (attempt ${attemptNumber}) after ${delay}ms`,
            attemptNumber,
            details: { delay }
        });
    }
    
    logTimeout(library: string, url: string, timeoutMs: number, attemptNumber?: number) {
        this.log({
            level: 'error',
            library,
            url,
            message: `Download timed out after ${timeoutMs}ms`,
            attemptNumber,
            details: { timeoutMs }
        });
    }
    
    logStall(library: string, url: string, stallDuration: number, bytesReceived: number) {
        this.log({
            level: 'error',
            library,
            url,
            message: `Download stalled for ${stallDuration}ms at ${bytesReceived} bytes`,
            details: { stallDuration, bytesReceived }
        });
    }
    
    logManifestLoad(library: string, url: string, duration?: number, error?: Error) {
        if (error) {
            this.log({
                level: 'error',
                library,
                url,
                message: `Manifest load failed: ${error.message}`,
                errorStack: error.stack,
                duration
            });
        } else {
            this.log({
                level: 'info',
                library,
                url,
                message: `Manifest loaded successfully`,
                duration
            });
        }
    }
    
    logPageSkipped(library: string, pageNumber: number, reason: string) {
        this.log({
            level: 'warn',
            library,
            message: `Page ${pageNumber} skipped: ${reason}`,
            details: { pageNumber, reason }
        });
    }
    
    // PDF Creation Events
    logPdfCreationStart(library: string, totalImages: number, outputPath: string) {
        this.log({
            level: 'info',
            library,
            message: `Starting PDF creation with ${totalImages} images`,
            details: { totalImages, outputPath }
        });
    }
    
    logPdfCreationComplete(library: string, outputPath: string, fileSize: number, duration: number) {
        this.log({
            level: 'info',
            library,
            message: `PDF created successfully: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
            duration,
            details: { 
                outputPath, 
                fileSize, 
                fileSizeMB: (fileSize / 1024 / 1024).toFixed(2)
            }
        });
    }
    
    logPdfCreationError(library: string, error: Error, details?: Record<string, unknown>) {
        this.log({
            level: 'error',
            library,
            message: `PDF creation failed: ${error.message}`,
            errorStack: error.stack,
            details: { ...details, errorName: (error as any)?.name }
        });
    }
    
    // Overall Download Status
    logManuscriptDownloadComplete(library: string, url: string, totalPages: number, outputFiles: string[], duration: number) {
        this.log({
            level: 'info',
            library,
            url,
            message: `Manuscript download completed: ${totalPages} pages saved to ${outputFiles?.length} file(s)`,
            duration,
            details: { 
                totalPages, 
                outputFiles,
                durationSeconds: (duration / 1000).toFixed(1)
            }
        });
    }
    
    logManuscriptDownloadFailed(library: string, url: string, error: Error, failedAtStage: string) {
        this.log({
            level: 'error',
            library,
            url,
            message: `Manuscript download failed at ${failedAtStage}: ${error.message}`,
            errorStack: error.stack,
            details: { 
                failedAtStage,
                errorName: (error as any)?.name 
            }
        });
    }
    
    // Queue Events
    logQueueItemStart(library: string, url: string, queuePosition: number, totalInQueue: number) {
        this.log({
            level: 'info',
            library,
            url,
            message: `Processing queue item ${queuePosition}/${totalInQueue}`,
            details: { queuePosition, totalInQueue }
        });
    }
    
    logQueueItemComplete(library: string, url: string, success: boolean, duration: number) {
        this.log({
            level: success ? 'info' : 'error',
            library,
            url,
            message: `Queue item ${success ? 'completed' : 'failed'}`,
            duration,
            details: { success }
        });
    }
    
    // File System Events
    logFileSaved(library: string, filePath: string, fileSize: number) {
        this.log({
            level: 'info',
            library,
            message: `File saved: ${path.basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
            details: { 
                filePath, 
                fileSize,
                directory: path.dirname(filePath)
            }
        });
    }
    
    logDirectoryCreated(library: string, directoryPath: string) {
        this.log({
            level: 'debug',
            library,
            message: `Created directory: ${directoryPath}`,
            details: { directoryPath }
        });
    }
    
    getLogsForExport(): string {
        const exportData = {
            sessionStart: this.sessionStartTime,
            exportTime: new Date().toISOString(),
            totalLogs: this.logs?.length,
            systemInfo: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                appVersion: app.getVersion()
            },
            logs: this.logs
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    async saveLogsToFile(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `mss-downloader-logs-${timestamp}.json`;
        const filepath = path.join(app.getPath('downloads'), filename);
        
        await fs.promises.writeFile(filepath, this.getLogsForExport(), 'utf8');
        return filepath;
    }
    
    clearLogs() {
        this.logs = [];
        this.sessionStartTime = new Date().toISOString();
    }
    
    getRecentLogs(count: number = 100): LogEntry[] {
        return this.logs.slice(-count);
    }
    
    getLogsByLibrary(library: string): LogEntry[] {
        return this.logs.filter(log => log.library === library);
    }
    
    getErrorLogs(): LogEntry[] {
        return this.logs.filter(log => log.level === 'error');
    }
}