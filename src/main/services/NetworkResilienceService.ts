/**
 * NETWORK RESILIENCE SERVICE
 * 
 * Implements advanced network resilience patterns including:
 * - Circuit breaker pattern for failing libraries
 * - Connection pooling with health monitoring
 * - Intelligent retry strategies
 * - DNS caching and resolution optimization
 * - Real-time network health tracking
 */

import { EventEmitter } from 'events';
import * as https from 'https';
// Unused imports removed for TypeScript compliance
import { configService } from './ConfigService';
import { EnhancedLogger } from './EnhancedLogger';

interface CircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    lastFailure: number;
    nextAttempt: number;
    successCount: number;
}

interface ConnectionPoolStats {
    activeConnections: number;
    totalRequests: number;
    avgResponseTime: number;
    lastUsed: number;
}

interface NetworkHealthMetrics {
    isOnline: boolean;
    latency: number;
    dnsCacheHitRate: number;
    circuitBreakerStates: Map<string, CircuitBreakerState>;
    connectionPools: Map<string, ConnectionPoolStats>;
}

export class NetworkResilienceService extends EventEmitter {
    private static instance: NetworkResilienceService | null = null;
    private logger: EnhancedLogger;
    
    // Circuit Breaker Management
    private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
    private readonly FAILURE_THRESHOLD = 5;
    private readonly RECOVERY_TIMEOUT = 60000; // 1 minute
    private readonly HALF_OPEN_MAX_CALLS = 3;
    
    // DNS Cache
    private dnsCache: Map<string, { addresses: string[], timestamp: number }> = new Map();
    private readonly DNS_CACHE_TTL = 300000; // 5 minutes
    
    // Connection Pools
    private httpAgents: Map<string, https.Agent> = new Map();
    private connectionStats: Map<string, ConnectionPoolStats> = new Map();
    
    // Network Health
    private healthMetrics: NetworkHealthMetrics = {
        isOnline: true,
        latency: 0,
        dnsCacheHitRate: 0,
        circuitBreakerStates: new Map(),
        connectionPools: new Map()
    };

    private constructor() {
        super();
        this.logger = EnhancedLogger.getInstance();
        this.startHealthMonitoring();
    }

    public static getInstance(): NetworkResilienceService {
        if (!NetworkResilienceService.instance) {
            NetworkResilienceService.instance = new NetworkResilienceService();
        }
        return NetworkResilienceService.instance;
    }

    /**
     * CIRCUIT BREAKER PATTERN IMPLEMENTATION
     */
    private getCircuitBreaker(libraryName: string): CircuitBreakerState {
        if (!this.circuitBreakers.has(libraryName)) {
            this.circuitBreakers.set(libraryName, {
                state: 'CLOSED',
                failures: 0,
                lastFailure: 0,
                nextAttempt: 0,
                successCount: 0
            });
        }
        return this.circuitBreakers.get(libraryName)!;
    }

    public canExecuteRequest(libraryName: string): { allowed: boolean; reason?: string } {
        const breaker = this.getCircuitBreaker(libraryName);
        const now = Date.now();

        switch (breaker.state) {
            case 'CLOSED':
                return { allowed: true };
                
            case 'OPEN':
                if (now >= breaker.nextAttempt) {
                    breaker.state = 'HALF_OPEN';
                    breaker.successCount = 0;
                    console.log(`[NETWORK] Circuit breaker for ${libraryName} moved to HALF_OPEN`);
                    return { allowed: true };
                }
                return { 
                    allowed: false, 
                    reason: `Circuit breaker OPEN for ${libraryName}. Next attempt in ${Math.ceil((breaker.nextAttempt - now) / 1000)}s` 
                };
                
            case 'HALF_OPEN':
                if (breaker.successCount < this.HALF_OPEN_MAX_CALLS) {
                    return { allowed: true };
                }
                return { 
                    allowed: false, 
                    reason: `Circuit breaker HALF_OPEN for ${libraryName}. Evaluating recovery...` 
                };
                
            default:
                return { allowed: true };
        }
    }

    public recordSuccess(libraryName: string): void {
        const breaker = this.getCircuitBreaker(libraryName);
        
        switch (breaker.state) {
            case 'HALF_OPEN':
                breaker.successCount++;
                if (breaker.successCount >= this.HALF_OPEN_MAX_CALLS) {
                    breaker.state = 'CLOSED';
                    breaker.failures = 0;
                    console.log(`[NETWORK] Circuit breaker for ${libraryName} CLOSED - service recovered`);
                }
                break;
                
            case 'CLOSED':
                // Reset failure counter on success
                if (breaker.failures > 0) {
                    breaker.failures = Math.max(0, breaker.failures - 1);
                }
                break;
        }

        this.emit('circuitBreakerStateChanged', { libraryName, state: breaker.state });
    }

