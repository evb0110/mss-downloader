# Orléans Library Download Fix Report

## Issue Resolved
Fixed timeout errors when downloading manuscripts from Orléans Médiathèques digital library.

## Previously Failing URL
The following URL was experiencing "Search timeout" errors and is now working:

**https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238**

*Manuscript: "Ouvrages de Pseudo Isidore" (Works of Pseudo Isidore)*

## What Was Fixed
- Extended search timeout from 15 to 30 seconds
- Added smart fallback search strategies for better manuscript discovery
- Improved URL processing to correctly identify manuscript titles
- Enhanced error handling for complex manuscript names

## Result
The Orléans library downloads should now work reliably without timeout errors. The application can successfully find and download manuscripts from the Médiathèques d'Orléans digital collection.

---
*Fixed in version 1.0.66*