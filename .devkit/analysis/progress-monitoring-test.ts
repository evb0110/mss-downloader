/**
 * Progress Monitoring System Test
 * 
 * Comprehensive test suite for the progress monitoring system
 * Tests core functionality, edge cases, and integration patterns
 */

import { ProgressMonitoringService, ProgressSnapshot, ProgressTrend } from '../src/main/services/ProgressMonitoringService.js';
import { DownloadProgressIntegration } from '../src/main/services/DownloadProgressIntegration.js';
import { progressMonitoringConfig } from '../src/main/services/ProgressMonitoringConfig.js';
import type { TLibrary } from '../src/shared/queueTypes.js';

interface TestResult {
    testName: string;
    passed: boolean;
    error?: string;
    duration?: number;
}

class ProgressMonitoringTester {
    private results: TestResult[] = [];
    private progressMonitor: ProgressMonitoringService;
    private progressIntegration: DownloadProgressIntegration;

    constructor() {
        this.progressMonitor = ProgressMonitoringService.getInstance();
        this.progressIntegration = new DownloadProgressIntegration();
    }

    /**
     * Run all tests
     */
    public async runAllTests(): Promise<TestResult[]> {
        console.log('🧪 Starting Progress Monitoring System Tests...\n');

        // Basic functionality tests
        await this.testSessionCreation();
        await this.testProgressUpdates();
        await this.testTrendAnalysis();
        await this.testTimeoutDetection();
        await this.testStuckDetection();
        await this.testSlowProgressDetection();
        await this.testSessionCompletion();
        
        // Configuration tests
        await this.testLibraryConfigurations();
        await this.testTimeoutCalculations();
        await this.testRecommendationEngine();
        
        // Integration tests
        await this.testDownloadIntegration();
        await this.testMultipleSessionsHandling();
        await this.testErrorHandling();
        
        // Performance tests
        await this.testMemoryUsage();
        await this.testConcurrentSessions();

        this.printResults();
        return this.results;
    }

    /**
     * Test session creation
     */
    private async testSessionCreation(): Promise<void> {
        await this.runTest('Session Creation', async () => {
            const sessionId = 'test-session-creation';
            const session = this.progressMonitor.createSession(
                sessionId,
                'https://example.com/test',
                'gallica',
                100
            );

            if (!session) throw new Error('Session not created');
            if (session.id !== sessionId) throw new Error('Session ID mismatch');
            if (session.library !== 'gallica') throw new Error('Library mismatch');
            if (session.totalPages !== 100) throw new Error('Total pages mismatch');
            if (session.snapshots.length !== 0) throw new Error('Initial snapshots should be empty');

            this.progressMonitor.cancelSession(sessionId);
        });
    }

    /**
     * Test progress updates
     */
    private async testProgressUpdates(): Promise<void> {
        await this.runTest('Progress Updates', async () => {
            const sessionId = 'test-progress-updates';
            this.progressMonitor.createSession(sessionId, 'https://example.com/test', 'gallica', 100);

            // Add multiple progress updates
            this.progressMonitor.updateProgress(sessionId, 10, 100, 'downloading');
            this.progressMonitor.updateProgress(sessionId, 25, 100, 'downloading');
            this.progressMonitor.updateProgress(sessionId, 50, 100, 'downloading');

            const activeSessions = this.progressMonitor.getActiveSessions();
            const session = activeSessions.find(s => s.id === sessionId);

            if (!session) throw new Error('Session not found');
            if (session.snapshots.length !== 3) throw new Error(`Expected 3 snapshots, got ${session.snapshots.length}`);
            
            const lastSnapshot = session.snapshots[session.snapshots.length - 1];
            if (lastSnapshot.current !== 50) throw new Error('Last progress not updated correctly');
            if (lastSnapshot.percentage !== 50) throw new Error('Percentage calculation incorrect');

            this.progressMonitor.cancelSession(sessionId);
        });
    }