    public recordFailure(libraryName: string, error: Error): void {
        const breaker = this.getCircuitBreaker(libraryName);
        const now = Date.now();
        
        breaker.failures++;
        breaker.lastFailure = now;
        
        // Only trip circuit breaker for network-related errors
        const isNetworkError = this.isNetworkError(error);
        
        if (isNetworkError && breaker.failures >= this.FAILURE_THRESHOLD) {
            if (breaker.state !== 'OPEN') {
                breaker.state = 'OPEN';
                breaker.nextAttempt = now + this.RECOVERY_TIMEOUT;
                console.log(`[NETWORK] Circuit breaker for ${libraryName} OPENED after ${breaker.failures} failures. Next attempt in ${this.RECOVERY_TIMEOUT/1000}s`);
                this.emit('circuitBreakerTripped', { libraryName, failures: breaker.failures });
            }
        }

        this.emit('circuitBreakerStateChanged', { libraryName, state: breaker.state });
    }

    private isNetworkError(error: Error): boolean {
        const networkErrorCodes = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH'];
        return networkErrorCodes.includes((error as any)?.code) || error.name === 'AbortError';
    }

    /**
     * DNS CACHING AND RESOLUTION OPTIMIZATION
     */
    public async resolveDNS(hostname: string): Promise<string[]> {
        // Check cache first
        const cached = this.dnsCache.get(hostname);
        if (cached && Date.now() - cached.timestamp < this.DNS_CACHE_TTL) {
            this.healthMetrics.dnsCacheHitRate = (this.healthMetrics.dnsCacheHitRate + 1) / 2; // Rolling average
            return cached.addresses;
        }

        try {
            const dns = await import('dns').then(m => m.promises);
            const addresses = await dns.resolve4(hostname);
            
            // Cache the result
            this.dnsCache.set(hostname, {
                addresses,
                timestamp: Date.now()
            });
            
            this.healthMetrics.dnsCacheHitRate = this.healthMetrics.dnsCacheHitRate * 0.9; // Reduce on cache miss
            
            console.log(`[NETWORK] DNS resolved for ${hostname}: ${addresses.length} addresses`);
            return addresses;
            
        } catch (error) {
            console.log(`[NETWORK] DNS resolution failed for ${hostname}:`, error);
            throw error;
        }
    }

    /**
     * CONNECTION POOLING WITH HEALTH MONITORING
     */
    public getHttpAgent(hostname: string): https.Agent {
        if (!this.httpAgents.has(hostname)) {
            const agent = new https.Agent({
                keepAlive: true,
                keepAliveMsecs: 30000,
                maxSockets: 6,  // Reasonable limit per host
                maxFreeSockets: 3,
                timeout: configService.get('requestTimeout'),
                scheduling: 'fifo'
            });
            
            this.httpAgents.set(hostname, agent);
            this.connectionStats.set(hostname, {
                activeConnections: 0,
                totalRequests: 0,
                avgResponseTime: 0,
                lastUsed: Date.now()
            });
        }
        
        return this.httpAgents.get(hostname)!;
    }

    public recordRequestMetrics(hostname: string, responseTime: number, success: boolean): void {
        const stats = this.connectionStats.get(hostname);
        if (stats) {
            stats.totalRequests++;
            stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2; // Rolling average
            stats.lastUsed = Date.now();
            
            if (success) {
                // Update connection pool health
                this.healthMetrics.connectionPools.set(hostname, { ...stats });
            }
        }
    }

    /**
     * INTELLIGENT RETRY STRATEGY
     */
    public calculateRetryDelay(attempt: number, error?: Error, _libraryName?: string): number {
        const baseDelay = configService.get('retryDelayBase');
        let delay = baseDelay * Math.pow(2, attempt);
        
        // Add jitter to prevent thundering herd
        delay += Math.random() * baseDelay;
        
        // Adjust based on error type
        if (error && this.isNetworkError(error)) {
            // Network errors: longer delays
            delay *= 1.5;
        }
        
        // Check if this is a rate limiting scenario
        if (error?.message.includes('429') || error?.message.includes('Too Many Requests')) {
            // Much longer delay for rate limiting
            delay *= 3;
        }
        
        // Cap at maximum delay
        return Math.min(delay, configService.get('retryDelayMax'));
    }

    public shouldRetry(attempt: number, error: Error, libraryName: string): { shouldRetry: boolean; reason: string } {
        const maxRetries = configService.get('maxRetries');
        
        if (attempt >= maxRetries) {
            return { shouldRetry: false, reason: 'Maximum retry attempts reached' };
        }
        
        // Check circuit breaker
        const { allowed, reason } = this.canExecuteRequest(libraryName);
        if (!allowed) {
            return { shouldRetry: false, reason: reason || 'Circuit breaker prevented retry' };
        }
        
        // Don't retry on certain error types
        if (error.message.includes('404') || error.message.includes('403')) {
            return { shouldRetry: false, reason: 'Non-retryable HTTP error' };
        }
        
        // Network errors are retryable
        if (this.isNetworkError(error)) {
            return { shouldRetry: true, reason: 'Network error - retryable' };
        }
        
        return { shouldRetry: true, reason: 'General error - attempting retry' };
    }

