# Project TODOs

## Pending Tasks

1. **E-Manuscripta Basel** - Fix multi-block manuscript handling
    - URLs:
      - https://www.e-manuscripta.ch/bau/content/titleinfo/5157222 (main issue)
      - https://www.e-manuscripta.ch/bau/content/thumbview/5157616
      - https://www.e-manuscripta.ch/bau/content/thumbview/5157228
      - https://www.e-manuscripta.ch/bau/content/thumbview/5157615
    - Issue: Only downloads first block of pages. Manuscript is split into blocks with different URLs:
      - Universitätsbibliothek Basel / Statuta et Consuetudines... [1-20]
      - Universitätsbibliothek Basel / Statuta et Consuetudines... [8-27]
      - ... continuing to [404-423]
    - Type: Multi-part manuscript handling issue

6. **BVPB (Biblioteca Virtual del Patrimonio Bibliográfico)** - Add new library support
    - URLs:
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22211
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000059
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000048
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=26408
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8540
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8546
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000299
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8568
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8567
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8566
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8526
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8547
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000078
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000547
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000606
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000104
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000026
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22224
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22226
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=8504
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000579
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000008
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000053
      - https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000054
    - Issue: New library - needs implementation for Spanish heritage library viewer
    - Type: Spanish historical manuscripts and patrimony documents

7. **BVPB Pagination Bug Fix** - Fix incomplete page downloads
    - URL: https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651
    - Issue: Only downloads first 12 pages instead of all available pages (не переходит дальше по сайту, где остальное лежит)
    - Required: Download 15 pages minimum and verify merged PDF using validation protocol
    - Type: Pagination/navigation issue

## Completed Tasks

See [COMPLETED.md](./COMPLETED.md) for full list of completed tasks.