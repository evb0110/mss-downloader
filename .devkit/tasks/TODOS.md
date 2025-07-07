# Project TODOs

## Pending Tasks

1. **MDC Catalonia fetch error fix** 🔄 REQUIRES ROBUST FIX
   - URL: https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1
   - Error: "fetch failed"
   - Status: Partial fix attempted, needs robust implementation
   - Priority: High

2. **Belgica KBR image pattern fix** 🔄 REQUIRES ROBUST FIX
   - URL: https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415
   - Error: "Could not find any working image patterns for this manuscript"
   - Status: Partial fix attempted, needs robust implementation
   - Priority: High

3. **Freiburg image quality verification** 🔄 REQUIRES ROBUST FIX
   - URL: https://dl.ub.uni-freiburg.de/diglit/hs360a/0001
   - Issue: Verify if our download quality matches official PDF quality
   - Status: Partial fix attempted, needs robust implementation
   - Priority: Medium

4. **BNE manifest calculation hanging** 🔄 REQUIRES ROBUST FIX
   - URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
   - Issue: Loads manifest but hangs during calculation
   - Status: Partial fix attempted, needs robust implementation
   - Priority: High

7. **~~UI improvements for larger screens~~** ✅ COMPLETED
   - Make supported libraries popup wider and fit more columns on larger screens
   - Make app window maximized by default (not fullscreen, just maximized to fit screen)
   - Priority: Medium
   - **RESOLVED**: Implemented responsive grid layout for libraries list and window maximization

## New Libraries to Add

### 8. **Grenoble (Гренобль)**
   - Base URL Pattern: `https://pagella.bm-grenoble.fr/ark:/12148/`
   - Manuscript 1: https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom
   - Manuscript 2: https://pagella.bm-grenoble.fr/ark:/12148/btv1b106634178/f3.item.zoom
   - Manuscript 3: https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663416t/f3.item.zoom
   - Status: Pending implementation
   - Priority: High (Gallica-based, easier to implement)

### 9. **Karlsruhe (Карлсруэ)**
   - Base URL Pattern: `https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F`
   - Manuscript 1: https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F3464606%2Fmanifest
   - Manuscript 2: https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F8004874%2Fmanifest
   - Manuscript 3: https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F38819%2Fmanifest
   - Manuscript 4: https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F8229066%2Fmanifest
   - Status: Pending implementation
   - Priority: High (IIIF-based, standard approach)

### 10. **Toronto (Торонто)**
   - Base URL Pattern: `https://collections.library.utoronto.ca/view/fisher2:`
   - Manuscript 1: https://collections.library.utoronto.ca/view/fisher2:F6521
   - Manuscript 2: https://collections.library.utoronto.ca/view/fisher2:F4089
   - Manuscript 3: https://collections.library.utoronto.ca/view/fisher2:165
   - Status: Pending implementation
   - Priority: Medium (requires API analysis)

### 11. **Manchester (Манчестер)**
   - Base URL Pattern: `https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-`
   - MS-LATIN-00074: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00074/1
   - MS-LATIN-00136: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00136/1
   - MS-LATIN-00011: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00011/1
   - MS-LATIN-00022: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00022/1
   - MS-LATIN-00088: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00088/28
   - MS-LATIN-00098: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00098/1
   - MS-LATIN-00009: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00009/9
   - MS-LATIN-00010: https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00010/9
   - Status: Pending implementation
   - Priority: Medium (requires structure analysis)

### 12. **Saint-Omer (Сент-Омер)**
   - Base URL Pattern: `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/`
   - 15 manuscripts including:
     - Collectaire et antiphonaire: https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/22581/?offset=3#page=1&viewer=picture&o=&n=0&q=
     - Antiphonaire Saint-Bertin: https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/18367/?offset=1#page=1&viewer=picture&o=&n=0&q=
     - Multiple Bréviaire and Missel manuscripts
   - Status: Pending implementation
   - Priority: Low (complex system with many manuscripts)

**Total new libraries**: 5 (Grenoble, Karlsruhe, Toronto, Manchester, Saint-Omer)
**Total test manuscripts**: 45+

### Recently Completed (Version 1.3.92)
- ✅ Verona Biblioteca Civica SSL certificate fix
- ✅ University of Freiburg infinite loop page counting fix
- ✅ ICCU Biblioteca Vallicelliana API integration

## Completed Tasks

See [COMPLETED.md](./COMPLETED.md) for full list of completed tasks.