    /**
     * Test trend analysis
     */
    private async testTrendAnalysis(): Promise<void> {
        await this.runTest('Trend Analysis', async () => {
            const sessionId = 'test-trend-analysis';
            this.progressMonitor.createSession(sessionId, 'https://example.com/test', 'gallica', 100);

            // Simulate progress over time
            const baseTime = Date.now();
            const updates = [
                { current: 0, time: baseTime },
                { current: 10, time: baseTime + 60000 },  // 10 pages in 1 minute = 10 pages/min
                { current: 25, time: baseTime + 120000 }, // 15 more pages in 1 minute = 15 pages/min
                { current: 40, time: baseTime + 180000 }  // 15 more pages in 1 minute = 15 pages/min
            ];

            for (const update of updates) {
                // Mock timestamp
                const originalNow = Date.now;
                Date.now = () => update.time;
                
                this.progressMonitor.updateProgress(sessionId, update.current, 100, 'downloading');
                
                Date.now = originalNow;
            }

            const trend = this.progressMonitor.getProgressTrend(sessionId);
            if (!trend) throw new Error('Trend analysis not available');

            // Average speed should be around 12-13 pages/min
            if (trend.averageSpeed < 10 || trend.averageSpeed > 15) {
                throw new Error(`Expected speed 10-15 pages/min, got ${trend.averageSpeed.toFixed(1)}`);
            }

            if (trend.isStuck) throw new Error('Should not be detected as stuck');
            if (trend.isSlow && trend.averageSpeed > 10) throw new Error('Should not be detected as slow for good speed');

            this.progressMonitor.cancelSession(sessionId);
        });
    }

    /**
     * Test timeout detection
     */
    private async testTimeoutDetection(): Promise<void> {
        await this.runTest('Timeout Detection', async () => {
            return new Promise<void>((resolve, reject) => {
                const sessionId = 'test-timeout';
                
                // Listen for timeout event
                const timeoutHandler = (event: any) => {
                    if (event.sessionId === sessionId) {
                        this.progressMonitor.off('timeout', timeoutHandler);
                        resolve();
                    }
                };
                
                this.progressMonitor.on('timeout', timeoutHandler);
                
                // Create session with very short timeout by modifying config
                const originalConfig = progressMonitoringConfig.getLibraryConfig('gallica');
                progressMonitoringConfig.updateLibraryConfig('gallica', {
                    ...originalConfig,
                    baseTimeoutMinutes: 0.01 // 0.6 seconds
                });
                
                this.progressMonitor.createSession(sessionId, 'https://example.com/test', 'gallica', 10);
                
                // Restore original config after timeout
                setTimeout(() => {
                    progressMonitoringConfig.updateLibraryConfig('gallica', originalConfig);
                    
                    // If no timeout event fired, fail the test
                    setTimeout(() => {
                        this.progressMonitor.off('timeout', timeoutHandler);
                        reject(new Error('Timeout event not fired'));
                    }, 2000);
                }, 100);
            });
        });
    }

    /**
     * Test stuck detection
     */
    private async testStuckDetection(): Promise<void> {
        await this.runTest('Stuck Detection', async () => {
            return new Promise<void>((resolve, reject) => {
                const sessionId = 'test-stuck';
                
                // Listen for stuck detection event
                const stuckHandler = (event: any) => {
                    if (event.sessionId === sessionId) {
                        this.progressMonitor.off('stuckDetected', stuckHandler);
                        this.progressMonitor.cancelSession(sessionId);
                        resolve();
                    }
                };
                
                this.progressMonitor.on('stuckDetected', stuckHandler);
                
                // Create session and simulate stuck progress
                this.progressMonitor.createSession(sessionId, 'https://example.com/test', 'gallica', 100);
                
                // Initial progress
                this.progressMonitor.updateProgress(sessionId, 10, 100, 'downloading');
                
                // Wait longer than stuck threshold (default is 5 minutes, but we'll use shorter for testing)
                const originalConfig = progressMonitoringConfig.getLibraryConfig('gallica');
                progressMonitoringConfig.updateLibraryConfig('gallica', {
                    ...originalConfig,
                    stuckThresholdMinutes: 0.01 // 0.6 seconds
                });
                
                setTimeout(() => {
                    progressMonitoringConfig.updateLibraryConfig('gallica', originalConfig);
                    
                    // If no stuck event fired, fail the test
                    setTimeout(() => {
                        this.progressMonitor.off('stuckDetected', stuckHandler);
                        this.progressMonitor.cancelSession(sessionId);
                        reject(new Error('Stuck detection event not fired'));
                    }, 2000);
                }, 100);
            });
        });
    }

