# 🔥 ULTRA-PRIORITY FIX for Issue #2

## Root Cause Analysis

After 60+ failed attempts, the REAL issue has been identified:

### The Problem
1. **IPC Timeout on Windows**: The `parse-manuscript-url` IPC handler is timing out on Windows
2. **Error Message**: "Error invoking remote method 'parse-manuscript-url': reply was never sent"
3. **Why Previous Fixes Failed**: All previous fixes focused on the manifest loading logic, but the actual issue is in the IPC communication layer

### Why It Works on Linux but Fails on Windows
- Linux test: 644 pages load in 2 seconds ✅
- Windows: IPC times out with "reply was never sent" ❌
- The SharedManifestLoaders work perfectly - the issue is in Electron's IPC layer

### The Real Issue
The IPC handler is not properly handling async errors and timeouts. When `loadManifest` takes too long or throws an error, the IPC channel doesn't send a reply, causing the "reply was never sent" error.

## Solution Strategy

### Approach A: Fix IPC Error Handling (90% confidence)
1. Add proper try-catch with guaranteed reply
2. Add timeout wrapper with explicit error response
3. Ensure all code paths send a reply

### Approach B: Force Chunked Handler (85% confidence)
1. Always use chunked handler for Graz
2. Cache manifest to avoid repeated loads
3. Add Windows-specific optimizations

### Approach C: Direct SharedManifestLoaders Integration (95% confidence)
1. Bypass the complex adapter chain
2. Use SharedManifestLoaders directly in main process
3. Add proper error boundaries

## Implementation Plan

We'll implement Approach C + A: Direct integration with proper error handling.