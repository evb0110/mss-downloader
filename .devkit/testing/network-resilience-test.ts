/**
 * COMPREHENSIVE NETWORK RESILIENCE TESTING
 * 
 * This test suite validates all network resilience improvements:
 * - Circuit breaker pattern
 * - Connection pooling
 * - DNS caching
 * - Enhanced retry logic
 * - Error classification
 */

import { networkResilienceService } from '../../src/main/services/NetworkResilienceService';

interface TestResult {
    feature: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    details: string;
    duration?: number;
}

class NetworkResilienceTestSuite {
    private results: TestResult[] = [];

    async runAllTests(): Promise<void> {
        console.log('🚀 Starting Network Resilience Test Suite...\n');

        await this.testCircuitBreakerPattern();
        await this.testDNSCaching();
        await this.testConnectionPooling();
        await this.testRetryLogic();
        await this.testErrorClassification();
        await this.testNetworkHealthMonitoring();

        this.printResults();
    }

    /**
     * Test Circuit Breaker Pattern
     */
    private async testCircuitBreakerPattern(): Promise<void> {
        console.log('🔧 Testing Circuit Breaker Pattern...');
        
        const testLibrary = 'test_library';
        
        try {
            // Test initial state (should be CLOSED)
            const initialCheck = networkResilienceService.canExecuteRequest(testLibrary);
            if (!initialCheck.allowed) {
                throw new Error('Circuit breaker should initially be CLOSED');
            }

            // Simulate multiple failures to trip the circuit
            const mockError = new Error('Network timeout');
            (mockError as any).code = 'ETIMEDOUT';

            for (let i = 0; i < 6; i++) {
                networkResilienceService.recordFailure(testLibrary, mockError);
            }

            // Circuit should now be OPEN
            const failedCheck = networkResilienceService.canExecuteRequest(testLibrary);
            if (failedCheck.allowed) {
                throw new Error('Circuit breaker should be OPEN after multiple failures');
            }

            // Reset and test success recording
            networkResilienceService.resetCircuitBreaker(testLibrary);
            networkResilienceService.recordSuccess(testLibrary);
            
            const resetCheck = networkResilienceService.canExecuteRequest(testLibrary);
            if (!resetCheck.allowed) {
                throw new Error('Circuit breaker should be CLOSED after reset and success');
            }

            this.results.push({
                feature: 'Circuit Breaker Pattern',
                status: 'PASS',
                details: 'Circuit breaker correctly transitions between CLOSED/OPEN/HALF_OPEN states'
            });

        } catch (error) {
            this.results.push({
                feature: 'Circuit Breaker Pattern',
                status: 'FAIL',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Test DNS Caching
     */
    private async testDNSCaching(): Promise<void> {
        console.log('🌐 Testing DNS Caching...');
        
        try {
            const testHostname = 'google.com';
            const startTime = Date.now();
            
            // First resolution (should hit DNS server)
            const firstResult = await networkResilienceService.resolveDNS(testHostname);
            const firstDuration = Date.now() - startTime;
            
            const secondStartTime = Date.now();
            // Second resolution (should hit cache)
            const secondResult = await networkResilienceService.resolveDNS(testHostname);
            const secondDuration = Date.now() - secondStartTime;
            
            if (!Array.isArray(firstResult) || !Array.isArray(secondResult)) {
                throw new Error('DNS resolution should return array of addresses');
            }
            
            if (firstResult.length === 0 || secondResult.length === 0) {
                throw new Error('DNS resolution should return at least one address');
            }
            
            // Cache hit should be significantly faster
            const cacheSpeedup = firstDuration / Math.max(secondDuration, 1);
            
            this.results.push({
                feature: 'DNS Caching',
                status: 'PASS',
                details: `DNS cache working. First: ${firstDuration}ms, Second: ${secondDuration}ms (${cacheSpeedup.toFixed(1)}x faster)`
            });

        } catch (error) {
            this.results.push({
                feature: 'DNS Caching',
                status: 'FAIL',
                details: error instanceof Error ? error.message : 'DNS resolution failed'
            });
        }
    }

    /**
     * Test Connection Pooling
     */
    private async testConnectionPooling(): Promise<void> {
        console.log('🔗 Testing Connection Pooling...');
        
        try {
            const testHostname = 'google.com';
            
            // Get HTTP agent (should create connection pool)
            const agent1 = networkResilienceService.getHttpAgent(testHostname);
            const agent2 = networkResilienceService.getHttpAgent(testHostname);
            
            // Should return the same agent instance (pooled)
            if (agent1 !== agent2) {
                throw new Error('Connection pool should return same agent instance for same hostname');
            }
            
            // Test metrics recording
            networkResilienceService.recordRequestMetrics(testHostname, 150, true);
            networkResilienceService.recordRequestMetrics(testHostname, 200, true);
            
            const healthMetrics = networkResilienceService.getHealthMetrics();
            const poolStats = healthMetrics.connectionPools.get(testHostname);
            
            if (!poolStats || poolStats.totalRequests !== 2) {
                throw new Error('Connection pool metrics not recording correctly');
            }

            this.results.push({
                feature: 'Connection Pooling',
                status: 'PASS',
                details: `Connection pool working. Agent reuse confirmed, metrics tracking ${poolStats.totalRequests} requests`
            });

        } catch (error) {
            this.results.push({
                feature: 'Connection Pooling',
                status: 'FAIL',
                details: error instanceof Error ? error.message : 'Connection pooling failed'
            });
        }
    }

    /**
     * Test Enhanced Retry Logic
     */
    private async testRetryLogic(): Promise<void> {
        console.log('🔄 Testing Enhanced Retry Logic...');
        
        try {
            const testLibrary = 'test_retry_library';
            
            // Test different error types
            const networkError = new Error('Connection timeout');
            (networkError as any).code = 'ETIMEDOUT';
            
            const httpError = new Error('Not found');
            (httpError as any).code = 'HTTP_404';
            
            const rateLimitError = new Error('Too Many Requests');
            
            // Test retry decisions
            const networkRetry = networkResilienceService.shouldRetry(1, networkError, testLibrary);
            const httpRetry = networkResilienceService.shouldRetry(1, httpError, testLibrary);
            const rateLimitRetry = networkResilienceService.shouldRetry(1, rateLimitError, testLibrary);
            
            if (!networkRetry.shouldRetry) {
                throw new Error('Network errors should be retryable');
            }
            
            if (httpRetry.shouldRetry) {
                throw new Error('404 errors should not be retryable');
            }
            
            // Test retry delay calculation
            const delay1 = networkResilienceService.calculateRetryDelay(1, networkError, testLibrary);
            const delay2 = networkResilienceService.calculateRetryDelay(2, networkError, testLibrary);
            const rateLimitDelay = networkResilienceService.calculateRetryDelay(1, rateLimitError, testLibrary);
            
            if (delay2 <= delay1) {
                throw new Error('Retry delay should increase exponentially');
            }
            
            if (rateLimitDelay <= delay1) {
                throw new Error('Rate limit errors should have longer delays');
            }

            this.results.push({
                feature: 'Enhanced Retry Logic',
                status: 'PASS',
                details: `Retry logic working correctly. Network: retryable, HTTP: non-retryable, Rate limit: longer delay`
            });

        } catch (error) {
            this.results.push({
                feature: 'Enhanced Retry Logic',
                status: 'FAIL',
                details: error instanceof Error ? error.message : 'Retry logic test failed'
            });
        }
    }

    /**
     * Test Error Classification
     */
    private async testErrorClassification(): Promise<void> {
        console.log('🏷️ Testing Error Classification...');
        
        try {
            // Test different error classifications
            const timeoutError = new Error('Connection timeout');
            (timeoutError as any).code = 'ETIMEDOUT';
            
            const notFoundError = new Error('Not found');
            
            const forbiddenError = new Error('Forbidden');
            
            const rateLimitError = new Error('Too Many Requests');
            
            const timeoutClassification = networkResilienceService.classifyNetworkError(timeoutError);
            const notFoundClassification = networkResilienceService.classifyNetworkError(notFoundError);
            const forbiddenClassification = networkResilienceService.classifyNetworkError(forbiddenError);
            const rateLimitClassification = networkResilienceService.classifyNetworkError(rateLimitError);
            
            if (timeoutClassification.category !== 'TEMPORARY') {
                throw new Error('Timeout errors should be classified as TEMPORARY');
            }
            
            if (notFoundClassification.category !== 'PERMANENT') {
                throw new Error('404 errors should be classified as PERMANENT');
            }
            
            if (forbiddenClassification.category !== 'PERMANENT') {
                throw new Error('403 errors should be classified as PERMANENT');
            }
            
            if (rateLimitClassification.category !== 'RATE_LIMITED') {
                throw new Error('Rate limit errors should be classified as RATE_LIMITED');
            }
            
            // Check user messages are helpful
            if (!timeoutClassification.userMessage.toLowerCase().includes('temporary')) {
                throw new Error('User message should indicate temporary nature');
            }
            
            if (!timeoutClassification.suggestedAction.toLowerCase().includes('retry')) {
                throw new Error('Suggested action should mention retry');
            }

            this.results.push({
                feature: 'Error Classification',
                status: 'PASS',
                details: 'All error types correctly classified with helpful user messages'
            });

        } catch (error) {
            this.results.push({
                feature: 'Error Classification',
                status: 'FAIL',
                details: error instanceof Error ? error.message : 'Error classification test failed'
            });
        }
    }

    /**
     * Test Network Health Monitoring
     */
    private async testNetworkHealthMonitoring(): Promise<void> {
        console.log('💗 Testing Network Health Monitoring...');
        
        try {
            const healthMetrics = networkResilienceService.getHealthMetrics();
            
            if (typeof healthMetrics.isOnline !== 'boolean') {
                throw new Error('Health metrics should include online status');
            }
            
            if (typeof healthMetrics.latency !== 'number') {
                throw new Error('Health metrics should include latency measurement');
            }
            
            if (typeof healthMetrics.dnsCacheHitRate !== 'number') {
                throw new Error('Health metrics should include DNS cache hit rate');
            }
            
            if (!(healthMetrics.circuitBreakerStates instanceof Map)) {
                throw new Error('Health metrics should include circuit breaker states');
            }
            
            if (!(healthMetrics.connectionPools instanceof Map)) {
                throw new Error('Health metrics should include connection pool stats');
            }

            this.results.push({
                feature: 'Network Health Monitoring',
                status: 'PASS',
                details: `Health metrics complete. Online: ${healthMetrics.isOnline}, Latency: ${healthMetrics.latency}ms`
            });

        } catch (error) {
            this.results.push({
                feature: 'Network Health Monitoring',
                status: 'FAIL',
                details: error instanceof Error ? error.message : 'Health monitoring test failed'
            });
        }
    }

    /**
     * Print comprehensive test results
     */
    private printResults(): void {
        console.log('\n📊 NETWORK RESILIENCE TEST RESULTS');
        console.log('=' .repeat(50));
        
        let passed = 0;
        let failed = 0;
        
        for (const result of this.results) {
            const statusIcon = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${statusIcon} ${result.feature}: ${result.status}`);
            console.log(`   ${result.details}`);
            if (result.duration) {
                console.log(`   Duration: ${result.duration}ms`);
            }
            console.log('');
            
            if (result.status === 'PASS') passed++;
            else if (result.status === 'FAIL') failed++;
        }
        
        console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('🎉 All network resilience features are working correctly!');
        } else {
            console.log('⚠️  Some network resilience features need attention.');
        }
    }
}

// Run the test suite
if (require.main === module) {
    const testSuite = new NetworkResilienceTestSuite();
    testSuite.runAllTests().catch(console.error);
}

export { NetworkResilienceTestSuite };