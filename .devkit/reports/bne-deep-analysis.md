# BNE Deep Analysis Report

## Page Analysis Results


### Manuscript 0000007619
- **URL:** https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
- **Page Size:** 15925 bytes
- **Has JavaScript:** true
- **Has AJAX:** false
- **Image URLs Found:** 2
- **PDF Endpoints:** 2
- **API Endpoints:** 0

**Sample Image URLs:**
- bdh-rd.bne.es/viewer.vm?id=0000007619&amp;page=1
- bdh-rd.bne.es/pdf.raw?query=id:0000007619&amp;page=1&amp;jpeg=true

**PDF Endpoints:**
- pdf.raw?query=id:0000007619&amp;page=1&amp;jpeg=true
- pdf.raw?query=id:0000007619&amp;page=1&amp;jpeg=true


### Manuscript 0000060229
- **URL:** https://bdh-rd.bne.es/viewer.vm?id=0000060229&page=1
- **Page Size:** 12314 bytes
- **Has JavaScript:** true
- **Has AJAX:** false
- **Image URLs Found:** 2
- **PDF Endpoints:** 2
- **API Endpoints:** 0

**Sample Image URLs:**
- bdh-rd.bne.es/viewer.vm?id=0000060229&amp;page=1
- bdh-rd.bne.es/pdf.raw?query=id:0000060229&amp;page=1&amp;jpeg=true

**PDF Endpoints:**
- pdf.raw?query=id:0000060229&amp;page=1&amp;jpeg=true
- pdf.raw?query=id:0000060229&amp;page=1&amp;jpeg=true


### Manuscript 0000015300
- **URL:** https://bdh-rd.bne.es/viewer.vm?id=0000015300&page=1
- **Page Size:** 13842 bytes
- **Has JavaScript:** true
- **Has AJAX:** false
- **Image URLs Found:** 2
- **PDF Endpoints:** 2
- **API Endpoints:** 0

**Sample Image URLs:**
- bdh-rd.bne.es/viewer.vm?id=0000015300&amp;page=1
- bdh-rd.bne.es/pdf.raw?query=id:0000015300&amp;page=1&amp;jpeg=true

**PDF Endpoints:**
- pdf.raw?query=id:0000015300&amp;page=1&amp;jpeg=true
- pdf.raw?query=id:0000015300&amp;page=1&amp;jpeg=true


## Image Endpoint Testing


### Manuscript 0000007619

**Successful Endpoints:**
- https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&jpeg=true (image/jpeg, 201908 bytes)
- https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1 (application/pdf, 211995 bytes)

**Failed Endpoints:**
- https://bdh-rd.bne.es/imagen.do?id=0000007619&page=1 (Status: 404)
- https://bdh-rd.bne.es/image.do?id=0000007619&page=1 (Status: 404)
- https://bdh-rd.bne.es/viewer/image?id=0000007619&page=1 (Status: 404)
- https://bdh-rd.bne.es/images/0000007619/page1.jpg (Status: 404)
- https://bdh-rd.bne.es/images/0000007619_001.jpg (Status: 404)
- https://bdh-rd.bne.es/fulltext/0000007619.pdf (Status: 404)
- https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1&format=image (Status: 200)
- https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1&type=jpeg (Status: 200)


### Manuscript 0000060229

**Successful Endpoints:**
- https://bdh-rd.bne.es/pdf.raw?query=id:0000060229&page=1&jpeg=true (image/jpeg, 260996 bytes)
- https://bdh-rd.bne.es/pdf.raw?query=id:0000060229&page=1 (application/pdf, 282581 bytes)