    /**
     * Test slow progress detection
     */
    private async testSlowProgressDetection(): Promise<void> {
        await this.runTest('Slow Progress Detection', async () => {
            const sessionId = 'test-slow-progress';
            this.progressMonitor.createSession(sessionId, 'https://example.com/test', 'gallica', 1000);

            // Simulate very slow progress
            const baseTime = Date.now();
            const slowUpdates = [
                { current: 0, time: baseTime },
                { current: 1, time: baseTime + 60000 },  // 1 page in 1 minute = 1 page/min (very slow)
                { current: 2, time: baseTime + 120000 }  // 1 more page in 1 minute = 1 page/min
            ];

            for (const update of slowUpdates) {
                const originalNow = Date.now;
                Date.now = () => update.time;
                
                this.progressMonitor.updateProgress(sessionId, update.current, 1000, 'downloading');
                
                Date.now = originalNow;
            }

            const trend = this.progressMonitor.getProgressTrend(sessionId);
            if (!trend) throw new Error('Trend analysis not available');

            if (!trend.isSlow) throw new Error('Should be detected as slow (1 page/min < 2 pages/min threshold)');
            if (trend.averageSpeed > 2) throw new Error(`Speed too high for slow detection: ${trend.averageSpeed}`);

            this.progressMonitor.cancelSession(sessionId);
        });
    }

    /**
     * Test session completion
     */
    private async testSessionCompletion(): Promise<void> {
        await this.runTest('Session Completion', async () => {
            return new Promise<void>((resolve, reject) => {
                const sessionId = 'test-completion';
                
                const completionHandler = (event: any) => {
                    if (event.sessionId === sessionId) {
                        this.progressMonitor.off('sessionCompleted', completionHandler);
                        
                        if (!event.success) {
                            reject(new Error('Session marked as failed'));
                            return;
                        }
                        
                        // Check that session is no longer active
                        setTimeout(() => {
                            const activeSessions = this.progressMonitor.getActiveSessions();
                            const stillActive = activeSessions.find(s => s.id === sessionId);
                            
                            if (stillActive) {
                                reject(new Error('Session still active after completion'));
                            } else {
                                resolve();
                            }
                        }, 100);
                    }
                };
                
                this.progressMonitor.on('sessionCompleted', completionHandler);
                
                this.progressMonitor.createSession(sessionId, 'https://example.com/test', 'gallica', 100);
                this.progressMonitor.updateProgress(sessionId, 100, 100, 'complete');
                this.progressMonitor.completeSession(sessionId, true);
                
                setTimeout(() => {
                    this.progressMonitor.off('sessionCompleted', completionHandler);
                    reject(new Error('Completion event not fired'));
                }, 1000);
            });
        });
    }

    /**
     * Test library configurations
     */
    private async testLibraryConfigurations(): Promise<void> {
        await this.runTest('Library Configurations', async () => {
            // Test different library configs
            const libraries: TLibrary[] = ['gallica', 'internet_culturale', 'manuscripta', 'nypl'];
            
            for (const library of libraries) {
                const config = progressMonitoringConfig.getLibraryConfig(library);
                
                if (!config) throw new Error(`No config found for ${library}`);
                if (typeof config.baseTimeoutMinutes !== 'number') throw new Error(`Invalid timeout for ${library}`);
                if (typeof config.timeoutMultiplier !== 'number') throw new Error(`Invalid multiplier for ${library}`);
                if (typeof config.slowProgressThreshold !== 'number') throw new Error(`Invalid threshold for ${library}`);
            }
            
            // Test that problematic libraries have higher timeouts
            const gallicaConfig = progressMonitoringConfig.getLibraryConfig('gallica');
            const internetCulturaleConfig = progressMonitoringConfig.getLibraryConfig('internet_culturale');
            
            if (internetCulturaleConfig.timeoutMultiplier <= gallicaConfig.timeoutMultiplier) {
                throw new Error('Internet Culturale should have higher timeout multiplier than Gallica');
            }
        });
    }

    /**
     * Test timeout calculations
     */
    private async testTimeoutCalculations(): Promise<void> {
        await this.runTest('Timeout Calculations', async () => {
            // Test different page counts
            const testCases = [
                { pages: 50, expectedMultiplier: 1 },
                { pages: 250, expectedMultiplier: 2 },
                { pages: 400, expectedMultiplier: 3 },
                { pages: 600, expectedMultiplier: 4 },
                { pages: 1000, expectedMultiplier: 5 }
            ];
            
            for (const testCase of testCases) {
                const config = progressMonitoringConfig.generateMonitoringConfig('gallica', testCase.pages);
                
                if (config.pageCountMultiplier !== testCase.expectedMultiplier) {
                    throw new Error(`Page multiplier for ${testCase.pages} pages should be ${testCase.expectedMultiplier}, got ${config.pageCountMultiplier}`);
                }
            }
        });
    }

