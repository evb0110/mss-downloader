import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { gzipSync, gunzipSync } from 'zlib';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory = 'network' | 'file' | 'manifest' | 'download' | 'pdf' | 'system' | 'renderer' | 'worker' | 'queue';

export interface LogContext {
    // System context
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    
    // Request context
    library?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    
    // Error context
    errorCode?: string;
    errorMessage?: string;
    errorStack?: string;
    errorType?: string;
    
    // Performance context
    duration?: number;
    bytesTransferred?: number;
    attemptNumber?: number;
    retryCount?: number;
    
    // File context
    filePath?: string;
    fileSize?: number;
    diskSpace?: number;
    
    // Network context
    dnsLookupTime?: number;
    connectionTime?: number;
    tlsTime?: number;
    firstByteTime?: number;
    downloadTime?: number;
    
    // Additional details
    details?: any;
}

export interface LogRotationConfig {
    maxFileSize: number; // in MB
    maxFiles: number;
    compressOldLogs: boolean;
}

export class ComprehensiveLogger {
    private static instance: ComprehensiveLogger;
    private logs: LogContext[] = [];
    private currentLogFile: string;
    private logStream: fs.WriteStream | null = null;
    private rotationConfig: LogRotationConfig = {
        maxFileSize: 10, // 10MB per file
        maxFiles: 5,
        compressOldLogs: true
    };
    
    // Performance metrics
    private sessionStartTime = Date.now();
    private logBuffer: LogContext[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL = 1000; // Flush every second
    private readonly MAX_MEMORY_LOGS = 5000; // Keep last 5k logs in memory
    
    // System info captured once per session
    private systemInfo: any;
    
    private constructor() {
        this.initializeLogger();
        this.captureSystemInfo();
        this.setupFlushInterval();
    }
    
    static getInstance(): ComprehensiveLogger {
        if (!this.instance) {
            this.instance = new ComprehensiveLogger();
        }
        return this.instance;
    }
    
    private initializeLogger() {
        const logsDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentLogFile = path.join(logsDir, `mss-downloader-${timestamp}.log`);
        
        this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
        
        // Log session start
        this.log({
            level: 'info',
            category: 'system',
            details: {
                message: 'Logging session started',
                version: app.getVersion(),
                logFile: this.currentLogFile
            }
        });
    }
    
    private captureSystemInfo() {
        this.systemInfo = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            appVersion: app.getVersion(),
            osRelease: os.release(),
            totalMemory: os.totalmem(),
            cpuCount: os.cpus().length,
            locale: app.getLocale(),
            userDataPath: app.getPath('userData'),
            tempPath: app.getPath('temp')
        };
    }
    
    private setupFlushInterval() {
        this.flushInterval = setInterval(() => {
            this.flushLogs();
        }, this.FLUSH_INTERVAL);
    }
    
    private async flushLogs() {
        if (this.logBuffer.length === 0) return;
        
        const logsToWrite = [...this.logBuffer];
        this.logBuffer = [];
        
        for (const log of logsToWrite) {
            const logLine = JSON.stringify(log) + '\n';
            this.logStream?.write(logLine);
        }
        
        // Check if rotation is needed
        await this.checkRotation();
    }
    
    private async checkRotation() {
        try {
            const stats = await fs.promises.stat(this.currentLogFile);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            if (fileSizeMB >= this.rotationConfig.maxFileSize) {
                await this.rotateLog();
            }
        } catch (error) {
            // Ignore stat errors
        }
    }
    
    private async rotateLog() {
        // Close current stream
        this.logStream?.end();
        
        // Compress old log if configured
        if (this.rotationConfig.compressOldLogs) {
            const content = await fs.promises.readFile(this.currentLogFile);
            const compressed = gzipSync(content);
            await fs.promises.writeFile(this.currentLogFile + '.gz', compressed);
            await fs.promises.unlink(this.currentLogFile);
        }
        
        // Clean up old logs
        await this.cleanupOldLogs();
        
        // Create new log file
        this.initializeLogger();
    }
    
    private async cleanupOldLogs() {
        const logsDir = path.join(app.getPath('userData'), 'logs');
        const files = await fs.promises.readdir(logsDir);
        const logFiles = files
            .filter(f => f.startsWith('mss-downloader-') && (f.endsWith('.log') || f.endsWith('.log.gz')))
            .sort()
            .reverse();
        
        if (logFiles.length > this.rotationConfig.maxFiles) {
            const filesToDelete = logFiles.slice(this.rotationConfig.maxFiles);
            for (const file of filesToDelete) {
                await fs.promises.unlink(path.join(logsDir, file));
            }
        }
    }
    
