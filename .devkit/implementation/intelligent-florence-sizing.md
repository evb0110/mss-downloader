# Intelligent Page Size Determination for Florence ContentDM Manuscripts

## Problem Analysis

The current Florence loader hardcodes maximum resolution (6000px width) which causes:
- 403 Forbidden errors on manuscripts with access restrictions
- Server overload on high-resolution requests
- No fallback strategy when maximum resolution fails

**Current problematic code (line 239):**
```typescript
return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`;
```

## Intelligent Sizing Algorithm

### Size Preference Hierarchy (High to Low Quality)
1. **6000px** - Maximum quality (if server allows)
2. **4000px** - High quality fallback
3. **2048px** - Standard high quality
4. **1024px** - Medium quality
5. **800px** - Basic quality (universal fallback)

### Error Handling Strategy
- **403 Forbidden**: Try next smaller size immediately
- **404 Not Found**: Try next smaller size immediately
- **Network/Timeout**: Retry same size once, then fallback
- **500+ Server Errors**: Wait and retry once, then fallback

### Implementation Features
1. **Per-Manuscript Caching**: Remember successful resolution for each manuscript
2. **Progressive Fallback**: Test sizes in order until one works
3. **Smart Retries**: Different retry logic for different error types
4. **Performance Logging**: Track which sizes work for which manuscripts
5. **User Transparency**: Log resolution decisions for debugging

## Benefits
- **Prevents 403 errors** with graceful fallbacks
- **Maximizes quality** while respecting server limits
- **Improves reliability** with smart error handling
- **Maintains performance** with caching and fast fallbacks
- **User-friendly logging** explains resolution choices