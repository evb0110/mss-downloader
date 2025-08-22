# ContentDM Download Best Practices Guide

## Executive Summary

ContentDM (OCLC) servers exhibit specific behavioral patterns that can cause 403 Forbidden errors during bulk downloads. This guide provides comprehensive technical requirements for successful ContentDM manuscript downloads based on research into OCLC server architecture, IIIF implementation, and known limitations.

## ContentDM Server Architecture and Behavior

### Core Characteristics
- **Platform**: OCLC-hosted ContentDM with full IIIF Image and Presentation API support
- **URL Pattern**: `https://server####.contentdm.oclc.org/` where #### is site ID
- **Authentication**: OCLC LDAP-based system with browser session management
- **Session Management**: No explicit logout - relies on browser cache/history clearing
- **Protocol**: HTTPS mandatory for *.oclc.org URLs with automatic redirection

### Known Server Limitations

#### Authentication and Session Issues
- **403 Forbidden Causes**:
  - Incorrect username/password
  - User not in ContentDM Admin > Server > Users list
  - Insufficient collection permissions
  - Missing port 8888 in Catcher URLs
  - Invalid CONTENTdm license information

#### Timeout Behavior
- **Script Timeout**: Minimum 5-minute timeout recommended for all API interactions
- **Collection Export**: Large collections timeout before completion (known issue)
- **Gateway Timeout**: 504 errors occur during metadata export operations

#### Size and Scale Limitations
- **Upload Limits**: 2GB single file limit (Project Client), 64MB (web admin)
- **OAI Harvesting**: PHP-based service with significant slowdown on date-specific criteria
- **Large Collection Issues**: API timeouts on collections with large full-text fields

## IIIF Implementation in ContentDM

### Server Types and URL Patterns

#### Cantaloupe Server (Newer)
```
Image Info: {yourCONTENTdmURL}/digital/iiif/2/{collection alias}:{record ID}/info.json
Image Request: {yourCONTENTdmURL}/digital/iiif/2/{collection alias}:{record ID}/{region}/{size}/{rotation}/{quality}.{format}
```

#### Legacy Server (Older)
```
Image Info: {yourCONTENTdmURL}/digital/iiif/{collection alias}/{record ID}/info.json
Image Request: {yourCONTENTdmURL}/digital/iiif/{collection alias}/{record ID}/{region}/{size}/{rotation}/{quality}.{format}
```

#### Server Detection Method
Test URL: `{yourCONTENTdmURL}/iiif/manifest.json`
- **Cantaloupe**: Auto-redirects to `/iiif/2/manifest.json`
- **Legacy**: URL does not resolve

### Access Controls and Security
- **Collection-level**: Admin-configurable access restrictions
- **Item-level**: Individual item permissions supported
- **IP-based**: Access can be restricted by IP address ranges
- **User-based**: Username/authentication requirements
- **Metadata vs Files**: Separate permissions for metadata access vs file viewing

## Rate Limiting and Anti-Bot Measures

### Current Rate Limiting Status
- **OCLC ContentDM**: No publicly documented rate limits for IIIF endpoints
- **Trust Model**: Operating on institutional trust rather than hard limits
- **Individual Institution Policies**: Libraries may implement their own restrictions

### General IIIF Rate Limiting Patterns
- **Standard Implementation**: 2,000 requests/hour for unauthenticated users
- **Rate Limit Headers**: 
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in window
  - `X-RateLimit-Reset`: Reset timestamp

### Server Resource Protection
- **Image Size Limits**: `maxWidth`, `maxHeight`, `maxArea` parameters
- **DoS Prevention**: Resource exhaustion protection through size limits
- **Concurrent Connection Management**: HTTP/2 recommended for many concurrent requests

## Download Best Practices

### HTTP Headers and Authentication

#### Required Headers
- **User-Agent**: Descriptive user-agent string (include contact email for bulk operations)
- **Accept**: `image/jpeg, image/png, application/json` as appropriate
- **Authorization**: Use appropriate authentication when required

#### Optional but Recommended
- **Referer**: Include when making requests from web applications
- **Cache-Control**: Respect cache directives for repeated requests

#### Example User-Agent
```
Mozilla/5.0 (compatible; ManuscriptDownloader/1.4; +mailto:contact@example.com)
```

### Request Timing and Delays

#### Conservative Approach (Recommended)
- **Delay Between Requests**: 100-500ms minimum
- **Concurrent Requests**: Maximum 2-3 simultaneous connections
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Session Management**: Reuse connections when possible (HTTP Keep-Alive)

#### Aggressive Approach (Use with Caution)
- **Delay Between Requests**: 50-100ms minimum
- **Concurrent Requests**: Maximum 5 simultaneous connections
- **Monitor for 403/429**: Immediately back off if rate limited

### Error Handling and Recovery

#### 403 Forbidden Response Pattern
1. **Initial Success**: First few requests succeed
2. **Sudden Block**: 403 Forbidden appears without warning
3. **Persistent Block**: Retries continue to fail with 403
4. **Potential Causes**:
   - Session timeout or authentication invalidation
   - IP-based rate limiting triggered
   - Server-side connection limits exceeded
   - Anti-bot detection activated

#### Recovery Strategies
1. **Wait Period**: 5-15 minute cooldown before retry
2. **Session Refresh**: Clear browser cache/cookies if using browser-based auth
3. **IP Rotation**: Use different source IP if available
4. **Contact Institution**: Notify library of legitimate bulk download needs

