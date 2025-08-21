#!/usr/bin/env node

/**
 * Quick Network DNS Test for Problematic Domains
 * Tests DNS resolution for domains identified as problematic in the codebase
 */

const dns = require('dns').promises;
const { performance } = require('perf_hooks');

// Problematic domains identified from the codebase analysis
const PROBLEMATIC_DOMAINS = [
    'unipub.uni-graz.at',           // ETIMEDOUT issues
    'cdm21059.contentdm.oclc.org',  // Florence - ETIMEDOUT
    'nuovabibliotecamanoscritta.it', // Verona - socket timeouts
    'nbm.regione.veneto.it',        // Verona alternative
    'digitale.bnc.roma.sbn.it',     // Rome - socket timeout issues
    'mdc.csuc.cat',                 // MDC Catalonia - network stability
    'digital.staatsbibliothek-berlin.de', // Berlin - slow manifests
    'www.internetculturale.it',     // Slow servers
    'collections.library.utoronto.ca', // Toronto routing
    'digital.ulb.hhu.de'            // HHU routing
];

const GOOD_DOMAINS = [
    'gallica.bnf.fr',               // Gallica - generally reliable
    'digi.vatlib.it',               // Vatican - stable
    'api.bl.uk',                    // British Library - good infrastructure
    'digitalcollections.nypl.org',  // NYPL - good performance
    'parker.stanford.edu'           // Parker - high performance
];

const TEST_DOMAINS = [...PROBLEMATIC_DOMAINS, ...GOOD_DOMAINS];

const DNS_SERVERS = [
    { name: 'Cloudflare', server: '1.1.1.1' },
    { name: 'Google', server: '8.8.8.8' },
    { name: 'System Default', server: null }
];

async function testDNSResolution(domain, dnsServer = null, timeout = 3000) {
    const startTime = performance.now();
    
    try {
        if (dnsServer) {
            dns.setServers([dnsServer]);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const addresses = await dns.resolve4(domain);
            clearTimeout(timeoutId);
            
            const duration = performance.now() - startTime;
            return {
                success: true,
                duration,
                addresses,
                error: null,
                timeout: false
            };
        } catch (error) {
            clearTimeout(timeoutId);
            const duration = performance.now() - startTime;
            
            return {
                success: false,
                duration,
                addresses: [],
                error: error.code || error.message,
                timeout: duration >= timeout * 0.9 // Consider timeout if close to limit
            };
        }

    } catch (error) {
        const duration = performance.now() - startTime;
        return {
            success: false,
            duration,
            addresses: [],
            error: error.code || error.message,
            timeout: false
        };
    }
}

