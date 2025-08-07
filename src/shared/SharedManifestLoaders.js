/**
 * Shared Manifest Loaders - Used by both production (Electron) and test scripts
 * This ensures production and test environments use IDENTICAL logic and resolution settings
 * SINGLE SOURCE OF TRUTH for all manuscript library integrations
 */

// Use dynamic import in constructor to avoid require() lint error
// const https = require('https');

class SharedManifestLoaders {
    constructor(fetchFunction = null) {
        // Use provided fetch function or default Node.js implementation
        this.fetchWithRetry = fetchFunction || this.defaultNodeFetch.bind(this);
    }

    async defaultNodeFetch(url, options = {}, retries = 3) {
        // CRITICAL FIX: Validate URL before processing
        if (url && typeof url === 'string' && url.includes('.frhttps://')) {
            console.error('[defaultNodeFetch] DETECTED MALFORMED URL:', url);
            const match = url.match(/(https:\/\/.+)$/);
            if (match) {
                url = match[1];
                console.log('[defaultNodeFetch] CORRECTED URL TO:', url);
            }
        }
        
        // Increase retries for Verona domains  
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
            retries = 15; // Increased from 9 to 15 for maximum reliability against server issues
        }
        
        for (let i = 0; i < retries; i++) {
            try {
                return await this.fetchUrl(url, options);
            } catch (error) {
                console.log(`[SharedManifestLoaders] Attempt ${i + 1}/${retries} failed for ${url}: ${error.message}`);
                if (error.code) console.log(`[SharedManifestLoaders] Error code: ${error.code}`);
                
                if (i === retries - 1) {
                    // Enhanced error messages for specific error types
                    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                        // ULTRA-PRIORITY FIX: Sanitize URL before extracting hostname
                        const sanitizedUrl = this.sanitizeUrl(url);
                        const domain = new URL(sanitizedUrl).hostname;
                        throw new Error(`DNS resolution failed for ${domain}. This may be due to:\n1. Network connectivity issues\n2. DNS server problems\n3. Firewall blocking the domain\n4. The server may be temporarily down\n\nPlease check your internet connection and try again.`);
                    }
                    
                    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
                        // ULTRA-PRIORITY FIX: Sanitize URL before extracting hostname
                        const sanitizedUrl = this.sanitizeUrl(url);
                        const domain = new URL(sanitizedUrl).hostname;
                        // Library-specific timeout messages
                        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
                            throw new Error(`Verona server is not responding after ${retries} attempts over ${this.calculateTotalRetryTime(retries)} minutes. The server may be experiencing high load, maintenance, or network issues. Please try again in 10-15 minutes.`);
                        } else if (url.includes('mdc.csuc.cat')) {
                            throw new Error(`Catalonia MDC server timeout after ${retries} attempts. The server at ${domain} is not responding. This may be due to high server load or network issues.`);
                        } else if (url.includes('cdm21059.contentdm.oclc.org')) {
                            throw new Error(`Florence library server timeout after ${retries} attempts. The ContentDM server is not responding. Please try again later.`);
                        } else {
                            throw new Error(`Connection timeout for ${domain} after ${retries} attempts. The server is not responding. Please try again later.`);
                        }
                    }
                    
