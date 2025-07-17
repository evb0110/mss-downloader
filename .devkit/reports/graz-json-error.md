# University of Graz JSON Parsing Error Investigation

## Summary
The JSON parsing error "Unexpected token '', is not valid JSON" occurs because the `fetchWithHTTPS` method requests gzip compression but doesn't decompress the response before returning it.

## Root Cause
1. The `fetchWithHTTPS` method includes `'Accept-Encoding': 'gzip, deflate, br'` in headers
2. The Graz server responds with gzipped content when requested
3. The method returns the raw gzipped buffer as the response body
4. When `response.json()` is called, it tries to parse gzipped binary data as JSON, causing the error

## Evidence
Our test script shows:
- Direct HTTPS requests without compression headers work fine
- node-fetch automatically handles gzip decompression
- Custom HTTPS implementation with gzip handling works correctly
- The manifest URL returns valid JSON (289KB, 405 pages)

## Solution
The `fetchWithHTTPS` method needs to:
1. Check the `content-encoding` header in the response
2. Decompress gzipped/deflated content using Node.js zlib module
3. Return the decompressed content in the Response object

## Implementation
Add decompression logic to `fetchWithHTTPS`:

```javascript
res.on('end', () => {
    let body = Buffer.concat(chunks);
    
    // Handle compression
    const encoding = res.headers['content-encoding'];
    if (encoding === 'gzip') {
        const zlib = require('zlib');
        body = zlib.gunzipSync(body);
    } else if (encoding === 'deflate') {
        const zlib = require('zlib');
        body = zlib.inflateSync(body);
    }
    // br (brotli) would require additional handling
    
    // Create response with decompressed body
    const response = new Response(body, {
        status: res.statusCode || 200,
        statusText: res.statusMessage || 'OK',
        headers: responseHeaders
    });
    
    resolve(response);
});
```

## Why This Affects Windows More
- Different network configurations may result in different Accept-Encoding negotiation
- Windows users might have different proxy/firewall settings affecting compression
- The issue is not Windows-specific but depends on whether the server chooses to compress the response

## Libraries Affected
All libraries using `fetchWithHTTPS`:
- University of Graz
- Verona (nuovabibliotecamanoscritta.it, nbm.regione.veneto.it)
- Grenoble (pagella.bm-grenoble.fr)
- MDC Catalonia (mdc.csuc.cat)

## Fix Applied
The `fetchWithHTTPS` method has been updated to handle gzip, deflate, and brotli compression:
1. Detects content-encoding header
2. Decompresses the response body using zlib
3. Removes content-encoding header after decompression
4. Falls back to original body if decompression fails

## Test Results
Successfully tested with University of Graz:
- ✓ IIIF manifest loads correctly (405 pages)
- ✓ JSON parsing works without errors
- ✓ Image downloads work properly
- ✓ Gzip decompression handles 289KB manifests correctly