async function runQuickDNSTest() {
    console.log('🔍 Quick Network DNS Test');
    console.log(`Testing ${TEST_DOMAINS.length} domains (${PROBLEMATIC_DOMAINS.length} problematic + ${GOOD_DOMAINS.length} control)`);
    console.log('=====================================\n');

    const results = {};
    const summary = {
        problematic: { total: 0, failed: 0, slow: 0, timeouts: 0 },
        control: { total: 0, failed: 0, slow: 0, timeouts: 0 },
        dnsPerformance: {}
    };

    for (const domain of TEST_DOMAINS) {
        console.log(`Testing ${domain}...`);
        results[domain] = {};
        
        const isProblematic = PROBLEMATIC_DOMAINS.includes(domain);
        const category = isProblematic ? 'problematic' : 'control';
        summary[category].total++;

        let domainFailed = true;
        let domainSlow = false;
        let domainTimeout = false;

        for (const dnsConfig of DNS_SERVERS) {
            const result = await testDNSResolution(domain, dnsConfig.server);
            results[domain][dnsConfig.name] = result;

            if (result.success) {
                domainFailed = false;
                
                // Track DNS server performance
                if (!summary.dnsPerformance[dnsConfig.name]) {
                    summary.dnsPerformance[dnsConfig.name] = { total: 0, count: 0, failures: 0 };
                }
                summary.dnsPerformance[dnsConfig.name].total += result.duration;
                summary.dnsPerformance[dnsConfig.name].count++;

                if (result.duration > 1000) {
                    domainSlow = true;
                }
            } else {
                if (summary.dnsPerformance[dnsConfig.name]) {
                    summary.dnsPerformance[dnsConfig.name].failures++;
                }
            }

            if (result.timeout) {
                domainTimeout = true;
            }

            console.log(`  ${dnsConfig.name}: ${result.success ? '✅' : '❌'} ${result.duration.toFixed(0)}ms ${result.error ? `(${result.error})` : ''}`);
        }

        if (domainFailed) summary[category].failed++;
        if (domainSlow) summary[category].slow++;
        if (domainTimeout) summary[category].timeouts++;

        console.log();
    }

    // Calculate DNS server averages
    for (const [serverName, stats] of Object.entries(summary.dnsPerformance)) {
        if (stats.count > 0) {
            stats.average = stats.total / stats.count;
            stats.successRate = (stats.count / (stats.count + stats.failures)) * 100;
        }
    }

    console.log('📊 SUMMARY RESULTS');
    console.log('==================');
    
    console.log('\n🔴 PROBLEMATIC DOMAINS:');
    console.log(`Total: ${summary.problematic.total}`);
    console.log(`Failed DNS: ${summary.problematic.failed} (${(summary.problematic.failed/summary.problematic.total*100).toFixed(1)}%)`);
    console.log(`Slow (>1s): ${summary.problematic.slow} (${(summary.problematic.slow/summary.problematic.total*100).toFixed(1)}%)`);
    console.log(`Timeouts: ${summary.problematic.timeouts} (${(summary.problematic.timeouts/summary.problematic.total*100).toFixed(1)}%)`);
    
    console.log('\n🟢 CONTROL DOMAINS:');
    console.log(`Total: ${summary.control.total}`);
    console.log(`Failed DNS: ${summary.control.failed} (${(summary.control.failed/summary.control.total*100).toFixed(1)}%)`);
    console.log(`Slow (>1s): ${summary.control.slow} (${(summary.control.slow/summary.control.total*100).toFixed(1)}%)`);
    console.log(`Timeouts: ${summary.control.timeouts} (${(summary.control.timeouts/summary.control.total*100).toFixed(1)}%)`);

    console.log('\n🚀 DNS SERVER PERFORMANCE:');
    for (const [serverName, stats] of Object.entries(summary.dnsPerformance)) {
        if (stats.count > 0) {
            console.log(`${serverName}: ${stats.average.toFixed(0)}ms avg, ${stats.successRate.toFixed(1)}% success rate`);
        }
    }

    console.log('\n💡 KEY FINDINGS:');
    
    // Find consistently failing domains
    const consistentFailures = [];
    for (const [domain, results] of Object.entries(results)) {
        const failures = Object.values(results).filter(r => !r.success).length;
        if (failures === DNS_SERVERS.length) {
            consistentFailures.push(domain);
        }
    }
    
    if (consistentFailures.length > 0) {
        console.log(`• ${consistentFailures.length} domains fail DNS resolution across all servers: ${consistentFailures.join(', ')}`);
    }

    // Find slow domains
    const slowDomains = [];
    for (const [domain, results] of Object.entries(results)) {
        const avgTime = Object.values(results)
            .filter(r => r.success)
            .reduce((acc, r, _, arr) => acc + r.duration / arr.length, 0);
        
        if (avgTime > 1000) {
            slowDomains.push({ domain, avgTime });
        }
    }
    
    if (slowDomains.length > 0) {
        console.log(`• ${slowDomains.length} domains have slow DNS (>1s average): ${slowDomains.map(s => s.domain).join(', ')}`);
    }

    // DNS server recommendation
    const bestDNS = Object.entries(summary.dnsPerformance)
        .filter(([, stats]) => stats.count > 0)
        .sort(([, a], [, b]) => a.average - b.average)[0];
    
    if (bestDNS) {
        console.log(`• Best performing DNS server: ${bestDNS[0]} (${bestDNS[1].average.toFixed(0)}ms average)`);
    }

    console.log('\n🔧 NETWORK RESILIENCE RECOMMENDATIONS:');
    console.log('1. Implement DNS server fallback sequence: Cloudflare → Google → System Default');
    console.log('2. Use longer DNS cache TTL (10-15 minutes) for slow-resolving domains');
    console.log('3. Pre-resolve DNS for known problematic domains during app startup');
    console.log('4. Implement domain-specific DNS timeout values based on historical performance');
    console.log('5. Add DNS resolution health monitoring to NetworkResilienceService');

    return { results, summary };
}

if (require.main === module) {
    runQuickDNSTest().catch(console.error);
}

module.exports = { runQuickDNSTest, TEST_DOMAINS };