    log(context: Partial<LogContext>) {
        const fullContext: LogContext = {
            timestamp: new Date().toISOString(),
            level: context.level || 'info',
            category: context.category || 'system',
            ...context
        };
        
        // Add to memory buffer
        this.logs.push(fullContext);
        if (this.logs.length > this.MAX_MEMORY_LOGS) {
            this.logs = this.logs.slice(-this.MAX_MEMORY_LOGS);
        }
        
        // Add to disk buffer
        this.logBuffer.push(fullContext);
        
        // Console output for development
        this.consoleOutput(fullContext);
    }
    
    private consoleOutput(context: LogContext) {
        const prefix = `[${context.category}${context.library ? ':' + context.library : ''}]`;
        const message = context.errorMessage || context.details?.message || 'Log entry';
        
        switch (context.level) {
            case 'fatal':
            case 'error':
                console.error(prefix, message, context.details);
                break;
            case 'warn':
                console.warn(prefix, message, context.details);
                break;
            case 'debug':
                if (process.env.DEBUG) {
                    console.debug(prefix, message, context.details);
                }
                break;
            default:
                console.log(prefix, message, context.details);
        }
    }
    
    // Enhanced logging methods
    
    logNetworkRequest(url: string, options: {
        method?: string;
        headers?: Record<string, string>;
        library?: string;
        timeout?: number;
    }) {
        this.log({
            level: 'debug',
            category: 'network',
            url,
            method: options.method || 'GET',
            headers: options.headers,
            library: options.library,
            details: {
                message: 'Network request started',
                timeout: options.timeout
            }
        });
    }
    
    logNetworkResponse(url: string, response: {
        statusCode: number;
        headers?: Record<string, string>;
        duration: number;
        bytesReceived?: number;
        library?: string;
    }) {
        this.log({
            level: response.statusCode >= 400 ? 'error' : 'info',
            category: 'network',
            url,
            statusCode: response.statusCode,
            headers: response.headers,
            duration: response.duration,
            bytesTransferred: response.bytesReceived,
            library: response.library,
            details: {
                message: `Network response: ${response.statusCode}`,
                speedMbps: response.bytesReceived && response.duration 
                    ? ((response.bytesReceived / response.duration) / 1024).toFixed(2)
                    : undefined
            }
        });
    }
    
    logNetworkError(url: string, error: any, context: {
        library?: string;
        attemptNumber?: number;
        duration?: number;
    }) {
        this.log({
            level: 'error',
            category: 'network',
            url,
            library: context.library,
            attemptNumber: context.attemptNumber,
            duration: context.duration,
            errorCode: error.code,
            errorMessage: error.message,
            errorStack: error.stack,
            errorType: error.constructor.name,
            details: {
                message: 'Network request failed',
                errno: error.errno,
                syscall: error.syscall,
                address: error.address,
                port: error.port
            }
        });
    }
    
    logTimeout(url: string, timeoutMs: number, context: {
        library?: string;
        attemptNumber?: number;
        bytesReceived?: number;
    }) {
        this.log({
            level: 'error',
            category: 'network',
            url,
            library: context.library,
            attemptNumber: context.attemptNumber,
            bytesTransferred: context.bytesReceived,
            details: {
                message: `Request timed out after ${timeoutMs}ms`,
                timeoutMs,
                partialData: context.bytesReceived ? true : false
            }
        });
    }
    
    logFileOperation(operation: 'read' | 'write' | 'delete' | 'create', filePath: string, result: {
        success: boolean;
        error?: Error;
        fileSize?: number;
        duration?: number;
    }) {
        const diskSpace = this.getAvailableDiskSpace(filePath);
        
        this.log({
            level: result.success ? 'debug' : 'error',
            category: 'file',
            filePath,
            fileSize: result.fileSize,
            duration: result.duration,
            diskSpace,
            errorMessage: result.error?.message,
            errorStack: result.error?.stack,
            errorCode: (result.error as any)?.code,
            details: {
                message: `File ${operation} ${result.success ? 'succeeded' : 'failed'}`,
                operation,
                permissions: (result.error as any)?.code === 'EACCES' ? 'Permission denied' : undefined
            }
        });
    }
    
    logRendererError(error: {
        message: string;
        filename?: string;
        lineno?: number;
        colno?: number;
        stack?: string;
        type?: string;
    }) {
        this.log({
            level: 'error',
            category: 'renderer',
            errorMessage: error.message,
            errorStack: error.stack,
            errorType: error.type || 'JavaScriptError',
            details: {
                message: 'Renderer process error',
                filename: error.filename,
                line: error.lineno,
                column: error.colno
            }
        });
    }
    
