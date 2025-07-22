# MDC Catalonia Resolution Analysis

## Summary
MDC Catalonia is **not providing full resolution** images despite using high-end capture equipment.

## Findings

### Camera Used
- **Hasselblad H4D-200MS** - capable of 200 megapixel captures
- Metadata shows professional digitization at 150 ppp

### Actual Storage
- **Only ~1 megapixel** images are stored on the IIIF server
- Examples:
  - Cover: 948×1340 (1.3MP)
  - f.9r: 836×1264 (1.1MP)  
  - f.16v: 847×1278 (1.1MP)
  - f.39v: 813×1278 (1.0MP)

### Server Behavior
- When requesting larger sizes (e.g., 2000px), the server **upscales** from the 1MP original
- This creates larger files but with **interpolated pixels**, not true detail
- Result: Blurry/soft images at higher resolutions

### Root Cause
MDC Catalonia appears to be storing only low-resolution derivatives (likely for web viewing) rather than the full Hasselblad captures. This is a policy/infrastructure decision by the library.

### Recommendation
Use `full/full` to get the actual stored resolution without upscaling artifacts. While only ~1MP, these will be sharper than upscaled versions.

## Comparison with Other Libraries
- **Library of Congress**: Provides true high-resolution (e.g., 6000×8000px)
- **BNE Spain**: Provides full PDFs with embedded high-res images
- **MDC Catalonia**: Limited to ~1MP despite professional capture equipment

This is a limitation of MDC's digital infrastructure, not our implementation.