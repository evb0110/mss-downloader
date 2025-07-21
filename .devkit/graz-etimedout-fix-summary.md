# Graz ETIMEDOUT Error Handling Improvements

## Changes Made

1. **Enhanced error messages in loadManifest method**
   - Added specific error handling for ETIMEDOUT errors from University of Graz
   - Added handling for ECONNRESET errors
   - Added handling for timeout-related error messages
   - Provides user-friendly error messages explaining the issue and suggesting solutions

2. **Enhanced error messages in loadGrazManifest method**
   - Added specific error handling for ETIMEDOUT, ECONNRESET, ENOTFOUND errors
   - Added handling for AbortError and generic timeout messages
   - Provides clear guidance about server issues and retry suggestions

3. **Improved fetchWithHTTPS method (already existed)**
   - Pre-existing retry logic for Graz connection timeouts
   - DNS pre-resolution for Graz URLs
   - Extended timeouts and exponential backoff for retries

## Error Messages Added

- ETIMEDOUT: "University of Graz connection timeout. The server is not responding - this may be due to high load or network issues. Please try again later or check if the manuscript is accessible through the Graz website."
- ECONNRESET: "University of Graz connection was reset. The server closed the connection unexpectedly. Please try again in a few moments."
- ENOTFOUND: "University of Graz server could not be reached. Please check your internet connection and verify that unipub.uni-graz.at is accessible."
- Timeout messages: "University of Graz request timed out. Large manuscripts may take longer to load - please try again with patience, as the system allows extended timeouts for Graz manuscripts."