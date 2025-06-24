# TODOs

## Pending Tasks

- Florence (Internet Culturale) splits file into parts but then hangs - need to fix hanging issue during download process

https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI

- Add support for BDL (Biblioteca Digitale Lombarda) manuscript library with IIIF endpoint integration

Test URLs:
https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903#mode/2up
https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3904#mode/2up

Full-size images available at IIIF endpoint:
https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460776/full/,567/0/default.jpg
https://www.bdl.servizirl.it/cantaloupe//iiif/2/1460973/full/,567/0/default.jpg

- Add support for Monte Cassino manuscript library with IIIF integration - need to determine correct URL format for downloads

Source catalog URLs:
https://manus.iccu.sbn.it/cnmd/0000313047
https://manus.iccu.sbn.it/cnmd/0000396781
https://manus.iccu.sbn.it/cnmd/0000313194

IIIF manifests and sample images:
https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest
https://omnes.dbseret.com/montecassino/iiif/2/IT-FR0084_0339_0133_pa_0129/full/136,/0/default.jpg

https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0271/manifest
https://omnes.dbseret.com/montecassino/iiif/2/IT-FR0084_0271_0006_pa_0002/full/136,/0/default.jpg

https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0023/manifest
https://omnes.dbseret.com/montecassino/iiif/2/IT-FR0084_0023_0007_pa_0001/full/136,/0/default.jpg

- Add support for Vallicelliana Library (Rome) - same ICCU platform as Monte Cassino but different URL patterns

Complex source URL (search result):
https://manus.iccu.sbn.it/risultati-ricerca-manoscritti/-/manus-search/detail/646207?struct%3A7007=ricerca.parole_tutte%3A4%3D6&filter%3A31%3AAnno_manoscritto%3A2%3A4=1115&struct%3A1016=ricerca.parole_tutte%3A4%3D6&struct%3A4091=ricerca.parole_tutte%3A4%3D6&struct%3A3041=ricerca.parole_tutte%3A4%3D6&struct%3A5003=ricerca.parole_tutte%3A4%3D6&struct%3A5005=ricerca.parole_tutte%3A4%3D6&struct%3A5004=ricerca.parole_tutte%3A4%3D6&struct%3A5091=ricerca.parole_tutte%3A4%3D6&fieldstruct%5B0%5D=ricerca.parole_tutte%3A4%3D6&fieldaccess%5B0%5D=nome_t%3A1003&struct%3A20044=ricerca.parole_tutte%3A4%3D6&struct%3A4=ricerca.parole_tutte%3A4%3D6&struct%3A20046=ricerca.parole_tutte%3A4%3D6&struct%3A9041=ricerca.parole_tutte%3A4%3D6&struct%3A5041=ricerca.parole_tutte%3A4%3D6&&item%3A4088%3Afondi%5B%5D=Biblioteca+Vallicelliana%7C%7C%7CIT-RM0281%7C%7C%7CRoma%7C%7C%7CManoscritti&struct:4088=ricerca.frase:4=1

Manifest URL patterns found:
DAM format:
https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest
https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest
https://dam.iccu.sbn.it/mol_46/containers/egpkGYa/manifest
https://dam.iccu.sbn.it/mol_46/containers/eEqPBke/manifest
https://dam.iccu.sbn.it/mol_46/containers/e169Pja/manifest
https://dam.iccu.sbn.it/mol_46/containers/ejYn4Bd/manifest

JMMS format:
https://jmms.iccu.sbn.it/jmms/metadata/VFdGblZHVmpZU0F0SUVsRFExVV8_/b2FpOnd3dy5pbnRlcm5ldGN1bHR1cmFsZS5zYm4uaXQvVGVjYToyMDpOVDAwMDA6Q05NRFxcMDAwMDAxNjQxOQ__/manifest.json
https://jmms.iccu.sbn.it/jmms/metadata/VFdGblZHVmpZU0F0SUVsRFExVV8_/b2FpOnd3dy5pbnRlcm5ldGN1bHR1cmFsZS5zYm4uaXQvVGVjYToyMDpOVDAwMDA6Q05NRFxcMDAwMDAxNjI5NQ__/manifest.json
https://jmms.iccu.sbn.it/jmms/metadata/VFdGblZHVmpZU0F0SUVsRFExVV8_/b2FpOnd3dy5pbnRlcm5ldGN1bHR1cmFsZS5zYm4uaXQvVGVjYToyMDpOVDAwMDA6Q05NRFxcMDAwMDAxNzE3Nzc_/manifest.json

- Add support for Verona Biblioteca Manoscritta (Veneto Region) - complex interface needs investigation for proper download URLs

Source URLs (complex interface):
https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15
https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=15&volume=1

https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14
https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=14&volume=1

IIIF Manifests found:
https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json
https://nbm.regione.veneto.it/documenti/mirador_json/manifest/CVII1001.json

## Usage

When user says "todo: [task]" → Add to "Pending Tasks" section
When user says "handle todos" → Process first pending task, then move to TODOS-COMPLETED.md when complete

<!-- All completed tasks moved to TODOS-COMPLETED.md -->