    /**
     * Test recommendation engine
     */
    private async testRecommendationEngine(): Promise<void> {
        await this.runTest('Recommendation Engine', async () => {
            // Test split recommendation for large manuscripts
            const largeMsRecommendation = progressMonitoringConfig.getDownloadRecommendation(
                'internet_culturale',
                800, // totalPages (above split threshold)
                100, // currentProgress
                1.5, // averageSpeed
                60   // estimatedTimeRemaining
            );
            
            if (largeMsRecommendation.action !== 'split') {
                throw new Error(`Expected 'split' recommendation for large manuscript, got '${largeMsRecommendation.action}'`);
            }
            
            // Test continue recommendation for normal manuscripts
            const normalRecommendation = progressMonitoringConfig.getDownloadRecommendation(
                'gallica',
                200, // totalPages
                100, // currentProgress
                3.0, // averageSpeed (good)
                15   // estimatedTimeRemaining
            );
            
            if (normalRecommendation.action !== 'continue') {
                throw new Error(`Expected 'continue' recommendation for normal manuscript, got '${normalRecommendation.action}'`);
            }
        });
    }

    /**
     * Test download integration
     */
    private async testDownloadIntegration(): Promise<void> {
        await this.runTest('Download Integration', async () => {
            const sessionId = 'test-integration';
            
            // Mock downloader
            const mockDownloader = {
                downloadManuscript: async (url: string, options: any) => {
                    // Simulate progress updates
                    for (let i = 0; i <= 100; i += 10) {
                        if (options.onProgress) {
                            options.onProgress({
                                current: i,
                                total: 100,
                                percentage: i,
                                stage: 'downloading'
                            });
                        }
                        
                        // Small delay to simulate real download
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                    return { success: true };
                }
            };
            
            const result = await this.progressIntegration.wrapDownloadManuscript(
                mockDownloader,
                'https://example.com/test',
                'gallica',
                100,
                {
                    onProgress: (progress) => {
                        // Verify enhanced progress info is provided
                        if (typeof progress.current !== 'number') throw new Error('Missing current progress');
                        if (typeof progress.percentage !== 'number') throw new Error('Missing percentage');
                        if (typeof progress.isStuck !== 'boolean') throw new Error('Missing stuck status');
                        if (typeof progress.isSlow !== 'boolean') throw new Error('Missing slow status');
                    }
                }
            );
            
            if (!result || !result.success) throw new Error('Integration download failed');
        });
    }

    /**
     * Test multiple sessions handling
     */
    private async testMultipleSessionsHandling(): Promise<void> {
        await this.runTest('Multiple Sessions Handling', async () => {
            const sessionIds = ['multi-1', 'multi-2', 'multi-3'];
            
            // Create multiple sessions
            for (const sessionId of sessionIds) {
                this.progressMonitor.createSession(sessionId, `https://example.com/${sessionId}`, 'gallica', 100);
            }
            
            const activeSessions = this.progressMonitor.getActiveSessions();
            if (activeSessions.length !== 3) {
                throw new Error(`Expected 3 active sessions, got ${activeSessions.length}`);
            }
            
            // Update progress on all sessions
            for (const sessionId of sessionIds) {
                this.progressMonitor.updateProgress(sessionId, 50, 100, 'downloading');
            }
            
            // Complete one session
            this.progressMonitor.completeSession(sessionIds[0]);
            
            // Cancel another session
            this.progressMonitor.cancelSession(sessionIds[1]);
            
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const remainingActiveSessions = this.progressMonitor.getActiveSessions();
            if (remainingActiveSessions.length !== 1) {
                throw new Error(`Expected 1 remaining active session, got ${remainingActiveSessions.length}`);
            }
            
            // Clean up
            this.progressMonitor.cancelSession(sessionIds[2]);
        });
    }

    /**
     * Test error handling
     */
    private async testErrorHandling(): Promise<void> {
        await this.runTest('Error Handling', async () => {
            // Test updating non-existent session
            this.progressMonitor.updateProgress('non-existent', 50, 100, 'downloading');
            // Should not throw error
            
            // Test completing non-existent session
            this.progressMonitor.completeSession('non-existent');
            // Should not throw error
            
            // Test cancelling non-existent session
            this.progressMonitor.cancelSession('non-existent');
            // Should not throw error
            
            // Test getting trend for non-existent session
            const trend = this.progressMonitor.getProgressTrend('non-existent');
            if (trend !== null) throw new Error('Should return null for non-existent session');
        });
    }

    /**
     * Test memory usage
     */
    private async testMemoryUsage(): Promise<void> {
        await this.runTest('Memory Usage', async () => {
            const sessionIds: string[] = [];
            
            // Create many sessions with lots of progress updates
            for (let i = 0; i < 10; i++) {
                const sessionId = `memory-test-${i}`;
                sessionIds.push(sessionId);
                
                this.progressMonitor.createSession(sessionId, `https://example.com/${sessionId}`, 'gallica', 1000);
                
                // Add many progress updates to test snapshot cleanup
                for (let j = 0; j < 100; j++) {
                    this.progressMonitor.updateProgress(sessionId, j, 1000, 'downloading');
                }
            }
            
            // Check that snapshots are limited (should be cleaned up)
            const activeSessions = this.progressMonitor.getActiveSessions();
            for (const session of activeSessions) {
                // Should not have all 100 snapshots due to cleanup
                if (session.snapshots.length > 50) {
                    throw new Error(`Too many snapshots retained: ${session.snapshots.length}`);
                }
            }
            
            // Clean up
            for (const sessionId of sessionIds) {
                this.progressMonitor.cancelSession(sessionId);
            }
        });
    }

    /**
     * Test concurrent sessions
     */
    private async testConcurrentSessions(): Promise<void> {
        await this.runTest('Concurrent Sessions', async () => {
            const sessionCount = 5;
            const sessionIds: string[] = [];
            
            // Create concurrent sessions
            const createPromises = Array.from({ length: sessionCount }, (_, i) => {
                const sessionId = `concurrent-${i}`;
                sessionIds.push(sessionId);
                
                return new Promise<void>(resolve => {
                    this.progressMonitor.createSession(sessionId, `https://example.com/${sessionId}`, 'gallica', 100);
                    
                    // Simulate concurrent progress updates
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += 10;
                        this.progressMonitor.updateProgress(sessionId, progress, 100, 'downloading');
                        
                        if (progress >= 100) {
                            clearInterval(interval);
                            this.progressMonitor.completeSession(sessionId);
                            resolve();
                        }
                    }, 50);
                });
            });
            
            await Promise.all(createPromises);
            
            // Verify all sessions completed
            const activeSessions = this.progressMonitor.getActiveSessions();
            const stillActive = activeSessions.filter(s => sessionIds.includes(s.id));
            
            if (stillActive.length > 0) {
                throw new Error(`${stillActive.length} sessions still active after completion`);
            }
        });
    }

    /**
     * Run a single test with error handling
     */
    private async runTest(testName: string, testFunction: () => Promise<void>): Promise<void> {
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            
            this.results.push({
                testName,
                passed: true,
                duration
            });
            
            console.log(`✅ ${testName} - ${duration}ms`);
            
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            this.results.push({
                testName,
                passed: false,
                error: error.message,
                duration
            });
            
            console.log(`❌ ${testName} - ${error.message} (${duration}ms)`);
        }
    }

    /**
     * Print test results summary
     */
    private printResults(): void {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
        
        console.log('\n📊 Test Results Summary:');
        console.log(`   Total: ${this.results.length}`);
        console.log(`   Passed: ${passed}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Duration: ${totalDuration}ms`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            for (const result of this.results.filter(r => !r.passed)) {
                console.log(`   - ${result.testName}: ${result.error}`);
            }
        }
        
        console.log(`\n${failed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        try {
            this.progressMonitor.destroy();
            this.progressIntegration.destroy();
        } catch (error) {
            console.warn('Cleanup error:', error);
        }
    }
}

// Export test runner
export async function runProgressMonitoringTests(): Promise<TestResult[]> {
    const tester = new ProgressMonitoringTester();
    
    try {
        const results = await tester.runAllTests();
        return results;
    } finally {
        tester.cleanup();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runProgressMonitoringTests()
        .then((results) => {
            const failed = results.filter(r => !r.passed).length;
            process.exit(failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}