    /**
     * NETWORK HEALTH MONITORING
     */
    private startHealthMonitoring(): void {
        // Monitor network health every 30 seconds
        setInterval(async () => {
            await this.updateNetworkHealth();
        }, 30000);
        
        // Clean up stale connections every 5 minutes
        setInterval(() => {
            this.cleanupConnections();
        }, 300000);
        
        // Clean up DNS cache every 10 minutes
        setInterval(() => {
            this.cleanupDNSCache();
        }, 600000);
    }

    private async updateNetworkHealth(): Promise<void> {
        try {
            // Simple connectivity check
            const startTime = Date.now();
            await this.resolveDNS('google.com');
            this.healthMetrics.latency = Date.now() - startTime;
            this.healthMetrics.isOnline = true;
            
            // Update circuit breaker states
            this.healthMetrics.circuitBreakerStates = new Map(this.circuitBreakers);
            
        } catch (error) {
            this.healthMetrics.isOnline = false;
            console.log(`[NETWORK] Network health check failed`, error);
        }
    }

    private cleanupConnections(): void {
        const now = Date.now();
        const staleThreshold = 600000; // 10 minutes
        
        for (const [hostname, stats] of this.connectionStats.entries()) {
            if (now - stats.lastUsed > staleThreshold) {
                const agent = this.httpAgents.get(hostname);
                if (agent) {
                    agent.destroy();
                    this.httpAgents.delete(hostname);
                    this.connectionStats.delete(hostname);
                    console.log(`[NETWORK] Cleaned up stale connection pool for ${hostname}`);
                }
            }
        }
    }

    private cleanupDNSCache(): void {
        const now = Date.now();
        
        for (const [hostname, cached] of this.dnsCache.entries()) {
            if (now - cached.timestamp > this.DNS_CACHE_TTL) {
                this.dnsCache.delete(hostname);
            }
        }
        
        console.log(`[NETWORK] DNS cache cleaned up. Size: ${this.dnsCache.size}`);
    }

    /**
     * PUBLIC API FOR GETTING HEALTH METRICS
     */
    public getHealthMetrics(): NetworkHealthMetrics {
        return { ...this.healthMetrics };
    }

    public getCircuitBreakerStatus(libraryName: string): CircuitBreakerState | null {
        return this.circuitBreakers.get(libraryName) || null;
    }

    public resetCircuitBreaker(libraryName: string): void {
        const breaker = this.circuitBreakers.get(libraryName);
        if (breaker) {
            breaker.state = 'CLOSED';
            breaker.failures = 0;
            breaker.successCount = 0;
            console.log(`[NETWORK] Circuit breaker manually reset for ${libraryName}`);
            this.emit('circuitBreakerReset', { libraryName });
        }
    }

    /**
     * ENHANCED ERROR CLASSIFICATION
     */
    public classifyNetworkError(error: Error): {
        category: 'TEMPORARY' | 'PERMANENT' | 'RATE_LIMITED' | 'UNKNOWN';
        userMessage: string;
        suggestedAction: string;
    } {
        const errorCode = (error as any)?.code;
        const causeCode = (error as any)?.cause?.code;
        const errorMessage = error.message.toLowerCase();

        // DNS and connection errors - usually temporary
        if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
            return {
                category: 'TEMPORARY',
                userMessage: 'DNS resolution failed. This is usually temporary.',
                suggestedAction: 'The system will automatically retry. Check your internet connection if the problem persists.'
            };
        }

        if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET' || errorCode === 'UND_ERR_CONNECT_TIMEOUT' || causeCode === 'UND_ERR_CONNECT_TIMEOUT') {
            return {
                category: 'TEMPORARY',
                userMessage: 'Connection timeout or reset. The server may be overloaded or unreachable.',
                suggestedAction: 'The system will retry with longer delays. This usually resolves itself.'
            };
        }

        if (errorCode === 'ECONNREFUSED') {
            return {
                category: 'TEMPORARY',
                userMessage: 'Connection refused. The server may be temporarily unavailable.',
                suggestedAction: 'The system will retry after a delay. If this persists, the server may be down.'
            };
        }

        // HTTP errors
        if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
            return {
                category: 'PERMANENT',
                userMessage: 'Access forbidden. You may not have permission to access this manuscript.',
                suggestedAction: 'Check if you need institutional access or if the manuscript is geo-restricted.'
            };
        }

        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            return {
                category: 'PERMANENT',
                userMessage: 'Manuscript not found. The URL may be incorrect or the manuscript was moved.',
                suggestedAction: 'Please verify the URL is correct and try a different manuscript.'
            };
        }

        if (errorMessage.includes('429') || errorMessage.includes('too many requests')) {
            return {
                category: 'RATE_LIMITED',
                userMessage: 'Rate limited. Too many requests sent too quickly.',
                suggestedAction: 'The system will automatically wait longer between requests and retry.'
            };
        }

        return {
            category: 'UNKNOWN',
            userMessage: 'An unexpected network error occurred.',
            suggestedAction: 'The system will attempt to retry. If the problem persists, please report this issue.'
        };
    }
}

// Export singleton instance
export const networkResilienceService = NetworkResilienceService.getInstance();