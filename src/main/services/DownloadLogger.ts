import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    library: string;
    url?: string;
    message: string;
    details?: any;
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
        if (this.logs.length > this.maxLogs) {
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
    
    logDownloadStart(library: string, url: string, details?: any) {
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
                errorName: error.name,
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
    
    getLogsForExport(): string {
        const exportData = {
            sessionStart: this.sessionStartTime,
            exportTime: new Date().toISOString(),
            totalLogs: this.logs.length,
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