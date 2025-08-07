# Geo-Blocked Libraries Documentation

## Overview
As of version 1.5.0, MSS Downloader now provides comprehensive geo-blocking indicators for libraries with geographic access restrictions. This documentation lists all libraries with confirmed or suspected geographic restrictions.

## 🔴 Libraries with Confirmed Geo-Blocking

### Europe
1. **University of Graz (Austria)** 🇦🇹
   - Requires Austrian IP address
   - Error: Access denied outside Austria
   - Solution: Use Austrian VPN

2. **Norwegian National Library** 🇳🇴
   - Many manuscripts require Norwegian IP
   - Error: HTTP 403 for image access
   - Solution: Norwegian VPN required

3. **Grenoble Municipal Library (France)** 🇫🇷
   - Requires French IP address
   - Confirmed by user reports
   - Solution: French VPN needed

4. **Trinity College Cambridge (UK)** 🇬🇧
   - May have geographic restrictions
   - Captcha protection in some regions
   - Solution: UK/EU VPN may help

### Italy 🇮🇹
5. **BDL (Biblioteca Digitale Lombarda)**
   - Some collections require Italian IP
   - Regional restrictions for certain manuscripts
   - Solution: Italian VPN

6. **Florence (ContentDM Plutei)**
   - May require Italian IP for full access
   - Historical manuscripts may be restricted
   - Solution: Italian VPN

7. **Internet Culturale**
   - National platform with regional restrictions
   - Some BNCF collections are geo-blocked
   - Solution: Italian VPN

8. **Verona Library (NBM)**
   - Nuova Biblioteca Manoscritta restrictions
   - May require Italian IP for full access
   - Solution: Italian VPN

### Spain 🇪🇸
9. **BNE (Biblioteca Nacional de España)**
   - Some content requires Spanish IP
   - Historical documents may be restricted
   - Solution: Spanish VPN

10. **MDC Catalonia**
    - Catalan digital collections
    - May require Spanish/Catalan IP
    - Solution: Spanish VPN

## 📊 Statistics
- Total Libraries: 59
- Geo-Blocked Libraries: 10
- Percentage Affected: 16.9%

## Regional Distribution
- Italy: 4 libraries (40%)
- Spain: 2 libraries (20%)
- France: 1 library (10%)
- Austria: 1 library (10%)
- Norway: 1 library (10%)
- UK: 1 library (10%)

## 🛠️ Recommended Solutions

### For Users
1. **VPN Services**: Use a VPN with servers in the library's country
2. **Institutional Access**: Check if your institution has agreements
3. **Contact Libraries**: Some provide temporary access codes
4. **Alternative Sources**: Check if manuscripts are available elsewhere

### Technical Implementation
The app now displays orange "Geo-Restricted" badges for affected libraries in the UI, helping users immediately identify which libraries may require special access methods.

## Visual Indicators
- 🟠 **Orange Badge**: "Geo-Restricted" - Library has known geographic restrictions
- ℹ️ **Hover Tooltip**: Provides specific information about the restrictions

## Updates
This list is maintained based on:
- User reports
- Testing from different geographic locations
- Library documentation
- Community feedback

Last Updated: 2025-08-07