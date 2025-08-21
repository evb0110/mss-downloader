#!/usr/bin/env node

/**
 * Network DNS Analysis Script
 * Tests DNS resolution for all supported manuscript library domains
 */

const dns = require('dns').promises;
const { performance } = require('perf_hooks');

// Library domains to test (extracted from loader patterns)
const LIBRARY_DOMAINS = [
    // Major libraries
    'api.bl.uk', 'bl.uk', 'bl.digirati.io',
    'digi.vatlib.it',
    'gallica.bnf.fr',
    'digitalcollections.nypl.org',
    'morganlibrarycatalog.s3.amazonaws.com',
    'cudl.lib.cam.ac.uk',
    'parker.stanford.edu',
    
    // European libraries
    'digital.bodleian.ox.ac.uk',
    'manuscripta.at',
    'unipub.uni-graz.at',
    'digitale.bnc.roma.sbn.it',
    'manus.iccu.sbn.it',
    'www.internetculturale.it',
    
    // German libraries
    'digital.staatsbibliothek-berlin.de',
    'digital.blb-karlsruhe.de',
    'www.geschichtsquellen.de',
    'digital.ulb.hhu.de',
    'dfg-viewer.de',
    'www.e-codices.unifr.ch',
    
    // French libraries  
    'bvmm.irht.cnrs.fr',
    'pagella.bm-grenoble.fr',
    'bibliotheque-numerique.bibliotheque-agglo-stomer.fr',
    'bibliotheque-numerique.ville-bourg-en-bresse.fr',
    
    // Italian libraries
    'teca.bncf.firenze.sbn.it',
    'www.nuovabibliotecamanoscritta.it',
    'nbm.regione.veneto.it',
    'manoscritti.vatlib.it',
    'omnesviae.org',
    
    // Spanish/Portuguese libraries
    'bdh-rd.bne.es',
    'www.bvpb.mcu.es',
    'mdc.csuc.cat',
    
    // Other European
    'www.kb.nl',
    'digi.ksbm.oeaw.ac.at',
    'www.onb.ac.at',
    
    // American/Canadian
    'collections.library.utoronto.ca',
    'repository.library.brown.edu',
    'contentdm.library.illinois.edu',
    'cdm21059.contentdm.oclc.org',
    
    // Archives and specialized
    'archiviodigitale.org',
    'manuscriptum.com',
    'www.diamond-project.eu',
    'www.e-manuscripta.ch'
];

// DNS server configurations to test
const DNS_SERVERS = {
    'cloudflare': ['1.1.1.1', '1.0.0.1'],
    'google': ['8.8.8.8', '8.8.4.4'],
    'quad9': ['9.9.9.9', '149.112.112.112'],
    'opendns': ['208.67.222.222', '208.67.220.220'],
    'system': [] // Use system default
};

class NetworkDNSAnalyzer {
    constructor() {
        this.results = {
            domains: {},
            summary: {},
            recommendations: []
        };
    }

    async testDNSResolution(domain, dnsServer = null, timeout = 5000) {
        const startTime = performance.now();
        
        try {
            // Configure DNS if specific server provided
            if (dnsServer) {
                dns.setServers([dnsServer]);
            } else {
                // Use system default
                dns.setServers([]);
            }

            // Test both IPv4 and IPv6
            const [ipv4, ipv6] = await Promise.allSettled([
                dns.resolve4(domain),
                dns.resolve6(domain).catch(() => []) // IPv6 is optional
            ]);

            const duration = performance.now() - startTime;

            return {
                success: true,
                duration,
                ipv4: ipv4.status === 'fulfilled' ? ipv4.value : [],
                ipv6: ipv6.status === 'fulfilled' ? ipv6.value : [],
                error: null,
                dnsServer: dnsServer || 'system',
                timeout: false
            };

        } catch (error) {
            const duration = performance.now() - startTime;
            
            return {
                success: false,
                duration,
                ipv4: [],
                ipv6: [],
                error: error.code || error.message,
                dnsServer: dnsServer || 'system',
                timeout: duration >= timeout
            };
        }
    }

    async testDomainAcrossServers(domain) {
        console.log(`Testing DNS for ${domain}...`);
        const domainResults = {};

        for (const [serverName, servers] of Object.entries(DNS_SERVERS)) {
            if (serverName === 'system') {
                domainResults[serverName] = await this.testDNSResolution(domain, null);
            } else {
                // Test primary server
                domainResults[serverName] = await this.testDNSResolution(domain, servers[0]);
            }
        }

        return domainResults;
    }

