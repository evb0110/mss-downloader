import * as fs from 'fs';
import * as path from 'path';
import { comprehensiveLogger } from './ComprehensiveLogger';

/**
 * Wrapper around file system operations that adds comprehensive logging
 */
export class LoggedFileOperations {
    static async readFile(filePath: string, encoding?: BufferEncoding): Promise<Buffer | string> {
        const startTime = Date.now();
        try {
            const stats = await fs.promises.stat(filePath).catch(() => null);
            const result = encoding 
                ? await fs.promises.readFile(filePath, encoding)
                : await fs.promises.readFile(filePath);
            
            comprehensiveLogger.logFileOperation('read', filePath, {
                success: true,
                fileSize: stats?.size,
                duration: Date.now() - startTime
            });
            
            return result;
        } catch (error: any) {
            comprehensiveLogger.logFileOperation('read', filePath, {
                success: false,
                error,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }
    
    static async writeFile(filePath: string, data: Buffer | string, encoding?: BufferEncoding): Promise<void> {
        const startTime = Date.now();
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.promises.mkdir(dir, { recursive: true });
            
            if (encoding) {
                await fs.promises.writeFile(filePath, data, encoding);
            } else {
                await fs.promises.writeFile(filePath, data);
            }
            
            const stats = await fs.promises.stat(filePath);
            
            comprehensiveLogger.logFileOperation('write', filePath, {
                success: true,
                fileSize: stats.size,
                duration: Date.now() - startTime
            });
        } catch (error: any) {
            comprehensiveLogger.logFileOperation('write', filePath, {
                success: false,
                error,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }
    
    static async mkdir(dirPath: string, options?: fs.MakeDirectoryOptions): Promise<string | undefined> {
        const startTime = Date.now();
        try {
            const result = await fs.promises.mkdir(dirPath, options);
            
            comprehensiveLogger.logFileOperation('create', dirPath, {
                success: true,
                duration: Date.now() - startTime
            });
            
            return result;
        } catch (error: any) {
            // Don't log EEXIST errors when recursive: true
            if ((error as any)?.code !== 'EEXIST' || !options?.recursive) {
                comprehensiveLogger.logFileOperation('create', dirPath, {
                    success: false,
                    error,
                    duration: Date.now() - startTime
                });
            }
            throw error;
        }
    }
    
    static async unlink(filePath: string): Promise<void> {
        const startTime = Date.now();
        try {
            const stats = await fs.promises.stat(filePath).catch(() => null);
            await fs.promises.unlink(filePath);
            
            comprehensiveLogger.logFileOperation('delete', filePath, {
                success: true,
                fileSize: stats?.size,
                duration: Date.now() - startTime
            });
        } catch (error: any) {
            comprehensiveLogger.logFileOperation('delete', filePath, {
                success: false,
                error,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }
    
    static async exists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    static async readdir(dirPath: string): Promise<string[]> {
        const startTime = Date.now();
        try {
            const files = await fs.promises.readdir(dirPath);
            
            comprehensiveLogger.log({
                level: 'debug',
                category: 'file',
                filePath: dirPath,
                duration: Date.now() - startTime,
                details: {
                    message: 'Directory read successful',
                    fileCount: files.length
                }
            });
            
            return files;
        } catch (error: any) {
            comprehensiveLogger.logFileOperation('read', dirPath, {
                success: false,
                error,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }
    
    static async stat(filePath: string): Promise<fs.Stats> {
        const startTime = Date.now();
        try {
            const stats = await fs.promises.stat(filePath);
            
            comprehensiveLogger.log({
                level: 'debug',
                category: 'file',
                filePath,
                fileSize: stats.size,
                duration: Date.now() - startTime,
                details: {
                    message: 'File stat successful',
                    isDirectory: stats.isDirectory(),
                    isFile: stats.isFile(),
                    mode: stats.mode,
                    modified: stats.mtime
                }
            });
            
            return stats;
        } catch (error: any) {
            comprehensiveLogger.logFileOperation('read', filePath, {
                success: false,
                error,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }
    
    static async copyFile(src: string, dest: string): Promise<void> {
        const startTime = Date.now();
        try {
            const srcStats = await fs.promises.stat(src);
            await fs.promises.copyFile(src, dest);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'file',
                filePath: src,
                fileSize: srcStats.size,
                duration: Date.now() - startTime,
                details: {
                    message: 'File copied successfully',
                    source: src,
                    destination: dest
                }
            });
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'file',
                filePath: src,
                duration: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorCode: (error as any)?.code,
                details: {
                    message: 'File copy failed',
                    source: src,
                    destination: dest
                }
            });
            throw error;
        }
    }
    
    static async rename(oldPath: string, newPath: string): Promise<void> {
        const startTime = Date.now();
        try {
            const stats = await fs.promises.stat(oldPath).catch(() => null);
            await fs.promises.rename(oldPath, newPath);
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'file',
                filePath: oldPath,
                fileSize: stats?.size,
                duration: Date.now() - startTime,
                details: {
                    message: 'File renamed successfully',
                    oldPath,
                    newPath
                }
            });
        } catch (error: any) {
            comprehensiveLogger.log({
                level: 'error',
                category: 'file',
                filePath: oldPath,
                duration: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorCode: (error as any)?.code,
                details: {
                    message: 'File rename failed',
                    oldPath,
                    newPath
                }
            });
            throw error;
        }
    }
}