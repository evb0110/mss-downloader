# University of Graz ETIMEDOUT Fix Analysis

## Problem
User reports ETIMEDOUT errors when trying to download Graz manuscripts:
- Error: "connect ETIMEDOUT 212.232.30.164:443"
- Both URLs fail with the same error
- The IIIF endpoints work fine when tested directly

## Root Cause Analysis
1. The ETIMEDOUT is happening at the TCP connection level (port 443)
2. The IP address 212.232.30.164 is the Graz server
3. Direct tests show the server is reachable and returns data quickly
4. The issue appears to be with how the Electron app establishes HTTPS connections

## Current Implementation Issues
1. `fetchWithHTTPS` has a fixed 30-second initial connection timeout
2. No retry logic at the connection establishment level
3. No DNS resolution fallback
4. No handling for transient network issues

## Proposed Fix
1. Add connection retry logic with exponential backoff
2. Implement DNS resolution fallback
3. Add more granular timeout settings for connection vs data transfer
4. Add specific ETIMEDOUT handling for Graz URLs