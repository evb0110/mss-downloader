# BNC Roma Server Infrastructure Investigation Report

**Investigation Date:** July 3, 2025  
**Agent:** Agent 2  
**Target:** digitale.bnc.roma.sbn.it  

## Executive Summary

The BNC Roma digital library server (digitale.bnc.roma.sbn.it) is experiencing **complete network unreachability** from external networks. This appears to be a systematic infrastructure issue affecting the entire server, not just specific services.

## Network Diagnostic Results

### Primary Target Analysis
- **Host:** digitale.bnc.roma.sbn.it
- **IP Address:** 193.206.215.125
- **Status:** COMPLETELY UNREACHABLE

### Connectivity Tests
| Test Type | Result | Details |
|-----------|---------|---------|
| Ping | FAILED | 100% packet loss (4 packets) |
| HTTP (Port 80) | FAILED | Connection timeout after 6.6s |
| HTTPS (Port 443) | FAILED | Connection timeout after 10s |
| Telnet | FAILED | Network unreachable |
| curl HTTP | FAILED | Connection timeout |
| curl HTTPS | FAILED | Connection timeout |

### Network Infrastructure Analysis

#### DNS Resolution
- **Status:** WORKING CORRECTLY
- **Primary DNS:** Resolves to 193.206.215.125
- **Google DNS (8.8.8.8):** Resolves to 193.206.215.125
- **Cloudflare DNS (1.1.1.1):** Resolves to 193.206.215.125
- **Conclusion:** DNS is not the issue

#### Network Routing
Traceroute shows packets successfully reach the GARR network infrastructure:
```
10  consortiumgarr-ic-383798.ip.twelve99-cust.net (62.115.35.149)  76.681 ms
```
- **Last Hop:** GARR network edge (62.115.35.149)
- **Final Destination:** 193.206.215.125 (NOT REACHED)
- **Conclusion:** Traffic reaches GARR network but fails at final destination

#### WHOIS Information
- **Network Block:** 193.206.215.0/24
- **Organization:** Biblioteca Nazionale Centrale di Roma
- **ISP:** GARR (Italian academic and research network)
- **Abuse Contact:** cert@garr.it
- **Last Modified:** October 9, 2023

## Alternative Access Method Testing

### Related BNC Roma Services Status
| Service | URL | Status | Notes |
|---------|-----|--------|-------|
| Main Website | www.bncrm.beniculturali.it | WORKING | Different IP (2.42.228.236) |
| Online Services | servizionline.bnc.roma.sbn.it | WORKING | Different IP (193.206.215.11) |
| Digital Library | digitale.bnc.roma.sbn.it | FAILED | Target IP (193.206.215.125) |

### Key Findings
1. **Main BNC Roma website** (www.bncrm.beniculturali.it) is accessible but uses different infrastructure
2. **Online services** (servizionline.bnc.roma.sbn.it) are working on IP 193.206.215.11
3. **Only the digital library server** (193.206.215.125) is completely unreachable

## Infrastructure Change Research

### DNS Management
- **SOA Record:** dns1.sbn.it (193.206.221.108)
- **SOA Serial:** 2024062601 (last updated June 26, 2024)
- **DNS Server Status:** Also unreachable (100% packet loss)

### Network Provider Analysis
- **Provider:** GARR (Italian academic and research network)
- **Network Segment:** 193.206.0.0/16
- **Route Origin:** AS137 (GARR)
- **Abuse Contact:** cert@garr.it

### Recent Maintenance History
Based on web search results:
- **October 26, 2024:** Network maintenance affecting online services
- **October 9, 2024:** 6-8 PM maintenance window affecting multiple services
- **General Pattern:** Regular maintenance windows for network infrastructure

## Scope of Server Issues

### Affected Services
- ✅ **WORKING:** Main BNC Roma website (different server)
- ✅ **WORKING:** Online services (different server in same network)
- ❌ **FAILED:** Digital library server (target server)
- ❌ **FAILED:** SBN DNS server (related infrastructure)

### Network Isolation Analysis
The issue appears to be **server-specific** rather than network-wide:
- Other servers in the same 193.206.215.x subnet are working
- GARR network routing is functional
- DNS resolution is working correctly

## Root Cause Analysis

### Most Likely Scenarios
1. **Server Hardware Failure:** The physical server may be offline
2. **Firewall/Security Policy:** New firewall rules blocking external access
3. **Network Configuration Change:** Server networking misconfiguration
4. **Planned Maintenance:** Extended maintenance window not publicly announced

### Evidence Supporting Server-Specific Issue
- Complete network unreachability (all ports, all protocols)
- DNS resolution works (server record exists)
- Other BNC Roma services operational
- Network routing reaches GARR infrastructure

## Recommended Solutions

### Immediate Actions
1. **Contact GARR Technical Support:** cert@garr.it
2. **Contact BNC Roma IT Department:** 
   - Email: bnc-rm.digitallibrary@beniculturali.it
   - Phone: +39 06 4989279 (Andrea Giuliano, Technical Contact)

### Alternative Access Research
1. **Check for service announcements** on www.bncrm.beniculturali.it
2. **Monitor DNS changes** for potential IP address updates
3. **Test alternative endpoints** within the same network range

### Technical Workarounds
Currently **no technical workarounds available** due to complete server unreachability.

## Monitoring Recommendations

### Ongoing Monitoring
- **DNS Changes:** Monitor for IP address updates
- **Network Reachability:** Periodic ping tests
- **Service Announcements:** Check official BNC Roma channels

### Escalation Timeline
- **Day 1-2:** Monitor for automatic recovery
- **Day 3-5:** Escalate to GARR and BNC Roma contacts
- **Day 6+:** Consider alternative manuscript sources

## Conclusion

The BNC Roma digital library server is experiencing a **complete infrastructure failure** affecting network connectivity. This is not a service-level issue but a fundamental network/server problem requiring intervention from either GARR network operations or BNC Roma technical staff.

**Status:** CRITICAL - Complete service unavailability  
**Impact:** All manuscript download functionality from BNC Roma disabled  
**Resolution:** Requires infrastructure-level intervention  

---
*Investigation completed by Agent 2 - Network Infrastructure Analysis*