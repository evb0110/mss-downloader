# Verona Biblioteca Civica Fetch Failure Analysis

## Executive Summary

The Verona Biblioteca Civica manuscript downloader is failing with "fetch failed" errors due to SSL certificate validation issues. While the current implementation attempts to bypass SSL verification, it's using an incompatible approach that doesn't work with the modern Node.js fetch API.

## Issue Analysis

### 1. Root Cause: SSL Certificate Validation
- **Domain**: `https://www.nuovabibliotecamanoscritta.it`
- **Error**: `fetch failed` (underlying: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`)
- **SSL Status**: Certificate is valid but causes Node.js fetch to fail
- **Verification**: Works with `curl` and `https` module with `rejectUnauthorized: false`

### 2. Current Implementation Issues

The service includes SSL bypass logic in `fetchDirect()`:
```typescript
if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') || url.includes('bdh-rd.bne.es')) {
    if (typeof process !== 'undefined' && process.versions?.node) {
        const { Agent } = await import('https');
        fetchOptions.agent = new Agent({
            rejectUnauthorized: false
        });
    }
}
```

**Problem**: Node.js `fetch()` API doesn't properly respect the `agent` option for SSL bypass.

### 3. Verification Tests

#### Test Results:
- ✅ **DNS Resolution**: `89.17.160.89` - resolves correctly
- ✅ **SSL Connection**: TLS 1.2, valid certificate for `www.nuovabibliotecamanoscritta.it`
- ✅ **HTTPS Module**: Works with `rejectUnauthorized: false`
- ✅ **Curl**: Works perfectly
- ❌ **Node.js fetch()**: Fails with "fetch failed"

#### HTML Page Analysis:
- Status: 200 OK
- Content-Type: text/html;charset=UTF-8
- Content-Length: 12,507 bytes
- Contains viewer link: `VisualizzaVolume/visualizza.html?codiceDigital=15&volume=1`

#### IIIF Manifest Test:
- Manifest URL: `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json`
- Status: 200 OK
- Type: sc:Manifest
- Label: "LXXXIX (84)"
- Canvases: 254 pages
- Image Service: `https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/`

### 4. Current Implementation Status

The Verona implementation in `loadVeronaManifest()` is functionally correct:
- ✅ Proper URL pattern recognition
- ✅ Correct manifest mapping (codice 15 → LXXXIX841)
- ✅ Valid IIIF manifest parsing
- ✅ High-resolution image URL construction (`/full/20000,/0/default.jpg`)
- ❌ SSL bypass not working with Node.js fetch

### 5. Working Solutions

#### Option A: Replace fetch with https module
```typescript
if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) {
    // Use https module directly for SSL bypass
    const httpsResponse = await this.fetchWithHTTPS(url, options);
    return httpsResponse;
}
```

#### Option B: Implement proper SSL bypass
```typescript
// Use undici or node-fetch with proper SSL bypass
const { Agent } = await import('undici');
const agent = new Agent({
    connect: {
        rejectUnauthorized: false
    }
});
```

## Recommendations

### 1. Immediate Fix (Critical)
Implement a dedicated `fetchWithHTTPS()` method for problematic domains:

```typescript
private async fetchWithHTTPS(url: string, options: any = {}): Promise<Response> {
    const https = await import('https');
    const { URL } = await import('url');
    
    const urlObj = new URL(url);
    const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            ...options.headers
        },
        rejectUnauthorized: false // Key fix for SSL issues
    };
    
    // Return Promise<Response> compatible object
    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve(new Response(body, {
                    status: res.statusCode || 200,
                    statusText: res.statusMessage || 'OK',
                    headers: Object.fromEntries(
                        Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v || ''])
                    )
                }));
            });
        });
        
        req.on('error', reject);
        req.setTimeout(options.timeout || 30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}
```

### 2. Implementation Priority
1. **High Priority**: Fix SSL bypass in `fetchDirect()` method
2. **Medium Priority**: Add comprehensive error handling for certificate issues
3. **Low Priority**: Add domain-specific SSL bypass detection

### 3. Testing Requirements
After fixing SSL bypass:
1. Test manifest loading from `nuovabibliotecamanoscritta.it`
2. Test IIIF manifest from `nbm.regione.veneto.it`
3. Test high-resolution image downloads
4. Validate PDF generation with sample manuscript

### 4. Alternative Approach
If SSL bypass continues to be problematic, consider:
- Using the working NBM manifest URLs directly
- Implementing a domain-specific proxy service
- Adding user-configurable SSL bypass options

## Technical Details

### Manifest Mapping (Working)
```javascript
const manifestMappings = {
    '14': 'CVII1001',
    '15': 'LXXXIX841',    // Working example
    '12': 'CXLV1331',
    '17': 'msClasseIII81'
};
```

### IIIF Image URL Pattern (Working)
```javascript
const serviceId = resource.service['@id'].replace(/\/$/, '');
const imageUrl = `${serviceId}/full/20000,/0/default.jpg`;
```

### Expected Result
- Manuscript: "LXXXIX (84)"
- Total Pages: 254
- High Resolution: 20000px width maximum
- File Size: ~2-5MB per page (estimated)

## Conclusion

The Verona implementation is architecturally sound but blocked by SSL certificate validation. The fix requires implementing proper SSL bypass for `nuovabibliotecamanoscritta.it` and `nbm.regione.veneto.it` domains using the Node.js `https` module instead of the `fetch` API.

Priority: **Critical** - Affects core functionality for Verona manuscript downloads.