    async runAnalysis() {
        console.log('🔍 Starting Network DNS Analysis...');
        console.log(`Testing ${LIBRARY_DOMAINS.length} library domains across ${Object.keys(DNS_SERVERS).length} DNS configurations\n`);

        for (const domain of LIBRARY_DOMAINS) {
            this.results.domains[domain] = await this.testDomainAcrossServers(domain);
        }

        this.analyzeSummary();
        this.generateRecommendations();
        this.printReport();
        this.saveReport();
    }

    analyzeSummary() {
        const summary = {
            totalDomains: LIBRARY_DOMAINS.length,
            successfulDomains: 0,
            failedDomains: 0,
            avgResolutionTime: 0,
            ipv6Support: 0,
            timeoutIssues: 0,
            errorTypes: {},
            fastestDNS: {},
            slowestDomains: [],
            problematicDomains: []
        };

        let totalResolutionTime = 0;
        let successfulResolutions = 0;
        const dnsPerformance = {};

        for (const [domain, results] of Object.entries(this.results.domains)) {
            let domainSuccess = false;
            let domainHasIPv6 = false;
            let domainHasTimeout = false;
            let domainHasErrors = false;

            for (const [serverName, result] of Object.entries(results)) {
                if (result.success) {
                    domainSuccess = true;
                    totalResolutionTime += result.duration;
                    successfulResolutions++;

                    // Track DNS server performance
                    if (!dnsPerformance[serverName]) {
                        dnsPerformance[serverName] = { total: 0, count: 0, avg: 0 };
                    }
                    dnsPerformance[serverName].total += result.duration;
                    dnsPerformance[serverName].count++;
                }

                if (result.ipv6.length > 0) {
                    domainHasIPv6 = true;
                }

                if (result.timeout) {
                    domainHasTimeout = true;
                }

                if (result.error) {
                    domainHasErrors = true;
                    summary.errorTypes[result.error] = (summary.errorTypes[result.error] || 0) + 1;
                }
            }

            if (domainSuccess) {
                summary.successfulDomains++;
            } else {
                summary.failedDomains++;
                summary.problematicDomains.push(domain);
            }

            if (domainHasIPv6) {
                summary.ipv6Support++;
            }

            if (domainHasTimeout) {
                summary.timeoutIssues++;
            }

            // Track slow domains
            const avgDomainTime = Object.values(results)
                .filter(r => r.success)
                .reduce((acc, r) => acc + r.duration, 0) / 
                Object.values(results).filter(r => r.success).length;
            
            if (avgDomainTime > 1000) { // Slower than 1 second
                summary.slowestDomains.push({ domain, avgTime: avgDomainTime });
            }
        }

        // Calculate DNS server averages
        for (const [serverName, stats] of Object.entries(dnsPerformance)) {
            stats.avg = stats.total / stats.count;
        }

        summary.avgResolutionTime = totalResolutionTime / successfulResolutions;
        summary.fastestDNS = Object.entries(dnsPerformance)
            .sort(([,a], [,b]) => a.avg - b.avg)
            .slice(0, 3);

        this.results.summary = summary;
    }

    generateRecommendations() {
        const { summary } = this.results;
        const recommendations = [];

        // DNS Server Performance
        if (summary.fastestDNS.length > 0) {
            const fastest = summary.fastestDNS[0];
            recommendations.push({
                category: 'DNS_OPTIMIZATION',
                priority: 'HIGH',
                title: 'Optimize DNS Server Configuration',
                description: `${fastest[0]} DNS shows best performance (${fastest[1].avg.toFixed(1)}ms average)`,
                implementation: `Configure NetworkResilienceService to prefer ${fastest[0]} DNS servers: ${JSON.stringify(DNS_SERVERS[fastest[0]])}`
            });
        }

        // IPv6 Support
        const ipv6Percentage = (summary.ipv6Support / summary.totalDomains) * 100;
        if (ipv6Percentage < 50) {
            recommendations.push({
                category: 'IPV6_FALLBACK',
                priority: 'MEDIUM',
                title: 'IPv6 Fallback Strategy',
                description: `Only ${ipv6Percentage.toFixed(1)}% of domains support IPv6`,
                implementation: 'Implement IPv4-first resolution with IPv6 fallback disabled for better performance'
            });
        }

        // Problematic Domains
        if (summary.problematicDomains.length > 0) {
            recommendations.push({
                category: 'DNS_FALLBACK',
                priority: 'HIGH',
                title: 'DNS Fallback for Problematic Domains',
                description: `${summary.problematicDomains.length} domains have DNS resolution issues`,
                implementation: 'Implement domain-specific DNS server fallbacks and extended timeouts',
                affectedDomains: summary.problematicDomains
            });
        }

        // Timeout Issues
        if (summary.timeoutIssues > 0) {
            recommendations.push({
                category: 'TIMEOUT_OPTIMIZATION',
                priority: 'MEDIUM',
                title: 'DNS Resolution Timeout Optimization',
                description: `${summary.timeoutIssues} domains experience timeout issues`,
                implementation: 'Implement adaptive DNS timeout based on domain patterns and geographic regions'
            });
        }

        // Slow Domains
        if (summary.slowestDomains.length > 0) {
            recommendations.push({
                category: 'DNS_CACHING',
                priority: 'HIGH',
                title: 'Enhanced DNS Caching for Slow Domains',
                description: `${summary.slowestDomains.length} domains have slow DNS resolution (>1s)`,
                implementation: 'Increase DNS cache TTL for slow domains and implement pre-resolution',
                slowDomains: summary.slowestDomains.sort((a, b) => b.avgTime - a.avgTime).slice(0, 10)
            });
        }

        this.results.recommendations = recommendations;
    }