### Bulk Download Implementation

#### Chunking Strategy
- **Batch Size**: Process 10-20 images per batch
- **Inter-batch Delay**: 1-2 second pause between batches
- **Progress Tracking**: Monitor success/failure rates
- **Graceful Degradation**: Fall back to slower requests if errors occur

#### Connection Management
- **HTTP/2 Support**: Use HTTP/2 for concurrent requests when available
- **Connection Pooling**: Reuse connections to minimize overhead
- **Timeout Settings**: 30-60 second request timeout
- **Retry Logic**: Maximum 5 retries with exponential backoff

### IIIF-Specific Considerations

#### Image Request Optimization
- **Tile Requests**: Most traffic comes from tile requests, not full images
- **Size Parameters**: Respect server `maxWidth`, `maxHeight`, `maxArea` limits
- **Quality Settings**: Use appropriate quality setting for intended use
- **Format Selection**: Prefer JPEG for photographs, PNG for line art

#### Manifest Processing
- **Manifest Caching**: Cache IIIF manifests to avoid repeated requests
- **Parallel Processing**: Download images in parallel after manifest parsing
- **Error Tolerance**: Handle missing or invalid image URLs gracefully

## Troubleshooting 403 Errors

### Diagnostic Steps

#### 1. Verify Authentication
- Check username exists in ContentDM Admin > Server > Users
- Verify password accuracy
- Confirm user has collection permissions
- Test authentication with simple API call

#### 2. Network and Protocol Issues
- Ensure HTTPS usage (HTTP may redirect or fail)
- Check for proxy or firewall interference
- Verify DNS resolution of ContentDM server
- Test from different network if possible

#### 3. Request Pattern Analysis
- Monitor request frequency and timing
- Check for concurrent request limits exceeded
- Verify proper HTTP headers included
- Test with minimal delay between requests

#### 4. Server-Specific Issues
- Confirm correct server type (Cantaloupe vs Legacy)
- Test IIIF endpoint accessibility
- Verify collection/item permissions
- Check for server maintenance or downtime

### Error Recovery Protocol

#### Immediate Actions
1. **Stop Current Downloads**: Halt all active requests immediately
2. **Wait Period**: Implement 5-15 minute cooldown
3. **Log Analysis**: Review recent request patterns for triggers
4. **Single Request Test**: Test with single image request

#### Medium-term Actions
1. **Adjust Parameters**: Reduce concurrency and increase delays
2. **Contact Support**: Notify OCLC Support of bulk download needs
3. **Alternative Approach**: Consider using official ContentDM tools
4. **Schedule Downloads**: Spread downloads across multiple sessions/days

## ContentDM API Best Practices

### Official API Usage
- **dmwebservices**: Use official ContentDM API when possible
- **HTTPS Required**: OCLC-hosted sites require HTTPS
- **Format Selection**: Support both XML and JSON responses
- **Function Categories**: Use appropriate application/server/collection/item level functions

### Performance Optimization
- **Field Limitation**: Limit returned fields to improve performance
- **Error Handling**: Handle potential error responses gracefully
- **Connection Reuse**: Maintain persistent connections when possible
- **Caching Strategy**: Cache metadata and manifest responses

## Institutional Courtesy

### Communication Protocol
- **Advance Notice**: Contact library before large bulk downloads
- **Purpose Declaration**: Clearly state intended use of materials
- **Technical Details**: Provide download schedule and volume estimates
- **Ongoing Dialogue**: Maintain communication during download process

### Ethical Considerations
- **Respect Terms of Use**: Adhere to institutional access policies
- **Attribution Requirements**: Follow citation and attribution guidelines
- **Commercial Use**: Obtain explicit permission for commercial applications
- **Bandwidth Consideration**: Avoid peak usage hours when possible

## Implementation Recommendations

### For Florence Manuscript Downloads Specifically
1. **Start Conservative**: Begin with 200ms delays between requests
2. **Monitor Response Patterns**: Watch for early signs of rate limiting
3. **Implement Circuit Breaker**: Stop downloads immediately on first 403
4. **Session Management**: Track authentication state throughout process
5. **Graceful Degradation**: Fall back to slower speeds if issues arise

### Code Implementation Example
```javascript
const downloadWithBackoff = async (url, attempt = 1) => {
  const maxRetries = 5;
  const baseDelay = 100; // ms
  
  try {
    // Add conservative delay
    await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ManuscriptDownloader/1.4 (+mailto:contact@example.com)',
        'Accept': 'image/jpeg, image/png',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000
    });
    
    if (response.status === 403) {
      throw new Error('403_FORBIDDEN');
    }
    
    if (response.status === 429) {
      throw new Error('429_RATE_LIMITED');
    }
    
    return response;
    
  } catch (error) {
    if (attempt < maxRetries && (error.message.includes('403') || error.message.includes('429'))) {
      // Exponential backoff with longer delay for rate limiting
      const retryDelay = error.message.includes('403') ? 300000 : baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return downloadWithBackoff(url, attempt + 1);
    }
    throw error;
  }
};
```

## Conclusion

ContentDM servers require careful handling for bulk downloads due to authentication complexity, session management limitations, and undocumented rate limiting. Success depends on conservative request timing, proper error handling, and institutional communication. The Florence 403 error pattern suggests session-based or IP-based blocking that can be mitigated through longer delays, connection management, and graceful degradation strategies.

---
*Last Updated: August 22, 2024*
*Based on OCLC ContentDM documentation and IIIF community best practices*