# Antivirus False Positive Issue

## Problem
Some antivirus software (Windows Defender, etc.) may flag the application as "Win32 malware gen" or similar. This is a **false positive** common with unsigned Electron applications.

## Why This Happens
- The application is not code-signed with a trusted certificate
- Electron apps can trigger heuristic detection due to their nature
- New/unknown publishers are treated as suspicious

## Solutions for Users

### Option 1: Add to Antivirus Exclusions (Recommended)
1. Open your antivirus software
2. Go to Settings → Exclusions/Whitelist
3. Add the downloaded `.exe` file to exclusions
4. Add the installation folder to exclusions

### Option 2: Temporary Disable Protection
1. Temporarily disable real-time protection
2. Install the application
3. Re-enable protection
4. Add installed app to exclusions

### Option 3: Windows Defender Specific
1. Open Windows Security
2. Go to Virus & threat protection
3. Manage settings under "Virus & threat protection settings"
4. Add exclusions → Add files/folders
5. Select the application file

## For Developers

### Current Status
- Application builds without code signing
- False positives are expected until signing is implemented

### Long-term Solution: Code Signing
1. Purchase code signing certificate from trusted CA (DigiCert, Sectigo, etc.)
2. Configure certificate in build environment
3. Enable signing in `sign-windows.js`
4. Build with certificate - eliminates most false positives

### Alternative Solutions
1. Submit false positive reports to major antivirus vendors
2. Build reputation over time through user installations
3. Use different build configurations to reduce detection

## Cost vs Benefit
- **Code signing certificate**: ~$200-400/year
- **Eliminates**: 90%+ of false positives
- **Users benefit**: No antivirus warnings, professional appearance