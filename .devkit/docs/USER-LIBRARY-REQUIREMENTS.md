# User Library Requirements - Full-Size Downloads

## Libraries That Need Full-Size Implementation

### ✅ Working Libraries (Good Examples)
1. **University of Graz** - PDF generation working
2. **Manuscripta.at** - 28MB PDFs with high-resolution images (2500-2900px width)

### 🔧 Libraries Requiring Full-Size Fixes

### 1. Morgan Library
- **Current Issue**: Only 650x428px low-resolution thumbnails  
- **Full-Size URLs**: `https://host.themorgan.org/facsimile/images/lindau-gospels/76874v_0002-0003.zif?t1751372226771n88`
- **Format**: .zif (Zoomable Image Format) - tiles that need extraction
- **Research Required**: How to get full-size from .zif tiles
- **Test URL**: https://www.themorgan.org/collection/lindau-gospels/thumbs

### 2. NYPL
- **Current Issue**: Still low resolution despite claiming "fixed"
- **Full-Size URLs**: `https://iiif-prod.nypl.org/index.php?id=58514364&t=g`
- **Format**: IIIF with t=g parameter for full-size
- **Test URL**: https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002

### 3. BNC Roma  
- **Current Issue**: Missing PDFs/downloads completely
- **Full-Size URLs**: `http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/2/full`
- **Format**: Direct /full endpoint access
- **Test URL**: http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1

### 4. BDL ServizIRL
- **Current Issue**: Hanging/404 errors, no working downloads
- **Full-Size URLs**: `https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460744/full/max/0/default.jpg`
- **Format**: Cantaloupe IIIF server 
- **Test URL**: https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903

## Success Criteria

### For Each Library:
1. **Actual Downloads**: Real image files downloaded and saved
2. **Full-Size Resolution**: Maximum available resolution, not thumbnails
3. **Valid PDFs**: Multi-page PDFs >100KB with real manuscript content
4. **Poppler Validation**: PDFs must pass poppler validation

### Quality Benchmarks:
- **Manuscripta.at**: 28MB PDFs with 2500-2900px width images (TARGET QUALITY)
- **University of Graz**: 2.4MB PDFs with 1000x1273px images (GOOD QUALITY)
- **Morgan Library**: Should achieve much higher than current 650x428px
- **NYPL**: Should achieve higher than current 515x759px  
- **BNC Roma**: Should achieve ~94KB+ per image
- **BDL**: Should achieve working downloads (currently 0% success)

## Implementation Notes

### Critical Requirements:
- Don't just claim "fixed" - provide actual downloadable artifacts
- Generate real PDFs with proper page counts and sizes
- Use maximum available resolution from each library
- Test with actual manuscript URLs provided
- Validate all artifacts with poppler/file tools

### Validation Protocol:
1. Download 5-10 sample images from each library
2. Verify images contain real manuscript content
3. Check image resolution and file sizes
4. Generate PDF from downloaded images  
5. Validate PDF with poppler tools
6. Store artifacts in validation folders
7. Provide clear before/after comparisons

## Agent Instructions

When working on these libraries:
1. **Research first**: Understand the URL patterns and image formats
2. **Test thoroughly**: Download actual samples to verify resolution
3. **Implement properly**: Update the actual codebase, not just validation scripts
4. **Validate completely**: Generate real PDFs and verify with tools
5. **Don't claim success without artifacts**: Provide downloadable proof

Remember: The user wants to see actual high-resolution PDFs in the validation folder, not just reports claiming success.