**Failed Endpoints:**
- https://bdh-rd.bne.es/imagen.do?id=0000060229&page=1 (Status: 404)
- https://bdh-rd.bne.es/image.do?id=0000060229&page=1 (Status: 404)
- https://bdh-rd.bne.es/viewer/image?id=0000060229&page=1 (Status: 404)
- https://bdh-rd.bne.es/images/0000060229/page1.jpg (Status: 404)
- https://bdh-rd.bne.es/images/0000060229_001.jpg (Status: 404)
- https://bdh-rd.bne.es/fulltext/0000060229.pdf (Status: 404)
- https://bdh-rd.bne.es/viewer.vm?id=0000060229&page=1&format=image (Status: 200)
- https://bdh-rd.bne.es/viewer.vm?id=0000060229&page=1&type=jpeg (Status: 200)


### Manuscript 0000015300

**Successful Endpoints:**
- https://bdh-rd.bne.es/pdf.raw?query=id:0000015300&page=1&jpeg=true (image/jpeg, 493621 bytes)
- https://bdh-rd.bne.es/pdf.raw?query=id:0000015300&page=1 (application/pdf, 887366 bytes)

**Failed Endpoints:**
- https://bdh-rd.bne.es/imagen.do?id=0000015300&page=1 (Status: 404)
- https://bdh-rd.bne.es/image.do?id=0000015300&page=1 (Status: 404)
- https://bdh-rd.bne.es/viewer/image?id=0000015300&page=1 (Status: 404)
- https://bdh-rd.bne.es/images/0000015300/page1.jpg (Status: 404)
- https://bdh-rd.bne.es/images/0000015300_001.jpg (Status: 404)
- https://bdh-rd.bne.es/fulltext/0000015300.pdf (Status: 404)
- https://bdh-rd.bne.es/viewer.vm?id=0000015300&page=1&format=image (Status: 200)
- https://bdh-rd.bne.es/viewer.vm?id=0000015300&page=1&type=jpeg (Status: 200)


## PDF Download Testing


### Manuscript 0000007619

**PDF Test Results:**
- https://bdh-rd.bne.es/pdf.raw?query=id:0000007619: SUCCESS (application/pdf)
- https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&jpeg=true: FAILED (image/jpeg)
- https://bdh-rd.bne.es/fulltext/0000007619.pdf: FAILED (text/html;charset=ISO-8859-1)
- https://bdh-rd.bne.es/viewer.vm?id=0000007619&format=pdf: FAILED (text/html;charset=UTF-8)


### Manuscript 0000060229

**PDF Test Results:**
- https://bdh-rd.bne.es/pdf.raw?query=id:0000060229: SUCCESS (application/pdf)
- https://bdh-rd.bne.es/pdf.raw?query=id:0000060229&page=1&jpeg=true: FAILED (image/jpeg)
- https://bdh-rd.bne.es/fulltext/0000060229.pdf: FAILED (text/html;charset=ISO-8859-1)
- https://bdh-rd.bne.es/viewer.vm?id=0000060229&format=pdf: FAILED (text/html;charset=UTF-8)


### Manuscript 0000015300

**PDF Test Results:**
- https://bdh-rd.bne.es/pdf.raw?query=id:0000015300: SUCCESS (application/pdf)
- https://bdh-rd.bne.es/pdf.raw?query=id:0000015300&page=1&jpeg=true: FAILED (image/jpeg)
- https://bdh-rd.bne.es/fulltext/0000015300.pdf: FAILED (text/html;charset=ISO-8859-1)
- https://bdh-rd.bne.es/viewer.vm?id=0000015300&format=pdf: FAILED (text/html;charset=UTF-8)


## Key Findings

1. **Page Structure:** All pages use JavaScript
2. **AJAX Usage:** No AJAX detected
3. **Image Endpoints:** 6 successful endpoints found
4. **PDF Support:** PDF downloads available

## Implementation Strategy

Based on the analysis, the recommended approach is:
1. Use discovered image endpoints for direct image access
2. Leverage PDF download endpoints where available
3. Test authentication requirements for image access
4. Implement page count detection mechanism

---

*Generated by BNE Deep Analysis Agent*