    printReport() {
        console.log('\n🔍 NETWORK DNS ANALYSIS REPORT');
        console.log('=====================================\n');

        const { summary } = this.results;

        // Summary Stats
        console.log('📊 SUMMARY STATISTICS');
        console.log(`Total Domains Tested: ${summary.totalDomains}`);
        console.log(`Successfully Resolved: ${summary.successfulDomains} (${(summary.successfulDomains/summary.totalDomains*100).toFixed(1)}%)`);
        console.log(`Resolution Failures: ${summary.failedDomains}`);
        console.log(`Average Resolution Time: ${summary.avgResolutionTime.toFixed(1)}ms`);
        console.log(`IPv6 Support: ${summary.ipv6Support}/${summary.totalDomains} domains (${(summary.ipv6Support/summary.totalDomains*100).toFixed(1)}%)`);
        console.log(`Timeout Issues: ${summary.timeoutIssues} domains\n`);

        // DNS Server Performance
        console.log('🚀 DNS SERVER PERFORMANCE');
        summary.fastestDNS.forEach(([server, stats], index) => {
            const medal = ['🥇', '🥈', '🥉'][index] || '⭐';
            console.log(`${medal} ${server}: ${stats.avg.toFixed(1)}ms average (${stats.count} successful resolutions)`);
        });
        console.log();

        // Error Analysis
        if (Object.keys(summary.errorTypes).length > 0) {
            console.log('❌ ERROR ANALYSIS');
            for (const [error, count] of Object.entries(summary.errorTypes)) {
                console.log(`${error}: ${count} occurrences`);
            }
            console.log();
        }

        // Problematic Domains
        if (summary.problematicDomains.length > 0) {
            console.log('⚠️  PROBLEMATIC DOMAINS');
            summary.problematicDomains.forEach(domain => {
                console.log(`• ${domain}`);
            });
            console.log();
        }

        // Recommendations
        console.log('💡 RECOMMENDATIONS');
        this.results.recommendations.forEach((rec, index) => {
            const priority = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
            console.log(`${index + 1}. ${priority} ${rec.title}`);
            console.log(`   ${rec.description}`);
            console.log(`   Implementation: ${rec.implementation}`);
            if (rec.affectedDomains) {
                console.log(`   Affected: ${rec.affectedDomains.slice(0, 5).join(', ')}${rec.affectedDomains.length > 5 ? '...' : ''}`);
            }
            console.log();
        });
    }

    async saveReport() {
        const fs = require('fs');
        const path = require('path');

        const reportPath = '.devkit/reports/network-dns-analysis.json';
        const reportDir = path.dirname(reportPath);
        
        // Ensure directory exists
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        // Add timestamp to results
        this.results.timestamp = new Date().toISOString();
        this.results.metadata = {
            totalDomains: LIBRARY_DOMAINS.length,
            dnsServerstested: Object.keys(DNS_SERVERS),
            analysisVersion: '1.0.0'
        };

        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`📄 Full report saved to: ${reportPath}`);
    }
}

// Run analysis
if (require.main === module) {
    const analyzer = new NetworkDNSAnalyzer();
    analyzer.runAnalysis().catch(console.error);
}

module.exports = NetworkDNSAnalyzer;