    logWorkerError(workerType: string, error: Error, context?: any) {
        this.log({
            level: 'error',
            category: 'worker',
            errorMessage: error.message,
            errorStack: error.stack,
            details: {
                message: `Worker error: ${workerType}`,
                workerType,
                context
            }
        });
    }
    
    logUnhandledRejection(reason: any, promise: Promise<any>) {
        this.log({
            level: 'fatal',
            category: 'system',
            errorMessage: reason?.message || String(reason),
            errorStack: reason?.stack,
            errorType: 'UnhandledPromiseRejection',
            details: {
                message: 'Unhandled promise rejection',
                reason,
                promiseString: String(promise)
            }
        });
    }
    
    logUncaughtException(error: Error) {
        this.log({
            level: 'fatal',
            category: 'system',
            errorMessage: error.message,
            errorStack: error.stack,
            errorType: 'UncaughtException',
            details: {
                message: 'Uncaught exception',
                errorName: error.name
            }
        });
    }
    
    // Helper methods
    
    private getAvailableDiskSpace(filePath: string): number | undefined {
        try {
            // Note: statfs is not available in standard Node.js fs module
            // This is a placeholder - actual disk space checking would require
            // platform-specific implementations or external libraries
            return undefined;
        } catch {
            return undefined;
        }
    }
    
    // Export functionality
    
    async exportLogs(options?: {
        format?: 'json' | 'readable';
        includeDebug?: boolean;
        compress?: boolean;
    }): Promise<string> {
        const format = options?.format || 'json';
        const includeDebug = options?.includeDebug ?? false;
        const compress = options?.compress ?? false;
        
        // Flush any pending logs
        await this.flushLogs();
        
        const filteredLogs = includeDebug 
            ? this.logs 
            : this.logs.filter(log => log.level !== 'debug');
        
        const exportData = {
            sessionInfo: {
                startTime: new Date(this.sessionStartTime).toISOString(),
                exportTime: new Date().toISOString(),
                duration: Date.now() - this.sessionStartTime,
                totalLogs: filteredLogs.length,
                appVersion: app.getVersion()
            },
            systemInfo: this.systemInfo,
            logs: filteredLogs
        };
        
        let content: string;
        if (format === 'readable') {
            content = this.formatReadableLogs(exportData);
        } else {
            content = JSON.stringify(exportData, null, 2);
        }
        
        if (compress) {
            const compressed = gzipSync(Buffer.from(content));
            const filename = `mss-downloader-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}.gz`;
            const filepath = path.join(app.getPath('downloads'), filename);
            await fs.promises.writeFile(filepath, compressed);
            return filepath;
        } else {
            const filename = `mss-downloader-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
            const filepath = path.join(app.getPath('downloads'), filename);
            await fs.promises.writeFile(filepath, content, 'utf8');
            return filepath;
        }
    }
    
    private formatReadableLogs(data: any): string {
        let output = '=== MSS DOWNLOADER LOG EXPORT ===\n\n';
        
        output += 'SESSION INFORMATION:\n';
        output += `  Start Time: ${data.sessionInfo.startTime}\n`;
        output += `  Export Time: ${data.sessionInfo.exportTime}\n`;
        output += `  Duration: ${Math.round(data.sessionInfo.duration / 1000)}s\n`;
        output += `  Total Logs: ${data.sessionInfo.totalLogs}\n`;
        output += `  App Version: ${data.sessionInfo.appVersion}\n\n`;
        
        output += 'SYSTEM INFORMATION:\n';
        for (const [key, value] of Object.entries(data.systemInfo)) {
            output += `  ${key}: ${value}\n`;
        }
        output += '\n';
        
        output += 'LOG ENTRIES:\n';
        output += '─'.repeat(80) + '\n';
        
        for (const log of data.logs) {
            output += `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}]\n`;
            
            if (log.library) output += `  Library: ${log.library}\n`;
            if (log.url) output += `  URL: ${log.url}\n`;
            if (log.errorMessage) output += `  Error: ${log.errorMessage}\n`;
            if (log.statusCode) output += `  Status Code: ${log.statusCode}\n`;
            if (log.duration) output += `  Duration: ${log.duration}ms\n`;
            
            if (log.details) {
                output += `  Details: ${JSON.stringify(log.details, null, 2).split('\n').join('\n  ')}\n`;
            }
            
            if (log.errorStack && log.level === 'error' || log.level === 'fatal') {
                output += `  Stack Trace:\n    ${log.errorStack.split('\n').join('\n    ')}\n`;
            }
            
            output += '─'.repeat(80) + '\n';
        }
        
        return output;
    }
    
    // Cleanup
    
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flushLogs();
        this.logStream?.end();
    }
}

// Export singleton instance
export const comprehensiveLogger = ComprehensiveLogger.getInstance();