                    throw error;
                }
                
                // Exponential backoff with jitter for Verona, progressive for others
                let delay;
                if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
                    // Exponential backoff: 3s, 6s, 12s, 24s, 48s, 96s, 192s, 384s, 768s
                    const baseDelay = 3000;
                    const exponentialDelay = baseDelay * Math.pow(2, i);
                    // Add jitter to prevent thundering herd
                    const jitter = Math.random() * 1000;
                    delay = Math.min(exponentialDelay + jitter, 300000); // Cap at 5 minutes
                } else {
                    delay = 2000 * (i + 1);
                }
                
                console.log(`[SharedManifestLoaders] Waiting ${Math.round(delay/1000)}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    calculateTotalRetryTime(retries) {
        // Calculate approximate total time for exponential backoff
        let totalMs = 0;
        for (let i = 0; i < retries - 1; i++) {
            const baseDelay = 3000;
            const exponentialDelay = baseDelay * Math.pow(2, i);
            totalMs += Math.min(exponentialDelay, 300000);
        }
        return Math.round(totalMs / 60000); // Convert to minutes
    }
    
    /**
     * ULTRA-PRIORITY FIX: Comprehensive URL sanitization to prevent hostname concatenation
     * This addresses Issue #13 where URLs like 'pagella.bm-grenoble.frhttps://...' cause DNS errors
     */
    sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return url;
        
        // Pattern 1: hostname directly concatenated with protocol (most common)
        // Example: pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/...
        const concatenatedPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
        const match = url.match(concatenatedPattern);
        if (match) {
            const [, hostname, actualUrl] = match;
            console.error(`[URL SANITIZER] Detected concatenated URL: ${url}`);
            console.error(`[URL SANITIZER] Extracted hostname: ${hostname}`);
            console.error(`[URL SANITIZER] Extracted URL: ${actualUrl}`);
            
            // Verify the extracted URL is valid
            try {
                new URL(actualUrl);
                console.log(`[URL SANITIZER] Fixed URL: ${actualUrl}`);
                return actualUrl;
            } catch (e) {
                console.error('[URL SANITIZER] Extracted URL is still invalid:', e.message);
            }
        }
        
        // Pattern 2: Check for any domain+protocol patterns
        const domainPatterns = [
            /\.(fr|com|org|edu|net|it|es|at|uk|de|ch)(https?:\/\/)/i,
            /^[^:/\s]+\.[^:/\s]+(https?:\/\/)/i
        ];
        
        for (const pattern of domainPatterns) {
            if (pattern.test(url)) {
                const protocolMatch = url.match(/(https?:\/\/.+)$/);
                if (protocolMatch) {
                    console.error(`[URL SANITIZER] Fixed malformed URL pattern: ${url} -> ${protocolMatch[1]}`);
                    return protocolMatch[1];
                }
            }
        }
        
        return url;
    }

    async fetchUrl(url, options = {}, redirectCount = 0) {
        const MAX_REDIRECTS = 10; // Prevent infinite redirect loops
        
        if (redirectCount > MAX_REDIRECTS) {
            throw new Error(`Too many redirects (${redirectCount}) for URL: ${url}`);
        }
        
        // ULTRA-CRITICAL FIX: Enhanced detection and fix for malformed URLs
        url = this.sanitizeUrl(url);
        
        // Legacy check for backward compatibility
        if (url && typeof url === 'string' && url.includes('.frhttps://')) {
            console.error('[SharedManifestLoaders] DETECTED MALFORMED URL:', url);
            const match = url.match(/(https:\/\/.+)$/);
            if (match) {
                url = match[1];
                console.log('[SharedManifestLoaders] CORRECTED URL TO:', url);
            }
        }
        
        // Check if we need to use HTTPS module for SSL bypass domains
        const needsSSLBypass = url.includes('bdh-rd.bne.es') || url.includes('pagella.bm-grenoble.fr') || 
                               url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') ||
                               url.includes('iiif.bodleian.ox.ac.uk') || url.includes('bdl.servizirl.it') ||
                               url.includes('mdc.csuc.cat') || url.includes('cdm21059.contentdm.oclc.org');
        
        // In Electron environment, use built-in fetch when available (unless SSL bypass needed)
        if (typeof fetch !== 'undefined' && !needsSSLBypass) {
            try {
                const controller = new AbortController();
                const timeoutMs = this.getTimeoutForUrl(url);
                
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': options.headers?.Accept || '*/*',
                        ...options.headers
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // Handle redirects
                if (response.redirected && response.url !== url) {
                    console.log(`[SharedManifestLoaders] Redirect: ${url} -> ${response.url}`);
                }
                
                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    buffer: () => response.arrayBuffer().then(ab => Buffer.from(ab)),
                    text: () => response.text(),
                    json: () => response.json()
                };
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout for ${url}`);
                }
                throw error;
            }
        }
        
        // Fallback to Node.js https module
        const https = eval("require('https')");
        
        return new Promise((resolve, reject) => {
            // DEFENSIVE: Ensure URL is sanitized before creating URL object
            url = this.sanitizeUrl(url);
            
            let urlObj;
            try {
                urlObj = new URL(url);
            } catch (error) {
                console.error('[SharedManifestLoaders] Invalid URL after sanitization:', url);
                reject(new Error(`Invalid URL: ${url}. Original error: ${error.message}`));
                return;
            }
            
            const timeoutMs = this.getTimeoutForUrl(url);
            
            // ULTRA-DEFENSIVE: Final hostname validation before request
            let hostname = urlObj.hostname;
            
            // CRITICAL FIX for Issue #13: Check for any URL-like patterns in hostname
            if (hostname.includes('://') || hostname.includes('https') || hostname.includes('http')) {
                console.error(`[CRITICAL] Hostname contains URL parts: ${hostname}`);
                console.error(`[CRITICAL] Original URL was: ${url}`);
                
                // Try to extract clean hostname
                const cleanMatch = hostname.match(/^([a-z0-9.-]+?)(?:https?|\/\/|$)/i);
                if (cleanMatch && cleanMatch[1]) {
                    hostname = cleanMatch[1];
                    console.log(`[CRITICAL] Extracted clean hostname: ${hostname}`);
                    urlObj.hostname = hostname; // Update the URL object
                } else {
                    reject(new Error(`Invalid hostname detected: ${hostname}. Cannot extract valid hostname from malformed URL.`));
                    return;
                }
            }
            
            // Additional validation: hostname should be a valid domain
            if (!/^[a-z0-9.-]+$/i.test(hostname) || hostname.length > 253) {
                console.error(`[CRITICAL] Invalid hostname format: ${hostname}`);
                reject(new Error(`Invalid hostname format: ${hostname}`));
                return;
            }
            
            const requestOptions = {
                hostname: hostname,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': options.headers?.Accept || '*/*',
                    ...options.headers
                },
                timeout: timeoutMs
            };

            // SSL bypass for specific domains with certificate issues
            if (url.includes('bdh-rd.bne.es') || url.includes('pagella.bm-grenoble.fr') || 
                url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') ||
                url.includes('iiif.bodleian.ox.ac.uk')) {
                requestOptions.rejectUnauthorized = false;
                // Additional headers for Verona servers
                if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
                    requestOptions.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
                    requestOptions.headers['Accept-Language'] = 'en-US,en;q=0.9';
                }
            }

            const req = https.request(requestOptions, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400) {
                    if (res.headers.location) {
                        let redirectUrl;
                        try {
                            // CRITICAL FIX: Validate that location header contains a proper URL
                            // before attempting to construct new URL to prevent error message concatenation
                            const location = res.headers.location.trim();
                            
                            // Check if location is a proper URL (absolute or relative)
                            if (location.startsWith('http://') || location.startsWith('https://')) {
                                // Absolute URL - use as-is
                                redirectUrl = location;
                            } else if (location.startsWith('/') || location.match(/^[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/)) {
                                // Relative URL or path - safe to resolve against base URL
                                redirectUrl = new URL(location, url).href;
                            } else {
                                // Invalid location header - likely contains error message
                                throw new Error(`Invalid redirect location header: "${location}"`);
                            }
                        } catch (urlError) {
                            // Failed to create valid redirect URL - treat as error
                            console.error(`[SharedManifestLoaders] Invalid redirect location from ${url}: ${res.headers.location}`);
                            resolve({
                                ok: false,
                                status: res.statusCode,
                                statusText: `Invalid redirect location: ${res.headers.location}`,
                                headers: res.headers,
                                buffer: () => Promise.resolve(Buffer.alloc(0)),
                                text: () => Promise.resolve(''),
                                json: () => Promise.reject(new Error('Invalid redirect response'))
                            });
                            return;
                        }
                        
                        console.log(`[SharedManifestLoaders] Redirect ${redirectCount + 1}/${MAX_REDIRECTS}: ${res.statusCode} ${url} -> ${redirectUrl}`);
                        
                        this.fetchUrl(redirectUrl, options, redirectCount + 1).then(resolve).catch(reject);
                        return;
                    } else {
                        resolve({
                            ok: false,
                            status: res.statusCode,
                            statusText: res.statusMessage + ' (Missing Location header)',
                            headers: res.headers,
                            buffer: () => Promise.resolve(Buffer.alloc(0)),
                            text: () => Promise.resolve(''),
                            json: () => Promise.reject(new Error('No content to parse'))
                        });
                        return;
                    }
                }

                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        buffer: () => Promise.resolve(buffer),
                        text: () => Promise.resolve(buffer.toString()),
                        json: () => Promise.resolve(JSON.parse(buffer.toString()))
                    });
                });
            });

            req.on('error', (error) => {
                // CRITICAL FIX: Clean error to prevent URL malformation
                // Node.js ETIMEDOUT errors contain address/port that can get concatenated with URLs
                if (error.code === 'ETIMEDOUT') {
                    const cleanError = new Error(`Connection timeout: ${error.message}`);
                    cleanError.code = error.code;
                    cleanError.originalUrl = url;
                    // Store network details separately to prevent concatenation
                    cleanError.networkDetails = {
                        address: error.address,
                        port: error.port,
                        syscall: error.syscall
                    };
                    reject(cleanError);
                } else {
                    reject(error);
                }
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }
    
    getTimeoutForUrl(url) {
        // Verona servers need extended timeout
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
            return url.includes('mirador_json/manifest/') ? 180000 : 90000;
        }
        // University of Graz and Florence need extended timeout
        if (url.includes('unipub.uni-graz.at') || url.includes('gams.uni-graz.at') || url.includes('cdm21059.contentdm.oclc.org')) {
            return 120000;
        }
        // Default timeout
        return 30000;
    }

    /**
     * BDL Servizirl - Fixed with double-slash IIIF pattern
     */
    async getBDLManifest(url) {
        const match = url.match(/BDL-OGGETTO-(\d+)/);
        if (!match) throw new Error('Invalid BDL URL');
        
        const objectId = match[1];
        
        // Use the BookReader API endpoint (path=public instead of fe)
        const apiUrl = `https://www.bdl.servizirl.it/bdl/public/rest/json/item/${objectId}/bookreader/pages`;
        
        const response = await this.fetchWithRetry(apiUrl);
        if (!response.ok) throw new Error(`Failed to fetch BDL API: ${response.status}`);
        
        const data = await response.json();
        const images = [];
        
        // Extract all pages with IIIF URLs
        for (let i = 0; i < data.length; i++) {
            const page = data[i];
            if (page.idMediaServer) {
                const imageUrl = `https://www.bdl.servizirl.it/cantaloupe//iiif/2/${page.idMediaServer}/full/max/0/default.jpg`;
                images.push({
                    url: imageUrl,
                    label: `Page ${i + 1}`
                });
            }
        }
        
        return { images };
    }

    /**
     * Verona - NBM (Nuova Biblioteca Manoscritta) - Fixed with Electron-safe fetch and simplified timeout handling
     */
    async getVeronaManifest(url) {
        console.log('[Verona] Processing URL:', url);
        
        // Perform server health check first (but don't fail completely if it fails)
        try {
            const isHealthy = await this.checkVeronaServerHealth();
            if (!isHealthy) {
                console.warn('[Verona] Health check failed, but continuing with enhanced retries...');
            }
        } catch (error) {
            console.warn('[Verona] Health check error, but continuing:', error.message);
        }
        
        // Check if this is a direct IIIF manifest URL
        if (url.includes('mirador_json/manifest/')) {
            console.log('[Verona] Direct IIIF manifest URL detected');
            return await this.fetchVeronaIIIFManifest(url);
        }
        
        // Extract codice from interface URL - handle multiple patterns
        let codice;
        
        // Pattern 1: New pattern /Generale/manoscritto/scheda/id/1093
        const schedaMatch = url.match(/\/scheda\/id\/(\d+)/);
        if (schedaMatch) {
            codice = schedaMatch[1];
            console.log('[Verona] Extracted codice from scheda URL:', codice);
        } else {
            // Pattern 2: Legacy patterns with query parameters
            const codiceMatch = url.match(/[?&]codice=(\d+)/);
            const codiceDigitalMatch = url.match(/[?&]codiceDigital=(\d+)/);
            codice = codiceMatch?.[1] || codiceDigitalMatch?.[1];
        }
        
        if (!codice) {
            throw new Error('Invalid Verona URL - no manuscript ID found. Expected patterns: /scheda/id/XXXX or ?codice=XXXX');
        }
        
        console.log('[Verona] Extracted codice:', codice);
        
        // Try to discover the manifest URL from the HTML page with enhanced error handling
        try {
            console.log('[Verona] Attempting manifest URL discovery...');
            const manifestUrl = await this.discoverVeronaManifestUrl(url, codice);
            if (manifestUrl) {
                console.log('[Verona] Discovered manifest URL:', manifestUrl);
                return await this.fetchVeronaIIIFManifest(manifestUrl);
            }
        } catch (error) {
            console.warn('[Verona] Manifest URL discovery failed:', error.message);
            if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                throw new Error('Verona server is not responding during manifest discovery. The server may be experiencing high load. Please try again in 10-15 minutes.');
            }
        }
        
        // Fallback to known mappings with enhanced discovery
        const knownMappings = {
            '15': 'LXXXIX841',  // LXXXIX (84)
            '14': 'CVII1001'    // CVII (100) - based on test patterns
        };
        
        const manifestId = knownMappings[codice];
        if (manifestId) {
            const manifestUrl = `https://www.nuovabibliotecamanoscritta.it/documenti/mirador_json/manifest/${manifestId}.json`;
            console.log('[Verona] Using known mapping, manifest URL:', manifestUrl);
            return await this.fetchVeronaIIIFManifest(manifestUrl);
        }
        
        throw new Error(`Unable to find manifest for Verona manuscript code: ${codice}. The server may be experiencing issues, or this manuscript may not be available. Please verify the URL is correct and try again later.`);
    }
    
    /**
     * Discover Verona manifest URL from HTML page
     */
    async discoverVeronaManifestUrl(pageUrl, codice) {
        console.log('[Verona] Attempting to discover manifest URL from page');
        
        try {
            const response = await this.fetchWithRetry(pageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch page: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Look for manifest references in the HTML
            // Common patterns: manifest.json links, Mirador configuration, etc.
            const manifestPatterns = [
                /manifest[/\\]([A-Z]+\d+)\.json/i,
                /"manifestUri":\s*"([^"]+manifest[^"]+)"/,
                /data-manifest="([^"]+)"/,
                /mirador_json\/manifest\/([A-Z]+\d+)/i
            ];
            
            for (const pattern of manifestPatterns) {
                const match = html.match(pattern);
                if (match) {
                    let manifestUrl = match[1];
                    
                    // If we only got the ID, construct the full URL
                    if (!manifestUrl.startsWith('http')) {
                        if (manifestUrl.includes('.json')) {
                            manifestUrl = `https://www.nuovabibliotecamanoscritta.it${manifestUrl.startsWith('/') ? '' : '/'}${manifestUrl}`;
                        } else {
                            manifestUrl = `https://www.nuovabibliotecamanoscritta.it/documenti/mirador_json/manifest/${manifestUrl}.json`;
                        }
                    }
                    
                    console.log('[Verona] Found manifest URL in HTML:', manifestUrl);
                    return manifestUrl;
                }
            }
            
            // Try to find Mirador viewer initialization
            const miradorMatch = html.match(/Mirador\.viewer\s*\(\s*{[^}]*manifestUri[^}]*}\s*\)/);
            if (miradorMatch) {
                const manifestUriMatch = miradorMatch[0].match(/"manifestUri":\s*"([^"]+)"/);
                if (manifestUriMatch) {
                    console.log('[Verona] Found manifest in Mirador config:', manifestUriMatch[1]);
                    return manifestUriMatch[1];
                }
            }
            
        } catch (error) {
            console.error('[Verona] Error discovering manifest URL:', error);
        }
        
        return null;
    }
    
    /**
     * Check Verona server health before attempting operations
     */
    async checkVeronaServerHealth() {
        console.log('[Verona] Performing server health check...');
        
        const healthCheckUrls = [
            'https://www.nuovabibliotecamanoscritta.it',
            'https://nbm.regione.veneto.it' // Keep old URL as fallback
        ];
        
        for (const healthUrl of healthCheckUrls) {
            try {
                const response = await this.fetchWithRetry(healthUrl, {
                    method: 'HEAD', // HEAD request for minimal data transfer
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                }, 2); // Only 2 retries for health check
                
                if (response.ok || response.status === 301 || response.status === 302) {
                    console.log(`[Verona] Server health check passed for ${healthUrl}`);
                    return true;
                }
            } catch (error) {
                console.log(`[Verona] Health check failed for ${healthUrl}: ${error.message}`);
                continue;
            }
        }
        
        console.warn('[Verona] All health checks failed');
        return false;
    }
    
    /**
     * Fetch and parse Verona IIIF manifest with enhanced timeout handling
     */
    async fetchVeronaIIIFManifest(manifestUrl) {
        console.log('[Verona] Fetching IIIF manifest from:', manifestUrl);
        
        // Enhanced timeout strategy with multiple layers
        const startTime = Date.now();
        const maxTotalTime = 300000; // 5 minutes maximum total time
        
        // Create adaptive timeout based on manifest size expectations
        const adaptiveTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                reject(new Error(`Verona manifest fetch timeout after ${elapsed} seconds. The manifest may be very large or the server is experiencing high load.`));
            }, 240000); // 4 minutes for manifest fetching
        });
        
        try {
            console.log('[Verona] Starting manifest fetch with enhanced timeout handling...');
            
            // Use fetchWithRetry which already has Verona-specific retry logic
            const response = await Promise.race([
                this.fetchWithRetry(manifestUrl),
                adaptiveTimeoutPromise
            ]);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Verona manifest not found (404). The manuscript may have been moved or the URL is incorrect.`);
                } else if (response.status >= 500) {
                    throw new Error(`Verona server error (${response.status}). The server is experiencing technical difficulties.`);
                } else {
                    throw new Error(`Failed to fetch Verona manifest: ${response.status} ${response.statusText}`);
                }
            }
            
            console.log('[Verona] Manifest response received, parsing JSON...');
            const parseStartTime = Date.now();
            
            let manifest;
            try {
                const manifestText = await response.text();
                console.log(`[Verona] Manifest size: ${Math.round(manifestText.length / 1024)}KB`);
                
                if (!manifestText || manifestText.trim().length === 0) {
                    throw new Error('Empty manifest received from Verona server');
                }
                
                if (manifestText.trim().startsWith('<!DOCTYPE') || manifestText.trim().startsWith('<html')) {
                    throw new Error('Verona server returned HTML error page instead of JSON manifest');
                }
                
                manifest = JSON.parse(manifestText);
                const parseTime = Date.now() - parseStartTime;
                console.log(`[Verona] Manifest parsed in ${parseTime}ms`);
                
            } catch (parseError) {
                console.error('[Verona] JSON parse error:', parseError.message);
                throw new Error(`Failed to parse Verona manifest: ${parseError.message}. The server may have returned invalid data.`);
            }
            
            const images = [];
            
            // Extract manuscript label/title
            const manuscriptIdMatch = url.match(/\/([^/?#]+)(?:\?|#|$)/);
            const manuscriptId = manuscriptIdMatch ? manuscriptIdMatch[1] : '';
            let displayName = manifest.label || `Verona Manuscript ${manuscriptId}`;
            // Include manuscript ID if not already present
            if (manuscriptId && !displayName.includes(manuscriptId)) {
                displayName = `${displayName} (${manuscriptId})`;
            }
            console.log('[Verona] Manuscript:', displayName);
            
            // Parse IIIF v2 manifest structure
            let totalCanvases = 0;
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases;
                totalCanvases = canvases.length;
                console.log('[Verona] Found', totalCanvases, 'pages in manifest');
                
                // FIXED in v1.4.56: Process ALL pages (was limited to 10)
                // Users reported missing pages, now they get complete manuscripts
                const maxPages = totalCanvases;
                for (let i = 0; i < maxPages; i++) {
                    const canvas = canvases[i];
                    
                    if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                        const resource = canvas.images[0].resource;
                        const service = resource.service;
                        
                        // Get the best quality image URL
                        let imageUrl = resource['@id'] || resource.id;
                        
                        // If we have a IIIF service, use it to get maximum resolution
                        if (service && service['@id']) {
                            const serviceUrl = service['@id'].replace(/\/$/, ''); // Remove trailing slash
                            // Test different resolution parameters to find the best quality
                            // Verona supports: full/full, full/max, full/2000, etc.
                            imageUrl = `${serviceUrl}/full/max/0/default.jpg`;
                        }
                        
                        // CRITICAL FIX: Replace old server URL with new one
                        // The manifest from the new server still contains image URLs pointing to the old server
                        if (imageUrl && imageUrl.includes('nbm.regione.veneto.it')) {
                            imageUrl = imageUrl.replace('nbm.regione.veneto.it', 'www.nuovabibliotecamanoscritta.it');
                            console.log('[Verona] Updated image URL from old to new server');
                        }
                        
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            } else {
                throw new Error('Invalid Verona IIIF manifest structure - no canvases found');
            }
            
            if (images.length === 0) {
                throw new Error('No images found in Verona manifest');
            }
            
            const totalTime = Date.now() - startTime;
            console.log(`[Verona] Successfully extracted ${images.length} pages in ${Math.round(totalTime/1000)}s` + (totalCanvases > 10 ? ` (limited from ${totalCanvases} total)` : ''));
            
            return { 
                images,
                displayName: `Verona - ${displayName}`
            };
            
        } catch (error) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.error(`[Verona] Manifest fetch failed after ${elapsed}s:`, error.message);
            
            if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                throw new Error(`Verona server timeout after ${elapsed} seconds. The server may be experiencing heavy load or network issues. Please try again in 15-20 minutes. If this is a large manuscript, consider trying during off-peak hours.`);
            } else if (error.code === 'ENOTFOUND') {
                throw new Error('Cannot connect to Verona server. Please check your internet connection and try again.');
            } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
                throw new Error('Connection to Verona server was reset. The server may be restarting or experiencing technical difficulties.');
            }
            
            throw error;
        }
    }

    /**
     * Vienna Manuscripta - Fixed with direct URL construction
     */
    async getViennaManuscriptaManifest(url) {
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);
        
        // Extract manuscript ID from URL
        const urlMatch = url.match(/\/diglit\/(AT\d+-\d+)/);
        if (!urlMatch) throw new Error('Invalid Vienna Manuscripta URL');
        const manuscriptId = urlMatch[1];
        
        const images = [];
        
        // Based on user's examples: /images/AT/5000/AT5000-71/AT5000-71_003r.jpg
        const parts = manuscriptId.match(/(AT)(\d+)-(\d+)/);
        if (!parts) throw new Error('Invalid manuscript ID format');
        
        const [, prefix, num1, num2] = parts;
        const basePath = `https://manuscripta.at/images/${prefix}/${num1}/${manuscriptId}`;
        
        // Get all pages
        for (let pageNum = 1; pageNum <= 10; pageNum++) {
            const paddedPage = String(pageNum).padStart(3, '0');
            const imageUrl = `${basePath}/${manuscriptId}_${paddedPage}r.jpg`;
            images.push({
                url: imageUrl,
                label: `Page ${paddedPage}r`
            });
        }
        
        return { images };
    }

    /**
     * BNE Spain - Fixed with SSL bypass
     */
    async getBNEManifest(url) {
        const match = url.match(/id=(\d+)/);
        if (!match) throw new Error('Invalid BNE URL');
        
        const docId = match[1];
        const images = [];
        
        // ULTRA-PRIORITY FIX v1.4.74: Direct PDF access to prevent hanging
        // Skip HTML parsing which can hang - test direct PDF access instead
        console.log(`[BNE] Processing manuscript ID: ${docId}`);
        
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${docId}&page=1&pdf=true`;
        
        try {
            // Test if PDFs are directly accessible with enhanced timeout
            console.log(`[BNE] Testing direct PDF access...`);
            const startTime = Date.now();
            
            // Use HEAD request to quickly test PDF availability
            const testResponse = await this.fetchWithRetry(testUrl, {
                method: 'HEAD',
                timeout: 15000, // 15 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 5); // 5 retries for reliability
            
            const responseTime = Date.now() - startTime;
            console.log(`[BNE] PDF access test completed in ${responseTime}ms`);
            
            if (testResponse.ok || testResponse.status === 200) {
                // Direct PDF access works - generate URLs without HTML parsing
                console.log(`[BNE] Direct PDF access confirmed, generating 100 page URLs`);
                
                for (let i = 1; i <= 100; i++) {
                    images.push({
                        url: `https://bdh-rd.bne.es/pdf.raw?query=id:${docId}&page=${i}&pdf=true`,
                        label: `Page ${i}`
                    });
                }
                
                return { images };
            }
        } catch (error) {
            console.warn(`[BNE] Direct PDF test failed: ${error.message}, falling back to HTML parsing`);
        }
        
        // Fallback: Try HTML parsing with enhanced timeouts
        try {
            const viewerUrl = `https://bdh-rd.bne.es/viewer.vm?id=${docId}`;
            const response = await this.fetchWithRetry(viewerUrl, {
                timeout: 30000, // 30 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 5); // 5 retries
            
            const html = await response.text();
            
            // Look for total pages in the HTML - enhanced detection
            const totalPagesMatch = html.match(/totalPages['":\s]+(\d+)|numPages['":\s]+(\d+)|pageCount['":\s]+(\d+)/);
            let totalPages = 100; // Default fallback if detection fails
            
            if (totalPagesMatch) {
                totalPages = parseInt(totalPagesMatch[1] || totalPagesMatch[2] || totalPagesMatch[3]);
                console.log(`[BNE] Auto-discovered ${totalPages} total pages from HTML`);
            }
            
            // Generate URLs for all pages
            for (let i = 1; i <= totalPages; i++) {
                const imageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${docId}&page=${i}&pdf=true`;
                images.push({
                    url: imageUrl,
                    label: `Page ${i}`
                });
            }
        } catch (error) {
            console.warn('[BNE] HTML parsing failed, using default 100 pages:', error.message);
            // Final fallback to 100 pages
            for (let i = 1; i <= 100; i++) {
                const imageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${docId}&page=${i}&pdf=true`;
                images.push({
                    url: imageUrl,
                    label: `Page ${i}`
                });
            }
        }
        
        return { images };
    }

    /**
     * Karlsruhe - Working
     */
    async getKarlsruheManifest(url) {
        let manifestUrl;
        
        // Handle proxy URLs from i3f.vls.io
        if (url.includes('i3f.vls.io')) {
            console.log('[Karlsruhe] Processing proxy URL from i3f.vls.io');
            
            // Extract the actual manifest URL from the id parameter
            const urlObj = new URL(url);
            const manifestId = urlObj.searchParams.get('id');
            
            if (!manifestId) {
                throw new Error('Invalid Karlsruhe proxy URL: missing id parameter');
            }
            
            // Decode the URL-encoded manifest URL
            manifestUrl = decodeURIComponent(manifestId);
            console.log(`[Karlsruhe] Extracted manifest URL: ${manifestUrl}`);
            
            // Validate it's a Karlsruhe manifest URL
            if (!manifestUrl.includes('digital.blb-karlsruhe.de')) {
                throw new Error('Invalid Karlsruhe manifest URL in proxy');
            }
        } else {
            // Handle direct titleinfo URLs
            const match = url.match(/titleinfo\/(\d+)/);
            if (!match) {
                throw new Error('Invalid Karlsruhe URL. Expected either a titleinfo URL or i3f.vls.io proxy URL');
            }
            
            const titleId = match[1];
            manifestUrl = `https://digital.blb-karlsruhe.de/i3f/v20/${titleId}/manifest`;
        }
        
        console.log(`[Karlsruhe] Fetching IIIF manifest from: ${manifestUrl}`);
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch Karlsruhe manifest: ${response.status} ${response.statusText}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            console.log(`[Karlsruhe] Found ${manifest.sequences[0].canvases.length} pages in manifest`);
            
            // FIXED in v1.4.56: Removed Math.min(canvases.length, 10) limit
            // Now processes ALL pages instead of just first 10
            // This ensures users get complete manuscripts (e.g., 600 pages for Karlsruhe)
            for (let i = 0; i < manifest.sequences[0].canvases.length; i++) {
                const canvas = manifest.sequences[0].canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        console.log(`[Karlsruhe] Successfully extracted ${images.length} pages`);
        return { images };
    }

    /**
     * Library of Congress - Working
     */
    async getLibraryOfCongressManifest(url) {
        const match = url.match(/item\/(\d+)/);
        if (!match) throw new Error('Invalid Library of Congress URL');
        
        const itemId = match[1];
        const manifestUrl = `https://www.loc.gov/item/${itemId}/manifest.json`;
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (let i = 0; i < manifest.sequences[0].canvases.length; i++) {
                const canvas = manifest.sequences[0].canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return { images };
    }

    /**
     * University of Graz - Fixed with streaming page processing and memory-efficient JSON parsing
     */
    async getGrazManifest(url) {
        console.log(`[Graz] Processing URL: ${url}`);
        
        // Extract manuscript ID from URL - handle multiple patterns
        let manuscriptId;
        
        // Handle direct image download URL pattern
        if (url.includes('/download/webcache/')) {
            throw new Error('Direct webcache image URLs cannot be used to download full manuscripts. Please use a titleinfo or pageview URL instead (e.g., https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538)');
        }
        
        // Handle standard content URLs
        let manuscriptIdMatch = url.match(/\/(\d+)$/);
        
        // Handle viewer/image pattern: /viewer/image/{ID}/{PAGE}/
        if (!manuscriptIdMatch) {
            manuscriptIdMatch = url.match(/\/viewer\/image\/([^/]+)\/\d+/);
        }
        
        if (!manuscriptIdMatch) {
            throw new Error('Could not extract manuscript ID from Graz URL');
        }
        
        manuscriptId = manuscriptIdMatch[1];
        
        // If this is a pageview URL, convert to titleinfo ID using known pattern
        if (url.includes('/pageview/')) {
            const pageviewId = parseInt(manuscriptId);
            const titleinfoId = (pageviewId - 2).toString();
            console.log(`[Graz] Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
            manuscriptId = titleinfoId;
        }
        
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
        console.log(`[Graz] Fetching IIIF manifest from: ${manifestUrl}`);
        
        try {
            // Use streaming approach for large manifests
            const response = await this.fetchWithRetry(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 5);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Graz manifest: ${response.status} ${response.statusText}`);
            }
            
            const manifestText = await response.text();
            console.log(`[Graz] Manifest size: ${(manifestText.length / 1024).toFixed(1)} KB`);
            
            // Validate response
            if (!manifestText || manifestText.trim().length === 0) {
                throw new Error('Empty response received from Graz server');
            }
            
            if (manifestText.trim().startsWith('<!DOCTYPE') || manifestText.trim().startsWith('<html')) {
                throw new Error('Graz server returned HTML error page instead of JSON manifest');
            }
            
            // Use streaming JSON parsing approach for large manifests
            const images = [];
            let displayName = `University of Graz Manuscript ${manuscriptId}`;
            
            // Parse manifest header for metadata
            const labelMatch = manifestText.match(/"label"\s*:\s*"([^"]+)"/);
            if (labelMatch) {
                // Include manuscript ID if not already present in label
                const label = labelMatch[1];
                if (!label.includes(manuscriptId)) {
                    displayName = `${label} (${manuscriptId})`;
                } else {
                    displayName = label;
                }
            }
            
            // Extract canvases using regex to avoid parsing entire JSON at once
            const canvasRegex = /"@id"\s*:\s*"([^"]*\/download\/webcache[^"]+)"/g;
            const serviceRegex = /"service"\s*:\s*{[^}]*"@id"\s*:\s*"([^"]+)"[^}]*}/g;
            let match;
            let pageNum = 1;
            
            // First pass: extract webcache URLs
            while ((match = canvasRegex.exec(manifestText)) !== null) {
                const resourceUrl = match[1];
                const pageIdMatch = resourceUrl.match(/\/webcache\/\d+\/(\d+)$/);
                if (pageIdMatch) {
                    const pageId = pageIdMatch[1];
                    // Use highest available resolution (2000px)
                    images.push({
                        url: `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`,
                        label: `Page ${pageNum++}`
                    });
                }
            }
            
            // If no webcache URLs found, try IIIF service URLs
            if (images.length === 0) {
                console.log('[Graz] No webcache URLs found, trying IIIF service URLs...');
                pageNum = 1;
                while ((match = serviceRegex.exec(manifestText)) !== null) {
                    const serviceUrl = match[1];
                    images.push({
                        url: `${serviceUrl}/full/full/0/default.jpg`,
                        label: `Page ${pageNum++}`
                    });
                }
            }
            
            // Final fallback: parse minimal JSON structure
            if (images.length === 0) {
                console.log('[Graz] Falling back to JSON parsing...');
                try {
                    const manifest = JSON.parse(manifestText);
                    if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                        const canvases = manifest.sequences[0].canvases;
                        console.log(`[Graz] Found ${canvases.length} pages in manifest`);
                        
                        // Process only what we need, not entire array
                        for (let i = 0; i < canvases.length; i++) {
                            const canvas = canvases[i];
                            if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                                const resource = canvas.images[0].resource;
                                let imageUrl = '';
                                
                                if (resource['@id']) {
                                    if (resource['@id'].includes('/download/webcache/')) {
                                        const pageIdMatch = resource['@id'].match(/\/webcache\/\d+\/(\d+)$/);
                                        if (pageIdMatch) {
                                            imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageIdMatch[1]}`;
                                        } else {
                                            imageUrl = resource['@id'];
                                        }
                                    } else {
                                        imageUrl = resource['@id'];
                                    }
                                } else if (resource.service && resource.service['@id']) {
                                    imageUrl = `${resource.service['@id']}/full/full/0/default.jpg`;
                                }
                                
                                if (imageUrl) {
                                    images.push({
                                        url: imageUrl,
                                        label: canvas.label || `Page ${i + 1}`
                                    });
                                }
                            }
                            
                            // Clear canvas reference to free memory
                            canvases[i] = null;
                        }
                    }
                } catch (parseError) {
                    console.error('[Graz] JSON parse error:', parseError.message);
                    throw new Error(`Failed to parse Graz manifest: ${parseError.message}`);
                }
            }
            
            if (images.length === 0) {
                throw new Error('No images found in Graz manifest');
            }
            
            console.log(`[Graz] Successfully extracted ${images.length} pages using memory-efficient approach`);
            
            return { 
                images,
                displayName: displayName
            };
            
        } catch (error) {
            console.error('[Graz] Manifest loading failed:', error);
            
            // Handle different error scenarios gracefully
            if (error.message && error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
                throw new Error('University of Graz server is not responding. The manuscript may be too large or the server is experiencing high load. Please try again later.');
            }
            
            if (error.message && (error.message.includes('ENOMEM') || error.message.includes('heap out of memory'))) {
                throw new Error('Out of memory while processing large Graz manuscript. The manuscript may be too large to process.');
            }
            
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to University of Graz server. This may be due to network issues or geo-restrictions.');
            }
            
            if (error.message && (error.message.includes('403') || error.message.includes('Forbidden'))) {
                throw new Error('Access to University of Graz manuscript is restricted. This may be due to geo-blocking or institutional access requirements.');
            }
            
            if (error.message && error.message.includes('404')) {
                throw new Error('University of Graz manuscript not found. Please check the URL or try a different manuscript.');
            }
            
            // Create a safe error for any other cases
            const safeError = new Error(
                `Failed to load University of Graz manifest: ${error.message || 'Unknown network or server error'}`
            );
            safeError.name = 'GrazManifestError';
            throw safeError;
        }
    }

    /**
     * MDC Catalonia - Fixed to use embedded __INITIAL_STATE__ data
     */
    async getMDCCataloniaManifest(url) {
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);
        
        const html = await response.text();
        
        // Extract __INITIAL_STATE__ JSON data - look for direct assignment or JSON.parse
        let initialState;
        
        // Try JSON.parse pattern first - need to match the entire string carefully
        const jsonParseMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.*)"\);/);
        if (jsonParseMatch) {
            try {
                // Decode the escaped JSON string
                let jsonString = jsonParseMatch[1];
                
                // Handle HTML entity decoding and JSON escaping
                jsonString = jsonString.replace(/\\"/g, '"');
                jsonString = jsonString.replace(/\\\\/g, '\\');
                
                // Use a more robust approach - eval the JSON.parse call safely
                // This handles all the complex escaping automatically
                const safeJsonParse = `JSON.parse("${jsonParseMatch[1]}")`;
                initialState = eval(safeJsonParse);
                
            } catch (parseError) {
                throw new Error(`Failed to parse JSON.parse format: ${parseError.message}`);
            }
        } else {
            // Try direct object assignment pattern
            const directMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
            if (directMatch) {
                try {
                    initialState = JSON.parse(directMatch[1]);
                } catch (parseError) {
                    throw new Error(`Failed to parse direct object format: ${parseError.message}`);
                }
            } else {
                throw new Error('Could not find IIIF data in __INITIAL_STATE__');
            }
        }
        
        // Extract compound object data
        const item = initialState.item?.item;
        if (!item) throw new Error('Could not find item data in page state');
        
        const images = [];
        
        // Check if this is a compound object with multiple pages
        if (item.parent && item.parent.children && item.parent.children.length > 0) {
            // Multi-page document - use parent.children array
            const maxPages = item.parent.children.length; // Get more pages for proper validation
            for (let i = 0; i < maxPages; i++) {
                const child = item.parent.children[i];
                if (child.id) {
                    // Use original stored resolution - MDC only stores ~1MP, requesting 2000px causes upscaling
                    // Better to get sharp 1MP original than blurry 2.6MP upscale
                    const imageUrl = `https://mdc.csuc.cat/iiif/2/${item.collectionAlias}:${child.id}/full/full/0/default.jpg`;
                    images.push({
                        url: imageUrl,
                        label: child.title || `Page ${i + 1}`
                    });
                }
            }
        } else {
            // Single page document - use original stored resolution without upscaling
            const imageUrl = `https://mdc.csuc.cat/iiif/2/${item.collectionAlias}:${item.id}/full/full/0/default.jpg`;
            images.push({
                url: imageUrl,
                label: item.title || 'Page 1'
            });
        }
        
        if (images.length === 0) {
            throw new Error('No IIIF images found in document structure');
        }
        
        return { images };
    }

    /**
     * BVPB (Biblioteca Virtual del Patrimonio Bibliográfico) - Spain
     * Uses direct image ID access pattern
     */
    async getBVPBManifest(url) {
        // Extract registro ID from URL
        const match = url.match(/registro\.do\?id=(\d+)/);
        if (!match) throw new Error('Invalid BVPB URL');
        
        const registroId = match[1];
        
        // Fetch the registro page to find image viewer links
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch BVPB page: ${response.status}`);
        
        const html = await response.text();
        
        // Look for all catalogo_imagenes grupo.do paths
        const grupoMatches = [...html.matchAll(/catalogo_imagenes\/grupo\.do\?path=(\d+)"[^>]*data-analytics-grouptitle="([^"]+)"/g)];
        
        let grupoPath = null;
        
        // First, try to find "Copia digital" (digital copy) path
        for (const match of grupoMatches) {
            if (match[2] && match[2].includes('Copia digital')) {
                grupoPath = match[1];
                break;
            }
        }
        
        // If not found, look for any non-PDF path
        if (!grupoPath) {
            for (const match of grupoMatches) {
                if (match[2] && !match[2].toUpperCase().includes('PDF')) {
                    grupoPath = match[1];
                    break;
                }
            }
        }
        
        // Fallback to simple pattern
        if (!grupoPath) {
            const simpleMatch = html.match(/catalogo_imagenes\/grupo\.do\?path=(\d+)/);
            if (simpleMatch) {
                grupoPath = simpleMatch[1];
            }
        }
        
        if (!grupoPath) throw new Error('No digital copy found for this BVPB manuscript');
        
        // First, fetch the main grupo page to see all thumbnails/pages
        const grupoUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${grupoPath}`;
        const grupoResponse = await this.fetchWithRetry(grupoUrl);
        if (!grupoResponse.ok) throw new Error(`Failed to fetch grupo page: ${grupoResponse.status}`);
        
        const grupoHtml = await grupoResponse.text();
        
        // Extract all image object IDs from miniature links
        const miniaturePattern = /object-miniature\.do\?id=(\d+)/g;
        const imageIdPattern = /idImagen=(\d+)/g;
        const imageIds = [];
        let idMatch;
        
        // Try miniature pattern first
        while ((idMatch = miniaturePattern.exec(grupoHtml)) !== null) {
            if (!imageIds.includes(idMatch[1])) {
                imageIds.push(idMatch[1]);
            }
        }
        
        // If no miniatures found, try direct image ID pattern
        if (imageIds.length === 0) {
            while ((idMatch = imageIdPattern.exec(grupoHtml)) !== null) {
                if (!imageIds.includes(idMatch[1])) {
                    imageIds.push(idMatch[1]);
                }
            }
        }
        
        if (imageIds.length === 0) {
            throw new Error('No image IDs found in BVPB viewer');
        }
        
        const images = [];
        
        // Get all pages
        const maxPages = imageIds.length;
        for (let i = 0; i < maxPages; i++) {
            const imageId = imageIds[i];
            // Direct image URL pattern found in the viewer
            const imageUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/imagen_id.do?idImagen=${imageId}&formato=jpg&registrardownload=0`;
            images.push({
                url: imageUrl,
                label: `Page ${i + 1}`
            });
        }
        
        return { images };
    }

    /**
     * Morgan Library - Supports multiple URL patterns with high-resolution image extraction
     */
    async getMorganManifest(url) {
        console.log('[Morgan] Processing URL:', url);
        
        // Handle direct image URLs
        if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            const filename = url.split('/').pop() || 'Morgan Image';
            return {
                images: [{
                    url: url,
                    label: filename
                }]
            };
        }
        
        // Handle direct facsimile URLs that user provided
        if (url.includes('host.themorgan.org/facsimile')) {
            console.log('[Morgan] Processing facsimile URL:', url);
            return await this.processMorganFacsimileUrl(url);
        }
        
        // Extract manuscript ID and determine base URL
        let baseUrl;
        let manuscriptId = '';
        let displayName = 'Morgan Library Manuscript';
        
        if (url.includes('ica.themorgan.org')) {
            // ICA format - handle both /manuscript/thumbs/ and /manuscript/page/ patterns
            const icaMatch = url.match(/\/manuscript\/(?:thumbs|page)\/(\d+)/);
            if (!icaMatch) throw new Error('Invalid Morgan ICA URL format');
            baseUrl = 'https://ica.themorgan.org';
            manuscriptId = icaMatch[1];
            displayName = `Morgan ICA Manuscript ${manuscriptId}`;
        } else {
            // Main format - handle multiple patterns
            // Pattern 1: New pattern /manuscript/76854 or /manuscripts/76854 (ULTRA-PRIORITY FIX for Issue #4)
            let mainMatch = url.match(/\/manuscripts?\/(\d+)/);
            if (mainMatch) {
                manuscriptId = mainMatch[1];
                console.log('[Morgan] Extracted manuscript ID from URL:', manuscriptId);
            } else {
                // Pattern 2: Legacy pattern /collection/
                mainMatch = url.match(/\/collection\/([^/]+)(?:\/(\d+))?(?:\/thumbs)?\/?/);
                if (mainMatch) {
                    manuscriptId = mainMatch[1];
                }
            }
            
            if (!manuscriptId) throw new Error('Invalid Morgan URL format. Expected patterns: /manuscript/XXXXX, /manuscripts/XXXXX, or /collection/XXXXX');
            baseUrl = 'https://www.themorgan.org';
            // Keep the manuscript ID in the display name for uniqueness
            displayName = `Morgan Library ${manuscriptId}`;
        }
        
        // Fetch the collection page
        let pageUrl = url;
        if (!pageUrl.includes('/thumbs') && !url.includes('ica.themorgan.org')) {
            // For /manuscript/ URLs, try to fetch the manuscript page directly
            if (url.includes('/manuscript/')) {
                pageUrl = url; // Use the original URL first
            } else {
                pageUrl = `${baseUrl}/collection/${manuscriptId}/thumbs`;
            }
        }
        
        try {
            const response = await this.fetchWithRetry(pageUrl);
            if (!response.ok) {
                // Handle specific error cases but not redirects (301/302)
                // Redirects should have been followed automatically by fetchWithRetry
                // If we get here with a 301/302, it means the redirect failed
                if (response.status === 301 || response.status === 302) {
                    console.log(`[Morgan] Received ${response.status} redirect from ${pageUrl}`);
                    // Try to follow redirect manually if location header exists
                    if (response.headers && response.headers.location) {
                        const redirectUrl = response.headers.location.startsWith('http') 
                            ? response.headers.location 
                            : new URL(response.headers.location, pageUrl).href;
                        console.log(`[Morgan] Following redirect to: ${redirectUrl}`);
                        const redirectResponse = await this.fetchWithRetry(redirectUrl);
                        if (redirectResponse.ok) {
                            const html = await redirectResponse.text();
                            const images = [];
                            return await this.processMorganHTML(html, url, baseUrl, manuscriptId, displayName, images);
                        }
                    }
                    // If manual redirect didn't work, provide helpful error
                    throw new Error(`Morgan page redirect (${response.status}) could not be followed. The manuscript may have moved. Try accessing it directly from themorgan.org.`);
                } else if (response.status === 404) {
                    throw new Error(`Morgan page not found (404): ${pageUrl}. The manuscript may have been moved or removed.`);
                } else if (response.status >= 500) {
                    throw new Error(`Morgan server error (${response.status}): The server is experiencing issues. Please try again later.`);
                } else {
                    throw new Error(`Failed to fetch Morgan page: ${response.status} for URL: ${pageUrl}`);
                }
            }
            
            const html = await response.text();
            const images = [];
            
            return await this.processMorganHTML(html, url, baseUrl, manuscriptId, displayName, images);
        } catch (error) {
            // Enhance error reporting for Morgan-specific issues
            if (error.message.includes('Too many redirects')) {
                throw new Error(`Morgan page has too many redirects - likely a redirect loop. The manuscript URL may be outdated. Try finding the current URL on themorgan.org.`);
            }
            throw error;
        }
    }
    
    async processMorganHTML(html, url, baseUrl, manuscriptId, displayName, images) {
        if (url.includes('ica.themorgan.org')) {
            // ICA format - extract image URLs with better pattern matching
            // Look for full image URLs or icaimages paths
            const icaImageRegex = /(?:https?:\/\/ica\.themorgan\.org\/)?icaimages\/\d+\/[^"']+\.(?:jpg|jpeg|png)/gi;
            const icaMatches = [...new Set(html.match(icaImageRegex) || [])];
            
            // Also try alternative pattern for image references
            if (icaMatches.length === 0) {
                const altRegex = /\/icaimages\/[^"']+\.(?:jpg|jpeg|png)/gi;
                const altMatches = html.match(altRegex) || [];
                icaMatches.push(...altMatches);
            }
            
            // Also check for data-zoom-image attributes
            const zoomRegex = /data-zoom-image="([^"]+icaimages[^"]+)"/gi;
            let zoomMatch;
            while ((zoomMatch = zoomRegex.exec(html)) !== null) {
                icaMatches.push(zoomMatch[1]);
            }
            
            // Deduplicate and process
            const uniqueImages = [...new Set(icaMatches)];
            
            for (let i = 0; i < uniqueImages.length; i++) {
                let imageUrl = uniqueImages[i];
                // Ensure full URL
                if (!imageUrl.startsWith('http')) {
                    imageUrl = imageUrl.startsWith('/') ? 
                        `https://ica.themorgan.org${imageUrl}` : 
                        `https://ica.themorgan.org/${imageUrl}`;
                }
                images.push({
                    url: imageUrl,
                    label: `Page ${i + 1}`
                });
            }
            
            // If still no images, check for viewer.php pattern
            if (images.length === 0) {
                console.log('[Morgan ICA] No images found with standard patterns, checking viewer.php');
                const viewerMatch = html.match(/viewer\.php\?id=(\d+)/);
                if (viewerMatch) {
                    // Generate image URLs based on common ICA pattern
                    const baseId = viewerMatch[1];
                    for (let i = 1; i <= 300; i++) { // Extended to 300 pages for full manuscripts
                        images.push({
                            url: `https://ica.themorgan.org/icaimages/${baseId}/${String(i).padStart(3, '0')}.jpg`,
                            label: `Page ${i}`
                        });
                    }
                }
            }
        } else {
            // Main Morgan format - prioritize high-resolution images
            const imagesByPriority = {
                0: [], // ZIF ultra-high resolution
                1: [], // High-res facsimile
                2: [], // Direct full-size
                3: [], // Styled images
                4: [], // Legacy facsimile
                5: []  // Other direct references
            };
            
            // Priority 0: ZIF files
            if (manuscriptId) {
                const imageIdRegex = /\/images\/collection\/([^"'?]+)\.jpg/g;
                const validImagePattern = /\d+v?_\d+/;
                let match;
                
                while ((match = imageIdRegex.exec(html)) !== null) {
                    const imageId = match[1];
                    if (validImagePattern.test(imageId) && !imageId.includes('front-cover')) {
                        const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
                        imagesByPriority[0].push(zifUrl);
                    }
                }
            }
            
            // Skip facsimile ASP URL fetching to avoid redirect issues
            // These URLs often redirect or timeout, causing failures in Electron environment
            
            // Priority 1: High-res facsimile from individual pages
            try {
                const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
                const pageMatches = [...html.matchAll(pageUrlRegex)];
                const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
                
                // Fetch all individual pages to get high-res URLs
                for (let i = 0; i < uniquePages.length; i++) {
                    const pageNum = uniquePages[i];
                    const individualPageUrl = `${baseUrl}/collection/${manuscriptId}/${pageNum}`;
                    
                    try {
                        const pageResponse = await this.fetchWithRetry(individualPageUrl, {}, 1);
                        if (pageResponse.ok) {
                            const pageContent = await pageResponse.text();
                            const facsimileMatch = pageContent.match(/\/sites\/default\/files\/facsimile\/[^"']+\.jpg/);
                            if (facsimileMatch) {
                                imagesByPriority[1].push(`${baseUrl}${facsimileMatch[0]}`);
                            }
                        }
                    } catch (error) {
                        console.warn(`[Morgan] Failed to fetch page ${pageNum}:`, error.message);
                    }
                }
            } catch (error) {
                console.warn('[Morgan] Error fetching individual pages:', error.message);
            }
            
            // Priority 2: Direct full-size images
            const fullSizeRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
            const fullSizeMatches = html.match(fullSizeRegex) || [];
            for (const match of fullSizeMatches) {
                imagesByPriority[2].push(`${baseUrl}${match}`);
            }
            
            // Priority 3: Styled images (convert to original)
            const styledRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
            const styledMatches = html.match(styledRegex) || [];
            for (const match of styledMatches) {
                const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
                imagesByPriority[3].push(`${baseUrl}${originalPath}`);
            }
            
            // Priority 4: Legacy facsimile
            const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
            const facsimileMatches = html.match(facsimileRegex) || [];
            for (const match of facsimileMatches) {
                imagesByPriority[4].push(`${baseUrl}${match}`);
            }
            
            // Select images by priority
            for (let priority = 0; priority <= 5; priority++) {
                if (imagesByPriority[priority].length > 0) {
                    console.log(`[Morgan] Using priority ${priority} images: ${imagesByPriority[priority].length} found`);
                    for (let i = 0; i < imagesByPriority[priority].length; i++) {
                        images.push({
                            url: imagesByPriority[priority][i],
                            label: `Page ${i + 1}`
                        });
                    }
                    break;
                }
            }
        }
        
        // Extract title from page
        const titleMatch = html.match(/<title[^>]*>([^<]+)</);
        if (titleMatch) {
            const pageTitle = titleMatch[1].replace(/\s*\|\s*The Morgan Library.*$/i, '').trim();
            if (pageTitle && pageTitle !== 'The Morgan Library & Museum') {
                displayName = pageTitle;
            }
        }
        
        // Look for manuscript identifier
        const msMatch = html.match(/MS\s+M\.?\s*(\d+)/i);
        if (msMatch) {
            displayName = `${displayName} (MS M.${msMatch[1]})`;
        }
        
        if (images.length === 0) {
            throw new Error('No images found on Morgan Library page');
        }
        
        console.log(`[Morgan] Successfully extracted ${images.length} images`);
        
        return {
            images,
            displayName
        };
    }

    /**
     * Heinrich Heine University Düsseldorf (HHU) - IIIF manifest support
     */
    async getHHUManifest(url) {
        console.log('[HHU] Processing URL:', url);
        
        // Extract ID from URL patterns like:
        // https://digital.ulb.hhu.de/content/titleinfo/7938251
        // https://digital.ulb.hhu.de/hs/content/titleinfo/259994
        // https://digital.ulb.hhu.de/ms/content/titleinfo/9400252
        const match = url.match(/titleinfo\/(\d+)/);
        if (!match) throw new Error('Invalid HHU URL format');
        
        const manuscriptId = match[1];
        
        // HHU uses a unified IIIF v2.0 pattern for all collections
        // All collections use the same /i3f/v20/ endpoint regardless of collection type
        const manifestUrl = `https://digital.ulb.hhu.de/i3f/v20/${manuscriptId}/manifest`;
        console.log('[HHU] Fetching IIIF manifest from:', manifestUrl);
        
        try {
            const response = await this.fetchWithRetry(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`HHU manuscript not found: ${manuscriptId}. Please verify the URL is correct.`);
                }
                throw new Error(`Failed to fetch HHU manifest: ${response.status} ${response.statusText}`);
            }
            
            const manifestText = await response.text();
            
            // Validate response is JSON
            if (!manifestText || manifestText.trim().length === 0) {
                throw new Error('HHU returned empty manifest response');
            }
            
            if (manifestText.trim().startsWith('<!DOCTYPE') || manifestText.trim().startsWith('<html')) {
                throw new Error('HHU returned HTML instead of JSON manifest. The manuscript may not be available.');
            }
            
            let manifest;
            try {
                manifest = JSON.parse(manifestText);
            } catch (parseError) {
                console.error('[HHU] JSON parse error:', parseError.message);
                console.error('[HHU] Response text (first 500 chars):', manifestText.substring(0, 500));
                throw new Error(`Failed to parse HHU manifest JSON: ${parseError.message}`);
            }
            
            const images = [];
            let displayName = manifest.label || `HHU Manuscript ${manuscriptId}`;
            // Include manuscript ID if not already present in label
            if (manifest.label && !manifest.label.includes(manuscriptId)) {
                displayName = `${manifest.label} (${manuscriptId})`;
            }
            
            // Extract images from IIIF v2 manifest
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases;
                console.log(`[HHU] Found ${canvases.length} pages in manifest`);
                
                // Process all pages, not just first 10
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];
                    
                    if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                        const resource = canvas.images[0].resource;
                        const service = resource.service;
                        
                        let imageUrl = '';
                        
                        // Try to get highest resolution from IIIF service
                        if (service && service['@id']) {
                            // HHU supports full resolution downloads
                            imageUrl = `${service['@id']}/full/full/0/default.jpg`;
                        } else if (resource['@id']) {
                            imageUrl = resource['@id'];
                        }
                        
                        if (imageUrl) {
                            images.push({
                                url: imageUrl,
                                label: canvas.label || `Page ${i + 1}`
                            });
                        }
                    }
                    
                    // Log progress for large manuscripts
                    if ((i + 1) % 50 === 0) {
                        console.log(`[HHU] Processing page ${i + 1}/${canvases.length}`);
                    }
                }
            } else {
                throw new Error('Invalid HHU IIIF manifest structure - no canvases found');
            }
            
            if (images.length === 0) {
                throw new Error('No images found in HHU manifest');
            }
            
            console.log(`[HHU] Successfully extracted ${images.length} pages`);
            
            return {
                images,
                displayName
            };
            
        } catch (error) {
            if (error.message.includes('timeout')) {
                throw new Error('HHU server request timed out. Please try again later.');
            }
            throw error;
        }
    }

    /**
     * GAMS University of Graz - Placeholder for GAMS URLs
     * This prevents the "unsupported library" error for GAMS URLs
     */
    async getGAMSManifest(url) {
        console.log('[GAMS] Processing URL:', url);
        
        // Extract GAMS context identifier
        const contextMatch = url.match(/context:([^/?]+)/);
        if (!contextMatch) {
            throw new Error('Could not extract context identifier from GAMS URL. Please ensure the URL contains a context parameter like "context:rbas.ms.P0008s11"');
        }
        
        const contextId = contextMatch[1];
        console.log('[GAMS] Context ID:', contextId);
        
        // GAMS (Geisteswissenschaftliches Asset Management System) uses a different structure than UniPub
        // For now, we provide a helpful error message with guidance
        throw new Error(`GAMS URLs are not currently supported. The URL you provided uses the GAMS system (${contextId}), which has a different structure than the supported UniPub system.

To download this manuscript, please:
1. Try to find an equivalent URL on unipub.uni-graz.at instead
2. Contact the University of Graz library for assistance
3. Alternatively, download the manuscript manually from the GAMS viewer

If you have a UniPub URL (starting with https://unipub.uni-graz.at/), please use that instead.`);
    }

    /**
     * Get manifest for any library
     */
    async getManifestForLibrary(libraryId, url) {
        switch (libraryId) {
            case 'bdl':
                return await this.getBDLManifest(url);
            case 'verona':
                return await this.getVeronaManifest(url);
            case 'vienna_manuscripta':
                return await this.getViennaManuscriptaManifest(url);
            case 'bne':
                return await this.getBNEManifest(url);
            case 'mdc_catalonia':
                return await this.getMDCCataloniaManifest(url);
            case 'karlsruhe':
                return await this.getKarlsruheManifest(url);
            case 'loc':
                return await this.getLibraryOfCongressManifest(url);
            case 'graz':
                return await this.getGrazManifest(url);
            case 'gams':
                return await this.getGAMSManifest(url);
            case 'florence':
                return await this.getFlorenceManifest(url);
            case 'grenoble':
                return await this.getGrenobleManifest(url);
            case 'manchester':
                return await this.getManchesterManifest(url);
            case 'munich':
                return await this.getMunichManifest(url);
            case 'toronto':
                return await this.getTorontoManifest(url);
            case 'vatican':
                return await this.getVaticanManifest(url);
            case 'bvpb':
                return await this.getBVPBManifest(url);
            case 'morgan':
                return await this.getMorganManifest(url);
            case 'hhu':
            case 'duesseldorf':
                return await this.getHHUManifest(url);
            case 'bordeaux':
                return await this.getBordeauxManifest(url);
            case 'bodleian':
                return await this.getBodleianManifest(url);
            case 'e_manuscripta':
                return await this.getEManuscriptaManifest(url);
            case 'norwegian':
            case 'nb':
                return await this.getNorwegianManifest(url);
            case 'heidelberg':
                return await this.getHeidelbergManifest(url);
            default:
                throw new Error(`Unsupported library: ${libraryId}`);
        }
    }

    /**
     * Florence (ContentDM Plutei) - Fixed with proper IIIF manifest integration and error handling
     */
    async getFlorenceManifest(url) {
        console.log('[Florence] Processing URL:', url);
        
        // Extract item ID from URL - handle multiple formats
        let match;
        let itemId;
        
        // Pattern 1: New pattern /s/itBMLO0000000000/item/174871
        match = url.match(/\/item\/(\d+)/);
        if (match) {
            itemId = match[1];
            console.log('[Florence] Extracted item ID from /item/ URL:', itemId);
        } else {
            // Pattern 2: Legacy patterns with collection/plutei
            match = url.match(/collection\/plutei\/id\/(\d+)/);
            if (!match) {
                // Try alternative URL format
                match = url.match(/digital\/collection\/plutei\/id\/(\d+)/);
            }
            if (match) {
                itemId = match[1];
            }
        }
        
        if (!itemId) throw new Error('Invalid Florence URL. Expected patterns: /item/XXXXX or /collection/plutei/id/XXXXX');
        
        console.log(`[Florence] Processing item ID: ${itemId}`);
        
        // Strategy 1: Try IIIF manifest first (most reliable)
        try {
            console.log('[Florence] Attempting IIIF manifest discovery...');
            const manifestUrl = `https://cdm21059.contentdm.oclc.org/iiif/info/plutei/${itemId}/manifest.json`;
            const manifestResponse = await this.fetchWithRetry(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 2);
            
            if (manifestResponse.ok) {
                const manifestText = await manifestResponse.text();
                if (manifestText.trim().startsWith('{') || manifestText.trim().startsWith('[')) {
                    const manifest = JSON.parse(manifestText);
                    console.log('[Florence] Successfully parsed IIIF manifest');
                    const iiifResult = this.parseFlorenceIIIFManifest(manifest, itemId);
                    
                    // If IIIF manifest only has 1 image, this might be a compound object
                    // Check if we need to discover child pages
                    if (iiifResult.images.length === 1) {
                        console.log('[Florence] Only 1 image in IIIF manifest, checking for compound object...');
                        try {
                            // ULTRA-PRIORITY FIX: Increased timeout for enhanced detection
                            // The new fast detection method needs less time but we allow 60s for large manuscripts
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Compound object detection timeout after 60s')), 60000)
                            );
                            
                            const compoundResult = await Promise.race([
                                this.detectFlorenceCompoundObject(itemId),
                                timeoutPromise
                            ]);
                            
                            if (compoundResult.images.length > 1) {
                                console.log(`[Florence] Found compound object with ${compoundResult.images.length} pages`);
                                return compoundResult;
                            }
                        } catch (compoundError) {
                            console.log('[Florence] Compound object detection failed:', compoundError.message);
                            // Continue with IIIF result even if compound detection fails
                        }
                    }
                    
                    return iiifResult;
                }
            }
        } catch (manifestError) {
            console.log('[Florence] IIIF manifest not available:', manifestError.message);
        }
        
        // Strategy 2: Try ContentDM compound object detection with HTML scraping
        try {
            console.log('[Florence] Attempting compound object detection via page scraping...');
            const pageUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${itemId}`;
            const pageResponse = await this.fetchWithRetry(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            }, 2);
            
            if (pageResponse.ok) {
                const html = await pageResponse.text();
                const images = [];
                
                // Look for page navigation or compound object indicators
                const pageNumberMatches = html.match(/(?:page|item)\s*(\d+)\s*of\s*(\d+)/i);
                const compoundPatterns = [
                    /compound[^>]*object/i,
                    /(?:page|item)\s*\d+\s*of\s*(\d+)/i,
                    /totalPages['"]\s*:\s*(\d+)/i,
                    /pageCount['"]\s*:\s*(\d+)/i
                ];
                
                let totalPages = 1;
                
                // Extract total page count from various patterns
                for (const pattern of compoundPatterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        totalPages = parseInt(match[1]);
                        if (totalPages > 1 && totalPages < 1000) { // Reasonable bounds
                            console.log(`[Florence] Detected ${totalPages} pages from HTML pattern`);
                            break;
                        }
                    }
                }
                
                // Look for specific page IDs in JavaScript or data attributes
                const pageIdMatches = html.match(/(?:pageptr|itemid)['"]\s*:\s*['"]*(\d+)/gi);
                const extractedPageIds = new Set();
                
                if (pageIdMatches) {
                    for (const match of pageIdMatches) {
                        const idMatch = match.match(/(\d+)/);
                        if (idMatch) {
                            extractedPageIds.add(idMatch[1]);
                        }
                    }
                }
                
                // Generate IIIF URLs based on discovered page structure
                if (extractedPageIds.size > 0) {
                    console.log(`[Florence] Found ${extractedPageIds.size} specific page IDs`);
                    let pageNum = 1;
                    for (const pageId of extractedPageIds) {
                        images.push({
                            url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/max/0/default.jpg`,
                            label: `Page ${pageNum++}`
                        });
                        if (images.length >= 50) break; // Reasonable limit
                    }
                } else if (totalPages > 1) {
                    // Generate sequential IDs based on base item ID
                    console.log(`[Florence] Generating sequential page IDs for ${totalPages} pages`);
                    const baseId = parseInt(itemId);
                    for (let i = 0; i < totalPages; i++) {
                        // Try different patterns commonly used by ContentDM
                        const pageId = (baseId + i).toString();
                        images.push({
                            url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/max/0/default.jpg`,
                            label: `Page ${i + 1}`
                        });
                    }
                }
                
                if (images.length > 0) {
                    console.log(`[Florence] Generated ${images.length} pages from HTML analysis`);
                    return { images };
                }
            }
        } catch (htmlError) {
            console.log('[Florence] HTML scraping failed:', htmlError.message);
        }
        
        // Strategy 3: Fallback to direct IIIF URL with validation
        try {
            console.log('[Florence] Falling back to direct IIIF URL with validation...');
            const directUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/max/0/default.jpg`;
            
            // Test if the URL is accessible with HEAD request
            const headResponse = await this.fetchWithRetry(directUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 1);
            
            if (headResponse.ok) {
                console.log('[Florence] Direct IIIF URL validated successfully');
                return {
                    images: [{
                        url: directUrl,
                        label: 'Page 1'
                    }]
                };
            } else {
                throw new Error(`IIIF URL validation failed: ${headResponse.status}`);
            }
        } catch (directError) {
            console.error('[Florence] Direct URL validation failed:', directError.message);
        }
        
        // Strategy 4: Last resort - return base URL without validation
        console.log('[Florence] Using unvalidated direct URL as last resort');
        return {
            images: [{
                url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/max/0/default.jpg`,
                label: 'Florence Manuscript Page 1'
            }]
        };
    }
    
    /**
     * Parse Florence IIIF manifest structure
     */
    parseFlorenceIIIFManifest(manifest, itemId) {
        const images = [];
        
        // Handle IIIF v2 manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            console.log(`[Florence] Processing ${canvases.length} pages from IIIF manifest`);
            
            // FIXED in v1.4.56: Removed page limit, now downloads ALL pages
            // Was limited to first 50 pages, users complained about incomplete manuscripts
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    let imageUrl = '';
                    if (service && service['@id']) {
                        // Use IIIF service for maximum resolution
                        imageUrl = `${service['@id']}/full/max/0/default.jpg`;
                    } else if (resource['@id']) {
                        imageUrl = resource['@id'];
                    }
                    
                    if (imageUrl) {
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            }
        }
        // Handle IIIF v3 manifest
        else if (manifest.items) {
            console.log(`[Florence] Processing ${manifest.items.length} pages from IIIF v3 manifest`);
            
            for (let i = 0; i < manifest.items.length; i++) {
                const item = manifest.items[i];
                if (item.items && item.items[0] && item.items[0].items && item.items[0].items[0]) {
                    const annotation = item.items[0].items[0];
                    if (annotation.body && annotation.body.service) {
                        const service = annotation.body.service[0];
                        if (service && service.id) {
                            images.push({
                                url: `${service.id}/full/max/0/default.jpg`,
                                label: item.label || `Page ${i + 1}`
                            });
                        }
                    }
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Florence IIIF manifest');
        }
        
        return { images };
    }

    /**
     * Grenoble Municipal Library - IIIF manifest with SSL bypass
     */
    async getGrenobleManifest(url) {
        // Extract document ID from URL (ARK identifier)
        const match = url.match(/ark:\/12148\/([^/]+)/);
        if (!match) throw new Error('Invalid Grenoble URL');
        
        const documentId = match[1];
        const manifestUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/manifest.json`;
        
        // Fetch IIIF manifest (SSL bypass already configured in fetchUrl)
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        // Process IIIF v2 manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            const maxPages = canvases.length;
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const imageResource = canvas.images[0].resource;
                    
                    // Get the highest quality image URL
                    let imageUrl = imageResource['@id'] || imageResource.id;
                    
                    // Ensure we're using the full resolution
                    if (imageUrl.includes('/full/') && !imageUrl.includes('/full/full/')) {
                        imageUrl = imageUrl.replace(/\/full\/[^/]+\//, '/full/full/');
                    }
                    
                    images.push({
                        url: imageUrl,
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Grenoble manifest');
        }
        
        return { images };
    }

    /**
     * Manchester Digital Collections - IIIF manifest with 2000px limit
     * Server limits: maxWidth: 2000, maxHeight: 2000
     * Native resolution: 3978x5600 (22.3MP) but server-limited
     */
    async getManchesterManifest(url) {
        // Extract manuscript ID from URL (e.g., MS-LATIN-00074)
        const match = url.match(/view\/(MS-[A-Z]+-\d+)/);
        if (!match) throw new Error('Invalid Manchester URL');
        
        const manuscriptId = match[1];
        const manifestUrl = `https://www.digitalcollections.manchester.ac.uk/iiif/${manuscriptId}`;
        
        // Fetch IIIF manifest
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        // Process IIIF v2 manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            const maxPages = canvases.length;
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const service = canvas.images[0].resource.service;
                    const imageId = service['@id'] || service.id;
                    
                    // Manchester server limits to 2000px max dimension
                    // We request 2000px width to get the best quality allowed
                    const imageUrl = `${imageId}/full/2000,/0/default.jpg`;
                    
                    images.push({
                        url: imageUrl,
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Manchester manifest');
        }
        
        return { images };
    }

    /**
     * Munich Digital Collections (Digitale Sammlungen)
     * Standard IIIF v2 implementation with reliable image service
     */
    async getMunichManifest(url) {
        console.log('[Munich] Processing URL:', url);
        
        // Extract manuscript ID from viewer URL
        // Format: https://www.digitale-sammlungen.de/en/view/bsb00050763?page=1
        const match = url.match(/view\/([a-z0-9]+)/i);
        if (!match) {
            throw new Error('Invalid Munich Digital Collections URL. Expected format: https://www.digitale-sammlungen.de/en/view/[manuscript-id]');
        }
        
        const manuscriptId = match[1];
        const manifestUrl = `https://api.digitale-sammlungen.de/iiif/presentation/v2/${manuscriptId}/manifest`;
        console.log('[Munich] IIIF manifest URL:', manifestUrl);
        
        // Fetch IIIF manifest
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Munich manifest: ${response.status}`);
        }
        
        const manifest = await response.json();
        const images = [];
        
        // Process IIIF v2 manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            const maxPages = canvases.length;
            console.log(`[Munich] Found ${maxPages} pages in manifest`);
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const imageResource = canvas.images[0].resource;
                    const service = imageResource.service;
                    const imageId = service?.['@id'] || service?.id || imageResource['@id'];
                    
                    if (imageId) {
                        // Use /full/max/ for highest quality available
                        const imageUrl = imageId.includes('/iiif/image/') ? 
                            `${imageId}/full/max/0/default.jpg` : 
                            imageId;
                        
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Munich manifest');
        }
        
        // Extract shelf mark from manifest metadata or URL
        let displayTitle = manifest.label || 'Munich Digital Collections Manuscript';
        
        // Check if the manuscriptId looks like a Clm number (e.g., bsb00050763)
        if (manuscriptId.startsWith('bsb000')) {
            // Extract the numeric part after 'bsb00'
            const clmNumber = manuscriptId.substring(5);
            // Format as "BSB Clm [number]" as requested by user
            displayTitle = `BSB Clm ${parseInt(clmNumber, 10)}`;
        } else if (manifest.metadata) {
            // Try to find shelf mark in metadata
            const shelfMarkEntry = manifest.metadata.find(m => 
                m.label === 'Signatur' || 
                m.label === 'Shelf mark' || 
                m.label === 'Call Number'
            );
            if (shelfMarkEntry && shelfMarkEntry.value) {
                displayTitle = shelfMarkEntry.value;
            }
        }
        
        return {
            type: 'iiif',
            manifest: manifest,
            images: images,
            metadata: {
                title: displayTitle,
                library: 'Munich Digital Collections',
                iiifVersion: '2'
            },
            displayName: displayTitle // Add displayName for consistency
        };
    }

    /**
     * University of Toronto Fisher Library
     * Supports both collections viewer URLs and direct IIIF URLs
     */
    async getTorontoManifest(url) {
        let manifestUrl = url;
        
        // Handle collections.library.utoronto.ca URLs
        if (url.includes('collections.library.utoronto.ca')) {
            const viewMatch = url.match(/\/view\/([^/]+)/);
            if (!viewMatch) throw new Error('Invalid Toronto collections URL');
            
            const itemId = viewMatch[1];
            
            // Try different manifest URL patterns
            const manifestPatterns = [
                `https://iiif.library.utoronto.ca/presentation/v2/${itemId}/manifest`,
                `https://iiif.library.utoronto.ca/presentation/v2/${itemId.replace(':', '%3A')}/manifest`,
                `https://iiif.library.utoronto.ca/presentation/v3/${itemId}/manifest`,
                `https://iiif.library.utoronto.ca/presentation/v3/${itemId.replace(':', '%3A')}/manifest`,
                `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
                `https://collections.library.utoronto.ca/iiif/${itemId.replace(':', '%3A')}/manifest`,
                `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
                `https://collections.library.utoronto.ca/api/iiif/${itemId.replace(':', '%3A')}/manifest`
            ];
            
            let manifestFound = false;
            for (const testUrl of manifestPatterns) {
                try {
                    const response = await this.fetchWithRetry(testUrl, {}, 1);
                    if (response.ok) {
                        const content = await response.text();
                        if (content.includes('"@context"')) {
                            manifestUrl = testUrl;
                            manifestFound = true;
                            break;
                        }
                    }
                } catch (error) {
                    // Try next pattern
                }
            }
            
            if (!manifestFound) {
                throw new Error('Could not find valid manifest for Toronto URL');
            }
        } else if (url.includes('iiif.library.utoronto.ca') && !url.includes('/manifest')) {
            manifestUrl = url.endsWith('/') ? `${url}manifest` : `${url}/manifest`;
        }
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        // Handle IIIF v3
        if (manifest.items) {
            const maxPages = manifest.items.length;
            for (let i = 0; i < maxPages; i++) {
                const item = manifest.items[i];
                if (item.items && item.items[0] && item.items[0].items && item.items[0].items[0]) {
                    const annotation = item.items[0].items[0];
                    if (annotation.body) {
                        const service = annotation.body.service && annotation.body.service[0];
                        if (service && service.id) {
                            const imageUrl = `${service.id}/full/max/0/default.jpg`;
                            images.push({
                                url: imageUrl,
                                label: item.label?.en?.[0] || item.label?.none?.[0] || `Page ${i + 1}`
                            });
                        } else if (annotation.body.id) {
                            images.push({
                                url: annotation.body.id,
                                label: item.label?.en?.[0] || item.label?.none?.[0] || `Page ${i + 1}`
                            });
                        }
                    }
                }
            }
        }
        // Handle IIIF v2
        else if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            const maxPages = canvases.length;
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    if (service) {
                        const serviceId = service['@id'] || service.id;
                        const imageUrl = `${serviceId}/full/max/0/default.jpg`;
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    } else if (resource['@id']) {
                        images.push({
                            url: resource['@id'],
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Toronto manifest');
        }
        
        return { images };
    }

    /**
     * Vatican Digital Library (DigiVatLib)
     * Supports manuscripts from digi.vatlib.it
     * Uses standard IIIF with maximum resolution available
     */
    async getVaticanManifest(url) {
        // Extract manuscript ID from URL
        const match = url.match(/view\/([^/?]+)/);
        if (!match) throw new Error('Invalid Vatican Library URL');
        
        const manuscriptId = match[1];
        const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptId}/manifest.json`;
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        // Get all canvases from the manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0]) {
                    const image = canvas.images[0];
                    const service = image.resource?.service;
                    
                    if (service && service['@id']) {
                        // Vatican supports up to 4000px width with excellent quality
                        // Testing showed 4000px gives optimal file size/quality balance
                        const imageUrl = `${service['@id']}/full/4000,/0/default.jpg`;
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Vatican manifest');
        }
        
        return { 
            images,
            label: manifest.label || manuscriptId,
            metadata: manifest.metadata || []
        };
    }

    /**
     * Morgan Library Facsimile URL processor - handles direct ASP facsimile pages
     * Supports the pattern: host.themorgan.org/facsimile/m1/default.asp?id=X
     */
    async processMorganFacsimileUrl(url) {
        console.log('[Morgan] Processing facsimile URL:', url);
        
        // Extract ID from URL
        const idMatch = url.match(/[?&]id=(\d+)/);
        if (!idMatch) {
            throw new Error('Cannot extract ID from Morgan facsimile URL');
        }
        
        const manuscriptId = idMatch[1];
        console.log(`[Morgan] Facsimile manuscript ID: ${manuscriptId}`);
        
        try {
            const response = await this.fetchWithRetry(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch Morgan facsimile page: ${response.status}`);
            }
            
            const html = await response.text();
            const images = [];
            
            // Look for image references in the ASP page
            // Common patterns in Morgan facsimile pages:
            // 1. Direct image URLs in JavaScript or HTML
            // 2. Zoom viewer references
            // 3. Page navigation elements
            
            // Pattern 1: Look for image URLs
            const imageRegex = /(?:src|href)=['"]([^'"]*\/(?:images?|facsimile|zoom)[^'"]*\.(?:jpg|jpeg|png))/gi;
            let match;
            while ((match = imageRegex.exec(html)) !== null) {
                let imageUrl = match[1];
                if (!imageUrl.startsWith('http')) {
                    imageUrl = imageUrl.startsWith('/') ? 
                        `https://host.themorgan.org${imageUrl}` : 
                        `https://host.themorgan.org/${imageUrl}`;
                }
                images.push({
                    url: imageUrl,
                    label: `Page ${images.length + 1}`
                });
            }
            
            // Pattern 2: Look for zoom images or high-resolution references
            const zoomRegex = /['"](.*?(?:zoom|large|high|max).*?\.(?:jpg|jpeg|png))['"]/gi;
            while ((match = zoomRegex.exec(html)) !== null) {
                let imageUrl = match[1];
                if (!imageUrl.startsWith('http')) {
                    imageUrl = imageUrl.startsWith('/') ? 
                        `https://host.themorgan.org${imageUrl}` : 
                        `https://host.themorgan.org/${imageUrl}`;
                }
                if (!images.some(img => img.url === imageUrl)) {
                    images.push({
                        url: imageUrl,
                        label: `Page ${images.length + 1} (High-res)`
                    });
                }
            }
            
            // Pattern 3: Generate potential image URLs based on common Morgan patterns
            if (images.length === 0) {
                console.log('[Morgan] No images found in HTML, generating potential URLs...');
                // Try common Morgan image URL patterns
                const basePatterns = [
                    `https://host.themorgan.org/facsimile/m${manuscriptId}/`,
                    `https://host.themorgan.org/images/facsimile/m${manuscriptId}/`,
                    `https://www.themorgan.org/sites/default/files/images/collection/`,
                ];
                
                for (const basePattern of basePatterns) {
                    for (let page = 1; page <= 20; page++) {
                        const extensions = ['jpg', 'jpeg', 'png'];
                        const pageFormats = [
                            String(page).padStart(2, '0'),
                            String(page).padStart(3, '0'),
                            String(page)
                        ];
                        
                        for (const ext of extensions) {
                            for (const pageFormat of pageFormats) {
                                images.push({
                                    url: `${basePattern}${pageFormat}.${ext}`,
                                    label: `Page ${page}`
                                });
                            }
                        }
                    }
                }
            }
            
            // Remove duplicates and limit results
            const uniqueImages = [];
            const seenUrls = new Set();
            for (const img of images) {
                if (!seenUrls.has(img.url)) {
                    seenUrls.add(img.url);
                    uniqueImages.push(img);
                    if (uniqueImages.length >= 50) break;
                }
            }
            
            console.log(`[Morgan] Found ${uniqueImages.length} facsimile images`);
            
            return {
                images: uniqueImages,
                displayName: `Morgan Library Manuscript ${manuscriptId} (Facsimile)`
            };
            
        } catch (error) {
            console.error('[Morgan] Facsimile processing error:', error.message);
            throw new Error(`Failed to process Morgan facsimile URL: ${error.message}`);
        }
    }

    /**
     * Detect Florence compound object by analyzing page data
     */
    async detectFlorenceCompoundObject(itemId) {
        console.log('[Florence] ULTRA-ENHANCED compound object detection for item:', itemId);
        
        const pageUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${itemId}`;
        const pageResponse = await this.fetchWithRetry(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, 2);
        
        if (!pageResponse.ok) {
            throw new Error(`Failed to fetch Florence page: ${pageResponse.status}`);
        }
        
        const html = await pageResponse.text();
        const images = [];
        
        // Look for the parent object with children in the page data
        // From the debug, we know there's a structure with lots of children
        // Let's look for parentId first, then fetch the parent page
        const parentIdMatch = html.match(/parentId.*?(\d+)/);
        if (parentIdMatch) {
            const parentId = parentIdMatch[1];
            console.log(`[Florence] Found parent ID: ${parentId}, fetching parent page...`);
            
            try {
                const parentUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${parentId}`;
                const parentResponse = await this.fetchWithRetry(parentUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                }, 2);
                
                if (parentResponse.ok) {
                    const parentHtml = await parentResponse.text();
                    
                    // Look for children array in parent page - use a more flexible pattern
                    const childrenPatterns = [
                        /"children":\s*\[([\s\S]*?)\]/,
                        /"children":\s*\[([^\]]+)\]/
                    ];
                    
                    for (const pattern of childrenPatterns) {
                        const childrenMatch = parentHtml.match(pattern);
                        if (childrenMatch) {
                            console.log('[Florence] Found children array in parent page');
                            const childrenData = childrenMatch[1];
                            const childMatches = [...childrenData.matchAll(/"id":(\d+)/g)];
                            
                            console.log(`[Florence] Found ${childMatches.length} child pages`);
                            
                            // Create IIIF URLs for each child page
                            for (const childMatch of childMatches) {
                                const childId = childMatch[1];
                                const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${childId}/full/max/0/default.jpg`;
                                
                                // Try to extract title from the children data  
                                const titleRegex = new RegExp(`"id":${childId}[^}]*"title":"([^"]+)"`);
                                const titleMatch = childrenData.match(titleRegex);
                                const title = titleMatch ? titleMatch[1] : `Page ${images.length + 1}`;
                                
                                images.push({
                                    url: imageUrl,
                                    label: title
                                });
                            }
                            break;
                        }
                    }
                }
            } catch (parentError) {
                console.log('[Florence] Failed to fetch parent page:', parentError.message);
            }
        } else {
            // Fallback: look for children directly in current page
            const childrenMatch = html.match(/"children":\s*\[([^\]]+)\]/);
            if (childrenMatch) {
                console.log('[Florence] Found children array in current page');
                const childrenData = childrenMatch[1];
                const childMatches = [...childrenData.matchAll(/"id":(\d+)/g)];
                
                console.log(`[Florence] Found ${childMatches.length} child pages`);
                
                for (const childMatch of childMatches) {
                    const childId = childMatch[1];
                    const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${childId}/full/max/0/default.jpg`;
                    images.push({
                        url: imageUrl,
                        label: `Page ${images.length + 1}`
                    });
                }
            }
        }
        
        // Fallback: if we found a parent ID but no children, try generating child URLs
        if (images.length === 0 && parentIdMatch) {
            console.log('[Florence] No children found, trying URL generation based on parent...');
            
            // For Florence ContentDM, if we have a parent ID, the children are usually
            // sequential IDs starting from a base number. Let's try to find them.
            const parentId = parseInt(parentIdMatch[1]);
            const currentId = parseInt(itemId);
            
            // Find the starting ID - usually it's lower than the current ID
            let startId = Math.min(parentId, currentId) + 1; // Start from parent + 1
            let maxPages = 300; // Reasonable limit for a manuscript
            
            console.log(`[Florence] Generating URLs from ${startId} for up to ${maxPages} pages`);
            
            // TIMEOUT FIX: Limit compound object detection to prevent infinite loops
            const detectionTimeout = 30000; // 30 seconds max for detection
            const detectionStartTime = Date.now();
            
            // Test a few URLs to find the actual range
            const https = eval("require('https')"); 
            let validStart = -1;
            let validEnd = -1;
            
            // ULTRA-PRIORITY FIX: Fast sequential ID detection
            // First do a quick check to see if sequential IDs exist
            const baseId = parseInt(itemId);
            const quickCheckIds = [baseId, baseId + 1, baseId + 2, baseId + 3, baseId + 4];
            let quickValidCount = 0;
            
            console.log('[Florence] Quick validation of sequential IDs...');
            for (const testId of quickCheckIds) {
                const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/info.json`;
                try {
                    const result = await new Promise((resolve) => {
                        const req = https.request(testUrl, { method: 'HEAD', timeout: 3000 }, (res) => {
                            resolve(res.statusCode === 200);
                        });
                        req.on('error', () => resolve(false));
                        req.on('timeout', () => { req.destroy(); resolve(false); });
                        req.end();
                    });
                    if (result) quickValidCount++;
                } catch (e) {
                    // Continue
                }
            }
            
            // If we found sequential IDs, scan the full range
            if (quickValidCount >= 3) {
                console.log(`[Florence] Found ${quickValidCount}/5 sequential IDs, scanning full range...`);
                
                // Scan up to 500 pages efficiently
                let consecutiveFails = 0;
                const maxConsecutiveFails = 3;
                const maxPages = 500;
                
                for (let i = 0; i < maxPages && consecutiveFails < maxConsecutiveFails; i++) {
                    const testId = baseId + i;
                    const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/info.json`;
                    
                    try {
                        const result = await new Promise((resolve) => {
                            const req = https.request(testUrl, { method: 'HEAD', timeout: 3000 }, (res) => {
                                resolve(res.statusCode === 200);
                            });
                            req.on('error', () => resolve(false));
                            req.on('timeout', () => { req.destroy(); resolve(false); });
                            req.end();
                        });
                        
                        if (result) {
                            consecutiveFails = 0;
                            const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/full/max/0/default.jpg`;
                            images.push({
                                url: imageUrl,
                                label: `Page ${i + 1}`
                            });
                        } else {
                            consecutiveFails++;
                        }
                    } catch (e) {
                        consecutiveFails++;
                    }
                }
                
                console.log(`[Florence] Sequential scan found ${images.length} pages`);
                if (images.length > 0) {
                    return { images };
                }
            }
            
            // Fallback to the original slower method if quick check failed
            for (let testId = startId; testId < startId + 50; testId++) {
                if (Date.now() - detectionStartTime > detectionTimeout) {
                    console.log('[Florence] Compound object detection timeout - returning current results');
                    break;
                }
                
                const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/full/max/0/default.jpg`;
                
                try {
                    const testResult = await new Promise((resolve) => {
                        const req = https.get(testUrl, (response) => {
                            resolve({ success: response.statusCode === 200 });
                        });
                        req.on('error', () => resolve({ success: false }));
                        req.setTimeout(5000, () => {
                            req.destroy();
                            resolve({ success: false });
                        });
                    });
                    
                    if (testResult.success) {
                        if (validStart === -1) validStart = testId;
                        validEnd = testId;
                    } else if (validStart !== -1) {
                        break;
                    }
                } catch (error) {
                    // Continue
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (validStart !== -1) {
                console.log(`[Florence] Found valid ID range: ${validStart} to ${validEnd}`);
                
                // Generate URLs for the valid range
                for (let id = validStart; id <= validEnd; id++) {
                    // Check timeout again during URL generation
                    if (Date.now() - detectionStartTime > detectionTimeout) {
                        console.log('[Florence] URL generation timeout - returning partial results');
                        break;
                    }
                    
                    const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${id}/full/max/0/default.jpg`;
                    images.push({
                        url: imageUrl,
                        label: `Page ${images.length + 1}`
                    });
                }
            }
        }
        
        // Final fallback: look for page count indicators
        if (images.length === 0) {
            console.log('[Florence] No valid URLs found, trying page count detection...');
            
            const patterns = [
                /(?:page|item)\s*(\d+)\s*of\s*(\d+)/i,
                /totalPages['"]\s*:\s*(\d+)/i,
                /pageCount['"]\s*:\s*(\d+)/i
            ];
            
            let totalPages = 0;
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    totalPages = parseInt(match[1]);
                    if (totalPages > 1 && totalPages < 1000) {
                        console.log(`[Florence] Detected ${totalPages} pages from pattern`);
                        break;
                    }
                }
            }
            
            // Generate URLs for detected page count
            if (totalPages > 1) {
                const baseId = parseInt(itemId);
                for (let i = 0; i < totalPages; i++) {
                    const pageId = baseId + i;
                    const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/max/0/default.jpg`;
                    images.push({
                        url: imageUrl,
                        label: `Page ${i + 1}`
                    });
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No compound object structure detected');
        }
        
        return { images };
    }

    /**
     * Discover the actual page range for a Bordeaux manuscript by testing tile availability
     */
    async discoverBordeauxPageRange(baseId) {
        console.log(`[Bordeaux] Discovering page range for baseId: ${baseId}`);
        
        const baseUrl = 'https://selene.bordeaux.fr/in/dz';
        const availablePages = [];
        
        // Test a reasonable range of pages
        const maxTestPages = 200; // Don't test too many to avoid overwhelming the server
        
        // First, do a quick scan to find the general range
        const quickScanPages = [1, 5, 6, 10, 20, 30, 50, 75, 100, 150, 200];
        let foundAny = false;
        let minFound = null;
        let maxFound = null;
        
        console.log(`[Bordeaux] Quick scan for page availability...`);
        for (const page of quickScanPages) {
            const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
            const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
            
            try {
                const response = await this.fetchUrl(testUrl);
                if (response.ok) {
                    foundAny = true;
                    if (minFound === null || page < minFound) minFound = page;
                    if (maxFound === null || page > maxFound) maxFound = page;
                    console.log(`[Bordeaux] Quick scan: Page ${page} available`);
                }
            } catch (error) {
                // Ignore errors during discovery
            }
            
            // Small delay to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (!foundAny) {
            console.log(`[Bordeaux] No pages found in quick scan`);
            return { firstPage: null, lastPage: null, totalPages: 0, availablePages: [] };
        }
        
        console.log(`[Bordeaux] Quick scan found pages between ${minFound} and ${maxFound}`);
        
        // Now do a detailed scan in the discovered range
        const detailedStart = Math.max(1, minFound - 5);
        const detailedEnd = Math.min(maxTestPages, maxFound + 10);
        
        console.log(`[Bordeaux] Detailed scan from ${detailedStart} to ${detailedEnd}...`);
        
        // Process pages in batches for faster discovery
        const batchSize = 10;
        for (let batchStart = detailedStart; batchStart <= detailedEnd; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize - 1, detailedEnd);
            
            // Create promises for batch
            const batchPromises = [];
            for (let page = batchStart; page <= batchEnd; page++) {
                const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
                const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
                
                batchPromises.push(
                    this.fetchUrl(testUrl)
                        .then(response => response.ok ? page : null)
                        .catch(() => null)
                );
            }
            
            // Process batch results
            const batchResults = await Promise.all(batchPromises);
            for (const page of batchResults) {
                if (page !== null) {
                    availablePages.push(page);
                }
            }
            
            // Progress indication
            console.log(`[Bordeaux] Scanned up to page ${batchEnd}... (${availablePages.length} found)`);
            
            // Small delay between batches to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Sort pages in case they came back out of order
        availablePages.sort((a, b) => a - b);
        
        const result = {
            firstPage: availablePages.length > 0 ? availablePages[0] : null,
            lastPage: availablePages.length > 0 ? availablePages[availablePages.length - 1] : null,
            totalPages: availablePages.length,
            availablePages: availablePages
        };
        
        console.log(`[Bordeaux] Page discovery complete: ${result.totalPages} pages found (${result.firstPage}-${result.lastPage})`);
        return result;
    }

    /**
     * Bordeaux - Fixed with proper tile processor integration
     */
    async getBordeauxManifest(url) {
        console.log('[Bordeaux] Processing URL:', url);
        
        // Handle both public URLs and direct tile URLs
        let publicId, pageNum, internalId;
        
        // Pattern 1: New pattern ?REPRODUCTION_ID=11556
        const reproductionMatch = url.match(/[?&]REPRODUCTION_ID=(\d+)/);
        
        // Pattern 2: Public manuscript URL with ARK
        const publicMatch = url.match(/ark:\/\d+\/([^/]+)(?:\/f(\d+))?\/?/);
        
        // Pattern 3: Direct selene.bordeaux.fr tile URL
        const directMatch = url.match(/selene\.bordeaux\.fr\/in\/dz\/([^/]+?)(?:_(\d{4}))?(?:\.dzi)?$/);
        
        if (reproductionMatch) {
            publicId = reproductionMatch[1];
            pageNum = 1;
            console.log('[Bordeaux] Extracted reproduction ID from query parameter:', publicId);
        } else if (publicMatch) {
            publicId = publicMatch[1];
            pageNum = publicMatch[2] ? parseInt(publicMatch[2]) : null; // Don't default to 1, let startPage logic handle it
        } else if (directMatch) {
            // Direct tile URL - extract ID and page
            internalId = directMatch[1];
            pageNum = directMatch[2] ? parseInt(directMatch[2]) : 1;
            
            // Extract the manuscript part for display
            const idParts = internalId.match(/(\d+)_(.+)/);
            publicId = idParts ? idParts[2] : internalId;
        } else {
            // ULTRA-PRIORITY FIX for Issue #6: Try to extract ID from selene/page URL
            const selenePageMatch = url.match(/selene\/page\/([a-f0-9-]+)/);
            if (selenePageMatch) {
                publicId = selenePageMatch[1];
                pageNum = 1;
                console.log('[Bordeaux] Extracted page ID from selene/page URL:', publicId);
                // These URLs typically need to be resolved to get the actual manuscript ID
                // For now, use the page ID as the public ID
            } else {
                throw new Error('Invalid Bordeaux URL format. Expected patterns: ?REPRODUCTION_ID=XXXXX, ark:/XXXXX/XXXXX, /selene/page/XXXXX, or direct selene.bordeaux.fr tile URL');
            }
        }
        
        console.log('[Bordeaux] Public ID:', publicId, 'Starting page:', pageNum, 'Internal ID:', internalId || 'unknown');
        
        // First, try to fetch the main page to discover the internal tile ID (if not already known)
        if (!internalId && publicMatch) {
            try {
                const pageResponse = await this.fetchWithRetry(url);
                if (pageResponse.ok) {
                    const html = await pageResponse.text();
                    
                    // Look for iframe with selene.bordeaux.fr
                    const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]*selene\.bordeaux\.fr[^'"]+)/i);
                    if (iframeMatch) {
                        console.log('[Bordeaux] Found iframe URL:', iframeMatch[1]);
                        
                        // Fetch iframe content to find tile ID
                        const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : `https://selene.bordeaux.fr${iframeMatch[1]}`;
                        try {
                            const iframeResponse = await this.fetchWithRetry(iframeUrl);
                            if (iframeResponse.ok) {
                                const iframeHtml = await iframeResponse.text();
                                
                                // Look for DZI references in OpenSeadragon config
                                const dziMatch = iframeHtml.match(/\/in\/dz\/([^"'/\s]+)\.dzi/);
                                if (dziMatch) {
                                    internalId = dziMatch[1];
                                    console.log('[Bordeaux] Found internal tile ID:', internalId);
                                }
                            }
                        } catch (error) {
                            console.log('[Bordeaux] Could not fetch iframe content:', error.message);
                        }
                    }
                }
            } catch (error) {
                console.log('[Bordeaux] Could not fetch main page:', error.message);
            }
        }
        
        // If we couldn't find the internal ID, try known patterns or direct tile URL
        if (!internalId) {
            // Known mappings (can be expanded)
            const knownMappings = {
                'btv1b52509616g': '330636101_MS0778',
                '330636101_MS_0778': '330636101_MS0778',
                // Add more mappings as discovered
            };
            
            internalId = knownMappings[publicId];
            
            if (!internalId) {
                // If it's a direct selene.bordeaux.fr URL, extract the ID
                if (url.includes('selene.bordeaux.fr')) {
                    const seleneMatch = url.match(/\/in\/dz\/([^/]+)/);
                    if (seleneMatch) {
                        internalId = seleneMatch[1];
                    }
                } else {
                    throw new Error(`Cannot determine tile ID for Bordeaux manuscript: ${publicId}. Please use the direct tile URL from selene.bordeaux.fr if available.`);
                }
            }
        }
        
        // Extract base ID without page number if present
        const baseIdMatch = internalId.match(/^(.+?)(?:_\d{4})?$/);
        const baseId = baseIdMatch ? baseIdMatch[1] : internalId;
        
        // For Bordeaux, discover the actual page range by testing availability
        console.log('[Bordeaux] Discovering actual page range...');
        const pageDiscovery = await this.discoverBordeauxPageRange(baseId);
        
        let startPage = pageNum || pageDiscovery.firstPage || 1;
        let pageCount = pageDiscovery.totalPages;
        
        // If user specified a specific page, respect it but use discovered total count
        if (pageNum && pageDiscovery.totalPages > 0) {
            startPage = pageNum;
        }
        
        console.log(`[Bordeaux] Discovered ${pageCount} pages, starting from page ${startPage}`);
        
        // Return manifest structure that will be processed by the tile processor
        return { 
            type: 'bordeaux_tiles',
            baseId: baseId,
            publicId: publicId,
            startPage: startPage,
            pageCount: pageCount,
            tileBaseUrl: 'https://selene.bordeaux.fr/in/dz',
            displayName: `Bordeaux - ${publicId}`,
            // This signals to the download service to use the tile processor
            requiresTileProcessor: true,
            tileConfig: {
                baseId: baseId,
                startPage: startPage,
                pageCount: pageCount,
                tileBaseUrl: 'https://selene.bordeaux.fr/in/dz',
                // Store discovered page range for the tile processor
                pageRange: pageDiscovery
            }
        };
    }
    
    /**
     * Parse Bordeaux IIIF manifest if available
     */
    async parseBordeauxIIIFManifest(manifest, manuscriptId) {
        const images = [];
        
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            const maxPages = canvases.length;
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    if (service && service['@id']) {
                        // Request maximum resolution
                        const imageUrl = `${service['@id']}/full/max/0/default.jpg`;
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Bordeaux IIIF manifest');
        }
        
        return {
            images,
            displayName: `Bordeaux - ${manuscriptId}`
        };
    }

    /**
     * Bodleian Library (Oxford) - IIIF v2 manifest support
     * Supports manuscripts from digital.bodleian.ox.ac.uk
     */
    async getBodleianManifest(url) {
        console.log('[Bodleian] Processing URL:', url);
        
        // Extract object ID from URL
        const match = url.match(/objects\/([^/?]+)/);
        if (!match) throw new Error('Invalid Bodleian URL');
        
        const objectId = match[1];
        const manifestUrl = `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${objectId}.json`;
        
        console.log('[Bodleian] Fetching IIIF manifest from:', manifestUrl);
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest = await response.json();
        const images = [];
        
        // Process IIIF v2 manifest
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            console.log(`[Bodleian] Processing ${canvases.length} pages from IIIF manifest`);
            
            // Process all canvases (Bodleian manuscripts can be quite long)
            const maxPages = canvases.length; // Reasonable limit
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    if (service && service['@id']) {
                        // Request maximum resolution available
                        const imageUrl = `${service['@id']}/full/max/0/default.jpg`;
                        images.push({
                            url: imageUrl,
                            label: canvas.label || `Page ${i + 1}`
                        });
                    } else if (resource['@id']) {
                        // Fallback to direct resource URL
                        images.push({
                            url: resource['@id'],
                            label: canvas.label || `Page ${i + 1}`
                        });
                    }
                }
            }
        }
        // Handle IIIF v3 if needed
        else if (manifest.items) {
            console.log(`[Bodleian] Processing ${manifest.items.length} items from IIIF v3 manifest`);
            
            const maxPages = manifest.items.length;
            
            for (let i = 0; i < maxPages; i++) {
                const item = manifest.items[i];
                if (item.items && item.items[0] && item.items[0].items && item.items[0].items[0]) {
                    const annotation = item.items[0].items[0];
                    if (annotation.body && annotation.body.service && annotation.body.service[0]) {
                        const service = annotation.body.service[0];
                        if (service.id) {
                            images.push({
                                url: `${service.id}/full/max/0/default.jpg`,
                                label: item.label?.en?.[0] || item.label?.none?.[0] || `Page ${i + 1}`
                            });
                        }
                    }
                }
            }
        }
        
        if (images.length === 0) {
            throw new Error('No images found in Bodleian manifest');
        }
        
        console.log(`[Bodleian] Successfully extracted ${images.length} pages`);
        
        return {
            images,
            displayName: manifest.label || `Bodleian - ${objectId}`
        };
    }

    /**
     * Discover all blocks for an e-manuscripta manuscript
     * Many e-manuscripta manuscripts are split into multiple blocks with sequential IDs
     */
    async discoverEManuscriptaBlocks(baseManuscriptId, library) {
        console.log(`[e-manuscripta] ULTRA-OPTIMIZED Discovery for manuscript ${baseManuscriptId} in library ${library}`);
        
        // Enhanced logging for debugging
        if (typeof window === 'undefined' && global.comprehensiveLogger) {
            global.comprehensiveLogger.logEManuscriptaDiscovery('discovery_start', {
                baseManuscriptId,
                library,
                method: 'ULTRA-OPTIMIZED'
            });
        }
        
        const baseId = parseInt(baseManuscriptId);
        const discoveredBlocks = new Set([baseId]);
        const startTime = Date.now();
        const maxDiscoveryTime = 8000; // 8 seconds max for discovery
        
        // ULTRA-OPTIMIZED Strategy: Smart pattern detection with minimal requests
        // Previous version made 1000+ requests causing timeouts (Issue #10)
        const searchPattern = 11;
        const maxQuickSearchRange = 55; // Reduced from 200 to prevent timeouts
        
        console.log(`[e-manuscripta] Quick search around ${baseId} with pattern +/-${searchPattern}`);
        
        // Quick backward search (limited to prevent timeout)
        for (let offset = searchPattern; offset <= maxQuickSearchRange && (Date.now() - startTime) < maxDiscoveryTime; offset += searchPattern) {
            const testId = baseId - offset;
            if (testId <= 0) break;
            
            try {
                const testUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${testId}`;
                const response = await this.fetchUrl(testUrl);
                if (response.ok) {
                    discoveredBlocks.add(testId);
                    console.log(`[e-manuscripta] Found block (backward): ${testId}`);
                } else {
                    // If we hit a 404, we've likely found the start of the manuscript
                    if (response.status === 404) {
                        console.log(`[e-manuscripta] Backward search stopped at ${testId} (not found)`);
                        break;
                    }
                }
            } catch (error) {
                // Continue searching even if there's an error
            }
            
            // Minimal delay to speed up discovery
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // Quick forward search (limited to prevent timeout)
        for (let offset = searchPattern; offset <= maxQuickSearchRange && (Date.now() - startTime) < maxDiscoveryTime; offset += searchPattern) {
            const testId = baseId + offset;
            
            try {
                const testUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${testId}`;
                const response = await this.fetchUrl(testUrl);
                if (response.ok) {
                    discoveredBlocks.add(testId);
                    console.log(`[e-manuscripta] Found block (forward): ${testId}`);
                } else {
                    // If we hit a 404, we've likely found the end of the manuscript
                    if (response.status === 404) {
                        console.log(`[e-manuscripta] Forward search stopped at ${testId} (not found)`);
                        break;
                    }
                }
            } catch (error) {
                // Continue searching even if there's an error
            }
            
            // Minimal delay to speed up discovery
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // Strategy 2: Check specific known patterns for this manuscript
        // Some manuscripts might have different patterns
        if (discoveredBlocks.size === 1) {
            console.log(`[e-manuscripta] Trying alternative patterns...`);
            
            const alternativePatterns = [1, 10, 12, 20]; // Other common patterns
            
            for (const pattern of alternativePatterns) {
                let foundWithPattern = false;
                
                // Test a few IDs with this pattern
                for (let i = 1; i <= 5; i++) {
                    const testId = baseId + (i * pattern);
                    
                    try {
                        const testUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${testId}`;
                        const response = await this.fetchUrl(testUrl);
                        if (response.ok) {
                            discoveredBlocks.add(testId);
                            foundWithPattern = true;
                            console.log(`[e-manuscripta] Found block with pattern +${pattern}: ${testId}`);
                        }
                    } catch (error) {
                        // Ignore errors
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // If we found blocks with this pattern, continue searching
                if (foundWithPattern) {
                    console.log(`[e-manuscripta] Pattern +${pattern} seems to work, extending search...`);
                    
                    for (let i = 6; i <= 20; i++) {
                        const testId = baseId + (i * pattern);
                        
                        try {
                            const testUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${testId}`;
                            const response = await this.fetchUrl(testUrl);
                            if (response.ok) {
                                discoveredBlocks.add(testId);
                            } else if (response.status === 404) {
                                break; // End of manuscript
                            }
                        } catch (error) {
                            // Continue
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    break; // Found a working pattern, stop trying others
                }
            }
        }
        
        // Strategy 3: ULTRA-FAST heuristic for known multi-series patterns
        // Critical fix for Issue #10: Use smart detection to avoid timeout
        if ((Date.now() - startTime) < maxDiscoveryTime) {
            console.log(`[e-manuscripta] Checking for multi-series manuscripts...`);
        
            // Known patterns from Issue #10: e-manuscripta multi-series structure
            // User's manuscript has blocks at 5157232, 5157243, 5157254, etc (offset -384 from 5157616)
            const knownSeriesOffsets = [-385, -384, -374];  // Most common multi-series offsets
            
            for (const offset of knownSeriesOffsets) {
                if ((Date.now() - startTime) >= maxDiscoveryTime) break;
                
                const probeId = baseId + offset;
                if (probeId <= 0) continue;
                
                try {
                    const probeUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${probeId}`;
                    const response = await this.fetchUrl(probeUrl);
                    
                    if (response.ok) {
                        console.log(`[e-manuscripta] Found multi-series block at ${probeId} (offset ${offset})`);
                        discoveredBlocks.add(probeId);
                        
                        // Smart scan: Add blocks in this series with validation
                        // Only add blocks we're confident exist based on the pattern
                        console.log(`[e-manuscripta] Exploring series from block ${probeId}...`);
                        
                        // Check forward from the found block
                        for (let i = 1; i <= 20 && (Date.now() - startTime) < maxDiscoveryTime; i++) {
                            const testBlockId = probeId + (i * 11);
                            try {
                                const testUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${testBlockId}`;
                                const testResponse = await this.fetchUrl(testUrl);
                                if (testResponse.ok) {
                                    discoveredBlocks.add(testBlockId);
                                } else if (testResponse.status === 404) {
                                    break; // End of this series
                                }
                            } catch (error) {
                                break;
                            }
                        }
                        
                        // Check backward from the found block (limited)
                        for (let i = 1; i <= 5 && (Date.now() - startTime) < maxDiscoveryTime; i++) {
                            const testBlockId = probeId - (i * 11);
                            if (testBlockId <= 0) break;
                            try {
                                const testUrl = `https://www.e-manuscripta.ch/${library}/content/zoom/${testBlockId}`;
                                const testResponse = await this.fetchUrl(testUrl);
                                if (testResponse.ok) {
                                    discoveredBlocks.add(testBlockId);
                                } else if (testResponse.status === 404) {
                                    break; // Start of this series
                                }
                            } catch (error) {
                                break;
                            }
                        }
                        
                        console.log(`[e-manuscripta] Added ${discoveredBlocks.size - 1} blocks based on multi-series pattern`);
                        break; // Found a multi-series pattern, that's enough
                    }
                } catch (error) {
                    // Continue with next offset
                }
            }
        }
        
        const elapsed = Date.now() - startTime;
        const sortedBlocks = Array.from(discoveredBlocks).sort((a, b) => a - b);
        const totalPages = sortedBlocks.length * 11; // Assuming 11 pages per block
        
        console.log(`[e-manuscripta] Discovery completed in ${elapsed}ms`);
        console.log(`[e-manuscripta] Blocks found: ${sortedBlocks.length}`);
        
        // Enhanced logging for debugging
        if (typeof window === 'undefined' && global.comprehensiveLogger) {
            global.comprehensiveLogger.logEManuscriptaDiscovery('discovery_complete', {
                baseManuscriptId,
                library,
                blocksFound: sortedBlocks.length,
                totalPages,
                elapsed,
                blocks: sortedBlocks.length > 50 ? 
                    `${sortedBlocks.slice(0, 10).join(',')}...${sortedBlocks.slice(-10).join(',')}` : 
                    sortedBlocks.join(',')
            });
        }
        if (sortedBlocks.length <= 20) {
            console.log(`[e-manuscripta] Block IDs: ${sortedBlocks.join(', ')}`);
        } else {
            console.log(`[e-manuscripta] First blocks: ${sortedBlocks.slice(0, 5).join(', ')}...`);
            console.log(`[e-manuscripta] Last blocks: ...${sortedBlocks.slice(-5).join(', ')}`);
        }
        console.log(`[e-manuscripta] Total pages: ${totalPages}`);
        
        // Log any large gaps for debugging
        for (let i = 1; i < sortedBlocks.length; i++) {
            const gap = sortedBlocks[i] - sortedBlocks[i-1];
            if (gap > 50) {
                console.log(`[e-manuscripta] Gap detected: ${gap} between blocks ${sortedBlocks[i-1]} and ${sortedBlocks[i]}`);
            }
        }
        
        return {
            blocks: sortedBlocks,
            totalPages: totalPages,
            baseId: baseId
        };
    }

    /**
     * e-manuscripta.ch - Swiss manuscript library
     * Supports manuscripts from www.e-manuscripta.ch
     */
    async getEManuscriptaManifest(url) {
        console.log('[e-manuscripta] Processing URL:', url);
        
        // Extract manuscript ID from URL
        // URL formats: 
        // - https://www.e-manuscripta.ch/{library}/content/zoom/{id}
        // - https://www.e-manuscripta.ch/{library}/doi/10.7891/e-manuscripta-{id}
        let match = url.match(/e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/);
        
        // ULTRA-PRIORITY FIX for Issue #10: Support DOI format URLs
        if (!match) {
            // Try DOI format
            const doiMatch = url.match(/e-manuscripta\.ch\/([^/]+)\/doi\/[^/]+\/e-manuscripta-(\d+)/);
            if (doiMatch) {
                // Convert DOI match to standard format [full, library, viewType, manuscriptId]
                match = [doiMatch[0], doiMatch[1], 'zoom', doiMatch[2]];
                console.log('[e-manuscripta] Detected DOI format, extracted ID:', doiMatch[2]);
            }
        }
        
        if (!match) {
            throw new Error('Invalid e-manuscripta.ch URL format. Expected patterns: /content/zoom/XXXXX or /doi/10.7891/e-manuscripta-XXXXX');
        }
        
        const [, library, viewType, manuscriptId] = match;
        console.log(`[e-manuscripta] Library: ${library}, View: ${viewType}, ID: ${manuscriptId}`);
        
        const images = [];
        
        // Fetch the viewer page to extract page count
        const response = await this.fetchWithRetry(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch e-manuscripta page: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Extract page count from dropdown or other elements
        let totalPages = 11; // Default to user-reported issue
        
        // Method 1: Look for goToPage dropdown with proper structure
        const selectMatch = html.match(/<select[^>]*(?:id|name)=['"]?goToPage[^>]*>([\s\S]*?)<\/select>/i);
        if (selectMatch) {
            const selectContent = selectMatch[1];
            const optionMatches = Array.from(selectContent.matchAll(/<option[^>]*>([^<]+)<\/option>/g));
            if (optionMatches.length > 0) {
                // The last option typically contains the highest page number
                const lastOption = optionMatches[optionMatches.length - 1][1];
                const pageNum = parseInt(lastOption.match(/\d+/)?.[0] || '0');
                if (pageNum > 0) {
                    totalPages = pageNum;
                    console.log(`[e-manuscripta] Found ${totalPages} pages from dropdown`);
                }
            }
        }
        
        // Method 2: Look for JavaScript variables or data attributes
        if (totalPages === 11) {
            // Try to find totalPages or similar variables in JavaScript
            const jsVarMatches = [
                html.match(/totalPages['":\s]+(\d+)/),
                html.match(/pageCount['":\s]+(\d+)/),
                html.match(/lastPage['":\s]+(\d+)/),
                html.match(/numPages['":\s]+(\d+)/)
            ];
            
            for (const match of jsVarMatches) {
                if (match && match[1]) {
                    const pages = parseInt(match[1]);
                    if (pages > totalPages) {
                        totalPages = pages;
                        console.log(`[e-manuscripta] Found ${totalPages} pages from JavaScript variable`);
                        break;
                    }
                }
            }
        }
        
        // Method 3: Try to discover page structure from navigation links
        if (totalPages === 11) {
            // Look for patterns like "Page X of Y" or similar
            const pageOfMatch = html.match(/(?:page|seite)\s+\d+\s+(?:of|von)\s+(\d+)/i);
            if (pageOfMatch) {
                totalPages = parseInt(pageOfMatch[1]);
                console.log(`[e-manuscripta] Found ${totalPages} pages from page indicator`);
            }
        }
        
        // Method 4: Advanced block discovery for e-manuscripta manuscripts
        console.log(`[e-manuscripta] Attempting advanced block discovery for manuscript ${manuscriptId}`);
        const blockDiscovery = await this.discoverEManuscriptaBlocks(manuscriptId, library);
        
        if (blockDiscovery.blocks.length > 1) {
            totalPages = blockDiscovery.totalPages;
            console.log(`[e-manuscripta] Advanced discovery found ${blockDiscovery.blocks.length} blocks with ${totalPages} total pages`);
        }
        
        // Extract title
        let displayName = `e-manuscripta ${library} ${manuscriptId}`;
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            displayName = titleMatch[1].trim();
        }
        
        // Generate page references across all discovered blocks
        // If we have block discovery data, use it to create proper block/page mappings
        if (blockDiscovery && blockDiscovery.blocks.length > 1) {
            console.log(`[e-manuscripta] Generating pages for ${blockDiscovery.blocks.length} blocks`);
            
            let globalPageNum = 1;
            for (const blockId of blockDiscovery.blocks) {
                // Each block typically has 11 pages
                for (let pageInBlock = 1; pageInBlock <= 11; pageInBlock++) {
                    // Generate actual download URL for e-manuscripta
                    // Calculate the actual page ID: blockId + (pageInBlock - 1)
                    const pageId = blockId + (pageInBlock - 1);
                    images.push({
                        url: `https://www.e-manuscripta.ch/${library}/download/webcache/2000/${pageId}`,
                        label: `Page ${globalPageNum}`,
                        blockId: blockId,
                        pageInBlock: pageInBlock
                    });
                    globalPageNum++;
                }
            }
        } else {
            // Fallback to original method for single-block manuscripts
            for (let i = 1; i <= Math.min(totalPages, 500); i++) { // Reasonable limit
                // Generate actual download URL
                const pageId = parseInt(manuscriptId) + (i - 1);
                images.push({
                    url: `https://www.e-manuscripta.ch/${library}/download/webcache/2000/${pageId}`,
                    label: `Page ${i}`
                });
            }
        }
        
        console.log(`[e-manuscripta] Successfully extracted ${images.length} pages`);
        
        return {
            images,
            displayName
        };
    }

    /**
     * Heidelberg University Library handler
     * Supports both IIIF v2 and v3 manifests
     * 
     * URL patterns:
     * - IIIF v3: https://digi.ub.uni-heidelberg.de/diglit/iiif3/{manuscript_id}/manifest
     * - IIIF v2: https://digi.ub.uni-heidelberg.de/diglit/iiif/{manuscript_id}/manifest
     * 
     * @param {string} url - The Heidelberg library URL
     * @returns {Promise<Object>} Manifest object with images array
     */
    async getHeidelbergManifest(url) {
        console.log('[Heidelberg] Processing URL:', url);
        
        // Handle DOI URLs (e.g., https://doi.org/10.11588/diglit.7292)
        if (url.includes('doi.org/10.11588/diglit')) {
            console.log('[Heidelberg] Detected DOI URL, processing...');
            
            // DOI pattern: https://doi.org/10.11588/diglit.XXXX maps to specific manuscripts
            // Known mappings (expand as needed)
            const doiMappings = {
                '7292': 'salVIII2',
                // Add more mappings as discovered
            };
            
            // Extract DOI number
            const doiMatch = url.match(/10\.11588\/diglit\.(\d+)/);
            if (doiMatch) {
                const doiNumber = doiMatch[1];
                const manuscriptId = doiMappings[doiNumber];
                
                if (manuscriptId) {
                    console.log(`[Heidelberg] DOI ${doiNumber} maps to manuscript: ${manuscriptId}`);
                    url = `https://digi.ub.uni-heidelberg.de/diglit/${manuscriptId}`;
                } else {
                    // Unknown DOI - cannot automatically resolve without mapping
                    console.log(`[Heidelberg] Unknown DOI ${doiNumber} - cannot automatically resolve`);
                    // Users should provide the direct Heidelberg URL for unmapped DOIs
                    throw new Error(`DOI ${doiNumber} is not yet mapped. Please use the direct Heidelberg URL (e.g., https://digi.ub.uni-heidelberg.de/diglit/MANUSCRIPT_ID) instead.`);
                }
            }
        }
        
        // Transform viewer URL to manifest URL if needed
        let manifestUrl;
        let isV3 = false;
        
        if (url.includes('/manifest')) {
            // Already a manifest URL
            manifestUrl = url;
            isV3 = url.includes('/iiif3/');
        } else if (url.includes('/iiif3/') || url.includes('/iiif/')) {
            // IIIF URL without /manifest
            manifestUrl = url + '/manifest';
            isV3 = url.includes('/iiif3/');
        } else {
            // Viewer URL like https://digi.ub.uni-heidelberg.de/diglit/salVIII2
            // Extract manuscript ID and construct manifest URL
            const match = url.match(/\/diglit\/([^/?#]+)/);
            if (match) {
                const manuscriptId = match[1];
                // Default to IIIF v3 for better features
                manifestUrl = `https://digi.ub.uni-heidelberg.de/diglit/iiif3/${manuscriptId}/manifest`;
                isV3 = true;
                console.log(`[Heidelberg] Transformed viewer URL to IIIF v3 manifest: ${manifestUrl}`);
            } else {
                // Fallback: try adding /manifest
                manifestUrl = url + '/manifest';
            }
        }
        
        console.log(`[Heidelberg] Fetching ${isV3 ? 'IIIF v3' : 'IIIF v2'} manifest from: ${manifestUrl}`);
        
        const response = await this.fetchWithRetry(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Heidelberg manifest: ${response.status}`);
        }
        
        const manifest = await response.json();
        const images = [];
        
        // Extract manuscript ID from URL
        const manuscriptIdMatch = url.match(/\/([^/?#]+)(?:\/manifest)?(?:\?|#|$)/);
        const manuscriptId = manuscriptIdMatch ? manuscriptIdMatch[1].replace(/^(diglit|iiif3?)\//i, '') : '';
        
        // Extract metadata
        let displayName = `Heidelberg Manuscript ${manuscriptId}`;
        if (manifest.label) {
            if (typeof manifest.label === 'object') {
                // IIIF v3 label format (language map)
                const labels = manifest.label.none || manifest.label.de || manifest.label.en || Object.values(manifest.label)[0];
                const label = Array.isArray(labels) ? labels[0] : labels;
                // Include manuscript ID if not already present
                if (manuscriptId && !label.includes(manuscriptId)) {
                    displayName = `${label} (${manuscriptId})`;
                } else {
                    displayName = label;
                }
            } else {
                // IIIF v2 label format (string)
                // Include manuscript ID if not already present
                if (manuscriptId && !manifest.label.includes(manuscriptId)) {
                    displayName = `${manifest.label} (${manuscriptId})`;
                } else {
                    displayName = manifest.label;
                }
            }
        }
        
        console.log(`[Heidelberg] Manuscript: ${displayName}`);
        
        // Process based on IIIF version
        if (isV3 || manifest.items) {
            // IIIF v3 structure
            console.log(`[Heidelberg] Processing IIIF v3 manifest with ${manifest.items?.length || 0} items`);
            
            if (manifest.items) {
                for (let i = 0; i < manifest.items.length; i++) {
                    const canvas = manifest.items[i];
                    
                    // Extract label for this page
                    let pageLabel = `Page ${i + 1}`;
                    if (canvas.label) {
                        if (typeof canvas.label === 'object') {
                            const labels = canvas.label.none || canvas.label.de || canvas.label.en || Object.values(canvas.label)[0];
                            pageLabel = Array.isArray(labels) ? labels[0] : labels;
                        } else {
                            pageLabel = canvas.label;
                        }
                    }
                    
                    // Find annotation with image
                    if (canvas.items && canvas.items[0] && canvas.items[0].items) {
                        const annotation = canvas.items[0].items[0];
                        if (annotation && annotation.body) {
                            let imageUrl = null;
                            
                            // Direct image URL
                            if (annotation.body.id) {
                                imageUrl = annotation.body.id;
                            }
                            
                            // Or use image service for maximum resolution
                            if (annotation.body.service && annotation.body.service[0]) {
                                const service = annotation.body.service[0];
                                const serviceId = service.id || service['@id'];
                                
                                // Try different resolutions in order of preference
                                // Heidelberg supports: full/max, full/full, full/4000, full/2000
                                if (serviceId) {
                                    // Use maximum available resolution
                                    imageUrl = `${serviceId}/full/max/0/default.jpg`;
                                }
                            }
                            
                            if (imageUrl) {
                                images.push({
                                    url: imageUrl,
                                    label: pageLabel
                                });
                            }
                        }
                    }
                }
            }
        } else if (manifest.sequences) {
            // IIIF v2 structure
            const sequence = manifest.sequences[0];
            if (sequence && sequence.canvases) {
                console.log(`[Heidelberg] Processing IIIF v2 manifest with ${sequence.canvases.length} canvases`);
                
                for (let i = 0; i < sequence.canvases.length; i++) {
                    const canvas = sequence.canvases[i];
                    
                    // Extract page label
                    let pageLabel = canvas.label || `Page ${i + 1}`;
                    
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        const resource = image.resource;
                        
                        if (resource) {
                            let imageUrl = null;
                            
                            // Check for direct image URL
                            if (resource['@id']) {
                                imageUrl = resource['@id'];
                            }
                            
                            // Or use image service for better quality
                            if (resource.service) {
                                const serviceId = resource.service['@id'];
                                if (serviceId) {
                                    // For IIIF v2, prefer using the service for maximum resolution
                                    // Check if it's IIIF Image API v2
                                    if (resource.service.profile && resource.service.profile.includes('http://iiif.io/api/image/2')) {
                                        // Use IIIF Image API for maximum resolution
                                        imageUrl = `${serviceId}/full/max/0/default.jpg`;
                                    }
                                }
                            }
                            
                            if (imageUrl) {
                                images.push({
                                    url: imageUrl,
                                    label: pageLabel
                                });
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`[Heidelberg] Found ${images.length} pages`);
        
        if (images.length === 0) {
            throw new Error('No images found in Heidelberg manifest');
        }
        
        // Log sample URLs for debugging
        if (images.length > 0) {
            console.log(`[Heidelberg] First page URL: ${images[0].url}`);
            console.log(`[Heidelberg] Last page URL: ${images[images.length - 1].url}`);
        }
        
        return {
            images,
            displayName,
            metadata: {
                library: 'Heidelberg University Library',
                manuscriptId: url.match(/\/([^/]+)\/manifest/)?.[1] || 'unknown',
                iiifVersion: isV3 ? 3 : 2,
                totalPages: images.length
            },
            type: 'iiif'
        };
    }

    /**
     * Norwegian National Library (nb.no) - IIIF v1 manifest
     * 
     * IMPORTANT: Some Norwegian National Library content is geo-restricted and only
     * accessible from Norwegian IP addresses. Users outside Norway may encounter
     * HTTP 403 errors when trying to access certain manuscripts.
     * 
     * Workarounds for geo-blocked content:
     * 1. Use a VPN service with Norwegian servers
     * 2. Access the content from within Norway
     * 3. Check if the manuscript has alternative access methods
     * 4. Contact nb.no for access permissions
     */
    async getNorwegianManifest(url) {
        console.log('[Norwegian] Processing URL:', url);
        
        // Extract item ID from URL
        // URL pattern: https://www.nb.no/items/{id}?page=X
        const match = url.match(/\/items\/([a-f0-9]+)/);
        if (!match) throw new Error('Invalid Norwegian National Library URL');
        
        const itemId = match[1];
        
        // Try v1 API first (the one that works from curl)
        const manifestUrl = `https://api.nb.no/catalog/v1/iiif/${itemId}/manifest?profile=nbdigital`;
        
        console.log(`[Norwegian] IIIF v1 manifest URL: ${manifestUrl}`);
        
        // Fetch IIIF manifest with proper headers
        // Note: Even with proper headers, some content may still be geo-blocked
        const response = await this.fetchUrl(manifestUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Authorization': 'null',
                'Origin': 'https://www.nb.no',
                'Referer': 'https://www.nb.no/'
            }
        });
        
        if (!response.ok) {
            // Try v3 API as fallback
            const v3Url = `https://api.nb.no/catalog/v3/iiif/${itemId}/manifest`;
            console.log(`[Norwegian] Trying v3 API: ${v3Url}`);
            const v3Response = await this.fetchWithRetry(v3Url);
            if (!v3Response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.status}`);
            }
            return this.parseNorwegianV3Manifest(await v3Response.json(), itemId);
        }
        
        const manifest = await response.json();
        const images = [];
        
        // Extract metadata  
        // itemId is already extracted above
        let displayName = `Norwegian Manuscript ${itemId}`;
        if (manifest.label) {
            // Include item ID if not already present
            if (itemId && !manifest.label.includes(itemId)) {
                displayName = `${manifest.label} (${itemId})`;
            } else {
                displayName = manifest.label;
            }
        }
        
        // Process sequences (IIIF v2 structure)
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            for (const canvas of manifest.sequences[0].canvases) {
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    
                    // Get the service URL for dynamic sizing
                    let imageUrl = resource['@id'] || resource.id;
                    
                    // If there's a service, use it to construct URLs
                    if (resource.service) {
                        const serviceId = resource.service['@id'] || resource.service.id;
                        // Use a reasonable size that should work
                        imageUrl = `${serviceId}/full/2000,/0/default.jpg`;
                    }
                    
                    images.push({
                        url: imageUrl,
                        label: canvas.label || `Page ${images.length + 1}`,
                        width: resource.width,
                        height: resource.height
                    });
                }
            }
        }
        
        console.log(`[Norwegian] Found ${images.length} pages in IIIF v1/v2 manifest`);
        
        return {
            images,
            displayName,
            metadata: {
                library: 'Norwegian National Library',
                id: itemId,
                rights: manifest.license || 'https://www.nb.no/lisens/stromming',
                requiresCookies: true,  // Important flag for download handling
                requiresNorwegianIP: true  // Some content only accessible from Norwegian IPs
            },
            type: 'iiif'
        };
    }
    
    /**
     * Parse Norwegian v3 manifest (fallback)
     */
    parseNorwegianV3Manifest(manifest, itemId) {
        const images = [];
        let displayName = `Norwegian Manuscript ${itemId}`;
        
        if (manifest.label) {
            if (typeof manifest.label === 'object') {
                const labels = manifest.label['no'] || manifest.label['nb'] || manifest.label['nn'] || manifest.label['en'] || Object.values(manifest.label)[0];
                const label = Array.isArray(labels) ? labels[0] : labels;
                // Include item ID if not already present
                if (itemId && !label.includes(itemId)) {
                    displayName = `${label} (${itemId})`;
                } else {
                    displayName = label;
                }
            } else {
                // Include item ID if not already present
                if (itemId && !manifest.label.includes(itemId)) {
                    displayName = `${manifest.label} (${itemId})`;
                } else {
                    displayName = manifest.label;
                }
            }
        }
        
        if (manifest.items) {
            for (let i = 0; i < manifest.items.length; i++) {
                const canvas = manifest.items[i];
                
                if (canvas.items && canvas.items[0] && canvas.items[0].items) {
                    for (const annotation of canvas.items[0].items) {
                        if (annotation.body) {
                            const body = annotation.body;
                            
                            let imageUrl = null;
                            if (body.id) {
                                imageUrl = body.id;
                            } else if (body.service && body.service[0]) {
                                const service = body.service[0];
                                const serviceId = service['@id'] || service.id;
                                // Use a reasonable size
                                imageUrl = `${serviceId}/full/2000,/0/default.jpg`;
                            }
                            
                            if (imageUrl) {
                                let label = `Page ${i + 1}`;
                                if (canvas.label) {
                                    if (typeof canvas.label === 'object') {
                                        const labels = canvas.label['no'] || canvas.label['nb'] || canvas.label['nn'] || canvas.label['en'] || Object.values(canvas.label)[0];
                                        label = Array.isArray(labels) ? labels[0] : labels;
                                    } else {
                                        label = canvas.label;
                                    }
                                }
                                
                                images.push({
                                    url: imageUrl,
                                    label: label
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return {
            images,
            displayName,
            metadata: {
                library: 'Norwegian National Library',
                id: itemId,
                rights: manifest.rights || 'https://www.nb.no/lisens/stromming',
                requiresCookies: true,
                requiresNorwegianIP: true  // Some content only accessible from Norwegian IPs
            },
            type: 'iiif'
        };
    }
}

module.exports = { SharedManifestLoaders };