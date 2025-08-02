import { app } from 'electron';
import Store from 'electron-store';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';

/**
 * Service to handle version migrations and ensure clean state between versions
 * CRITICAL: This service ensures all caches and data are wiped on version changes
 * to prevent any corruption or issues from old cached data
 */
export class VersionMigrationService {
    private store: Store<{ lastVersion: string }>;
    private currentVersion: string;
    
    constructor() {
        this.store = new Store<{ lastVersion: string }>({
            name: 'version-info',
            defaults: { lastVersion: '' }
        });
        
        // Get current version from package.json
        this.currentVersion = app.getVersion();
    }
    
    /**
     * Check if version has changed and perform migration if needed
     * @returns true if migration was performed
     */
    async checkAndMigrate(): Promise<boolean> {
        const lastVersion = this.store.get('lastVersion');
        
        // If no last version stored, this is first run
        if (!lastVersion) {
            console.log('First run detected, storing version:', this.currentVersion);
            this.store.set('lastVersion', this.currentVersion);
            return false;
        }
        
        // If version hasn't changed, no migration needed
        if (lastVersion === this.currentVersion) {
            console.log('Version unchanged:', this.currentVersion);
            return false;
        }
        
        // Version has changed - perform full wipe
        console.log(`Version changed from ${lastVersion} to ${this.currentVersion} - PERFORMING FULL CACHE WIPE`);
        
        try {
            await this.performFullWipe();
            
            // Update stored version after successful wipe
            this.store.set('lastVersion', this.currentVersion);
            
            console.log('Version migration completed successfully');
            return true;
        } catch (error) {
            console.error('Failed to perform version migration:', error);
            throw error;
        }
    }
    
    /**
     * Perform complete wipe of all caches and temporary data
     * MANDATORY: This ensures no old data persists between versions
     */
    private async performFullWipe(): Promise<void> {
        const userDataPath = app.getPath('userData');
        
        // List of directories to completely wipe
        const directoriesToWipe = [
            'cache',           // ElectronImageCache directory
            'temp-images',     // Temporary images directory
            'manifests',       // Manifest cache directory
            'logs',           // Old logs directory
            '.devkit'         // Development kit directory if exists
        ];
        
        // List of files to delete
        const filesToDelete = [
            'download-queue.json',    // Old queue file
            'config.json',           // Old config file (will be recreated with defaults)
            'metadata.json'          // Cache metadata
        ];
        
        console.log('Starting full cache wipe...');
        
        // Wipe directories
        for (const dir of directoriesToWipe) {
            const dirPath = path.join(userDataPath, dir);
            if (fsSync.existsSync(dirPath)) {
                try {
                    console.log(`Wiping directory: ${dirPath}`);
                    await fs.rm(dirPath, { recursive: true, force: true });
                } catch (error) {
                    console.warn(`Failed to wipe directory ${dirPath}:`, error);
                }
            }
        }
        
        // Delete specific files
        for (const file of filesToDelete) {
            const filePath = path.join(userDataPath, file);
            if (fsSync.existsSync(filePath)) {
                try {
                    console.log(`Deleting file: ${filePath}`);
                    await fs.unlink(filePath);
                } catch (error) {
                    console.warn(`Failed to delete file ${filePath}:`, error);
                }
            }
        }
        
        // Clear electron-store data (except version info)
        try {
            // Get all stores in userData
            const storeFiles = await fs.readdir(userDataPath);
            for (const file of storeFiles) {
                // Delete all .json files that look like electron-store files
                // except our version-info.json
                if (file.endsWith('.json') && 
                    !file.includes('version-info') && 
                    !file.includes('package')) {
                    const filePath = path.join(userDataPath, file);
                    try {
                        console.log(`Deleting store file: ${filePath}`);
                        await fs.unlink(filePath);
                    } catch (error) {
                        console.warn(`Failed to delete store file ${filePath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to clear electron-store files:', error);
        }
        
        console.log('Full cache wipe completed');
    }
    
    /**
     * Force a full wipe regardless of version
     * Used for manual cache clearing operations
     */
    async forceFullWipe(): Promise<void> {
        console.log('Forced full cache wipe requested');
        await this.performFullWipe();
    }
}